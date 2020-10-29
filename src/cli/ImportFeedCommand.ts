import AdmZip = require("adm-zip");
import {CLICommand} from "./CLICommand";
import {FeedConfig} from "../../config";
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
    private readonly xFilesFolder?: string,
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
    }
    catch (err) {
      console.error(err);
    }

    return await this.end();
  }

  /**
   * Extract the zip, set up the schema and do the inserts
   */
  public async doImport(filePath: string): Promise<void> {
    console.log('Importing using ImportFeedCommand');

    console.log(`Extracting ${filePath} to ${this.tmpFolder}`);
    fs.emptyDirSync(this.tmpFolder);

    new AdmZip(filePath).extractAllTo(this.tmpFolder);

    const zipName = path.basename(filePath);
    const isIncremental = zipName.charAt(4) === "C";

    // if the file is a not an incremental, reset the database schema
    if (!isIncremental) {
      await Promise.all(this.fileArray.map(file => this.setupSchema(file)));
      await this.createLastProcessedSchema();
    }

    if (this.files["CFA"] instanceof MultiRecordFile) {
      await this.setLastScheduleId();
      this.ensureALFExists(zipName.substring(0, zipName.length - 4));
    }

    await this.importDirectory(this.tmpFolder);

    if (this.files["CFA"] instanceof MultiRecordFile) {
      await this.removeOrphanStopTimes();
    }

    await this.updateLastFile(zipName);

    // We import X-files only with the full update of the timetable feed
    if (this.xFilesFolder !== undefined && !isIncremental) {
      console.log(`Importing X-Files from "${this.xFilesFolder}" - is incremental: ${isIncremental ? 'yes' : 'no'}`);
      await this.importDirectory(this.xFilesFolder);
    } else {
      console.log(`Skipping X-Files import from "${this.xFilesFolder}" - is incremental: ${isIncremental ? 'yes' : 'no'}`);
    }
  }

  private async importDirectory(path: string): Promise<void> {
    // no, we can't squeeze those 2 Promise.all() into single one.
    await Promise.all(
      fs.readdirSync(path)
        .filter(filename => this.getFeedFile(filename))
        .map(filename => this.processFile(filename))
    );

    await Promise.all(Object.values(this.index).map(table => table.flushAll()));
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

  private async removeOrphanStopTimes() {
    return Promise.all([
      this.db.query("DELETE FROM stop_time WHERE schedule NOT IN (SELECT id FROM schedule)"),
      this.db.query("DELETE FROM schedule_extra WHERE schedule NOT IN (SELECT id FROM schedule)")
    ]);
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
  public async end(): Promise<void> {
    await Promise.all(
      Object.values(this.index).map(table => table.close())
    );

    return await this.db.end();
  }

}
