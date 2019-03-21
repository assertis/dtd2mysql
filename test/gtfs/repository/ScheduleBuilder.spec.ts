import * as chai from "chai";
import {ScheduleBuilder} from "../../../src/gtfs/repository/ScheduleBuilder";
import {ActivityPattern} from "../../../src/gtfs/file/StopTime";

describe("ScheduleBuilder", () => {

  const scheduleBuilder = new ScheduleBuilder();

  it("getActivities will return correct activities", () => {

    chai.expect(scheduleBuilder.getActivities("U K")).to.equal("U-" + ActivityPattern.PickUpOnly);
    chai.expect(scheduleBuilder.getActivities("F K  U")).to.equal("U-"+ActivityPattern.PickUpOnly);
    chai.expect(scheduleBuilder.getActivities("TBK")).to.equal("TB-"+ ActivityPattern.PickUpOnly);
    chai.expect(scheduleBuilder.getActivities("TFK")).to.equal("TF-" + ActivityPattern.SetDownOnly);
    // K. .. .. R
    chai.expect(scheduleBuilder.getActivities("K     R")).to.equal("R-" + ActivityPattern.RequestStop);

  });
});