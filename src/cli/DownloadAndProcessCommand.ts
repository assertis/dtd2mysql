
import {CLICommand} from "./CLICommand";
import {ImportFeedCommand} from "./ImportFeedCommand";
import {DatabaseConnection} from "../database/DatabaseConnection";
import {OfflineDataProcessor} from "../database/OfflineDataProcessor";

export class DownloadAndProcessCommand implements CLICommand {

  constructor(
    private readonly download: FileProvider,
    private readonly process: ImportFeedCommand,
    protected readonly db: DatabaseConnection,
    protected readonly offlineDataProcessor: OfflineDataProcessor
  ) {}

  /**
   * Download and process the feed in one command
   */
  public async run(argv: string[]): Promise<any> {
    const files = await this.download.run([]);

    for (const filename of files) {
      try {
        await this.process.doImport(filename);
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
    }

    return this.process.end();
  }

}

export interface FileProvider {
  run(args: any[]): Promise<string[]>;
}
