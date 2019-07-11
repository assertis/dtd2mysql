import { DatabaseConnection } from "./DatabaseConnection";
import { ParsedRecord, RecordAction } from "../feed/record/Record";
import { MySQLTable } from './MySQLTable';
import { Table } from './Table';


const TMP_PREFIX = "_tmp_";


/**
 * Stateful class that provides access to a MySQL table and acts as buffer for inserts.
 */
export class MySQLTmpTable extends MySQLTable implements Table{


  private readonly originalTableName;
  private tmpExists = false;

  constructor(
    db: DatabaseConnection,
    tableName: string,
    flushLimit: number = 5000
  ) {
    super(db, TMP_PREFIX + tableName, flushLimit);
    this.originalTableName = tableName;
  }

  public static async create(
    db: DatabaseConnection,
    tableName: string,
    flushLimit: number = 5000
  ): Promise<MySQLTmpTable> {
    const self = new this(db, tableName, flushLimit);
    await self.init();

    return self;
  }

  public async init(): Promise<MySQLTmpTable>
  {
    await this.createTmpTableIfNotExists();
    return this;
  }

  /**
   * overwrite original table with _tmp_ table data.
   */
  public async persist(): Promise<void> {
    await Promise.all([
      this.flush(RecordAction.Delete),
      this.flush(RecordAction.Update),
      this.flush(RecordAction.Insert)
    ]);

    await this.truncateTable(this.originalTableName);
    await this.db.query('INSERT INTO `' + this.originalTableName + '` SELECT * FROM `' + this.tableName + '`');
    await this.db.query('DROP TABLE `' + this.tableName + '`');
  }

  /**
   * Drop tmp table and forget about it.
   */
  public async revert(): Promise<void> {
    await this.db.query('DROP TABLE `' + this.tableName + '`');
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

    await this.db.query('CREATE TABLE `' + this.tableName + '` LIKE `' + this.originalTableName + '`');
    await this.db.query('INSERT INTO `' + this.tableName + '` SELECT * FROM `' + this.originalTableName + '`');
    this.tmpExists = true;
  }

  protected async assertTableNotExists(): Promise<void> {
    const [rows] = await this.db.query(`SHOW TABLES LIKE ?`, [this.tableName]);
    if (rows.length > 0) {
      throw new Error("Assertion failed. Table " + this.tableName + " already exists!");
    }
  }

  protected async truncateTable(tableName: string): Promise<void> {
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

