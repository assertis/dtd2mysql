import {ImportIdmsFeedCommand} from "./ImportIdmsFeedCommand";

export class ImportIdmsGroupCommand extends ImportIdmsFeedCommand {

  public async doImport(filePath: string): Promise<void> {
    await this.doIdmsImport(filePath, 'tag:permittedstations');
  }

}
