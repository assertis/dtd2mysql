import {Activity, StopTime} from "../file/StopTime";
import {ScheduleCalendar} from "./ScheduleCalendar";
import {Trip} from "../file/Trip";
import {Route, RouteType} from "../file/Route";
import {AgencyID} from "../file/Agency";
import {CRS} from "../file/Stop";
import {OverlayRecord, RSID, ServiceReservation, STP, TUID} from './OverlayRecord';

/**
 * A CIF schedule (BS record)
 */
export class Schedule implements OverlayRecord {

  constructor(
    public readonly id: number,
    public readonly stopTimes: StopTime[],
    public readonly tuid: TUID,
    public readonly rsid: RSID,
    public readonly calendar: ScheduleCalendar,
    public readonly mode: RouteType,
    public readonly operator: AgencyID | null,
    public readonly stp: STP,
    public readonly firstClassAvailable: boolean,
    public readonly reservationFlag: ServiceReservation,
    public readonly activity: Activity
  ) {}

  public get origin(): CRS {
    return this.stopTimes[0].stop_id;
  }

  public get destination(): CRS {
    return this.stopTimes[this.stopTimes.length - 1].stop_id;
  }

  /**
   * This needs to include all significant fields, otherwise they'll be lost after merging with another schedule.
   */
  public get hash(): string {
    return this.stopTimes.map(this.hashStop).join("") +
      this.tuid +
      this.rsid +
      this.calendar.binaryDays +
      this.mode +
      this.operator +
      this.firstClassAvailable +
      this.reservationFlag +
      this.activity +
      (this.stp === STP.Extra ? STP.Extra : STP.Permanent);
  }

  /**
   * This needs to include all significant fields, otherwise they'll be lost after merging with another schedule.
   */
  private hashStop(stop: StopTime): string {
    return stop.arrival_time +
      stop.departure_time +
      stop.stop_id +
      stop.stop_sequence +
      stop.stop_headsign +
      stop.pickup_type +
      stop.drop_off_type +
      stop.shape_dist_traveled +
      stop.timepoint +
      stop.activity;
  }

  /**
   * Clone the current record with the new calendar and id
   */
  public clone(calendar: ScheduleCalendar, scheduleId: number): Schedule {
    return new Schedule(
      scheduleId,
      this.stopTimes.map(st => Object.assign({}, st, {trip_id: scheduleId})),
      this.tuid,
      this.rsid,
      calendar,
      this.mode,
      this.operator,
      this.stp,
      this.firstClassAvailable,
      this.reservationFlag,
      this.activity
    );
  }

  /**
   * Clone the current record with the new stop times
   */
  public withStopTimes(stopTimes: StopTime[]): Schedule {
    return new Schedule(
      this.id,
      stopTimes,
      this.tuid,
      this.rsid,
      this.calendar,
      this.mode,
      this.operator,
      this.stp,
      this.firstClassAvailable,
      this.reservationFlag,
      this.activity
    );
  }

  /**
   * Clone the current record with the new stop times
   */
  public withTuid(tuid: TUID): Schedule {
    return new Schedule(
      this.id,
      this.stopTimes,
      tuid,
      this.rsid,
      this.calendar,
      this.mode,
      this.operator,
      this.stp,
      this.firstClassAvailable,
      this.reservationFlag,
      this.activity
    );
  }

  /**
   * Convert to a GTFS Trip
   */
  public toTrip(serviceId: string, routeId: number): Trip {
    return {
      route_id: routeId,
      service_id: serviceId,
      trip_id: this.id,
      trip_headsign: this.tuid,
      trip_short_name: this.rsid,
      direction_id: 0,
      wheelchair_accessible: 0,
      bikes_allowed: 0,
      reservation_flag: this.reservationFlag,
      stp: this.stp,
      runs_from: this.calendar.runsFrom.format('YYYY-MM-DD'),
    };
  }

  /**
   * Convert to GTFS Route
   */
  public toRoute(): Route {
    return {
      route_id: this.id,
      agency_id: this.operator || "ZZ",
      route_short_name: `${this.operator || "Z"}:${this.origin}->${this.destination}`,
      route_long_name: `${this.operator || "Z"} ${this.modeDescription.toLowerCase()} service from ${this.origin} to ${this.destination}`,
      route_type: this.mode,
      route_text_color: null,
      route_color: null,
      route_url: null,
      route_desc: [this.modeDescription, this.classDescription, this.reservationDescription].join(". ")
    };
  }

  private get reservationDescription(): string {
    switch (this.reservationFlag) {
      case 'A': return "Reservation mandatory";
      case 'E': return "Reservation for bicycles essential";
      case 'R': return "Reservation recommended";
      case 'S': return "Reservation possible";
      default: return "Reservation not possible"
    }
  }

  private get modeDescription(): string {
    switch (this.mode) {
      case RouteType.Rail: return "Train";
      case RouteType.Subway: return "Underground";
      case RouteType.Tram: return "Tram";
      case RouteType.Bus: return "Bus";
      case RouteType.Gondola: return "Replacement bus";
      case RouteType.Ferry: return "Boat";
      default: return "Train";
    }
  }

  private get classDescription(): string {
    return this.firstClassAvailable ? "First class available" : "Standard class only";
  }

  public before(location: CRS): StopTime[] {
    return this.stopTimes.slice(0, this.stopTimes.findIndex(s => s.stop_id === location));
  }

  public beforeIncluding(location: CRS): StopTime[] {
    return this.stopTimes.slice(0, this.stopTimes.findIndex(s => s.stop_id === location) + 1);
  }

  public after(location: CRS): StopTime[] {
    return this.stopTimes.slice(this.stopTimes.findIndex(s => s.stop_id === location) + 1);
  }

  public afterIncluding(location: CRS): StopTime[] {
    return this.stopTimes.slice(this.stopTimes.findIndex(s => s.stop_id === location));
  }

  public stopAt(location: CRS): StopTime {
    return <StopTime> this.stopTimes.find(s => s.stop_id === location);
  }

}
