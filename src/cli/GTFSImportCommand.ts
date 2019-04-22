import {CLICommand} from "./CLICommand";
import {execSync} from "child_process";
import {DatabaseConfiguration} from "../database/DatabaseConnection";
import {schema} from "../../config/gtfs/schema";
import {importSQL} from "../../config/gtfs/import";
import {OfflineDataProcessor} from "../database/OfflineDataProcessor";

export class GTFSImportCommand implements CLICommand {

  constructor(
    private readonly db: DatabaseConfiguration,
    private readonly offlineDataProcessor: OfflineDataProcessor
  ) {
  }

  /**
   * Create the text files and then zip them up using a CLI command that hopefully exists.
   */
  public async run(argv: string[]): Promise<void> {
    const path = argv[3] || "./";
    const schemaEsc = schema.replace(/`/g, "\\`");
    const importSQLEsc = importSQL.replace(/`/g, "\\`");

    const credentials = `-h${this.db.host} -u${this.db.user} ${this.db.password ? "-p" + this.db.password : ""} `;

    const mysqlExec = `mysql --local-infile ${credentials} ${this.db.database} -e`;

    execSync(`${mysqlExec} "${schemaEsc}"`, {cwd: path});
    execSync(`${mysqlExec} "${importSQLEsc}"`, {cwd: path});

    const viewsDatabase = process.env.DATABASE_NAME || "";
    if (!viewsDatabase) {
      throw new Error('Cannot create views in correct because DATABASE_NAME is empty');
    }
    // const ojpViewsSql = this.offlineDataProcessor.getViews();
    // const sqlCommand = `mysql ${credentials} ${viewsDatabase} -e "${ojpViewsSql}"`;
    // execSync(sqlCommand, {cwd: path});
  }

}