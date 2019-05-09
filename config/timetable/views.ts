export const TIMETABLE_TABLES = [
  'additional_fixed_link',
  'alias',
  'association',
  'fixed_link',
  'idms_fixed_link',
  'log',
  'nfm64',
  'physical_station',
  'schedule',
  'schedule_extra',
  'stop_time',
  'tiploc',
  'z_schedule',
  'z_stop_time',
];

export const timetableViews = TIMETABLE_TABLES.map(j => `
  DROP TABLE IF EXISTS {orgdb}.${j};
  CREATE OR REPLACE VIEW {orgdb}.${j} AS SELECT * FROM {dbname}.${j};
  `).join('');



