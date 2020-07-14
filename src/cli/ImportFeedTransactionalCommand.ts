import AdmZip = require("adm-zip");
import { CLICommand } from "./CLICommand";
import { FeedConfig } from "../../config";
import { FeedFile } from "../feed/file/FeedFile";
import { MySQLSchema } from "../database/MySQLSchema";
import { DatabaseConnection } from "../database/DatabaseConnection";
import * as path from "path";
import * as memoize from "memoized-class-decorator";
import fs = require("fs-extra");
import { MultiRecordFile } from "../feed/file/MultiRecordFile";
import { RecordWithManualIdentifier } from "../feed/record/FixedWidthRecord";
import { MySQLStream, TableIndex } from "../database/MySQLStream";
import byline = require("byline");
import streamToPromise = require("stream-to-promise");
import { MySQLTmpTable } from '../database/MySQLTmpTable';
import {ImportFeedCommand} from "./ImportFeedCommand";
import {MySQLTable} from "../database/MySQLTable";

const getExt = filename => path.extname(filename).slice(1).toUpperCase();
const readFile = filename => byline.createStream(fs.createReadStream(filename, "utf8"));

export interface ImportFeedTransactionalCommandInterface {
  doImport(filePaths: string[]): Promise<void>;

  sanityChecks(): Promise<void>;

  commit(): Promise<void>;

  rollback(): Promise<void>;

  end(): Promise<void>
}

/**
 * Imports one of the feeds
 */
export class ImportFeedTransactionalCommand implements CLICommand, ImportFeedTransactionalCommandInterface {

  private index: { [name: string]: MySQLTmpTable } = {};
  private lastProcessedFile: string | null = null;

  constructor(
    protected readonly db: DatabaseConnection,
    protected readonly files: FeedConfig,
    protected readonly tmpFolder: string,
    protected readonly sanityChecksList: string[]
  ) {
  }

  /**
   * Do the import and then shut down the connection pool
   */
  public async run(argv: string[]): Promise<void> {
    try {
      await this.doImport([argv[3]]);
    } catch (err) {
      console.error(err);
    }

    return await this.end();
  }

  /**
   * Extract the zip, set up the schema and do the inserts
   */
  public async doImport(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      await this.importSingleFile(filePath);
      if (this.lastProcessedFile !== null) {
        await this.updateLastFile(this.lastProcessedFile);
      }
    }

  }

  public async sanityChecks(): Promise<void> {
    for(const check of this.sanityChecksList) {
      const [[result]] = await this.db.query(check);
      if (result !== undefined && result.length > 0) {
        throw new Error(`Sanity check failure =>  ${check} results are => ${JSON.stringify(result)}`);
      }
    }
  }

  public async commit(): Promise<void> {
    await Promise.all(
      Object.values(this.index)
            .map(table => table.persist())
    );
    console.log("Data persisted");
  }

  public async rollback(): Promise<void> {
    await Promise.all(
      Object.values(this.index).map(table => table.revert())
    );
    console.log("Import aborted!");
  }

  private async importSingleFile(filePath: string): Promise<void> {
    console.log(`Extracting ${filePath} to ${this.tmpFolder}`);
    fs.emptyDirSync(this.tmpFolder);

    new AdmZip(filePath).extractAllTo(this.tmpFolder);

    const zipName = path.basename(filePath);
    console.log(zipName);
    // if the file is a not an incremental, reset the database schema
    const isIncremental = zipName.charAt(4) === "C";

    if (this.files["CFA"] instanceof MultiRecordFile) {
      await this.setLastScheduleId();
      this.ensureALFExists(zipName.substring(0, zipName.length - 4));
    }

    // no, we can't squeeze those 2 Promise.all() into single one.
    await Promise.all(fs.readdirSync(this.tmpFolder)
                        .filter(filename => this.getFeedFile(filename))
                        .map(filename => this.writeFileData(filename, isIncremental)));

    await Promise.all(Object.values(this.index).map(table => table.flushAll()));
    this.lastProcessedFile = zipName;
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
   * Drop and recreate the tables
   */
  protected async setupSchema(file: FeedFile): Promise<void> {
    await Promise.all(this.schemas(file).map(schema => schema.dropSchema()));
    await Promise.all(this.schemas(file).map(schema => schema.createSchema()));
  }

  protected get fileArray(): FeedFile[] {
    return Object.values(this.files);
  }

  /**
   * Process the records inside the given file
   */
  private async writeFileData(filename: string, isIncremental: boolean): Promise<any> {
    const file = this.getFeedFile(filename);
    const tables = await this.tables(file, isIncremental);
    const tableStream = new MySQLStream(filename, file, tables);
    const stream = readFile(this.tmpFolder + filename).pipe(tableStream);

    try {
      await streamToPromise(stream);

      console.log(`Finished processing ${filename}`);
    } catch (err) {
      console.error(`Error during processing ${filename}`);
      console.error(err);
      throw err;
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
  protected async tables(file: FeedFile, isIncremental: boolean): Promise<TableIndex> {
    for (const record of file.recordTypes) {
      if (!this.index[record.name]) {
        const db = record.orderedInserts ? await this.db.getConnection() : this.db;

        this.index[record.name] = await MySQLTmpTable.create(db, record.name, isIncremental);
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

    return this.db.end();
  }

}
