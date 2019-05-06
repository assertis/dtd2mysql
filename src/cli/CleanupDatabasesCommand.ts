import {OfflineDataProcessor} from "../database/OfflineDataProcessor";
import {DatabaseConnection} from "../database/DatabaseConnection";


export class CleanupDatabasesCommand {

  public constructor(
      private readonly databaseConnection: DatabaseConnection,
      private readonly offlineProcessor: OfflineDataProcessor
  ) {

  }

  public async run(argv: string[]): Promise<void> {
    // Check if new views in original database works fine
    const tables = this.offlineProcessor.getTablesList();

    const checkAlltables = () => {
      for (const table of tables) {
        const sql = `SELECT * FROM ${table} LIMIT 1`;
        try {
          console.log(`[DEBUG] Run check query for table ${table}`);
          this.databaseConnection.query(sql);
        } catch (err) {
          return false;
        }
      }
      return true;
    };

    if (checkAlltables()) {
      console.log('[INFO] Views works fine. Removing outdated databases');
      this.offlineProcessor.removeOutdatedOfflineDatabase();
    }
    process.exit(0);
  }
}