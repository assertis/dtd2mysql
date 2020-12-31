import FixedLinks_v10, {idmsFixedLinksFilename} from "./file/FixedLinks_v1.0";
import FareGroupPermittedStations_v10, {idmsGroupFilename} from "./file/FareGroupPermittedStations_v1.0";
import {FeedConfig} from "../index";
import StationsRefData, {idmsStationsRefDataFilename} from "./file/StationsRefData";
import GroupLocationMapping, {idmsGroupLocationMappingFilename} from "./file/GroupLocationMapping";

export const idmsBucket = "ride-data";
export const idmsPrefix = "idms/";
export const idmsUrl = "https://s3-eu-west-1.amazonaws.com/" + idmsBucket + "/" + idmsPrefix;

const specification: FeedConfig = {
  [idmsFixedLinksFilename]: FixedLinks_v10,
  [idmsGroupFilename]: FareGroupPermittedStations_v10,
  [idmsStationsRefDataFilename]: StationsRefData,
  [idmsGroupLocationMappingFilename]: GroupLocationMapping,
};

export default specification;
export * from "./file/FixedLinks_v1.0";
export * from "./file/FareGroupPermittedStations_v1.0";
export * from "./file/StationsRefData";
export * from "./file/GroupLocationMapping";
