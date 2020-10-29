import {ScheduleCalendar} from "./ScheduleCalendar";

export interface OverlayRecord {
  calendar: ScheduleCalendar;
  stp: STP;
  id: number;
  tuid: TUID;
  hash: string;

  clone(calendar: ScheduleCalendar, scheduleId: number): OverlayRecord;
}


export type TUID = string;
export type RSID = string;

export enum STP {
  Permanent = "P",
  Overlay = "O",
  New = "N",
  Cancellation = "C",
  Extra = "X",
}

export type IdGenerator = IterableIterator<number>;

export type ServiceReservation = 'A' | 'E' | 'R' | 'S' | null;
