import {CLICommand} from "./CLICommand";
import {SourceManager} from "../sftp/SourceManager";

export class DownloadCommand implements CLICommand {

  constructor(
    private readonly fileManager: SourceManager,
    private readonly directory: string
  ) {}

  /**
   * Download the latest refresh file from an SFTP server
   */
  public async run(argv: string[]): Promise<string[]> {
    const outputDirectory = argv[3] || "/tmp/";
    const [remoteFiles, lastProcessedFile] = await Promise.all([
      this.fileManager.getRemoteFiles(this.directory),
      this.fileManager.getLastProcessedFile()
    ]);

    const files = this.fileManager.getFilesToProcess(remoteFiles, lastProcessedFile);

    if (files.length > 0) {
      console.log(`Downloading ${files.length} feed file(s)`);
    }
    else {
      console.log("No files to update. Last processed file => ", lastProcessedFile);
    }

    try {
      await Promise.all(
        files.map(f => this.fileManager.sftp.fastGet(this.directory + f, outputDirectory + f))
      );
    }
    catch (err) {
      console.error(err);
    }

    this.fileManager.sftp.end();

    return files.map(filename => outputDirectory + filename);
  }
}
