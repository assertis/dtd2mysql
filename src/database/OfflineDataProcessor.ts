import {DateTimeFormatter, LocalDate} from "js-joda";
import {DatabaseConfiguration} from "./DatabaseConnection";
import {execSync} from "child_process";
import {FARES_TABLES, faresView} from "../../config/fares/views";
import memoize = require("memoized-class-decorator");
import {ROUTEING_TABLES, routeingViews} from "../../config/routeing/views";
import {TIMETABLE_TABLES, timetableViews} from "../../config/timetable/views";
import {GTFS_TABLES, ojpViews} from "../../config/gtfs/views";


export class OfflineDataProcessor {

  public static DATE_FORMAT = 'dd_MM';
  private static DUMP_ONLY_STRUCTURES = ['ojp'];

  private readonly execSyncOptions = {cwd: "./"};

  private credentials;

  /**
   * @param databaseName
   * @param databaseConfiguration
   * @param commandExecutor - mainly to overwrite it in unit tests
   */
  public constructor(
    private readonly databaseName: string,
    public readonly databaseConfiguration: DatabaseConfiguration,
    private readonly commandExecutor: Function = execSync
  ) {
    this.credentials = `-h${this.databaseConfiguration.host} -u${this.databaseConfiguration.user} ${this.databaseConfiguration.password ? "-p" + this.databaseConfiguration.password : ""}`;
  }

  public getTemporaryDatabaseName(dbName: string = this.databaseName, date: LocalDate = LocalDate.now()) {
    return temporaryDatabaseNameFactory(dbName, date);
  }

  @memoize
  public getOriginalDatabase(): string {
    const query = `mysql ${this.credentials} -e "SHOW DATABASES"`;

    const result: string[] = this.commandExecutor(`${query}`, this.execSyncOptions)
      .toString()
      .split('\n')
      .map(s => s.trim());

    if (result.includes(this.getTemporaryDatabaseName())) {
      throw new Error('Database already exists')
    }
    if (result.includes(this.dbNameFromYesterday)) {
      return this.dbNameFromYesterday;
    }
    if (result.includes(this.dbNameFromDayBeforeYesterday)) {
      return this.dbNameFromDayBeforeYesterday;
    }
    // If there is no database from yesterday, from day before yesterday try to find the latest database
    const pattern = this.databaseName + '_';
    const regExp = new RegExp(pattern, 'g');
    const matchingDatabases = result.filter(db => db.match(regExp)).sort().reverse();
    // Return last database with data if exists
    if(matchingDatabases.length > 0) {
      return matchingDatabases[0];
    }

    // If there is no database with data use original database name
    if (result.includes(this.databaseName)) {
      return this.databaseName;
    }

    throw new Error('There is no original database to copy');
  }

  public createOfflineDatabase(cloneOriginalDb: boolean = false) {

    let originalDb: string;
    try {
      originalDb = this.getOriginalDatabase();
    }
    catch (err) {
      console.log('[INFO] No need of copying database because it`s already exists. Performing update on ' + this.getTemporaryDatabaseName());
      return; // Database already exists
    }
    const temporaryDatabase = this.getTemporaryDatabaseName(this.databaseName);
    const query = `mysql ${this.credentials} -e "CREATE DATABASE IF NOT EXISTS ${temporaryDatabase};"`;
    this.commandExecutor(`${query}`, this.execSyncOptions);

    const dumpOnlyStructure = OfflineDataProcessor.DUMP_ONLY_STRUCTURES.includes(this.databaseName) ? '-d' : '';

    if (cloneOriginalDb) {
      console.log('[INFO] Copying database ' + originalDb + ' to ' + temporaryDatabase);
      // Create database and insert data
      const commands = [
        // First dump only structure to make sure that you have all tables
        `mysqldump -d ${this.credentials}  ${originalDb} > ${originalDb}_structure.sql`,
        `mysql ${this.credentials} ${temporaryDatabase} < ${originalDb}_structure.sql`,

        `mysqldump ${dumpOnlyStructure} ${this.credentials}  ${originalDb} > ${originalDb}.sql`,
        `mysql ${this.credentials} ${temporaryDatabase} < ${originalDb}.sql`,
        `rm -rf ${originalDb}.sql`,
        `rm -rf ${originalDb}_structure.sql`
      ];

      commands.forEach(command => {
        this.commandExecutor(`${command}`, this.execSyncOptions);
      });
    }
  }

  public getViews(dbWithData: string = this.getTemporaryDatabaseName()): string {
    let views: string = "";
    switch (this.databaseName) {
      case 'fares':
        views = faresView;
        break;
      case 'routeing':
        views = routeingViews;
        break;
      case 'timetable':
        views = timetableViews;
        break;
      case 'ojp':
        views = ojpViews;
        break;
    }

    return views
      .replace(new RegExp(/{dbname}/g), dbWithData)
      .replace(new RegExp(/{orgdb}/g), this.databaseName);
  }

  public getTablesList(): string[] {
    switch(this.databaseName) {
      case 'fares':
        return FARES_TABLES;
      case 'routeing':
        return ROUTEING_TABLES;
      case 'timetable':
        return TIMETABLE_TABLES;
      case 'ojp':
        return GTFS_TABLES;
    }
    return [];
  }

  public get dbNameFromYesterday(): string {
    return this.getTemporaryDatabaseName(this.databaseName, LocalDate.now().minusDays(1));
  }

  public get dbNameFromDayBeforeYesterday(): string {
    return this.getTemporaryDatabaseName(this.databaseName, LocalDate.now().minusDays(2));
  }

  public removeDatabase(dbName: string) {
    const deleteCommand = `mysql ${this.credentials} -e "DROP DATABASE IF EXISTS ${dbName};"`;
    console.log(`[INFO] Removing outdated database ${dbName}`);
    this.commandExecutor(deleteCommand, this.execSyncOptions);
  }

  public removeOutdatedOfflineDatabase() {
    // Get databases matching pattern
    const command = `mysql ${this.credentials} -e "SHOW DATABASES;"`;
    const result = this.commandExecutor(command, {cwd: './'}).toString().split('\n');

    // Set of databases which shouldn't be removed
    const doNotRemove = [
      this.databaseName,
      this.dbNameFromDayBeforeYesterday,
      this.dbNameFromYesterday,
      this.getTemporaryDatabaseName()
    ];
    // Remove old databases
    const regExp = new RegExp(/^[a-z]*_[0-9]{2}_[0-9]{2}$/);
    for (const dbName of result) {
      if (dbName.includes(this.databaseName) && regExp.test(dbName) && !doNotRemove.includes(dbName)) {
        this.removeDatabase(dbName);
      }
    }
  }
}

export function temporaryDatabaseNameFactory(dbName: string, date: LocalDate = LocalDate.now()) {
  const dateStr: string = date.format(
    DateTimeFormatter.ofPattern('dd_MM')
  );
  return [dbName, dateStr].join('_');
}

export type DATABASE_NAME = string;

