import {ImportIdmsFeedCommand} from "./ImportIdmsFeedCommand";

export class ImportIdmsGroupLocationMappingCommand extends ImportIdmsFeedCommand {

  public async doImport(filePath: string): Promise<void> {
    await this.doIdmsImport(filePath, 'tag:location');
  }

}
