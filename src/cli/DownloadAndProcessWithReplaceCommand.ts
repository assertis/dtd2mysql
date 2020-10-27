import {CLICommand} from "./CLICommand";
import { ImportFeedCommand } from "./ImportFeedCommand";
import {DatabaseConnection} from "../database/DatabaseConnection";
import {FileProvider} from "./index";

export class DownloadAndProcessWithReplaceCommand implements CLICommand {

  constructor(
    private readonly download: FileProvider,
    private readonly process: ImportFeedCommand,
    protected readonly db: DatabaseConnection
  ) {}

  /**
   * Download and process the feed in one command
   */
  public async run(argv: string[]): Promise<any> {
    const files = await this.download.run([]);

    for (const filename of files) {
      try {
        await this.process.doImport(filename);
      }
      catch (err) {
        console.error(err);
      }
    }

    return this.process.end();
  }

}
