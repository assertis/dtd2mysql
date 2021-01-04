import {FieldMap, ParsedRecord, Record, RecordAction} from "../../../src/feed/record/Record";
import {TextField} from "../../../src/feed/field";
import {XmlFile} from "../../../src/feed/file/XmlFile";

class GroupLocationMappingRecord implements Record {
  public readonly name: string = "idms_group_location_mapping";

  public readonly indexes: string[] = [];
  public readonly key: string[] = [];
  public readonly orderedInserts: boolean = false;

  public readonly fields: FieldMap = {
    "nlc": new TextField(1, 4, true),
    "crs": new TextField(4, 3),
  };

  public extractValues(record: IdmsGroupLocationMappingRecord | any): ParsedRecord {
    const values = {
      id: null,
      nlc: record.nlc,
      crs: record.crs,
    };

    return {action: RecordAction.Insert, values, keysValues: values};
  }
}

export interface IdmsGroupLocationMappingRecord {
  nlc: string,
  crs: string,
}

export const idmsGroupLocationMappingFilename = 'Group_Location_NLC_TO_CRS_CODE_Mapping.xml';

const GroupLocationMapping = new XmlFile(idmsGroupLocationMappingFilename, new GroupLocationMappingRecord());

export default GroupLocationMapping;
