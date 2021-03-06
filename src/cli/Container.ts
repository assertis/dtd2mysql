import * as AWS from 'aws-sdk';
import * as proxy from "proxy-agent";
import * as memoize from "memoized-class-decorator";

import {DatabaseConfiguration, DatabaseConnection, OfflineDataProcessor} from "../database";
import config from "../../config";
import {CIFRepository} from "../gtfs/repository/CIFRepository";
import {stationCoordinates} from "../../config/gtfs/station-coordinates";
import {FileOutput} from "../gtfs/output/FileOutput";
import {GTFSOutput} from "../gtfs/output/GTFSOutput";
import {nfm64DownloadUrl} from "../../config/nfm64";
import {faresPath, PromiseSFTP, routingPath, SourceManager, timetablePath} from "../sftp";
import {
  idmsBucket,
  idmsFixedLinksFilename,
  idmsGroupFilename,
  idmsGroupLocationMappingFilename,
  idmsPrefix,
  idmsStationsRefDataFilename,
  idmsUrl
} from "../../config/idms";
import {S3Storage} from '../backup/S3Storage';
import {xFilesBucket, xFilesPrefix} from "../../config/timetable";
import {
  ImportIdmsFixedLinksCommand,
  ImportIdmsFixedLinksCommandWithFallback,
  ImportIdmsGroupCommand,
  ImportIdmsGroupCommandWithFallback, ImportIdmsGroupLocationMappingCommand,
  ImportIdmsStationsRefDataCommand
} from "./idms";
import {
  BackupDatabaseCommand,
  CheckAvailableFilesCommand,
  CleanFaresCommand,
  CleanupDatabasesCommand,
  CLICommand,
  DownloadAndProcessCommand,
  DownloadAndProcessInTransactionCommand,
  DownloadCommand,
  DownloadDirectoryFromS3Command,
  DownloadFileCommand,
  DownloadFileFromS3Command,
  GTFSImportCommand,
  ImportDirectoryTransactionalCommand,
  ImportFeedCommand,
  ImportFeedTransactionalCommand,
  ImportFeedTransactionalCommandInterface,
  OutputGTFSCommand,
  OutputGTFSZipCommand,
  RollbackDatabaseCommand,
  ShowHelpCommand
} from ".";

export class Container {

  private readonly GTFSScheduleHorizonMonths = 12;

  @memoize
  public getCommand(type: string): Promise<CLICommand> {
    switch (type) {
      case "--fares":
        return this.getFaresImportCommand();
      case "--fares-clean":
        return this.getCleanFaresCommand();
      case "--routeing":
        return this.getRouteingImportCommand();
      case "--timetable":
        return this.getTimetableImportCommand();
      case "--nfm64":
        return this.getNFM64ImportCommand();
      case "--idms-fixed-links":
        return this.getImportIdmsFixedLinksCommand();
      case "--idms-group":
        return this.getImportIdmsGroupCommand();
      case "--gtfs":
        return this.getOutputGTFSCommand();
      case "--gtfs-import":
        return this.getImportGTFSCommand();
      case "--gtfs-zip":
        return this.getOutputGTFSZipCommand();
      case "--download-fares":
        return this.getDownloadCommand(faresPath);
      case "--download-timetable":
        return this.getDownloadCommand(timetablePath);
      case "--download-x-files":
        return this.getDownloadXFilesCommand();
      case "--download-routeing":
        return this.getDownloadCommand(routingPath);
      case "--download-nfm64":
        return this.getDownloadNFM64Command();
      case "--download-idms-fixed-links":
        return this.getDownloadIdmsFixedLinksCommand();
      case "--download-idms-group":
        return this.getDownloadIdmsGroupCommand();
      case "--download-idms-stations-ref-data":
        return this.getDownloadIdmsStationsRefDataCommand();
      case "--download-idms-group-location-mapping":
        return this.getDownloadIdmsGroupLocationMappingCommand();
      case "--get-fares":
        return this.getDownloadAndProcessCommand(faresPath, this.getFaresImportCommand());
      case "--get-fares-in-transaction":
        return this.getDownloadAndProcessInTransactionCommand(faresPath, this.getFaresImportCommandWithFallback());
      case "--get-timetable-in-transaction":
        return this.getDownloadAndProcessInTransactionCommand(timetablePath, this.getTimetableImportCommandWithFallback());
      case "--get-x-files-in-transaction":
        return this.getDownloadAndProcessXFilesInTransactionCommand();
      case "--get-routeing-in-transaction":
        return this.getDownloadAndProcessInTransactionCommand(routingPath, this.getRouteingImportCommandWithFallback());
      case "--get-timetable":
        return this.getDownloadAndProcessCommand(timetablePath, this.getTimetableImportCommand());
      case "--get-routeing":
        return this.getDownloadAndProcessCommand(routingPath, this.getRouteingImportCommand());
      case "--get-nfm64":
        return this.getDownloadAndProcessNFM64Command();
      case "--get-nfm64-in-transaction":
        return this.getDownloadAndProcessInTransactionNFM64Command();
      case "--get-idms-fixed-links-in-transaction":
        return this.getDownloadAndProcessInTransactionIdmsFixedLinksCommand();
      case "--get-idms-group-in-transaction":
        return this.getDownloadAndProcessInTransactionIdmsGroupCommand();
      case "--get-idms-fixed-links":
        return this.getDownloadAndProcessIdmsFixedLinksCommand();
      case "--get-idms-group":
        return this.getDownloadAndProcessIdmsGroupCommand();
      case "--get-idms-stations-ref-data":
        return this.getDownloadAndProcessIdmsStationsRefDataCommand();
      case "--get-idms-group-location-mapping":
        return this.getDownloadAndProcessIdmsGroupLocationMappingCommand();
      case "--clean-databases":
        return this.getCleanupDatabasesCommand();
      case "--backup-fares":
        return this.getBackupDatabaseCommand('fares');
      case "--backup-timetable":
        return this.getBackupDatabaseCommand('timetable');
      case "--backup-routeing":
        return this.getBackupDatabaseCommand('routeing');
      case "--backup-ojp":
        return this.getBackupDatabaseCommand('ojp');
      case "--rollback-fares":
        return this.getRollbackDatabaseCommand('fares');
      case "--rollback-timetable":
        return this.getRollbackDatabaseCommand('timetable');
      case "--rollback-routeing":
        return this.getRollbackDatabaseCommand('routeing');
      case "--rollback-ojp":
        return this.getRollbackDatabaseCommand('ojp');
      case "--check-files-availability":
        return this.getCheckAvailableFilesCommand();
      default:
        return this.getShowHelpCommand();
    }
  }

  @memoize
  public async getCheckAvailableFilesCommand(): Promise<CheckAvailableFilesCommand> {
    const [
      sftp,
      fares,
      timetable
    ] = await Promise.all([
      this.getSFTP(),
      this.getDatabaseConnection(process.env.FARES_DATABASE),
      this.getDatabaseConnection(process.env.TIMETABLE_DATABASE)
    ]);
    const [
      faresFileManager,
      timetableFileManager
    ] = [
      new SourceManager(sftp, fares),
      new SourceManager(sftp, timetable)
    ];
    return new CheckAvailableFilesCommand(
      faresFileManager,
      timetableFileManager,
    );
  }

  @memoize
  public async getRollbackDatabaseCommand(databaseName: string): Promise<RollbackDatabaseCommand> {
    const bucketName = process.env.BUCKET_NAME || "";
    if (bucketName.length === 0) {
      throw new Error("Please set BUCKET_NAME variable");
    }
    return new RollbackDatabaseCommand(
      databaseName,
      process.env.DATABASE_USERNAME || "root",
      process.env.DATABASE_PASSWORD || "",
      process.env.DATABASE_HOSTNAME || "localhost",
      new S3Storage(await this.getS3(), bucketName),
    );
  }

  @memoize
  public async getBackupDatabaseCommand(databaseName: string): Promise<BackupDatabaseCommand> {
    const bucketName = process.env.BUCKET_NAME || "";
    if (bucketName.length === 0) {
      throw new Error("Please set BUCKET_NAME variable");
    }
    return new BackupDatabaseCommand(
      databaseName,
      process.env.DATABASE_USERNAME || "root",
      process.env.DATABASE_PASSWORD || "",
      process.env.DATABASE_HOSTNAME || "localhost",
      new S3Storage(await this.getS3(), bucketName),
    );
  }

  @memoize
  public async getCleanupDatabasesCommand(): Promise<CleanupDatabasesCommand> {
    return new CleanupDatabasesCommand(
      this.getDatabaseConnection(),
      new OfflineDataProcessor(process.env.DATABASE_NAME || "", this.getDatabaseConfiguration())
    );
  }


  @memoize
  public async getFaresImportCommand(): Promise<ImportFeedCommand> {
    return new ImportFeedCommand(
      await this.getDatabaseConnection(),
      config.fares,
      "/tmp/dtd/fares/"
    );
  }

  @memoize
  public async getFaresImportCommandWithFallback(): Promise<ImportFeedTransactionalCommand> {
    return new ImportFeedTransactionalCommand(
      await this.getDatabaseConnection(),
      config.fares,
      "/tmp/dtd/fares/",
      []
    );
  }

  @memoize
  public async getXFilesImportCommandWithFallback(): Promise<ImportDirectoryTransactionalCommand> {
    return new ImportDirectoryTransactionalCommand(
      await this.getDatabaseConnection(),
      config.timetableExtra,
      this.getXFilesTmpDirectory(),
      config.sanityChecks.timetable,
    );
  }

  @memoize
  public async getTimetableImportCommand(): Promise<ImportFeedCommand> {
    return new ImportFeedCommand(
      await this.getDatabaseConnection(),
      config.timetable,
      "/tmp/dtd/timetable/",
      this.getXFilesTmpDirectory(),
    );
  }

  @memoize
  public async getTimetableImportCommandWithFallback(): Promise<ImportFeedTransactionalCommand> {
    return new ImportFeedTransactionalCommand(
      await this.getDatabaseConnection(),
      config.timetable,
      "/tmp/dtd/timetable/",
      config.sanityChecks.timetable,
      this.getXFilesTmpDirectory(),
    );
  }

  @memoize
  public async getRouteingImportCommandWithFallback(): Promise<ImportFeedTransactionalCommand> {
    return new ImportFeedTransactionalCommand(
      await this.getDatabaseConnection(),
      config.routeing,
      "/tmp/dtd/routeing/",
      []
    );
  }

  @memoize
  public async getRouteingImportCommand(): Promise<ImportFeedCommand> {
    return new ImportFeedCommand(
      await this.getDatabaseConnection(),
      config.routeing,
      "/tmp/dtd/routeing/"
    );
  }

  @memoize
  public async getNFM64ImportCommandWithFallback(): Promise<ImportFeedTransactionalCommand> {
    return new ImportFeedTransactionalCommand(
      await this.getDatabaseConnection(),
      config.nfm64,
      "/tmp/dtd/nfm64/",
      []
    );
  }

  @memoize
  public async getNFM64ImportCommand(): Promise<ImportFeedCommand> {
    return new ImportFeedCommand(
      await this.getDatabaseConnection(),
      config.nfm64,
      "/tmp/dtd/nfm64/"
    );
  }

  @memoize
  public async getImportIdmsFixedLinksCommandWithFallback(): Promise<ImportIdmsFixedLinksCommandWithFallback> {
    return new ImportIdmsFixedLinksCommandWithFallback(
      await this.getDatabaseConnection(),
      config.idms,
      "/tmp/idms/",
      []
    );
  }

  @memoize
  public async getImportIdmsGroupCommandWithFallback(): Promise<ImportIdmsGroupCommandWithFallback> {
    return new ImportIdmsGroupCommandWithFallback(
      await this.getDatabaseConnection(),
      config.idms,
      "/tmp/idms/",
      []
    );
  }

  @memoize
  public async getImportIdmsFixedLinksCommand(): Promise<ImportIdmsFixedLinksCommand> {
    return new ImportIdmsFixedLinksCommand(
      await this.getDatabaseConnection(),
      config.idms,
      "/tmp/idms/"
    );
  }

  @memoize
  public async getImportIdmsGroupCommand(): Promise<ImportIdmsGroupCommand> {
    return new ImportIdmsGroupCommand(
      await this.getDatabaseConnection(),
      config.idms,
      "/tmp/idms/"
    );
  }

  @memoize
  public async getImportIdmsStationsRefDataCommand(): Promise<ImportIdmsStationsRefDataCommand> {
    return new ImportIdmsStationsRefDataCommand(
      await this.getDatabaseConnection(),
      config.idms,
      "/tmp/idms/"
    );
  }

  @memoize
  public async getImportIdmsGroupLocationMappingCommand(): Promise<ImportIdmsGroupLocationMappingCommand> {
    return new ImportIdmsGroupLocationMappingCommand(
      await this.getDatabaseConnection(),
      config.idms,
      "/tmp/idms/"
    );
  }

  @memoize
  public async getCleanFaresCommand(): Promise<CLICommand> {
    return new CleanFaresCommand(await this.getDatabaseConnection());
  }

  @memoize
  public async getShowHelpCommand(): Promise<CLICommand> {
    return new ShowHelpCommand();
  }

  @memoize
  public getImportGTFSCommand(): Promise<GTFSImportCommand> {
    return Promise.resolve(new GTFSImportCommand(this.getDatabaseConfiguration()));
  }

  @memoize
  private getOutputGTFSCommandWithOutput(output: GTFSOutput): OutputGTFSCommand {
    return new OutputGTFSCommand(
      new CIFRepository(
        this.getDatabaseConnection(),
        this.getDatabaseStream(),
        stationCoordinates,
        this.GTFSScheduleHorizonMonths,
      ),
      output
    );
  }

  @memoize
  private async getOutputGTFSCommand(): Promise<OutputGTFSCommand> {
    return this.getOutputGTFSCommandWithOutput(new FileOutput());
  }

  @memoize
  private async getOutputGTFSZipCommand(): Promise<OutputGTFSZipCommand> {
    return new OutputGTFSZipCommand(await this.getOutputGTFSCommand());
  }

  @memoize
  private async getDownloadCommand(path: string): Promise<DownloadCommand> {
    const [db, sftp] = await Promise.all([
      this.getDatabaseConnection(),
      this.getSFTP()
    ]);
    const fileManager = new SourceManager(sftp, db);
    return new DownloadCommand(fileManager, path);
  }

  @memoize
  private async getDownloadNFM64Command(): Promise<DownloadFileCommand> {
    return Promise.resolve(new DownloadFileCommand(nfm64DownloadUrl, 'nfm64.zip'));
  }

  private async getDownloadIdmsFileCommand(filename: string): Promise<DownloadFileFromS3Command | DownloadFileCommand> {
    const command = process.env.S3_KEY
      // Download via S3 API
      ? new DownloadFileFromS3Command(await this.getS3(), idmsBucket, idmsPrefix + filename, filename)
      // Download via HTTPS
      : new DownloadFileCommand(idmsUrl + filename, filename);

    return Promise.resolve(command);
  }

  private async getDownloadXFilesCommand(): Promise<DownloadDirectoryFromS3Command> {
    return new DownloadDirectoryFromS3Command(await this.getS3(), xFilesBucket, xFilesPrefix, this.getXFilesTmpDirectory());
  }

  private getXFilesTmpDirectory(): string {
    return '/tmp/x-files/';
  }

  @memoize
  private async getDownloadIdmsFixedLinksCommand(): Promise<DownloadFileFromS3Command | DownloadFileCommand> {
    return this.getDownloadIdmsFileCommand(idmsFixedLinksFilename);
  }

  @memoize
  private async getDownloadIdmsGroupCommand(): Promise<DownloadFileFromS3Command | DownloadFileCommand> {
    return this.getDownloadIdmsFileCommand(idmsGroupFilename);
  }

  @memoize
  private async getDownloadIdmsStationsRefDataCommand(): Promise<DownloadFileFromS3Command | DownloadFileCommand> {
    return this.getDownloadIdmsFileCommand(idmsStationsRefDataFilename);
  }

  @memoize
  private async getDownloadIdmsGroupLocationMappingCommand(): Promise<DownloadFileFromS3Command | DownloadFileCommand> {
    return this.getDownloadIdmsFileCommand(idmsGroupLocationMappingFilename);
  }

  public async getS3(): Promise<AWS.S3> {
    const key = process.env.S3_KEY;
    const secret = process.env.S3_SECRET;
    const region = process.env.S3_REGION || 'eu-west-1';
    const proxyUrl = process.env.S3_PROXY;
    const debug = process.env.DEBUG;
    const hasCredentials = !!(key && secret);

    if (!hasCredentials) {
      console.warn('S3_KEY or S3_SECRET is not set. If server do not have access to S3, process will fail!');
    }

    const config: AWS.S3.Types.ClientConfiguration = {
      region: region,
    };

    if (hasCredentials) {
      config.credentials = new AWS.Credentials(key || '', secret || '');
    }

    if (debug) {
      config.logger = console;
    }

    if (proxyUrl) {
      config.httpOptions = {agent: proxy(proxyUrl)};
    }

    return new AWS.S3(config);
  }

  @memoize
  private async getDownloadAndProcessCommand(path: string, importFeedProcess: Promise<ImportFeedCommand>): Promise<DownloadAndProcessCommand> {
    return new DownloadAndProcessCommand(
      await this.getDownloadCommand(path),
      await importFeedProcess,
      await this.getDatabaseConnection()
    );
  }

  private async getDownloadAndProcessInTransactionCommand(path: string, importFeedProcess: Promise<ImportFeedTransactionalCommandInterface>) {
    return new DownloadAndProcessInTransactionCommand(
      await this.getDownloadCommand(path),
      await importFeedProcess,
      await this.getDatabaseConnection()
    );
  }

  private async getDownloadAndProcessXFilesInTransactionCommand() {
    return new DownloadAndProcessInTransactionCommand(
      await this.getDownloadXFilesCommand(),
      await this.getXFilesImportCommandWithFallback(),
      await this.getDatabaseConnection()
    );
  }

  @memoize
  private async getDownloadAndProcessInTransactionNFM64Command(): Promise<DownloadAndProcessInTransactionCommand> {
    return new DownloadAndProcessInTransactionCommand(
      await this.getDownloadNFM64Command(),
      await this.getNFM64ImportCommandWithFallback(),
      await this.getDatabaseConnection()
    );
  }

  @memoize
  private async getDownloadAndProcessNFM64Command(): Promise<DownloadAndProcessCommand> {
    return new DownloadAndProcessCommand(
      await this.getDownloadNFM64Command(),
      await this.getNFM64ImportCommand(),
      await this.getDatabaseConnection()
    );
  }

  @memoize
  private async getDownloadAndProcessInTransactionIdmsFixedLinksCommand(): Promise<DownloadAndProcessInTransactionCommand> {
    return new DownloadAndProcessInTransactionCommand(
      await this.getDownloadIdmsFixedLinksCommand(),
      await this.getImportIdmsFixedLinksCommandWithFallback(),
      await this.getDatabaseConnection()
    );
  }

  @memoize
  private async getDownloadAndProcessInTransactionIdmsGroupCommand(): Promise<DownloadAndProcessInTransactionCommand> {
    return new DownloadAndProcessInTransactionCommand(
      await this.getDownloadIdmsGroupCommand(),
      await this.getImportIdmsGroupCommandWithFallback(),
      await this.getDatabaseConnection()
    );
  }

  @memoize
  private async getDownloadAndProcessIdmsFixedLinksCommand(): Promise<DownloadAndProcessCommand> {
    return new DownloadAndProcessCommand(
      await this.getDownloadIdmsFixedLinksCommand(),
      await this.getImportIdmsFixedLinksCommand(),
      await this.getDatabaseConnection()
    );
  }

  @memoize
  private async getDownloadAndProcessIdmsGroupCommand(): Promise<DownloadAndProcessCommand> {
    return new DownloadAndProcessCommand(
      await this.getDownloadIdmsGroupCommand(),
      await this.getImportIdmsGroupCommand(),
      await this.getDatabaseConnection()
    );
  }

  @memoize
  private async getDownloadAndProcessIdmsStationsRefDataCommand(): Promise<DownloadAndProcessCommand> {
    return new DownloadAndProcessCommand(
      await this.getDownloadIdmsStationsRefDataCommand(),
      await this.getImportIdmsStationsRefDataCommand(),
      await this.getDatabaseConnection()
    );
  }

  @memoize
  private async getDownloadAndProcessIdmsGroupLocationMappingCommand(): Promise<DownloadAndProcessCommand> {
    return new DownloadAndProcessCommand(
      await this.getDownloadIdmsGroupLocationMappingCommand(),
      await this.getImportIdmsGroupLocationMappingCommand(),
      await this.getDatabaseConnection()
    );
  }

  @memoize
  private getSFTP(): Promise<PromiseSFTP> {
    return PromiseSFTP.connect({
      host: process.env.SFTP_HOSTNAME || "dtd.atocrsp.org",
      username: process.env.SFTP_USERNAME,
      password: process.env.SFTP_PASSWORD,
      algorithms: {
        serverHostKey: ['ssh-dss']
      }
    });
  }

  @memoize
  public getDatabaseConnection(customDbName?: string): DatabaseConnection {
    return require('mysql2/promise').createPool({
      ...this.getDatabaseConfiguration(customDbName),
    });
  }

  @memoize
  public getDatabaseStream() {
    return require('mysql2').createPool(this.getDatabaseConfiguration());

  }

  public getDatabaseConfiguration(dbName?: string): DatabaseConfiguration {
    if (!dbName && !process.env.DATABASE_NAME) {
      throw new Error("Please set the DATABASE_NAME environment variable.");
    }

    return {
      host: process.env.DATABASE_HOSTNAME || "localhost",
      user: process.env.DATABASE_USERNAME || "root",
      password: process.env.DATABASE_PASSWORD || null,
      database: dbName || <string> process.env.DATABASE_NAME,
      connectionLimit: 20,
      multipleStatements: true
    };
  }

}
