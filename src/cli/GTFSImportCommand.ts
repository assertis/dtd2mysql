import {CLICommand} from "./CLICommand";
import {execSync} from "child_process";
import {DatabaseConfiguration} from "../database/DatabaseConnection";
import {schema} from "../../config/gtfs/schema";
import {importSQL} from "../../config/gtfs/import";
import * as fs from "fs";

export class GTFSImportCommand implements CLICommand {

  private readonly fileList: string[] = [
      'transfers.txt',
      'routes.txt',
      'agency.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'trips.txt',
      'links.txt',
      'stop_times.txt',
      'stops.txt'
  ];
  constructor(
    private readonly db: DatabaseConfiguration
  ) {
  }

  /**
   * Create the text files and then zip them up using a CLI command that hopefully exists.
   */
  public async run(argv: string[]): Promise<void> {
    const path = argv[3] || "./";
    const schemaEsc = schema.replace(/`/g, "\\`");
    // Sanity check
    for(const file of this.fileList) {
      if (await this.fileIsEmpty(path + file)) {
        throw new Error(`${file} is empty. Cannot upload it to OJP database`);
      }
    }
    const importSQLEsc = importSQL.replace(/`/g, "\\`");

    const credentials = `-h${this.db.host} -u${this.db.user} ${this.db.password ? "-p" + this.db.password : ""} `;

    const mysqlExec = `mysql --local-infile ${credentials} ${this.db.database} -e`;

    execSync(`${mysqlExec} "${schemaEsc}"`, {cwd: path});
    execSync(`${mysqlExec} "${importSQLEsc}"`, {cwd: path});
  }

    /**
     * File is empty when it doesn't have any lines or only 2 lines (table columns and empty line)
     * @param filePath
     */
  private async fileIsEmpty(filePath: string): Promise<boolean> {
    return fs.readFileSync(filePath, 'utf8').split('\n').length <= 2;
  }

}
