import {CLICommand} from "./CLICommand";
import {CIFRepository} from "../gtfs/repository/CIFRepository";
import {Schedule} from "../gtfs/native/Schedule";
import {agencies} from "../../config/gtfs/agency";
import {Association} from "../gtfs/native/Association";
import {applyOverlays} from "../gtfs/command/ApplyOverlays";
import {mergeSchedules} from "../gtfs/command/MergeSchedules";
import {applyAssociations, AssociationIndex, ScheduleIndex} from "../gtfs/command/ApplyAssociations";
import {createCalendar, ServiceIdIndex} from "../gtfs/command/CreateCalendar";
import {ScheduleResults} from "../gtfs/repository/ScheduleBuilder";
import {GTFSOutput} from "../gtfs/output/GTFSOutput";
import * as fs from "fs";
import {addLateNightServices} from "../gtfs/command/AddLateNightServices";
import streamToPromise = require("stream-to-promise");
import {RouteID} from "../gtfs/file/Route";

export class OutputGTFSCommand implements CLICommand {
  private baseDir: string;

  public constructor(
    private readonly repository: CIFRepository,
    private readonly output: GTFSOutput
  ) {}

  /**
   * Turn the timetable feed into GTFS files
   */
  public async run(argv: string[]): Promise<void> {
    this.baseDir = argv[3] || "./";

    if (!fs.existsSync(this.baseDir)) {
      throw new Error(`Output path ${this.baseDir} does not exist.`);
    }

    const agencyP = this.copy(agencies, "agency.txt");
    const transfersP = this.copy(this.repository.getTransfers(), "transfers.txt");
    const stopsP = this.copy(this.repository.getStops(), "stops.txt");
    const fixedLinksP = this.copy(this.repository.getFixedLinks(), "links.txt");

    const associationsP = this.repository.getAssociations();
    const sleeperFortWilliamAssociationIdsP = this.repository.getSleeperFortWilliamAssociationIds();
    const scheduleResultsP = this.repository.getSchedules();
    const schedules = this.getSchedules(await associationsP, await scheduleResultsP, await sleeperFortWilliamAssociationIdsP);

    const [calendars, calendarDates, serviceIds] = createCalendar(schedules);
    const calendarP = this.copy(calendars, "calendar.txt");
    const calendarDatesP = this.copy(calendarDates, "calendar_dates.txt");
    const tripsP = this.copyTrips(schedules, serviceIds);

    await Promise.all([
      agencyP,
      transfersP,
      stopsP,
      calendarP,
      calendarDatesP,
      tripsP,
      fixedLinksP,
      this.repository.end(),
      this.output.end()
    ]);
  }

  /**
   * Map SQL records to a file
   */
  private async copy(results: object[] | Promise<object[]>, filename: string): Promise<void> {
    const rows = await results;
    if (rows.length === 0) {
      throw new Error(`OJP update failed for ${filename} file. Files shouldn't be empty`)
    }
    const output = this.output.open(this.baseDir + filename);

    console.log("Writing " + filename);
    rows.forEach(row => output.write(row));
    output.end();

    return streamToPromise(output);
  }

  /**
   * trips.txt, stop_times.txt and routes.txt have interdependencies so they are written together
   */
  private copyTrips(schedules: Schedule[], serviceIds: ServiceIdIndex): Promise<any> {
    console.log("Writing trips.txt, stop_times.txt and routes.txt");
    const trips = this.output.open(this.baseDir + "trips.txt");
    const stopTimes = this.output.open(this.baseDir + "stop_times.txt");
    const routeFile = this.output.open(this.baseDir + "routes.txt");
    const routes = {};

    for (const schedule of schedules) {
      const routeId = this.getRoutesFromSchedule(schedule, routes);
      const serviceId = serviceIds[schedule.calendar.id];

      trips.write(schedule.toTrip(serviceId, routeId));
      schedule.stopTimes.forEach(r => stopTimes.write(r));
    }

    for (const route of Object.values(routes)) {
      routeFile.write(route);
    }

    trips.end();
    stopTimes.end();
    routeFile.end();

    return Promise.all([
      streamToPromise(trips),
      streamToPromise(stopTimes),
      streamToPromise(routeFile),
    ]);
  }

  private getSchedules(associations: Association[], scheduleResults: ScheduleResults, sleeperFortWilliamAssociationIds: number[]): Schedule[] {
    const processedAssociations = <AssociationIndex>applyOverlays(associations);
    const processedSchedules = <ScheduleIndex>applyOverlays(scheduleResults.schedules, scheduleResults.idGenerator);
    const associatedSchedules = applyAssociations(processedSchedules, processedAssociations, sleeperFortWilliamAssociationIds, scheduleResults.idGenerator);
    const mergedSchedules = <Schedule[]>mergeSchedules(associatedSchedules);

    return addLateNightServices(mergedSchedules, scheduleResults.idGenerator);
  }

  /**
   * Wrap around collecting routes to make this thing testable.
   * We use javascript feature here with passing object reference as argument
   * @param schedule
   * @param routesCollection
   */
  public getRoutesFromSchedule(schedule: Schedule, routesCollection: {}): RouteID {
    const route = schedule.toRoute();

    routesCollection[route.route_id] = route;

    return route.route_id;
  }
}
