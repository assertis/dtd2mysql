import * as chai from "chai";
import {DateField, DoubleField, TextField} from "../../../src/feed/field";
import {CSVRecord} from "../../../src/feed/record/CSVRecord";
import {RecordAction} from "../../../src/feed/record/Record";

describe("CSVRecord", () => {

  it("looks up the correct field", () => {
    const field = new DoubleField(0, 4, 2);
    const field2 = new TextField(1, 3);
    const field3 = new DateField(2);

    const record = new CSVRecord(
      "test",
      [], {
        "field": field,
        "field2": field2,
        "field3": field3
      });

    chai.expect(record.extractValues("10.12,Hi ,31122999")).to.deep.equal({
      action: RecordAction.Insert,
      keysValues: {},
      values: {
        id: null,
        field: 10.12,
        field2: "Hi ",
        field3: "2999-12-31"
      }
    });
  });

  it("ignores missing fields", () => {
    const field = new DoubleField(0, 4, 2);
    const field2 = new TextField(1, 3);

    const record = new CSVRecord(
      "test",
      [], {
        "field": field,
        "field2": field2,
      });

    chai.expect(record.extractValues("10.12,Hi ,31122999")).to.deep.equal({
      action: RecordAction.Insert,
      keysValues: {},
      values: {
        id: null,
        field: 10.12,
        field2: "Hi "
      }
    });
  });


});
