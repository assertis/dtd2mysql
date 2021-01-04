import {ImportIdmsFeedCommand} from "./ImportIdmsFeedCommand";

export class ImportIdmsStationsRefDataCommand extends ImportIdmsFeedCommand {

  public async doImport(filePath: string): Promise<void> {
    await this.doIdmsImport(filePath, 'tag:station');
  }

}
