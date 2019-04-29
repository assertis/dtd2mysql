import AdmZip = require("adm-zip");
import {CLICommand} from "./CLICommand";
import {FeedConfig, viewsSqlFactory} from "../../config";
import {FeedFile} from "../feed/file/FeedFile";
import {MySQLSchema} from "../database/MySQLSchema";
import {DatabaseConnection} from "../database/DatabaseConnection";
import * as path from "path";
import {MySQLTable} from "../database/MySQLTable";
import * as memoize from "memoized-class-decorator";
import fs = require("fs-extra");
import {MultiRecordFile} from "../feed/file/MultiRecordFile";
import {RecordWithManualIdentifier} from "../feed/record/FixedWidthRecord";
import {MySQLStream, TableIndex} from "../database/MySQLStream";
import byline = require("byline");
import streamToPromise = require("stream-to-promise");
import {faresView} from "../../config/fares/views";
import {OfflineDataProcessor} from "../database/OfflineDataProcessor";

const getExt = filename => path.extname(filename).slice(1).toUpperCase();
const readFile = filename => byline.createStream(fs.createReadStream(filename, "utf8"));

/**
 * Imports one of the feeds
 */
export class ImportFeedCommand implements CLICommand {

  private index: {[name: string]: MySQLTable} = {};
  
  constructor(
    protected readonly db: DatabaseConnection,
    protected readonly files: FeedConfig,
    protected readonly tmpFolder: string,
    protected readonly offlineDataProcessor: OfflineDataProcessor
  ) { }

  protected get fileArray(): FeedFile[] {
    return Object.values(this.files);
  }

  /**
   * Do the import and then shut down the connection pool
   */
  public async run(argv: string[]): Promise<void> {
    try {
      await this.doImport(argv[3]);
      const viewsQuery = this.offlineDataProcessor.getViews();
      if(viewsQuery) {
        console.log(`[INFO] Applying views SQL to original table.`);
        await this.db.query(
          viewsQuery
        );
      }
    }
    catch (err) {
      console.error(err);
    }

    return this.end();
  }

  /**
   * Extract the zip, set up the schema and do the inserts
   */
  public async doImport(filePath: string): Promise<void> {
    console.log(`Extracting ${filePath} to ${this.tmpFolder}`);
    fs.emptyDirSync(this.tmpFolder);

    new AdmZip(filePath).extractAllTo(this.tmpFolder);

    const zipName = path.basename(filePath);

    // if the file is a not an incremental, reset the database schema
    if (zipName.charAt(4) !== "C") {
      await Promise.all(this.fileArray.map(file => this.setupSchema(file)));
      await this.createLastProcessedSchema();
    }

    if (this.files["CFA"] instanceof MultiRecordFile) {
      await this.setLastScheduleId();
      this.ensureALFExists(zipName.substring(0, zipName.length - 4));
    }

    await Promise.all(
      fs.readdirSync(this.tmpFolder)
        .filter(filename => this.getFeedFile(filename))
        .map(filename => this.processFile(filename))
    );

    await this.updateLastFile(zipName);


  }

  /**
   * Drop and recreate the tables
   */
  protected async setupSchema(file: FeedFile): Promise<void> {
    await Promise.all(this.schemas(file).map(schema => schema.dropSchema()));
    await Promise.all(this.schemas(file).map(schema => schema.createSchema()));
  }

  /**
   * Create the last_file table (if it doesn't already exist)
   */
  private createLastProcessedSchema(): Promise<void> {
    return this.db.query(`
      CREATE TABLE IF NOT EXISTS log ( 
        id INT(11) unsigned not null primary key auto_increment, 
        filename VARCHAR(12), 
        processed DATETIME 
      )
    `);
  }

  /**
   * Set the last schedule ID in the CFA record
   */
  private async setLastScheduleId(): Promise<void> {
    const [[lastSchedule]] = await this.db.query("SELECT id FROM schedule ORDER BY id desc LIMIT 1");
    const lastId = lastSchedule ? lastSchedule.id : 0;
    const cfaFile = this.files["CFA"] as MultiRecordFile;
    const bsRecord = cfaFile.records["BS"] as RecordWithManualIdentifier;

    bsRecord.lastId = lastId;
  }

  private ensureALFExists(filename): void {
    if (!fs.existsSync(this.tmpFolder + filename + ".alf")) {
      fs.copyFileSync(__dirname + "/../../config/timetable/data/fixed.alf", this.tmpFolder + "fixed.alf");
    }
  }

  private updateLastFile(filename: string): Promise<void> {
    return this.db.query("INSERT INTO log (filename,processed) VALUES (?, NOW())", [filename]);
  }

  /**
   * Process the records inside the given file
   */
  private async processFile(filename: string): Promise<any> {
    const file = this.getFeedFile(filename);
    const tables = await this.tables(file);
    const tableStream = new MySQLStream(filename, file, tables);
    const stream = readFile(this.tmpFolder + filename).pipe(tableStream);

    try {
      await streamToPromise(stream);

      console.log(`Finished processing ${filename}`);
    }
    catch (err) {
      console.error(`Error processing ${filename}`);
      console.error(err);
    }
  }

  @memoize
  private getFeedFile(filename: string): FeedFile {
    return this.files[getExt(filename)];
  }

  @memoize
  private schemas(file: FeedFile): MySQLSchema[] {
    return file.recordTypes.map(record => new MySQLSchema(this.db, record));
  }

  @memoize
  protected async tables(file: FeedFile): Promise<TableIndex> {
    for (const record of file.recordTypes) {
      if (!this.index[record.name]) {
        const db = record.orderedInserts ? await this.db.getConnection() : this.db;

        this.index[record.name] = new MySQLTable(db, record.name);
      }
    }

    return this.index;
  }

  /**
   * Close the underling database connection
   */
  public end(): Promise<void> {
    Object.values(this.index).forEach(table => table.close());
    return this.db.end();
  }

}
