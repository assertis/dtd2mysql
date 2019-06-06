/**
 * Data update process controller.
 * It manages switching the tables and performing data update in a way where
 * we don't break the live env.
 */
import {DatabaseConnection} from "./DatabaseConnection";

export class DataUpdateProcessor {

  // Prefix for temporary tables where we'll process data
  public static TMP_PREFIX = "_tmp_";

  // Prefix for working tables copy
  public static PREV_PREFIX = "_prev_";

  public constructor(
    private readonly db: DatabaseConnection,
    private readonly tables: string[]
  ) {

  }

  public async prepareUpdate() {
    // Clone working data just in case
    // await this.cloneWorkingTables(DataUpdateProcessor.PREV_PREFIX);
    // Clone data to tables where we'll update them
    await this.cloneWorkingTables(DataUpdateProcessor.TMP_PREFIX);
  }

  public async finishUpdate() {
    try {
      // await (await this.db.getConnection()).beginTransaction();
      for(const table of this.tables) {
        const tmpTable = DataUpdateProcessor.TMP_PREFIX + table;
        await this.db.query(`DROP TABLE IF EXISTS ${table}; RENAME TABLE ${tmpTable} TO ${table}`);
        console.log(`[INFO] Table ${tmpTable} moved to ${table}`);
      }
      // await (await this.db.getConnection()).commit();
      // await (await this.db.getConnection()).release();
    }catch(err) {
      // await (await this.db.getConnection()).rollback();
      // await (await this.db.getConnection()).release();
      console.log(`[ERROR] ${err.toString()}`);
      // process.exit(500);
    } finally {
      await (await this.db.getConnection()).release();
    }
  }

  public async cloneWorkingTables(prefix: string) {
    try {
      for (const table of this.tables) {
        // await (await this.db.getConnection()).beginTransaction();
        const tmpTable = prefix + table;
        console.log(`[INFO] Clone ${table} TO ${tmpTable} START`);
        // Drop old table and clone working table
        await this.db.query(
            `DROP TABLE IF EXISTS ${tmpTable}; CREATE TABLE ${tmpTable} AS SELECT * FROM ${table}`
        );
        try {
          await this.db.query(
              `ALTER TABLE ${tmpTable} MODIFY COLUMN IF EXISTS id INT(11) unsigned AUTO_INCREMENT PRIMARY KEY`
          );
          console.log(`[INFO] Alter id column in ${tmpTable}`);
        }catch(err) {
          // DO nothing
        }
        // await (await this.db.getConnection()).commit();
        // await (await this.db.getConnection()).release();
        console.log(`[INFO] Cloned ${table} TO ${tmpTable} FINISHED`);
      }
    } catch (err) {
      // await (await this.db.getConnection()).rollback();
      // await (await this.db.getConnection()).release();
      console.log(`[ERROR] ${err.toString()}`);
      // process.exit(500);
    } finally {
      await (await this.db.getConnection()).release();
    }
  }


}