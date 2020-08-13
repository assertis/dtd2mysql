import { DatabaseConnection } from "./DatabaseConnection";
import { RecordAction } from "../feed/record/Record";
import { MySQLTable } from './MySQLTable';
import { Table } from './Table';


const TMP_PREFIX = "_tmp_";


/**
 * Stateful class that provides access to a MySQL table and acts as buffer for inserts.
 */
export class MySQLTmpTable extends MySQLTable implements Table {

  private readonly originalTableName;
  private tmpExists = false;
  private readonly isIncremental;

  constructor(
    db: DatabaseConnection,
    tableName: string,
    isIncremental: boolean,
    flushLimit: number = 5000
  ) {
    super(db, TMP_PREFIX + tableName, flushLimit);
    this.originalTableName = tableName;
    this.isIncremental = isIncremental
  }

  public static async create(
    db: DatabaseConnection,
    tableName: string,
    isIncremental: boolean,
    flushLimit: number = 5000
  ): Promise<MySQLTmpTable> {
    const self = new this(db, tableName, isIncremental, flushLimit);
    await self.init();

    return self;
  }

  public async init(): Promise<MySQLTmpTable> {
    await this.createTmpTableIfNotExists();
    return this;
  }

  /**
   * overwrite original table with _tmp_ table data.
   */
  public async persist(): Promise<void> {
    console.log(`Persisting ${this.tableName} into ${this.originalTableName}`);
    // to speed up table copying
    await this.db.query('SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED');
    try {
      await this.db.query('START TRANSACTION');
      await this.truncateTable(this.originalTableName);
      await this.db.query('INSERT IGNORE INTO `' + this.originalTableName + '` SELECT * FROM `' + this.tableName + '`');
      await this.db.query('DROP TABLE `' + this.tableName + '`');
      await this.db.query('COMMIT');
    } catch (e) {
      console.error(`Persisting failed ${this.tableName}, rolling back`);
      await this.db.query('ROLLBACK');
      console.info(`Rolled back ${this.tableName}`);
      throw e;
    }
    // revert to default InnoDB value.
    await this.db.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  }

  /**
   * Drop tmp table and forget about it.
   */
  public async revert(): Promise<void> {
    console.log(`Dropping table ${this.tableName}`);
    await this.db.query('DROP TABLE IF EXISTS`' + this.tableName + '`');
  }

  public async flushAll(): Promise<void> {
    await Promise.all([
      this.flush(RecordAction.Delete),
      this.flush(RecordAction.Update),
      this.flush(RecordAction.Insert)
    ]);
  }

  protected async createTmpTableIfNotExists(): Promise<void> {
    if (this.tmpExists) {
      return;
    }

    try {
      await this.assertTableNotExists();
    } catch (e) {
      this.truncateTable(this.tableName);
      this.tmpExists = true;
      return;
    }

    console.log(`Creating table ${this.tableName} from ${this.originalTableName}`);
    await this.db.query('CREATE TABLE `' + this.tableName + '` LIKE `' + this.originalTableName + '`');
    // _tmp table should be populated with "old" data only in case of incremental update.
    if (this.isIncremental) {
      console.log(`Copying data from ${this.originalTableName} to ${this.tableName}`);
      await this.db.query('INSERT INTO `' + this.tableName + '` SELECT * FROM `' + this.originalTableName + '`');
    }
    this.tmpExists = true;
  }

  protected async assertTableNotExists(): Promise<void> {
    const [rows] = await this.db.query(`SHOW TABLES LIKE ?`, [this.tableName]);
    if (rows.length > 0) {
      throw new Error("Assertion failed. Table " + this.tableName + " already exists!");
    }
  }

  protected async truncateTable(tableName: string): Promise<void> {
    console.log(`Truncating table ${tableName}`);
    await this.db.query("TRUNCATE `" + tableName + "`");
  }

  /**
   * Release database.
   * In opposite to MySQLTable implementation,
   * flush remaining records is executed in persist() method.
   */
  public async close(): Promise<any> {
    if (this.db.release) {
      await this.db.release();
    }
  }
}

