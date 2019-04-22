

const TABLES = [
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

TABLES.map(t => {
  console.log(`RENAME TABLE timetable_15_04.${t} TO timetable.${t};`);
});
