import {PromiseSFTP} from "./PromiseSFTP";
import {FileEntry} from "ssh2-streams";
import {DatabaseConnection} from "../database/DatabaseConnection";

/**
 * Common interface to manage file processing
 */
export class SourceManager {

  public constructor(
    public readonly sftp: PromiseSFTP,
    private readonly db: DatabaseConnection
  ) {
  }

  public async getFilesToProcess(path: string): Promise<string[]> {
    const sourceFiles = (await this.getRemoteFiles(path))
      .sort((a: FileEntry, b: FileEntry) => b.attrs.mtime - a.attrs.mtime)
      .map(e => e.filename);

    const processedFiles = (await this.getLastProcessedFiles());

    return this.calculatePendingFiles(sourceFiles, processedFiles);
  }

  public async getLastProcessedFile(): Promise<string | undefined> {
    const files = await this.getLastProcessedFiles();

    return files[0];
  }

  public calculatePendingFiles(sourceFiles: string[], processedFiles: string[]): string[] {
    const lastProcessed = processedFiles[0];

    const lastRefresh = sourceFiles.findIndex(i => i.charAt(4) === "F" || i.startsWith("RJRG"));
    const lastFile = sourceFiles.findIndex(i => i === lastProcessed);
    const lastProcessedRefreshFile = processedFiles.filter(i => i.charAt(4) === "F")[0];

    const processFromLastRefresh = sourceFiles[lastRefresh] !== lastProcessedRefreshFile
      || (lastFile <= -1 || (lastFile > lastRefresh && lastRefresh >= 0));

    const files = processFromLastRefresh
      ? sourceFiles.slice(0, lastRefresh + 1)
      : sourceFiles.slice(0, lastFile);

    return files.reverse();
  }

  private async getLastProcessedFiles(): Promise<string[]> {
    try {
      const [logs] = await this.db.query("SELECT * FROM log ORDER BY id DESC LIMIT 10");
      return logs ? logs.map(row => row.filename) : [];
    } catch (err) {
      console.log(err);
      return [];
    }
  }

  private async getRemoteFiles(directory: string): Promise<FileEntry[]> {
    try {
      return this.sftp.readdir(directory);
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  public async end() {
    await this.sftp.end();
    await this.db.end();
  }
}
