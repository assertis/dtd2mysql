
import {CRS} from "./Stop";

export interface StopTime {
  trip_id: number;
  arrival_time: string;
  departure_time: string;
  stop_id: CRS;
  stop_sequence: number;
  stop_headsign: Platform;
  pickup_type: 0 | 1 | 2 | 3;
  drop_off_type: 0 | 1 | 2 | 3;
  shape_dist_traveled: null;
  timepoint: 0 | 1;
  activity: Activity;
}

export type Platform = string;

export type Activity = string | null;

export enum ActivityPattern {
  PickUpOnly = "PickUpOnly",
  SetDownOnly = "SetDownOnly",
  RequestStop = "RequestStop",
  Normal = "Normal"
}

export const ActivityMap = {
  "TB": ActivityPattern.PickUpOnly, // Train Begins
  "TF": ActivityPattern.SetDownOnly, // Train finish
  "D": ActivityPattern.SetDownOnly, // Train stops only to set down passengers
  "U": ActivityPattern.PickUpOnly, // Train stops only to take up passengers
  "T": ActivityPattern.Normal, // Train stops to take up and set down passengers
  "R": ActivityPattern.RequestStop // Train stops when required
};
