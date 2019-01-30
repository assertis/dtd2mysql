
import {FeedFile} from "../src/feed/file/FeedFile";
import fares from "./fares";
import routeing from "./routeing";
import timetable from "./timetable";
import nfm64 from "./nfm64";
import idms from "./idms";

export type FeedConfig = {
  [fileExtension: string]: FeedFile
};

export default {
  fares,
  routeing,
  timetable,
  nfm64,
  idms
};
