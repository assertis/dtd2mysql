import {CLICommand} from "./CLICommand";
import {faresPath, timetablePath} from "../sftp/Paths";
import {SourceManager} from "../sftp/SourceManager";

export class CheckAvailableFilesCommand implements CLICommand {

  public constructor(
    private readonly faresSource: SourceManager,
    private readonly timetableSource: SourceManager
  ) {
  }

  public async run(argv: string[]): Promise<any> {
    const fares = await this.faresSource.getFilesToProcess(faresPath);
    const timetables = await this.timetableSource.getFilesToProcess(timetablePath);

    // If at least in one source data are available process them
    if (fares.length > 0 || timetables.length > 0) {
      await this.end();
      console.log("Process the data");
    } else {
      console.log("No available files to process");
      await this.end();
      /**
       * We return exit code to stop executing any other command after check availability.
       */
      process.exit(500);
    }
  }


  private async end() {
    await this.faresSource.end();
    await this.timetableSource.end();
  }
}
