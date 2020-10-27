import * as fs from "fs";
import {S3} from "aws-sdk";
import {CLICommand} from "./CLICommand";

export class DownloadDirectoryFromS3Command implements CLICommand {

  constructor(
    private readonly s3: S3,
    private readonly bucket: string,
    private readonly path: string,
    private readonly outputDirectory: string,
  ) {
  }

  public async run(argv: string[]): Promise<string[]> {
    if (!fs.existsSync(this.outputDirectory)) {
      fs.mkdirSync(this.outputDirectory);
    }

    const names = await this.listAvailableFileNames();

    await Promise.all(names.map(async (name: string): Promise<string> => {
      const filename = this.outputDirectory + name;
      const stream = this.s3.getObject({Bucket: this.bucket, Key: this.path + name}).createReadStream();

      console.log(`Downloading S3 file ${this.bucket}/${this.path}/${name}`);

      return this.downloadStream(stream, filename);
    }));

    return [this.outputDirectory];
  }

  private async listAvailableFileNames(): Promise<string[]> {
    const files = await this.s3.listObjects({Bucket: this.bucket, Prefix: this.path}).promise();

    if (files.Contents === undefined) {
      throw new Error(`Bucket ${name} empty or incorrect: ${this.bucket}${this.path}`);
    }

    return files.Contents.reduce((names: string[], item: S3.Object) => {
      const name = this.parseFilename(item);

      if (name !== undefined) {
        names.push(name);
      }

      return names;
    }, [] as string[]);
  }

  private parseFilename(item: S3.Object): string | undefined {
    if (!item.Key) {
      return undefined;
    }

    const [, name] = item.Key.split('/');

    if (name === undefined || name === '') {
      return undefined;
    }

    return name;
  }

  private async downloadStream(stream: NodeJS.ReadableStream, filename: string): Promise<string> {
    const file = fs.createWriteStream(filename);

    return new Promise((resolve, reject) => {
      stream.pipe(file);

      stream.on('end', () => {
        file.close();
        resolve(filename)
      });
      stream.on('error', reject);
    });
  }
}
