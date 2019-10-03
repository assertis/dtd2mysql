import {Field, FieldValue} from "../field/Field";

export interface Record extends MysqlRecord{

  orderedInserts: boolean;

  /**
   * Turn the given line into a list of values
   */
  extractValues(line: string): ParsedRecord | ParsedRecord[];

}

export interface MysqlRecord {
  name: string;
  key: string[];
  fields: FieldMap;
  indexes: string[];
}

export interface FieldMap {
  [field: string]: Field;
}

export enum RecordAction {
  Insert = "I",
  Update = "A",
  Delete = "D",
  DelayedInsert = "DI"
}

export interface ParsedRecord {
  action: RecordAction;
  values: {
    [field: string]: FieldValue;
  };
  keysValues: {
    [keyField: string]: FieldValue;
  }
}
