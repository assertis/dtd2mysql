![dtd2mysql](logo.png)

[![Travis](https://img.shields.io/travis/planarnetwork/dtd2mysql.svg?style=flat-square)](https://travis-ci.org/planarnetwork/dtd2mysql) ![npm](https://img.shields.io/npm/v/dtd2mysql.svg?style=flat-square) ![npm](https://img.shields.io/npm/dw/dtd2mysql.svg?style=flat-square) 
![David](https://img.shields.io/david/planarnetwork/dtd2mysql.svg?style=flat-square)




An import tool for the British rail fares, routeing and timetable feeds into a database.

Although both the timetable and fares feed are open data you will need to obtain the fares feed via the [ATOC website](http://data.atoc.org/fares-data). The formal specification for the data inside the feed also available on the [ATOC website](http://data.atoc.org/sites/all/themes/atoc/files/SP0035.pdf).

At the moment only MySQL compatible databases are supported but it could be extended to support other data stores. PRs are very welcome.

## Download / Install

You don't have to install it globally but it makes it easier if you are not going to use it as part of another project. The `-g` option usually requires `sudo`. It is not necessary to git clone this repository unless you would like to contribute.

```
npm install -g dtd2mysql
```

## Fares 

Each of these commands relies on the database settings being set in the environment variables. For example `DATABASE_USERNAME=root DATABASE_NAME=fares dtd2mysql --fares-clean`.

### Import

Import the fares into a database, creating the schema if necessary. This operation is destructive and will remove any existing data.

```
dtd2mysql --fares /path/to/RJFAFxxx.ZIP
```
### Clean 

Removes expired data and invalid fares, corrects railcard passenger quantities, adds full date entries to restriction date records. This command will occasionally fail due to a MySQL timeout (depending on hardware), re-running the command should correct the problem.

```
dtd2mysql --fares-clean
```
## Timetables
### Import

Import the timetable information into a database, creating the schema if necessary. This operation is destructive and will remove any existing data.

```
dtd2mysql --timetable /path/to/RJTTFxxx.ZIP
```

### Convert to GTFS

Convert the DTD/TTIS version of the timetable (up to 3 months into the future) to GTFS. 

```
dtd2mysql --timetable /path/to/RJTTFxxx.ZIP
dtd2mysql --gtfs-zip filename-of-gtfs.zip
```

## Routeing Guide
### Import
```
dtd2mysql --routeing /path/to/RJRGxxxx.ZIP
# optional
dtd2mysql --nfm64 /path/to/nfm64.zip 
```

## Download from SFTP server

The download commands will take the latest full refresh from an SFTP server (by default the DTD server).

Requires the following environment variables:

```
SFTP_USERNAME=dtd_username
SFTP_PASSWORD=dtd_password
SFTP_HOSTNAME=dtd_hostname (this will default to dtd.atocrsp.org)
```

There is a command for each feed

```
dtd2mysql --download-fares /path/
dtd2mysql --download-timetable /path/
dtd2mysql --download-routeing /path/
dtd2mysql --download-nfm64 /path/
```

Or download and process in one command

```
dtd2mysql --get-fares
dtd2mysql --get-timetable
dtd2mysql --get-routeing
dtd2mysql --get-nfm64
```

## IDMS Fixed Links

### Import
```
dtd2mysql --idms-fixed-links /path/to/FixedLinks_v1.0.xml
```

### To get around the IP restriction on the IDMS S3 bucket

Start a tunnel to an S3 server that has access to the bucket.

```
ssh -D 12345 -C -N [your username]@app1.live.aws.assertis
```

Then add the following environment variables to the call:

```
S3_KEY="[your S3 key]" S3_SECRET="[your S3 secret]" S3_REGION="[your S3 region]" S3_PROXY="socks5://127.0.0.1:12345" dtd2mysql --download-idms-fixed-links /tmp/FixedLinks_v1.0.xml
```

## Offline data processing

Since April 2019 data update clone the `original` database `db` to `db_dd_mm`
where `dd` is day of month number and `mm` is month number.

The word `original` means it's the last correct database with data.
So day after day this process can look like that:
* copy `fares` (`original` database) to `fares_01_01`
* update fares data in `fares_01_01` and create views in `fares` which will select data from `fares_01_01`
* Next day copy `fares_01_01` to `fares_02_01` (because `original` database is `fares_01_01` now). But view will always be created in `fares`

Few benefits of that:
* Receiver/customer doesn't have to worry which database to use because `fares` database is always connected to the newest data.
* We keep in database `fares`, `fares_01_01`, `fares_02_01` so database with views, database with data from yesterday and from the day before yesterday
* In case when data update break our services you can simply switch to the older database.
Let's say that update which we have in `fares_04_01` breaks something.
By using `npm run dataVersion fares fares_03_01` you switch the views in `fares` to use data from `fares_03_01`
when everything was fine. You still have access to `fares_03_01` so you can investigate on your machine what happened, but bring service back really fast by switching the databases.
But if `fares_03_01` also has corrupted data you can also switch it to the database from the day before yesterday `fares_02_01` because it will also be accessible in database.
Older databases so `fares_01_01` for example are always cleaned when we run update.

If database for "today" exists update will be performed on existing dataabse
and views will be just updated.  

## Notes
### null values

Values marked as all asterisks, empty spaces, or in the case of dates - zeros, are set to null. This is to preverse the integrity of the column type. For instance a route code is numerical although the data feed often uses ***** to signify any so this value is converted to null. 

### keys
Although every record format has a composite key defined in the specification an `id` field is added as the fields in the composite key are sometimes null. This is no longer supported in modern versions of MariaDB or MySQL.

### missing data
At present journey segments, class legends, rounding rules, print formats  and the fares data feed meta data are not imported. They are either deprecated or irrelevant. Raise an issue or PR if you would like them added.

### timetable format

The timetable data does not map to a relational database in a very logical fashion so all LO, LI and LT records map to a single `stop_time` table.

### GTFS feed cutoff date

Only schedule records that **start** up to 3 months into the future (using date of import as a reference point) are exported to GTFS for performance reasons.
This will cause any data after that point to be either incomplete or incorrect, as override/cancellation records after that will be ignored as well.

## Contributing

Issues and PRs are very welcome. To get the project set up run

```
git clone git@github.com:planarnetwork/dtd2mysql
npm install --dev
npm test
```

If you would like to send a pull request please write your contribution in TypeScript and if possible, add a test.

## License

This software is licensed under [GNU GPLv3](https://www.gnu.org/licenses/gpl-3.0.en.html).

Copyright 2017 Linus Norton.
