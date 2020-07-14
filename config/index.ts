
import {FeedFile} from "../src/feed/file/FeedFile";
import fares from "./fares";
import routeing from "./routeing";
import timetable from "./timetable";
import nfm64 from "./nfm64";
import idms from "./idms";
import timetableSanityChecks from "./timetable/sanityChecks";

export type FeedConfig = {
  [fileExtension: string]: FeedFile
};

export default {
  fares,
  routeing,
  timetable,
  nfm64,
  idms,
  sanityChecks: {
    timetable: timetableSanityChecks
  }
};

export function viewsSqlFactory(views: string, databaseWithData: string, orgdb: string): string {
  return views
    .replace(new RegExp(/{dbname}/g), databaseWithData)
    .replace(new RegExp(/{orgdb}/g), orgdb);
}
