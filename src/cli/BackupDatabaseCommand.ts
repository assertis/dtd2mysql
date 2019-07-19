import { CLICommand } from './CLICommand';
import { execSync } from "child_process";
import { Storage } from '../backup/Storage';

export class BackupDatabaseCommand implements CLICommand {

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
    if (!await this.isBackupable()) {
      throw new Error("Backup tool not available");
    }

    console.log("dumping database " + this.databaseName);
    const backupFileName = await this.doBackup();
    console.log("pushing dump into storage");
    await this.persistBackup(backupFileName);
  }

  protected async isBackupable(): Promise<boolean> {
    try {
      await this.cmd("mysqldump --help");
    } catch (e) {
      return false;
    }

    return true;
  }

  protected async doBackup(): Promise<string> {
    const backupFileName = "/tmp/" + this.databaseName + "_dump_" + new Date().toISOString() + ".sql";
    const command = "mysqldump -u " + this.username +
      " --password=" + this.password +
      " -h " + this.host +
      " " + this.databaseName +
      " > " + backupFileName;
    await this.cmd(command);

    return backupFileName;
  }

  protected async persistBackup(fileName: string): Promise<void> {
    return this.storage.persist(fileName);
  }
}
