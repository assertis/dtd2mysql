import {ImportIdmsFeedCommandWithFallback} from "./ImportIdmsFeedCommandWithFallback";

export class ImportIdmsGroupCommandWithFallback extends ImportIdmsFeedCommandWithFallback {

  public async doImport(filePath: string[]): Promise<void> {
    if (undefined !== filePath[0]) {
      await this.doIdmsImport(filePath[0], 'tag:permittedstations');
    }
  }

}
