import {OfflineDataProcessor} from "../../src/database/OfflineDataProcessor";
import * as chai from "chai";
import {DateTimeFormatter, LocalDate} from "js-joda";
import {ExecSyncOptions} from "child_process";

describe("OfflineDataProcessor", () => {

  const databaseConfiguration = {
    host: "localhost",
    user: "",
    password: null,
    database: "",
    connectionLimit: 2,
    multipleStatements: false,
  };

  it("Temporary database name creator", () => {
    const offlineDataProcessor = new OfflineDataProcessor(
      'test',
      databaseConfiguration
    );

    const temporarydatabaseName = offlineDataProcessor.getTemporaryDatabaseName(
      'dbname',
      LocalDate.of(2019, 2, 12)
    );
    chai.expect(temporarydatabaseName).to.equal('dbname_12_02');
  });

  it("Return original database name when any other doesn't exist", () => {
    const executor = (command: string, options?: ExecSyncOptions) => {
      return `
      test
      test_01_02
      `;
    };
    const offlineDataProcessor = new OfflineDataProcessor(
      'test',
      databaseConfiguration,
      executor
    );
    // Will return original database name
    chai.expect(offlineDataProcessor.getOriginalDatabase()).to.equal('test_01_02');
  });

  it("Return database name from yesterday when it exists", () => {
    const dbFromYesterday = 'test_' + LocalDate.now().minusDays(1).format(
      DateTimeFormatter.ofPattern(OfflineDataProcessor.DATE_FORMAT)
    );

    const executor = (command: string, options?: ExecSyncOptions) => {
      return `
      test
      ${dbFromYesterday}
      `;
    };
    const offlineDataProcessor = new OfflineDataProcessor(
      'test',
      databaseConfiguration,
      executor
    );
    chai.expect(offlineDataProcessor.getOriginalDatabase()).to.equal(dbFromYesterday);
  });

  it("Return database name from yesterday even when database from day before yesterday exists", () => {
    const dbFromYesterday = 'test_' + LocalDate.now().minusDays(1).format(
      DateTimeFormatter.ofPattern(OfflineDataProcessor.DATE_FORMAT)
    );

    const dbFromDayBeforeYesterday = 'test_' + LocalDate.now().minusDays(2).format(
      DateTimeFormatter.ofPattern(OfflineDataProcessor.DATE_FORMAT)
    );

    const executor = (command: string, options?: ExecSyncOptions) => {
      return `
      test
      ${dbFromYesterday}
      ${dbFromDayBeforeYesterday}
      `;
    };
    const offlineDataProcessor = new OfflineDataProcessor(
      'test',
      databaseConfiguration,
      executor
    );
    chai.expect(offlineDataProcessor.getOriginalDatabase()).to.equal(dbFromYesterday);
  });

  it("getViews will return proper sql query", () => {
    const databaseName = 'fares';
    const offlineDataProcessor = new OfflineDataProcessor(
      databaseName,
      databaseConfiguration
    );

    const viewsSql = offlineDataProcessor.getViews();
    chai.expect(viewsSql).to.not.contain('{dbname}');
    chai.expect(viewsSql).to.not.contain('{orgdb}');
    chai.expect(viewsSql).to.contain(offlineDataProcessor.getTemporaryDatabaseName());
    chai.expect(viewsSql).to.contain(databaseName);
  });

});