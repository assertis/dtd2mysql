import {ImportIdmsFeedCommand} from "./ImportIdmsFeedCommand";

export class ImportIdmsFixedLinksCommand extends ImportIdmsFeedCommand {

  public async doImport(filePath: string): Promise<void> {
    await this.doIdmsImport(filePath, 'tag:fixedlink');
  }

}
