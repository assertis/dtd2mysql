export const ROUTEING_TABLES = [
   'easement',
   'easement_detail',
   'easement_exception',
   'easement_location',
   'easement_text',
   'easement_toc',
   'link',
   'location',
   'log',
   'london_route',
   'london_station',
   'map',
   'new_station',
   'nfm64',
   'permitted_route',
   'route_data',
   'routeing_node',
   'routeing_point',
   'station_distance',
   'station_group',
   'station_link',
   'station_routeing_point'
];

export const routeingViews = 'START TRANSACTION;' +
  ROUTEING_TABLES.map(j => `
  DROP TABLE IF EXISTS {orgdb}.${j};
  CREATE OR REPLACE VIEW {orgdb}.${j} AS SELECT * FROM {dbname}.${j};
  `).join('') +
  'COMMIT;';



