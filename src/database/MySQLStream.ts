import {Writable} from "stream";
import {FeedFile} from "../feed/file/FeedFile";
import {ParsedRecord} from "../feed/record/Record";
import { Table } from './Table';

export class MySQLStream extends Writable {

  constructor(
    private readonly filename: string,
    private readonly file: FeedFile,
    private readonly tables: TableIndex,
    objectMode: boolean = false,
  ) {
    super({ decodeStrings: false, objectMode });
  }

  public async _write(line: any, encoding: string, callback: WritableCallback): Promise<void> {
    try {
      const record = this.file.getRecord(line);

      if (record) {
        const table = this.tables[record.name];
        const valuesRaw = record.extractValues(line);
        const values: ParsedRecord[] = Array.isArray(valuesRaw) ? valuesRaw : [valuesRaw];

        await Promise.all(
          values.map(value => table.apply(value))
        );
      }

      callback();
    }
    catch (err) {
      callback(Error(`Error processing ${this.filename} with data ${line}` + err.stack));
    }
  }

  public async close(): Promise<void> {
    await Promise.all(Object.values(this.tables).map(t => t.close()));
  }

  public async _final(callback: WritableCallback): Promise<void> {
    try {
      await this.close();
      callback();
    }
    catch (err) {
      callback(err);
    }
  }

}

export type WritableCallback = (error?: Error | null) => void;

export type TableIndex = {
  [tableName: string]: Table;
}
