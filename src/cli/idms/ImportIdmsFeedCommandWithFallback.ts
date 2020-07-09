import * as flow from 'xml-flow';
import {createReadStream} from "fs";

import {MySQLStream} from "../../database/MySQLStream";
import {XmlFile} from "../../feed/file/XmlFile";
import {ImportFeedTransactionalCommand} from "../ImportFeedTransactionalCommand";

export abstract class ImportIdmsFeedCommandWithFallback extends ImportFeedTransactionalCommand {

  abstract async doImport(filePath: string[]): Promise<void>;

  protected async doIdmsImport(filePath: string, tagSelector: string) {
    console.log(`Parsing ${filePath}`);

    const file = this.fileArray.find((file: XmlFile) => filePath.endsWith(file.fileName));
    if (file === undefined) {
      throw new Error(`Could not find file type for ${filePath}`);
    }

    await this.setupSchema(file);
    const tables = await this.tables(file, false);
    const tableStream = new MySQLStream(filePath, file, tables, true);

    const inFile = createReadStream(filePath);

    await new Promise((resolve, reject) => {
      const xmlStream: NodeJS.EventEmitter = flow(inFile);

      xmlStream.on(tagSelector, async function (tag: any) {
        await tableStream.write(tag);
      });

      xmlStream.on('end', async () => {
        await tableStream.close();
        resolve();
      });

      xmlStream.on('error', reject);
    });
  }
}
