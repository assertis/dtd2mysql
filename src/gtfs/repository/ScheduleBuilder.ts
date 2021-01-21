import {IdGenerator, STP} from "../native/OverlayRecord";
import {Schedule} from "../native/Schedule";
import {RouteType} from "../file/Route";
import moment = require("moment");
import {ScheduleCalendar} from "../native/ScheduleCalendar";
import {ScheduleStopTimeRow} from "./CIFRepository";
import {ActivityMap, StopTime} from "../file/StopTime";

const pickupActivities = ["T ", "TB", "U "];
const dropOffActivities = ["T ", "TF", "D "];
const coordinatedActivity = ["R "];
const notAdvertised = "N ";

const busCategories = ["BR", "BS"]; //Bus Replacement and Bus Schedule
/**
 * This class takes a stream of results and builds a list of Schedules
 */
export class ScheduleBuilder {
  private readonly schedules: Schedule[] = [];
  private maxId: number = 0;

  /**
   * Take a stream of ScheduleStopTimeRow, turn them into Schedule objects and add the result to the schedules
   */
  public loadSchedules(results: any): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let stops: StopTime[] = [];
      let prevRow: ScheduleStopTimeRow;
      let departureHour: number | undefined = undefined;

      const parseHour = (row: ScheduleStopTimeRow): number => {
        const time = row.public_arrival_time || row.public_departure_time || row.scheduled_arrival_time || row.scheduled_departure_time || '04:00';

        return parseInt(time.substr(0, 2), 10);
      }

      results.on("result", (row: ScheduleStopTimeRow) => {
        if (prevRow && prevRow.id !== row.id) {
          const schedule = this.createSchedule(prevRow, stops);
          if (schedule) {
            this.schedules.push(schedule);
          }
          stops = [];

          // Reset departure hour for the new service
          departureHour = parseHour(row);
        }

        if (row.stp_indicator !== STP.Cancellation) {
          if (!departureHour) {
            departureHour = parseHour(row);
          }

          const stop = this.createStop(row, stops.length + 1, departureHour);

          if (prevRow && prevRow.id === row.id && row.crs_code === prevRow.crs_code) {
            if (stop.pickup_type === 0 || stop.drop_off_type === 0) {
              stops[stops.length - 1] = Object.assign(stop, { stop_sequence: stops.length });
            }
          }
          else {
            stops.push(stop);
          }
        }

        prevRow = row;
      });

      results.on("end", () => {
        if (prevRow) {
          const schedule = this.createSchedule(prevRow, stops);
          if (schedule) {
            this.schedules.push(schedule);
          }
        }

        resolve();
      });
      results.on("error", reject);
    });
  }

  private verifyStops(stops: StopTime[]): void {
    let last: StopTime | undefined;

    const timeToSec = (time: string): number => {
      const hour = parseInt(time.substr(0, 2));
      const minute = parseInt(time.substr(3, 2));
      const second = parseInt(time.substr(6, 2));

      return (hour * 3600) + (minute * 60) + second;
    }

    for (const stop of stops) {
      // Catch
      const diff = timeToSec(stop.arrival_time) - timeToSec(stop.departure_time);
      if (diff > 180) {
        throw new Error(`Stop ${stop.stop_id} is time traveling by ${diff} sec`);
      }

      if (last) {
        const diff = timeToSec(last.departure_time) - timeToSec(stop.arrival_time);
        if (diff > 180) {
          throw new Error(`Time traveling between ${last.stop_id} ${stop.stop_id} by ${diff} sec`);
        }
      }

      last = stop;
    }
  }

  private dateToStr = (date: Date): string => {
    const year = date.getFullYear() % 2000;
    const month = date.getMonth() + 1;
    const day = date.getDay() + 1;

    return year + '/' + (month < 10 ? '0' : '') + month + '/' + (day < 10 ? '0' : '') + day;
  };

  private createSchedule(row: ScheduleStopTimeRow, stops: StopTime[]): Schedule | undefined {
    try {
      this.verifyStops(stops);
    } catch (e) {
      console.log(`Schedule ${row.train_uid}-${row.retail_train_id}-${this.dateToStr(row.runs_from)}-${row.stp_indicator} (ID: ${row.id}) has time travel: ${e.message}`);
      return undefined;
    }

    this.maxId = Math.max(this.maxId, row.id);

    /**
     * General rule for seating classes
     * Blank or B - First and standard
     * S - Standard class only.
     * For buses in data train_class is blank which causes some issues that 1st class fares are available on buses
     * which is not true
     */
    const mode = routeTypeIndex.hasOwnProperty(row.train_category) ? routeTypeIndex[row.train_category] : RouteType.Rail;
    const firstClassAvailable = busCategories.includes(row.train_category) ? false : row.train_class !== "S";
    return new Schedule(
      row.id,
      stops,
      row.train_uid,
      row.retail_train_id,
      new ScheduleCalendar(
        moment(row.runs_from),
        moment(row.runs_to),
        {
          0: row.sunday,
          1: row.monday,
          2: row.tuesday,
          3: row.wednesday,
          4: row.thursday,
          5: row.friday,
          6: row.saturday
        }
      ),
      mode,
      row.atoc_code,
      row.stp_indicator,
      firstClassAvailable,
      row.reservations,
      row.activity
    );
  }

  public getActivities(activity: string) {
    let activitiesPairs = activity.match(/.{1,2}/g);
    const result:string[] = [];
    if(Array.isArray(activitiesPairs)) {
      activitiesPairs = activitiesPairs.map(a => a.trim());
      for (const pair of activitiesPairs) {
        if (ActivityMap.hasOwnProperty(pair)) {
          result.push(pair);
          result.push(ActivityMap[pair]);
        }
      }
    }
    return result.length > 0 ? result.join('-') : null; // Join by sth different than ; or , because we load CSV files to database later
  }

  private createStop(row: ScheduleStopTimeRow, stopId: number, departHour: number): StopTime {
    let arrivalTime, departureTime;

    // if either public time is set, use those
    if (row.public_arrival_time || row.public_departure_time) {
      arrivalTime = this.formatTime(row.public_arrival_time, departHour);
      departureTime = this.formatTime(row.public_departure_time, departHour);
    }
    // if no public time at all (no set down or pick) use the scheduled time
    else {
      arrivalTime = this.formatTime(row.scheduled_arrival_time, departHour);
      departureTime = this.formatTime(row.scheduled_departure_time, departHour);
    }

    const activities = row.activity !== null ? (row.activity.match(/.{1,2}/g) || []) : [];
    const pickup = pickupActivities.find(a => activities.includes(a)) && !activities.includes(notAdvertised) ? 0 : 1;
    const coordinatedDropOff = coordinatedActivity.find(a => activities.includes(a)) ? 3 : 0;
    const dropOff = dropOffActivities.find(a => activities.includes(a)) ? 0 : 1;
    const activitiesPatterns = row.activity !== null ? this.getActivities(row.activity) : null;

    return {
      trip_id: row.id,
      arrival_time: (arrivalTime || departureTime),
      departure_time: (departureTime || arrivalTime),
      stop_id: row.crs_code,
      stop_sequence: stopId,
      stop_headsign: row.platform,
      pickup_type: coordinatedDropOff || pickup,
      drop_off_type: coordinatedDropOff || dropOff,
      shape_dist_traveled: null,
      timepoint: 1,
      activity: activitiesPatterns
    };
  }

  private formatTime(time: string | null, originDepartureHour: number) {
    if (time === null) return null;

    const departureHour = parseInt(time.substr(0, 2), 10);

    // If the service started after 4am and after the current stops departure hour we've probably rolled over midnight.
    // We force the jump to be at least 4 hours (i.e. 23:00 -> to 18:00 next day will work, 23:00 to 21:00 next day won't)
    // to get rid of small DTD issues where a passing point is 1-2 minutes after the next calling point, i.e.
    //  LIWEALING           0624 000000004  RL
    //  LIEALINGB 0625H0626H     062306234  RL    T
    if (originDepartureHour >= 4 && (originDepartureHour - departureHour > 4)) {
      return (departureHour + 24) + time.substr(2);
    }

    return time;
  }

  public get results(): ScheduleResults {
    return {
      schedules: this.schedules,
      idGenerator: this.getIdGenerator(this.maxId)
    };
  }

  private *getIdGenerator(startId: number): IterableIterator<number> {
    let id = startId + 1;
    while (true) {
      yield id++;
    }
  }
}

export interface ScheduleResults {
  schedules: Schedule[],
  idGenerator: IdGenerator
}

const routeTypeIndex: object = {
  "OO": RouteType.Rail,
  "XX": RouteType.Rail,
  "XZ": RouteType.Rail,
  "BR": RouteType.Gondola,
  "BS": RouteType.Bus,
  "OL": RouteType.Subway,
  "XC": RouteType.Rail,
  "SS": RouteType.Ferry
};
