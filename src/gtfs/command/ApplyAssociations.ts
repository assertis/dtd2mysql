import {Association, DateIndicator} from "../native/Association";
import {Schedule} from "../native/Schedule";
import {OverlapType, ScheduleCalendar} from "../native/ScheduleCalendar";
import {IdGenerator} from "../native/OverlayRecord";

/**
 * Iterate through the associations matching association schedules records with base schedules and applying the
 * association as a join or split.
 *
 * Splits prepend the base schedule (0, point of split) to the association schedule
 * Joins append the base schedule (point of split, end) to the association schedule
 */
export function applyAssociations(
  schedulesByTuid: ScheduleIndex,
  associationsIndex: AssociationIndex,
  keepOriginalAssociatedScheduleIds: number[],
  idGenerator: IdGenerator,
): ScheduleIndex {

  for (const associations of Object.values(associationsIndex)) {
    // for each association
    for (const association of associations) {
      const enableExtraTrainChange = keepOriginalAssociatedScheduleIds.includes(association.id);

      // get the date range for the associated schedules
      const assocCalendar = association.dateIndicator === DateIndicator.Next
        ? association.calendar.shiftForward()
        : association.calendar;

      // get the associated schedules inside the date range of the association
      for (const assocSchedule of findSchedules(schedulesByTuid[association.assocTUID] || [], assocCalendar)) {
        // get the date range for the target base schedule (same or previous day of associated schedule NOT the association)
        const baseCalendar = association.dateIndicator === DateIndicator.Next
          ? assocSchedule.calendar.shiftBackward()
          : assocSchedule.calendar;

        // find the matching base record
        const baseSchedules = findSchedules(schedulesByTuid[association.baseTUID] || [], baseCalendar);

        for (const baseSchedule of baseSchedules) {
          const [replacement, ...associatedSchedules] = association.apply(baseSchedule, assocSchedule, idGenerator, enableExtraTrainChange);

          // add the merged base and associated schedule to the TUID index
          (schedulesByTuid[replacement.tuid] = schedulesByTuid[replacement.tuid] || []).push(replacement);

          if (enableExtraTrainChange) {
            const extra = association.sliceSchedule(replacement)
              .withTuid(assocSchedule.tuid);

            if (extra.stopTimes.length > 0) {
              // We need to change the trip id
              (schedulesByTuid[assocSchedule.tuid] = schedulesByTuid[assocSchedule.tuid] || [])
                .push(extra.clone(assocSchedule.calendar, idGenerator.next().value));
            } else {
              console.log('Extra without calling points', extra.tuid, extra.rsid, association.assocLocation);
            }

          }

          // remove the original associated schedule and replace with any substitute schedules created
          schedulesByTuid[assocSchedule.tuid].splice(
            schedulesByTuid[assocSchedule.tuid].indexOf(assocSchedule), 1, ...associatedSchedules
          );
        }
      }
    }
  }

  return schedulesByTuid;
}

/**
 * Return schedules that overlap with the given calendar
 */
function findSchedules(schedules: Schedule[], calendar: ScheduleCalendar): Schedule[] {
  return schedules.filter(schedule => calendar.getOverlap(schedule.calendar) !== OverlapType.None);
}

export type ScheduleIndex = {
  [tuid: string]: Schedule[];
}

export type AssociationIndex = {
  [tuid: string]: Association[];
}
