import { DatabaseConnection } from "./DatabaseConnection";
import { ParsedRecord, RecordAction } from "../feed/record/Record";
import { MySQLTable } from './MySQLTable';


const TMP_PREFIX = "_tmp_";


/**
 * Stateful class that provides access to a MySQL table and acts as buffer for inserts.
 */
export class MySQLTmpTable extends MySQLTable{


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

  /**
   * Flush the table
   */
  protected async flush(type: RecordAction): Promise<void> {
    const rows = this.buffer[type];

    if (rows.length > 0) {
      this.buffer[type] = [];

      this.createTmpTableIfNotExists();

      return this.queryWithRetry(type, rows);
    }
  }

  protected createTmpTableIfNotExists(): void {
    if (this.tmpExists) {
      return;
    }

    this.db.query(`CREATE TABLE ? SELECT * FROM ?`, [this.tableName, this.originalTableName])
    this.tmpExists = true;
  }

}

