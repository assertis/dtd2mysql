import {Writable} from "stream";
import {FeedFile} from "../feed/file/FeedFile";
import {ParsedRecord, RecordAction} from "../feed/record/Record";
import {Table} from './Table';
import {RecordWithManualIdentifier} from "../feed/record/FixedWidthRecord";

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

        if (this.isRecordWithPreUpdateScript(record)) {
          const preUpdateScripts: Promise<any>[] = [];

          values.forEach((value: ParsedRecord) => {
            if (value.action === RecordAction.Update) {
              preUpdateScripts.push(...record.preUpdateScript(value, this.tables));
            }
          });

          await Promise.all(preUpdateScripts);
        }

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

  private isRecordWithPreUpdateScript(value: any): value is RecordWithManualIdentifier {
    return value.preUpdateScript !== undefined;
  }

  public async close(): Promise<void> {
    await Promise.all(Object.values(this.tables).map(t => t.close()));
  }

  public async _final(callback: WritableCallback): Promise<void> {
    try {
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
