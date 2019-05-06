import {OfflineDataProcessor} from "../database/OfflineDataProcessor";
import {DatabaseConnection} from "../database/DatabaseConnection";


export class CleanupDatabasesCommand {

  public constructor(
      private readonly databaseConnection: DatabaseConnection,
      private readonly offlineProcessor: OfflineDataProcessor
  ) {

  }

  private checkAllTables(tables: string[]) {
    for (const table of tables) {
      const sql = `SELECT * FROM ${table} LIMIT 1`;
      try {
        console.log(`[DEBUG] Run check query for table ${table}`);
        this.databaseConnection.query(sql);
      } catch (err) {
        console.log(`[ERROR] ${err.message}`);
        return false;
      }
    }
    return true;
  }

  public async run(argv: string[]): Promise<void> {
    // Check if new views in original database work fine
    const tables = this.offlineProcessor.getTablesList();
    if (this.checkAllTables(tables)) {
      console.log('[INFO] Views works fine. Removing outdated databases');
      this.offlineProcessor.removeOutdatedOfflineDatabase();
    }
    process.exit(0);
  }
}