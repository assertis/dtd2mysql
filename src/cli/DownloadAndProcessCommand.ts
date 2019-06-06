
import {CLICommand} from "./CLICommand";
import {ImportFeedCommand} from "./ImportFeedCommand";
import {DatabaseConnection} from "../database/DatabaseConnection";
import {DataUpdateProcessor} from "../database/DataUpdateProcessor";

export class DownloadAndProcessCommand implements CLICommand {

  constructor(
    private readonly download: FileProvider,
    private readonly process: ImportFeedCommand,
    protected readonly db: DatabaseConnection,
    protected readonly dataUpdateProcessor: DataUpdateProcessor
  ) {}

  /**
   * Download and process the feed in one command
   */
  public async run(argv: string[]): Promise<any> {
    const files = await this.download.run([]);

    await this.dataUpdateProcessor.prepareUpdate();
    for (const filename of files) {
      try {
        await this.process.doImport(filename);
      }
      catch (err) {
        console.error(err);
      }
    }
    await this.dataUpdateProcessor.finishUpdate();
    return this.process.end();
  }

}

export interface FileProvider {
  run(args: any[]): Promise<string[]>;
}
