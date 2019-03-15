import {XmlFile} from "../../../src/feed/file/XmlFile";
import {FieldMap, ParsedRecord, Record, RecordAction} from "../../../src/feed/record/Record";
import {DateField, TextField} from "../../../src/feed/field";

class GroupRecord implements Record {

  public readonly indexes: string[] = [];
  public readonly key: string[] = [];
  public readonly orderedInserts: boolean = false;
  public readonly name: string = "idms_fare_group_permitted_stations";

  public readonly fields: FieldMap = {
    "fare_group_nlc": new TextField(1, 4),
    "fare_location_nlc": new TextField(2, 4),
    "permitted_station_crs": new TextField(3, 3),
    "route_code": new TextField(4, 5),
    "start_date": new DateField(5),
    "end_date": new DateField(6),
  };

  public extractValues(record: IdmsGroupRecord | any): ParsedRecord[] {
    const values = {
      id: null,
      fare_group_nlc: record.$attrs.faregroupnlc,
      fare_location_nlc: record.$attrs.farelocationnlc,
      permitted_station_crs: null,
      route_code: record.$attrs.routecode,
      start_date: record.$attrs.startdate,
      end_date: record.$attrs.enddate,
    };

    const crsList = Array.isArray(record.crs) ? record.crs : [record.crs];

    return crsList
      .map(crs => {
        return {
          action: RecordAction.Insert,
          values: Object.assign({}, values, {permitted_station_crs: crs}),
        }
      });
  }
}

export const idmsGroupFilename = 'FareGroupPermittedStations_v1.0.xml';

export interface IdmsGroupRecord {
  $attrs: {
    faregroupnlc: string, // '0254'
    farelocationnlc: string, // '0035'
    routecode: string, // '00000'
    startdate: string, // '2018-05-21'
    enddate: string, // '2999-12-31'
  },
  crs: string[], // [ 'CET', 'COL' ]
}

const FareGroupPermittedStations_v10 = new XmlFile(idmsGroupFilename, new GroupRecord());

export default FareGroupPermittedStations_v10;
