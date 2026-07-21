import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';


@Injectable()
export class FilesService {
  private s3 = new S3Client({
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' },
    forcePathStyle: true
  })

  private bucket = 'files'

  async upload(key: string, body: Readable, size: number) {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentLength: size
    }))
  }

  async getDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket, Key: key
    })
    return getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }

  async list(): Promise<string[]> {
    const result = await this.s3.send(new ListObjectsV2Command({ Bucket: this.bucket }));
    const keys: string[] = [] 
    result.Contents?.forEach(key => {
      if (key.Key) {
        keys.push(key.Key)
      }
    })
    return keys
  }
}
