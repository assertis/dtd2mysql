import {CLICommand} from "./CLICommand";
import {SourceManager} from "../sftp/SourceManager";

export class DownloadCommand implements CLICommand {

  constructor(
    private readonly sourceManager: SourceManager,
    private readonly directory: string
  ) {}

  /**
   * Download the latest refresh file from an SFTP server
   */
  public async run(argv: string[]): Promise<string[]> {
    const outputDirectory = argv[3] || "/tmp/";
    const [remoteFiles, lastProcessedFile] = await Promise.all([
      this.sourceManager.getRemoteFiles(this.directory),
      this.sourceManager.getLastProcessedFile()
    ]);

    const files = this.sourceManager.getFilesToProcess(remoteFiles, lastProcessedFile);

    if (files.length > 0) {
      console.log(`Downloading ${files.length} feed file(s)`);
    }
    else {
      console.log("No files to update. Last processed file => ", lastProcessedFile);
    }

    try {
      await Promise.all(
        files.map(f => this.sourceManager.sftp.fastGet(this.directory + f, outputDirectory + f))
      );
    }
    catch (err) {
      console.error(err);
    }

    this.sourceManager.sftp.end();

    return files.map(filename => outputDirectory + filename);
  }
}
