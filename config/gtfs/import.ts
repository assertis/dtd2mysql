
export const importSQL = `
TRUNCATE _tmp_transfers;
LOAD DATA LOCAL INFILE 'transfers.txt' INTO TABLE _tmp_transfers FIELDS TERMINATED BY ',' IGNORE 1 LINES;
TRUNCATE _tmp_routes;
LOAD DATA LOCAL INFILE 'routes.txt' INTO TABLE _tmp_routes FIELDS TERMINATED BY ',' IGNORE 1 LINES;
TRUNCATE _tmp_agency;
LOAD DATA LOCAL INFILE 'agency.txt' INTO TABLE _tmp_agency FIELDS TERMINATED BY ',' IGNORE 1 LINES;
TRUNCATE _tmp_calendar;
LOAD DATA LOCAL INFILE 'calendar.txt' INTO TABLE _tmp_calendar FIELDS TERMINATED BY ',' IGNORE 1 LINES;
TRUNCATE _tmp_calendar_dates;
LOAD DATA LOCAL INFILE 'calendar_dates.txt' INTO TABLE _tmp_calendar_dates FIELDS TERMINATED BY ',' IGNORE 1 LINES;
TRUNCATE _tmp_trips;
LOAD DATA LOCAL INFILE 'trips.txt' INTO TABLE _tmp_trips FIELDS TERMINATED BY ',' IGNORE 1 LINES;
TRUNCATE _tmp_links;
LOAD DATA LOCAL INFILE 'links.txt' INTO TABLE _tmp_links FIELDS TERMINATED BY ',' IGNORE 1 LINES;

TRUNCATE _tmp_stop_times;
LOAD DATA LOCAL INFILE 'stop_times.txt' INTO TABLE _tmp_stop_times FIELDS TERMINATED BY ',' IGNORE 1 LINES;


TRUNCATE _tmp_stops;
LOAD DATA LOCAL INFILE 'stops.txt' INTO TABLE _tmp_stops
FIELDS TERMINATED BY ','
IGNORE 1 LINES
(stop_id, @stop_code, stop_name, stop_desc, stop_lat, stop_lon, zone_id, stop_url, location_type, parent_station, stop_timezone, wheelchair_boarding)
SET stop_code = NULLIF(@stop_code, '');

DROP TABLE IF EXISTS stops;
RENAME TABLE _tmp_stops TO stops;
DROP TABLE IF EXISTS stop_times;
RENAME TABLE _tmp_stop_times TO stop_times;
DROP TABLE IF EXISTS links;
RENAME TABLE _tmp_links TO links;
DROP TABLE IF EXISTS trips;
RENAME TABLE _tmp_trips TO trips;
DROP TABLE IF EXISTS calendar_dates;
RENAME TABLE _tmp_calendar_dates TO calendar_dates;
DROP TABLE IF EXISTS calendar;
RENAME TABLE _tmp_calendar TO calendar;
DROP TABLE IF EXISTS routes;
RENAME TABLE _tmp_routes TO routes;
DROP TABLE IF EXISTS agency;
RENAME TABLE _tmp_agency TO agency;
DROP TABLE IF EXISTS transfers;
RENAME TABLE _tmp_transfers TO transfers;
`;
