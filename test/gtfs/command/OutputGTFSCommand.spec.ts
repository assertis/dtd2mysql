import {STP} from "../../../src/gtfs/native/OverlayRecord";
import {schedule} from "./MergeSchedules.spec";
import {RouteType} from "../../../src/gtfs/file/Route";
import {OutputGTFSCommand} from "../../../src/cli/OutputGTFSCommand";
import {CIFRepository} from "../../../src/gtfs/repository/CIFRepository";
import {stationCoordinates} from "../../../config/gtfs/station-coordinates";
import {MockDatabaseConnection} from "../../database/MySQLSchema.spec";
import {FileOutput} from "../../../src/gtfs/output/FileOutput";
import {Days} from "../../../src/gtfs/native/ScheduleCalendar";
import {stop} from "./ApplyAssociations.spec";
import * as chai from "chai";

describe("OutputGTFSCommand", () => {
  const ALL_DAYS: Days = {0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1};

  it("Will create two routes from two schedules when the only difference is mode", () => {

    const baseSchedules = [
      schedule(1, "A", "2017-01-01", "2017-01-31", STP.Permanent, ALL_DAYS, [
        stop(1, "ASH", "00:35"),
        stop(2, "DOV", "01:00"),
        stop(3, "SEA", "01:30"),
      ], RouteType.Rail),
      schedule(2, "A", "2017-02-01", "2017-02-28", STP.Permanent, ALL_DAYS, [
        stop(1, "ASH", "00:35"),
        stop(2, "DOV", "01:00"),
        stop(3, "SEA", "01:30"),
      ], RouteType.Gondola),
    ];

    const outputGTFS = new OutputGTFSCommand(
      new CIFRepository(
        new MockDatabaseConnection(),
        require('mysql2').createPool({}),
        stationCoordinates
      ),
      new FileOutput()
    );
    const routes = {};
    for (const schedule of baseSchedules) {
      outputGTFS.getRoutesFromSchedule(schedule, routes);
    }

    chai.expect(routes[1].route_type).to.equal(2);
    chai.expect(routes[2].route_type).to.equal(6);
  });

});
