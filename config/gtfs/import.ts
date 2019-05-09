
export const importSQL = `
CREATE TABLE tmp_transfers;
LOAD DATA LOCAL INFILE 'transfers.txt' INTO TABLE tmp_transfers FIELDS TERMINATED BY ',' IGNORE 1 LINES;
CREATE TABLE tmp_routes;
LOAD DATA LOCAL INFILE 'routes.txt' INTO TABLE tmp_routes FIELDS TERMINATED BY ',' IGNORE 1 LINES;
CREATE TABLE tmp_agency;
LOAD DATA LOCAL INFILE 'agency.txt' INTO TABLE tmp_agency FIELDS TERMINATED BY ',' IGNORE 1 LINES;
CREATE TABLE tmp_calendar;
LOAD DATA LOCAL INFILE 'calendar.txt' INTO TABLE tmp_calendar FIELDS TERMINATED BY ',' IGNORE 1 LINES;
CREATE TABLE tmp_calendar_dates;
LOAD DATA LOCAL INFILE 'calendar_dates.txt' INTO TABLE tmp_calendar_dates FIELDS TERMINATED BY ',' IGNORE 1 LINES;
CREATE TABLE tmp_trips;
LOAD DATA LOCAL INFILE 'trips.txt' INTO TABLE tmp_trips FIELDS TERMINATED BY ',' IGNORE 1 LINES;
CREATE TABLE tmp_links;
LOAD DATA LOCAL INFILE 'links.txt' INTO TABLE tmp_links FIELDS TERMINATED BY ',' IGNORE 1 LINES;

CREATE TABLE tmp_stop_times;
LOAD DATA LOCAL INFILE 'stop_times.txt' INTO TABLE tmp_stop_times FIELDS TERMINATED BY ',' IGNORE 1 LINES;


CREATE TABLE tmp_stops;
LOAD DATA LOCAL INFILE 'stops.txt' INTO TABLE tmp_stops
FIELDS TERMINATED BY ','
IGNORE 1 LINES
(stop_id, @stop_code, stop_name, stop_desc, stop_lat, stop_lon, zone_id, stop_url, location_type, parent_station, stop_timezone, wheelchair_boarding)
SET stop_code = NULLIF(@stop_code, '');
`;