import { CLICommand } from './CLICommand';
import { execSync } from "child_process";
import { Storage } from '../backup/Storage';

export class RollbackDatabaseCommand implements CLICommand {

  public constructor(
    private readonly databaseName: string,
    private readonly username: string,
    private readonly password: string,
    private readonly host: string,
    private readonly storage: Storage,
    private readonly cmd: Function = execSync
  ) {

  }

  public async run(argv: string[]): Promise<any> {
    if (!await this.isRollbackPossible()) {
      throw new Error("Mysql command not available");
    }

    const backupFileName = argv[3];
    const filename = "/tmp/" + this.databaseName + "_dump_" + new Date().toISOString() + ".sql";

    if (await this.storage.doesFileExists(backupFileName)) {
      console.log(`Downloading file ${backupFileName}`);
      await this.fetchFile(backupFileName, filename);

      console.log("Reverting database " + this.databaseName);
      await this.rollback(filename);
    }
    console.log(`Cannot find file ${backupFileName} in S3 Bucket`);
  }

  protected async isRollbackPossible(): Promise<boolean> {
    try {
      await this.cmd("mysql --help");
    } catch (e) {
      return false;
    }

    return true;
  }

  protected async rollback(filename): Promise<string> {
    const command = "mysql -u " + this.username +
      " --password=" + this.password +
      " -h " + this.host +
      " " + this.databaseName +
      " < " + filename;
    await this.cmd(command);

    return filename;
  }

  protected async fetchFile(path: string, filename: string): Promise<string[]> {
    return this.storage.download(path, filename);
  }
}
