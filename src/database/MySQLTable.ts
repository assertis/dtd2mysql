import {DatabaseConnection} from "./DatabaseConnection";
import {ParsedRecord, RecordAction} from "../feed/record/Record";
import { Table } from './Table';

/**
 * Stateful class that provides access to a MySQL table and acts as buffer for inserts.
 */
export class MySQLTable implements Table{

  protected readonly buffer = {
    [RecordAction.Insert]: [] as ParsedRecord[],
    [RecordAction.Update]: [] as ParsedRecord[],
    [RecordAction.Delete]: [] as ParsedRecord[],
  };

  constructor(
    protected readonly db: DatabaseConnection,
    protected readonly tableName: string,
    protected readonly flushLimit: number = 5000
  ) {}

  /**
   * This implementation persist records on the fly in apply() method.
   */
  public async persist(): Promise<void> {
    return;
  }

  /**
   * This implementation do not support reverting!!
   */
  public async revert(): Promise<void> {
    throw new Error("MySQLTable do not support reverting!");
  }

  /**
   * Insert the given row to the table
   */
  public async apply(row: ParsedRecord): Promise<void> {
    this.buffer[row.action].push(row);

    if (this.buffer[row.action].length >= this.flushLimit) {
      return await this.flush(row.action);
    }
  }

  /**
   * Flush the table
   */
  protected async flush(type: RecordAction): Promise<void> {
    const rows = this.buffer[type];

    if (rows.length > 0) {
      this.buffer[type] = [];

      return this.queryWithRetry(type, rows);
    }
  }

  /**
   * Flush and return all promises
   */
  public async close(): Promise<any> {
    await Promise.all([
      this.flush(RecordAction.Delete),
      this.flush(RecordAction.Update),
      this.flush(RecordAction.Insert)
    ]);

    if (this.db.release) {
      await this.db.release();
    }
  }

  /**
   * Query with retry. Sometimes locking errors occur
   */
  protected async queryWithRetry(type: RecordAction, rows: ParsedRecord[], numRetries: number = 3): Promise<void> {
    try {
      await this.query(type, rows);
    }
    catch (err) {
      if (err.errno === 1213 && numRetries > 0) {
        return this.queryWithRetry(type, rows, numRetries - 1);
      }
      else {
        throw err;
      }
    }
  }

  protected query(type: RecordAction, rows: ParsedRecord[]): Promise<void> {
    const rowValues = rows.map(r => Object.values(r.values));

    switch (type) {
      case RecordAction.Insert:
        return this.db.query(`INSERT IGNORE INTO \`${this.tableName}\` VALUES ?`, [rowValues]);
      case RecordAction.Update:
        return this.db.query(`REPLACE INTO \`${this.tableName}\` VALUES ?`, [rowValues]);
      case RecordAction.Delete:
        return this.db.query(`DELETE FROM \`${this.tableName}\` WHERE (${this.getDeleteSQL(rows)})`, [].concat.apply([], rowValues));
      default:
        throw new Error("Unknown record action: " + type);
    }
  }

  protected getDeleteSQL(rows: ParsedRecord[]): string {
    return rows.map(row => Object.keys(row.values).map(k => `\`${k}\` = ?`).join(" AND ")).join(") OR (");
  }

}

