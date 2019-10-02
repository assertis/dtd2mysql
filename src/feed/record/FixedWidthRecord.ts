import {FieldMap, ParsedRecord, Record, RecordAction} from "./Record";
import {ScheduleIdMap} from "../../cli/ScheduleIdMap";
import {TableIndex} from "../../database/MySQLStream";

/**
 * Record with fixed with fields
 */
export class FixedWidthRecord implements Record {

  constructor(
    public readonly name: string,
    public readonly key: string[],
    public readonly fields: FieldMap,
    public readonly indexes: string[] = [],
    public readonly actionMap: ActionMap = {},
    public readonly charPosition: number = 0,
    public readonly orderedInserts: boolean = false,
  ) {
  }

  /**
   * Extract the relevant part of the line for each field and then get the value from the field
   */
  public extractValues(line: string): ParsedRecord {
    const action = this.actionMap[line.charAt(this.charPosition)] || RecordAction.Insert;
    const values = action === RecordAction.Delete ? {} : {id: null};
    const fields = action === RecordAction.Delete ? this.key : Object.keys(this.fields);

    for (const key of fields) {
      values[key] = this.fields[key].extract(line.substr(this.fields[key].position, this.fields[key].length));
    }

    return {action, values} as ParsedRecord;
  }

}

/**
 * Different feeds use different characters for different actions, this map provides a look up from char to action
 */
export interface ActionMap {
  [char: string]: RecordAction;
}

/**
 * This record type uses a generated integer rather than the standard auto_increment. The only reason to do this use
 * this record type is to reference a row in another table that has not been inserted yet see {@link ForeignKeyField}
 */
export class RecordWithManualIdentifier extends FixedWidthRecord {
  private lastId: number = 0;
  private previousId: number | undefined;
  private scheduleIdMap: ScheduleIdMap;

  constructor(
    public readonly name: string,
    public readonly key: string[],
    public readonly fields: FieldMap,
    public readonly indexes: string[] = [],
    public readonly actionMap: ActionMap = {},
    public readonly charPosition: number = 0,
    public readonly orderedInserts: boolean = false,
    public readonly preUpdateScript = (record: ParsedRecord, tables: TableIndex): Promise<void>[] => [Promise.resolve()],
  ) {
    super(name, key, fields, indexes, actionMap, charPosition, orderedInserts);
  }

  public setLastId(value: number) {
    this.lastId = value;
  }

  public setScheduleIdMap(map: ScheduleIdMap) {
    this.scheduleIdMap = map;
  }

  public getPreviousId(): number | undefined {
    return this.previousId;
  }

  public extractValues(line: string): ParsedRecord {
    const action = this.actionMap[line.charAt(this.charPosition)] || RecordAction.Insert;
    let values = {};

    if (action === RecordAction.Insert) {
      this.lastId++;
      values = {id: this.lastId};
      this.previousId = this.lastId;
    } else if (action === RecordAction.Update) {
      values = {id: this.lastId};
      this.previousId = this.scheduleIdMap.getId(
        this.fields['train_uid'].extractFrom(line) as string,
        this.fields['runs_from'].extractFrom(line) as string,
        this.fields['stp_indicator'].extractFrom(line) as string
      );
    } else {
      this.previousId = undefined;
    }

    for (const key in this.fields) {
      values[key] = this.fields[key].extract(line.substr(this.fields[key].position, this.fields[key].length));
    }

    return {action, values} as ParsedRecord;
  }

}
