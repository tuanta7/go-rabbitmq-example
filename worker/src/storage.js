import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { readConfig } from './config.js';

const { endpoint, region, accessKey, secretKey, bucket } = readConfig();
const client = new S3Client({
  endpoint,
  region,
  forcePathStyle: true,
  credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
});

export async function ensureBucket() {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (error) {
    if (error.$metadata?.httpStatusCode !== 404) throw error;
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export async function download(key) {
  const { Body } = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return Buffer.from(await Body.transformToByteArray());
}

export async function upload(key, data) {
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: 'image/png' }),
  );
}

export function closeStorage() {
  client.destroy();
}
