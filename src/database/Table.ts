import { ParsedRecord } from '../feed/record/Record';

export interface Table {
  /**
   * Insert the given row to the table
   */
  apply(row: ParsedRecord): Promise<void>;

  /**
   * Make all applied data persistent.
   * Depends on implementation, can behave differently.
   */
  persist(): Promise<void>;

  /**
   * Revert all applied records.
   * Not all implementation might support it!
   */
  revert(): Promise<void>;

  close(): Promise<any>;
}

