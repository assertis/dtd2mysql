
import FixedLinks_v10 from "./file/FixedLinks_v1.0";
import {FeedConfig} from "../index";

export const idmsFixedLinksBucket = "ride-data";
export const idmsFixedLinksPath = "idms/FixedLinks_v1.0.xml";
export const idmsFixedLinkUrl = "https://s3-eu-west-1.amazonaws.com/" + idmsFixedLinksBucket + "/" + idmsFixedLinksPath;

const specification: FeedConfig = {
  "": FixedLinks_v10
};

export default specification;
