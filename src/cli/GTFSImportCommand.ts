import {CLICommand} from "./CLICommand";
import {execSync} from "child_process";
import {DatabaseConfiguration, DatabaseConnection} from "../database/DatabaseConnection";
import {schema} from "../../config/gtfs/schema";
import {importSQL} from "../../config/gtfs/import";
import {DataUpdateProcessor} from "../database/DataUpdateProcessor";

export class GTFSImportCommand implements CLICommand {

  constructor(
    private readonly db: DatabaseConfiguration,
    private readonly dataUpdateProcessor: DataUpdateProcessor,
    private readonly databaseConnection: DatabaseConnection
  ) {
  }

  /**
   * Create the text files and then zip them up using a CLI command that hopefully exists.
   */
  public async run(argv: string[]): Promise<void> {
    const path = argv[3] || "./";
    const schemaEsc = schema.replace(/`/g, "\\`");
    const importSQLEsc = importSQL.replace(/`/g, "\\`");

    // Do only the security backup. No need of prepariing _tmp tables because we create them in config/gtfs/import.ts
    this.dataUpdateProcessor.cloneWorkingTables(DataUpdateProcessor.PREV_PREFIX);
    const credentials = `-h${this.db.host} -u${this.db.user} ${this.db.password ? "-p" + this.db.password : ""} `;

    const mysqlExec = `mysql --local-infile ${credentials} ${this.db.database} -e`;

    execSync(`${mysqlExec} "${schemaEsc}"`, {cwd: path});
    execSync(`${mysqlExec} "${importSQLEsc}"`, {cwd: path});

    this.dataUpdateProcessor.finishUpdate();

  }

}