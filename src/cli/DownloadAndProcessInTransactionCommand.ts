import { CLICommand } from "./CLICommand";
import { DatabaseConnection } from "../database/DatabaseConnection";
import { ImportFeedInTransactionCommand } from './ImportFeedCommandWithFallback';

export class DownloadAndProcessInTransactionCommand implements CLICommand {

  constructor(
    private readonly download: FileProvider,
    private readonly process: ImportFeedInTransactionCommand,
    protected readonly db: DatabaseConnection
  ) {
  }

  /**
   * Download and process the feed in one command
   */
  public async run(argv: string[]): Promise<any> {
    const files = await this.download.run([]);

    try {
      await this.process.doImport(files);
      await this.process.commit();
    } catch (err) {
      await this.process.rollback();
      console.error(err);
    }

    return this.process.end();
  }

}

export interface FileProvider {
  run(args: any[]): Promise<string[]>;
}
