import { S3Storage } from '../../src/backup/S3Storage';
import * as chai from 'chai';
import { Container } from '../../src/cli/Container';

describe("Some tests to verify s3 storage behaviour", () => {

  it("should return false if bucket do not exists and true otherwise", async () => {
    const storage = new S3Storage(await (new Container()).getS3(), '');
    const resultFalse = await storage.doesBucketExists("non-existing-test");
    chai.expect(resultFalse).to.be.eq(false);

    const resultTrue = await storage.doesBucketExists("assertis-backup");
    chai.expect(resultTrue).to.be.eq(true);
  });

  /**
   * THIS IS NOT A UNIT TEST !!!! interested? keep reading :)
   * Below crap use real s3 storage.
   * It has been created to avoid manual verification during development.
   * It's not perfect and isolated so it is disabled by default.
   * Please read function body before moaning like "this shit ain't work!".
   * Thanks, enjoy :)
   */
  it.skip('should upload file to bucket', async () => {
    const testFileName = 'test_tickets.sql';

    const s3 = await (new Container()).getS3();
    const bucket = 'assertis-test-bucket';
    const storage = new S3Storage(s3, bucket);

    // make sure our test bucket exists and is empty.
    const resultTrue = await storage.doesBucketExists(bucket);
    chai.expect(resultTrue).to.be.eq(true);

    try {
      await s3.deleteObject({
        Bucket: bucket, Key: testFileName
      }).promise();
    } catch (e) {
      // do nothing....
    }
    chai.expect(await fileExistsInBucket(bucket, testFileName)).to.be.equal(false);
    // upload something
    await storage.persist(__dirname + "/../fixtures/" + testFileName);

    chai.expect(await fileExistsInBucket(bucket, testFileName)).to.be.equal(true);
  }).timeout(10000);

  const fileExistsInBucket = async (bucketName: string, fileName: string): Promise<boolean> => {
    const s3 = await (new Container()).getS3();
    const files = await s3.listObjectsV2({
      Bucket: bucketName
    }).promise();

    return files.$response.data["Contents"].some(o => o["Key"] === fileName);
  }

});
