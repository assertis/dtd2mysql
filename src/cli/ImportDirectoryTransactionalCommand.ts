import * as path from "path";
import * as memoize from "memoized-class-decorator";
import fs = require("fs-extra");
import byline = require("byline");
import streamToPromise = require("stream-to-promise");
import {CLICommand, ImportFeedTransactionalCommandInterface} from ".";
import {FeedConfig} from "../../config";
import {FeedFile} from "../feed/file/FeedFile";
import {MySQLSchema} from "../database/MySQLSchema";
import {DatabaseConnection} from "../database/DatabaseConnection";
import {MySQLStream, TableIndex} from "../database/MySQLStream";
import {MySQLTmpTable} from '../database/MySQLTmpTable';

const getExt = filename => path.extname(filename).slice(1).toUpperCase();
const readFile = filename => byline.createStream(fs.createReadStream(filename, "utf8"));

/**
 * Imports one of the feeds
 */
export class ImportDirectoryTransactionalCommand implements CLICommand, ImportFeedTransactionalCommandInterface {

  protected index: { [name: string]: MySQLTmpTable } = {};

  constructor(
    protected readonly db: DatabaseConnection,
    protected readonly files: FeedConfig,
    protected readonly tmpFolder: string,
    private readonly sanityChecksList: {},
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
    console.log('Importing using ImportDirectoryTransactionalCommand');

    for (const filePath of filePaths) {
      await this.importDirectory(filePath, true);
    }

  }

  public async sanityChecks(): Promise<void> {
    for (const check in this.sanityChecksList) {
      const [[result]] = await this.db.query(this.sanityChecksList[check]);
      if (result !== undefined && result.length > 0) {
        throw new Error(`Sanity check failure =>  ${check} `);
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

  protected async importDirectory(path: string, isIncremental: boolean): Promise<void> {
    // no, we can't squeeze those 2 Promise.all() into single one.
    await Promise.all(fs.readdirSync(path)
      .filter(filename => this.getFeedFile(filename))
      .map(filename => this.writeFileData(path, filename, isIncremental)));

    await Promise.all(Object.values(this.index).map(table => table.flushAll()));
  }

  /**
   * Process the records inside the given file
   */
  private async writeFileData(path: string, filename: string, isIncremental: boolean): Promise<any> {
    console.log(`Processing ${filename}`);

    const file = this.getFeedFile(filename);
    const tables = await this.tables(file, isIncremental);
    const tableStream = new MySQLStream(filename, file, tables);
    const stream = readFile(path + filename).pipe(tableStream);

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
  protected getFeedFile(filename: string): FeedFile {
    return this.files[getExt(filename)];
  }

  @memoize
  protected schemas(file: FeedFile): MySQLSchema[] {
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
