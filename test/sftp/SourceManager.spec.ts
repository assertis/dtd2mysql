import * as chai from "chai";
import {SourceManager} from "../../src/sftp/SourceManager";
import {PromiseSFTP} from "../../src/sftp/PromiseSFTP";
import {DatabaseConnection} from "../../src/database/DatabaseConnection";

describe("SourceManager", () => {

  it("skips if everything is applied", () => {
    const source = ['RJTTC002.ZIP', 'RJTTF001.ZIP'];
    const processed = ['RJTTC002.ZIP', 'RJTTF001.ZIP'];
    const expected = [];

    const manager = new SourceManager({} as PromiseSFTP, {} as DatabaseConnection);
    const pending = manager.calculatePendingFiles(source, processed);

    chai.expect(pending.join()).to.equal(expected.join());
  });

  it("applies all pending partials", () => {
    const source = ['RJTTC005.ZIP', 'RJTTC004.ZIP', 'RJTTC003.ZIP', 'RJTTF002.ZIP', 'RJTTC001.ZIP'];
    const processed = ['RJTTC003.ZIP', 'RJTTF002.ZIP'];
    const expected = ['RJTTC004.ZIP', 'RJTTC005.ZIP'];

    const manager = new SourceManager({} as PromiseSFTP, {} as DatabaseConnection);
    const pending = manager.calculatePendingFiles(source, processed);

    chai.expect(pending.join()).to.equal(expected.join());
  });

  it("applies a missing full update", () => {
    const source = ['RJTTC003.ZIP', 'RJTTF002.ZIP', 'RJTTC001.ZIP'];
    const processed = ['RJTTC003.ZIP'];
    const expected = ['RJTTF002.ZIP', 'RJTTC003.ZIP'];

    const manager = new SourceManager({} as PromiseSFTP, {} as DatabaseConnection);
    const pending = manager.calculatePendingFiles(source, processed);

    chai.expect(pending.join()).to.equal(expected.join());
  });

});
