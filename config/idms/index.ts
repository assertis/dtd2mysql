import FixedLinks_v10, {idmsFixedLinksFilename} from "./file/FixedLinks_v1.0";
import FareGroupPermittedStations_v10, {idmsGroupFilename} from "./file/FareGroupPermittedStations_v1.0";
import {FeedConfig} from "../index";

export const idmsBucket = "ride-data";
export const idmsPrefix = "idms/";
export const idmsUrl = "https://s3-eu-west-1.amazonaws.com/" + idmsBucket + "/" + idmsPrefix;

const specification: FeedConfig = {
  [idmsFixedLinksFilename]: FixedLinks_v10,
  [idmsGroupFilename]: FareGroupPermittedStations_v10,
};

export default specification;
export * from "./file/FixedLinks_v1.0";
export * from "./file/FareGroupPermittedStations_v1.0";
