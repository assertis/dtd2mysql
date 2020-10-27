import AdmZip = require("adm-zip");
import fs = require("fs-extra");
import * as path from "path";
import {FeedConfig} from "../../config";
import {FeedFile} from "../feed/file/FeedFile";
import {DatabaseConnection} from "../database/DatabaseConnection";
import {MultiRecordFile} from "../feed/file/MultiRecordFile";
import {RecordWithManualIdentifier} from "../feed/record/FixedWidthRecord";
import {ImportDirectoryTransactionalCommand} from "./ImportDirectoryTransactionalCommand";

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
export class ImportFeedTransactionalCommand extends ImportDirectoryTransactionalCommand {

  private lastProcessedFile: string | null = null;

  constructor(
    db: DatabaseConnection,
    files: FeedConfig,
    tmpFolder: string,
    sanityChecksList: {},
    private readonly xFilesFolder?: string,
  ) {
    super(db, files, tmpFolder, sanityChecksList)
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

  private async importSingleFile(filePath: string): Promise<void> {
    console.log(`Extracting ${filePath} to ${this.tmpFolder}`);
    fs.emptyDirSync(this.tmpFolder);

    new AdmZip(filePath).extractAllTo(this.tmpFolder);

    const zipName = path.basename(filePath);
    // if the file is a not an incremental, reset the database schema
    const isIncremental = zipName.charAt(4) === "C";

    if (this.files["CFA"] instanceof MultiRecordFile) {
      await this.setLastScheduleId();
      this.ensureALFExists(zipName.substring(0, zipName.length - 4));
    }

    await this.importDirectory(this.tmpFolder, isIncremental);
    this.lastProcessedFile = zipName;

    // We import X-files only with the full update of the timetable feed
    if (this.xFilesFolder !== undefined && !isIncremental) {
      await this.importDirectory(this.xFilesFolder, false);
    }
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

}
