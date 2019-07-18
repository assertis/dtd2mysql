import * as chai from "chai";
import {DatabaseConnection} from "../../src/database/DatabaseConnection";
import {MySQLTable} from "../../src/database/MySQLTable";
import {RecordAction} from "../../src/feed/record/Record";
import { MySQLTmpTable } from '../../src/database/MySQLTmpTable';
import { MockDatabaseConnection } from './MockDatabaseConnection';

describe("MySQLTmpTable", () => {

  // set of tests copied directly from MySQLTable.spec
  // TmpTale should behave exactly same way for "flush" action
  // scroll down to find "differences tests".
  it("inserts to a table", () => {
    const db = new MockDatabaseConnection();
    const table = new MySQLTmpTable(db, "my_table", false, 1);
    const action = RecordAction.Insert;
    const values = { some: "value" };

    table.apply({ action, values });

    chai.expect(db.queries[0]).is.equal("INSERT IGNORE INTO \`_tmp_my_table\` VALUES ?");
  });

  it("buffers inserts", () => {
    const db = new MockDatabaseConnection();
    const table = new MySQLTmpTable(db, "my_table", false, 2);
    const action = RecordAction.Insert;
    const values = { some: "value" };

    table.apply({ action, values });
    chai.expect(db.queries.length).is.equal(0);

    table.apply({ action, values });
    chai.expect(db.queries[0]).is.equal("INSERT IGNORE INTO \`_tmp_my_table\` VALUES ?");
  });

  it("flushes all remaining inserts", () => {
    const db = new MockDatabaseConnection();
    const table = new MySQLTmpTable(db, "my_table", false, 2);
    const action = RecordAction.Insert;
    const values = { some: "value" };

    table.apply({ action, values });
    table.flushAll();
    table.persist();

    chai.expect(db.queries[0]).is.equal("INSERT IGNORE INTO \`_tmp_my_table\` VALUES ?");
  });

  it("updates records", () => {
    const db = new MockDatabaseConnection();
    const table = new MySQLTmpTable(db, "my_table", false, 1);
    const action = RecordAction.Update;
    const values = { some: "value" };

    table.apply({ action, values });

    chai.expect(db.queries[0]).is.equal("REPLACE INTO \`_tmp_my_table\` VALUES ?");
  });

  it("deletes records", () => {
    const db = new MockDatabaseConnection();
    const table = new MySQLTmpTable(db, "my_table", false, 2);
    const action = RecordAction.Delete;
    const values = { some: "value", other: "value" };

    table.apply({ action, values });

    const values2 = { diff: "col", other: "value" };

    table.apply({ action, values: values2 });

    chai.expect(db.queries[0]).is.equal(
      "DELETE FROM \`_tmp_my_table\` WHERE (`some` = ? AND `other` = ?) OR (`diff` = ? AND `other` = ?)"
    );
  });

  // "differences tests"
  it("should create table if not exists", async () => {
    const db = new MockDatabaseConnection();
    db.addMockResponse('SHOW TABLES LIKE ?', []);
    await MySQLTmpTable.create(db, "my_table", false, 2);

    const createTable = db.queries.filter(s => s.includes("CREATE TABLE "));
    chai.expect(createTable.length).is.equal(1);

    const truncates = db.queries.filter(s => s.includes("TRUNCATE "));
    chai.expect(truncates.length).is.equal(0);
  });

  it("should not create table if exists but should truncate it", async () => {
    const db = new MockDatabaseConnection();
    db.addMockResponse('SHOW TABLES LIKE ?', ["_tmp_my_table"]);
    await MySQLTmpTable.create(db, "my_table", false, 2);

    const createTable = db.queries.filter(s => s.includes("CREATE TABLE "));
    chai.expect(createTable.length).is.equal(0);

    const truncates = db.queries.filter(s => s.includes("TRUNCATE "));
    chai.expect(truncates.length).is.equal(1);
  });

  it("should copy data to _tmp table if it's incremental update", async () => {
    const db = new MockDatabaseConnection();
    db.addMockResponse('SHOW TABLES LIKE ?', ["_tmp_my_table"]);
    await MySQLTmpTable.create(db, "my_table", true, 1);

    const createTable = db.queries.filter(s => s.includes("CREATE TABLE "));
    chai.expect(createTable.length).is.equal(0);

    const truncates = db.queries.filter(s => s.includes("TRUNCATE "));
    chai.expect(truncates.length).is.equal(1);

    const copyStatementRegex = new RegExp('^INSERT INTO .* SELECT \* FROM .*');
    const copyData = db.queries.filter(s => copyStatementRegex.test(s));
    chai.expect(copyData.length).is.equal(0);
  });

});
