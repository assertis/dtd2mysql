import { Storage } from "./Storage";
import { S3 } from 'aws-sdk';
import * as path from 'path';
import * as fs from 'fs';

export class S3Storage implements Storage {

  public constructor(
    private readonly s3: S3,
    private readonly bucketName: string
  ) {

  }


  public async persist(filePath: string): Promise<void> {
    if (!this.doesBucketExists(this.bucketName)) {
      throw new Error("Failed to persist file " + filePath + ". Bucket '" + this.bucketName + "' does not exists!");
    }

    const fileContent = fs.readFileSync(filePath);

    await this.s3.putObject({
      Bucket: this.bucketName,
      Key: path.basename(filePath),
      Body: fileContent
    }).promise();
  }

  public async doesBucketExists(name: string): Promise<boolean> {
    try {
      await this.s3.headBucket({
        Bucket: name,
      }).promise();
      return true;
    } catch (error) {
      if (error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

}
