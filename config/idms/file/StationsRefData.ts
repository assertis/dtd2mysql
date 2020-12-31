import {FieldMap, ParsedRecord, Record, RecordAction} from "../../../src/feed/record/Record";
import {XmlFile} from "../../../src/feed/file/XmlFile";
import {BooleanField, TextField, VariableLengthText} from "../../../src/feed/field";

class StationsRefRecord implements Record {
  public readonly name: string = "idms_stations_ref_data";

  public readonly indexes: string[] = [];
  public readonly key: string[] = [];
  public readonly orderedInserts: boolean = false;

  public readonly fields: FieldMap = {
    "nlc": new TextField(1, 4, true),
    "name": new VariableLengthText(2, 100),
    "tiploc": new VariableLengthText(3, 50, true),
    "crs": new TextField(4, 3),
    "ojp_enabled": new BooleanField(5, false, ['true'], ['false']),
    "ojp_display_name": new VariableLengthText(6, 100, true),
    "ojp_advice_message": new VariableLengthText(7, 200, true),
    "rsp_display_name": new VariableLengthText(8, 100, true),
    "attended_tis": new BooleanField(9, false, ['true'], ['false']),
    "unattended_tis": new BooleanField(10, false, ['true'], ['false']),
  };

  public extractValues(record: IdmsStationsRefRecord | any): ParsedRecord {
    const values = {
      id: null,
      nlc: record.nlc,
      name: record.name,
      tiploc: record.tiploc,
      crs: record.crs,
      ojp_enabled: record.ojpenabled,
      ojp_display_name: record.opjdisplayname,
      ojp_advice_message: record.ojpadvicemessage,
      rsp_display_name: record.rspdisplayname,
      attended_tis: record.attendedtis,
      unattended_tis: record.unattendedtis,
    };

    return {action: RecordAction.Insert, values, keysValues: values};
  }
}

export interface IdmsStationsRefRecord {
  nlc: string,
  name: string,
  tiploc: string,
  crs: string,
  ojpenabled: string,
  opjdisplayname: string,
  ojpadvicemessage: string,
  rspdisplayname: string,
  attendedtis: string,
  unattendedtis: string,
}

export const idmsStationsRefDataFilename = 'StationsRefData.xml';

const StationsRefData = new XmlFile(idmsStationsRefDataFilename, new StationsRefRecord());

export default StationsRefData;
