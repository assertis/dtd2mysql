import * as flow from 'xml-flow';
import {createReadStream} from "fs";

import {ImportFeedCommand} from "../ImportFeedCommand";
import {MySQLStream} from "../../database";
import {XmlFile} from "../../feed/file/XmlFile";

export abstract class ImportIdmsFeedCommand extends ImportFeedCommand {

  abstract async doImport(filePath: string): Promise<void>;

  protected async doIdmsImport(filePath: string, tagSelector: string) {
    console.log(`Parsing ${filePath}`);

    const file = this.fileArray.find((file: XmlFile) => filePath.endsWith(file.fileName));
    if (file === undefined) {
      throw new Error(`Could not find file type for ${filePath}`);
    }

    await this.setupSchema(file);
    const tables = await this.tables(file);
    const tableStream = new MySQLStream(filePath, file, tables, true);

    const inFile = createReadStream(filePath);

    await new Promise((resolve, reject) => {
      const xmlStream: NodeJS.ReadableStream = flow(inFile);

      xmlStream.on(tagSelector, async function (tag: any) {
        if (await tableStream.write(tag) === false) {
          xmlStream.pause();
        }
      });

      tableStream.on('drain', async () => {
        xmlStream.resume();
      });

      xmlStream.on('end', async () => {
        await tableStream.close();
        resolve();
      });

      xmlStream.on('error', reject);
    });
  }
}
