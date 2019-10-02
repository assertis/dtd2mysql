import {MultiRecordFile} from "../../../src/feed/file/MultiRecordFile";
import {association, callingPoint, extraDetails, schedule, tiplocInsert} from "./MCA";

const CFA = new MultiRecordFile({
  "AA": association,
  "TI": tiplocInsert,
  "TA": tiplocInsert,
  "BS": schedule,
  "BX": extraDetails,
  "LO": callingPoint,
  "LI": callingPoint,
  "LT": callingPoint
}, 0, 2);

export default CFA;
