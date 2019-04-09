const TABLES = [
  'agency',
  'calendar',
  'calendar_dates',
  'links',
  'routes',
  'shapes',
  'stop_times',
  'stops',
  'transfers',
  'trips'
];

export const ojpViews = 'START TRANSACTION;' +
  TABLES.map(j => `
  DROP TABLE IF EXISTS {orgdb}.${j};
  CREATE OR REPLACE VIEW {orgdb}.${j} AS SELECT * FROM {dbname}.${j};
  `).join('') +
  'CREATE OR REPLACE VIEW {orgdb}.transfer_patterns AS SELECT * FROM transfer_patterns.transfer_patterns;'
  ' COMMIT;';



