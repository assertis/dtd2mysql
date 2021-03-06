import {Schedule} from "./Schedule";
import {ScheduleCalendar} from "./ScheduleCalendar";
import {CRS} from "../file/Stop";
import {IdGenerator, OverlayRecord, STP, TUID} from "./OverlayRecord";
import {StopTime} from "../file/StopTime";
import {formatDuration} from "./Duration";
import moment = require("moment");

export class Association implements OverlayRecord {

  constructor(
    public readonly id: number,
    public readonly baseTUID: TUID,
    public readonly assocTUID: TUID,
    public readonly assocLocation: CRS,
    public readonly dateIndicator: DateIndicator,
    public readonly assocType: AssociationType,
    public readonly calendar: ScheduleCalendar,
    public readonly stp: STP
  ) {
  }

  public get tuid(): TUID {
    return this.baseTUID + "_" + this.assocTUID + "_";
  }

  public get hash(): string {
    return this.tuid + this.assocLocation + this.calendar.binaryDays;
  }

  /**
   * Clone the association with a different calendar
   */
  public clone(calendar: ScheduleCalendar, id: number): Association {
    return new Association(
      id,
      this.baseTUID,
      this.assocTUID,
      this.assocLocation,
      this.dateIndicator,
      this.assocType,
      calendar,
      this.stp
    );
  }

  /**
   * Apply the join or split to the associated schedule. Check for any days that the associated service runs but the
   * association does not and create additional schedules to cover those periods.
   */
  public apply(base: Schedule, assoc: Schedule, idGenerator: IdGenerator, makeMergePointAccessible: boolean = false): Schedule[] {
    const assocCalendar = this.dateIndicator === DateIndicator.Next ? this.calendar.shiftForward() : this.calendar;
    const schedules = [this.mergeSchedules(base, assoc, makeMergePointAccessible)];

    // if the associated train starts running before the association, clone the associated schedule for those dates
    if (assoc.calendar.runsFrom.isBefore(assocCalendar.runsFrom)) {
      const before = assoc.calendar.clone(assoc.calendar.runsFrom, assocCalendar.runsFrom.clone().subtract(1, "days"));

      schedules.push(assoc.clone(before, idGenerator.next().value));
    }

    // if the associated train runs after the association has finished, clone the associated schedule for those dates
    if (assoc.calendar.runsTo.isAfter(assocCalendar.runsTo)) {
      const after = assoc.calendar.clone(assocCalendar.runsTo.clone().add(1, "days"), assoc.calendar.runsTo);

      schedules.push(assoc.clone(after, idGenerator.next().value));
    }

    // for each exclude day of the association
    for (const excludeDay of Object.values(assocCalendar.excludeDays)) {
      schedules.push(assoc.clone(assoc.calendar.clone(excludeDay, excludeDay), idGenerator.next().value));
    }

    return schedules;
  }

  /**
   * Apply the split or join to the given schedules
   */
  private mergeSchedules(base: Schedule, assoc: Schedule, makeMergePointAccessible: boolean = false): Schedule {
    let tuid: TUID;
    let start: StopTime[];
    let assocStop: StopTime;
    let end: StopTime[];
    const baseStopTime = base.stopAt(this.assocLocation);
    const assocStopTime = assoc.stopAt(this.assocLocation);

    // this should never happen, unless data feed is corrupted. It will prevent us from update failure (see: JP-404).
    if (baseStopTime === undefined || assocStopTime === undefined) {
      return assoc;
    }

    if (this.assocType === AssociationType.Split) {
      tuid = base.tuid + "_" + assoc.tuid;

      start = base.before(this.assocLocation);
      assocStop = this.mergeAssociationStop(baseStopTime, assocStopTime, makeMergePointAccessible);
      end = assoc.after(this.assocLocation);
    } else {
      tuid = assoc.tuid + "_" + base.tuid;

      start = assoc.before(this.assocLocation);
      assocStop = this.mergeAssociationStop(assocStopTime, baseStopTime, makeMergePointAccessible);
      end = base.after(this.assocLocation)
    }

    let stopSequence: number = 1;

    const stops = [
      ...start.map(s => cloneStop(s, stopSequence++, assoc.id)),
      cloneStop(assocStop, stopSequence++, assoc.id),
      ...end.map(s => cloneStop(s, stopSequence++, assoc.id, assocStop))
    ];

    const calendar = this.dateIndicator === DateIndicator.Next ? assoc.calendar.shiftBackward() : assoc.calendar;

    return new Schedule(
      assoc.id,
      stops,
      tuid,
      assoc.rsid,
      // only take the part of the schedule that the association applies to
      calendar.clone(
        moment.max(this.calendar.runsFrom, calendar.runsFrom),
        moment.min(this.calendar.runsTo, calendar.runsTo)
      ),
      assoc.mode,
      assoc.operator,
      assoc.stp,
      assoc.firstClassAvailable,
      assoc.reservationFlag,
      assoc.activity
    )
  }

  /**
   * Apply the split or join to the given schedules
   */
  public sliceSchedule(schedule: Schedule): Schedule {
    const stops: StopTime[] = this.assocType === AssociationType.Split
      ? schedule.afterIncluding(this.assocLocation)
      : schedule.beforeIncluding(this.assocLocation);

    let stopSequence: number = 1;
    const newStops = stops.map(s => cloneStop(s, stopSequence++, schedule.id));

    return schedule.withStopTimes(newStops);
  }

  /**
   * Take the arrival time of the first stop and the departure time of the second stop and put them into a new stop
   */
  public mergeAssociationStop(arrivalStop: StopTime, departureStop: StopTime, makeMergePointAccessible: boolean): StopTime {
    let arrivalTime = moment.duration(arrivalStop.arrival_time);
    let departureTime = moment.duration(departureStop.departure_time);

    if (arrivalTime.asSeconds() > departureTime.asSeconds()) {
      if (this.dateIndicator === DateIndicator.Next) {
        departureTime.add(1, "days");
      } else {
        arrivalTime = moment.duration(departureStop.arrival_time);
      }
    }

    const pickup = makeMergePointAccessible ? 0 : departureStop.pickup_type;
    const dropOff = makeMergePointAccessible ? 0 : arrivalStop.drop_off_type;

    return Object.assign({}, arrivalStop, {
      arrival_time: formatDuration(arrivalTime.asSeconds()),
      departure_time: formatDuration(departureTime.asSeconds()),
      pickup_type: pickup,
      drop_off_type: dropOff,
    });
  }

}

/**
 * Clone the given stop overriding the sequence number and modifying the arrival/departure times if necessary
 */
function cloneStop(stop: StopTime, stopSequence: number, tripId: number, assocStop: StopTime | null = null): StopTime {
  const assocTime = moment.duration(assocStop && assocStop.arrival_time ? assocStop.arrival_time : "00:00");
  const departureTime = stop.departure_time ? moment.duration(stop.departure_time) : undefined;

  if (departureTime && departureTime.asSeconds() < assocTime.asSeconds()) {
    departureTime.add(1, "day");
  }

  const arrivalTime = stop.arrival_time ? moment.duration(stop.arrival_time) : undefined;

  if (arrivalTime && arrivalTime.asSeconds() < assocTime.asSeconds()) {
    arrivalTime.add(1, "day");
  }

  return Object.assign({}, stop, {
    arrival_time: arrivalTime ? formatDuration(arrivalTime.asSeconds()) : undefined,
    departure_time: departureTime ? formatDuration(departureTime.asSeconds()) : undefined,
    stop_sequence: stopSequence,
    trip_id: tripId
  });
}

export enum DateIndicator {
  Same = "S",
  Next = "N",
  Previous = "P"
}

export enum AssociationType {
  Split = "VV",
  Join = "JJ",
  NA = ""
}
