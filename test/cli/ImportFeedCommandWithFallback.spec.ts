import * as chai from "chai";
import { ImportFeedCommandWithFallback } from '../../src/cli/ImportFeedCommandWithFallback';
import specification from '../../config/fares';
import * as fs from 'fs';

/**
 * THIS IS NOT A UNIT TEST !!!!!
 * IT"S DISABLED (it.skip()) BY DEFAULT !!!!
 *
 * if you want to run it, remove all .skip() (so it will be like regular it("...", () => { ... }); ).
 * Please do not forget to set DATABASE_NAME environment variable.
 * It do not have default option to not override (corrupt) any database which is not
 * specified explicit. If you don't want to corrupt your local `fares` database, set it like:
 * `DATABASE_NAME=test_fares` (please, make sure that this DB exists locally :) ).
 * You can also run those tests at some external DB by setting envs like:
 * DATABASE_HOSTNAME, DATABASE_USERNAME, DATABASE_NAME
 * but in opposite to DATABASE_NAME those have default values.
 */
describe("It should perform data update and persist results only in case of success", () => {

  const db = require('mysql2/promise').createPool({
    host: process.env.DATABASE_HOSTNAME || "localhost",
    user: process.env.DATABASE_USERNAME || "root",
    password: process.env.DATABASE_PASSWORD || null,
    database: <string>process.env.DATABASE_NAME,
    connectionLimit: 20,
    multipleStatements: true
  });

  const fixturesDir = __dirname + "/../fixtures";

  const getCommand = (): ImportFeedCommandWithFallback => {
    if (!process.env.DATABASE_NAME) {
      throw new Error("Please set the DATABASE_NAME environment variable.");
    }

    const tmpFolder = fixturesDir + "/fares/";

    return new ImportFeedCommandWithFallback(db, specification, tmpFolder);
  };

  afterEach(() => {
    const path = fixturesDir + "/fares/";
    fs.readdirSync(path).map(
      file => fs.unlinkSync(path + file)
    );
  });

  /**
   * Import RJFAC feed (incremental feed - "C" in name point that).
   * That mean you won't overwrite existing data if there is no record for particular row.
   * Only records described in feed will be affected.
   */
  it.skip("should persist data in database in case of successful import and do not overwrite existing data", async () => {
    const command = getCommand();
    const filePath = __dirname + "/../fixtures/RJFAC263_slim.ZIP";

    await db.query(fs.readFileSync(fixturesDir + "/test_railcards.sql", 'utf8'));

    await command.doImport(filePath);

    const [tmpTables] = await db.query("SHOW TABLES LIKE '_tmp_%'");
    chai.expect(tmpTables.length).equal(0);

    const [railcardsImported] = await db.query("SELECT count(*) as 'count' FROM railcard");
    chai.expect(railcardsImported[0].count).equal(361);
  });

  /**
   * Import RJFAF feed (full feed - "F" in name at 5th position point that).
   * That mean you will overwrite existing data.
   * Only records described in feed will remain.
   */
  it.skip("should persist data in database in case of successful import and overwrite existing data", async () => {
    const command = getCommand();
    const filePath = __dirname + "/../fixtures/RJFAF263_slim.ZIP";

    await db.query(fs.readFileSync(fixturesDir + "/test_railcards.sql", 'utf8'));

    await command.doImport(filePath);

    const [tmpTables] = await db.query("SHOW TABLES LIKE '_tmp_%'");
    chai.expect(tmpTables.length).equal(0);

    const [railcardsImported] = await db.query("SELECT count(*) as 'count' FROM railcard");
    chai.expect(railcardsImported[0].count).equal(360);
  });

  /**
   * If we have corrupted data feed (or failure by any other reason),
   * database "real" tables should not be affected. Ie. if .RLC file is corrupted
   * not just railcard table should be untouched, all other tables should be unaffected
   * (to keep data consistency).
   */
  it.skip("should not change data in database in case of failed import", async () => {
    const command = getCommand();
    const filePath = __dirname + "/../fixtures/RJFAC263_corrupted.ZIP";

    await db.query(fs.readFileSync(fixturesDir + "/test_railcards.sql", 'utf8'));
    await db.query(fs.readFileSync(fixturesDir + "/test_tickets.sql", 'utf8'));

    try {
      await command.doImport(filePath);
    } catch (err) {
      // do nothing - we expect error here.
      // just check below how it affected database state.
    }
    const [tmpTables] = await db.query("SHOW TABLES LIKE '_tmp_%'");
    chai.expect(tmpTables.length).equal(0);

    const [railcardsImported] = await db.query("SELECT count(*) as 'count' FROM railcard");
    chai.expect(railcardsImported[0].count).equal(1);
    const [ticketsImported] = await db.query("SELECT count(*) as 'count' FROM ticket_type");
    chai.expect(ticketsImported[0].count).equal(3);
  });

});
