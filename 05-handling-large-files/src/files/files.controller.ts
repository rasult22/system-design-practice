import { Body, Controller, Get, Param, Post, Req, Res,} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Response, Request } from 'express';
import { Readable } from 'stream';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  async upload(@Req() req: Request, @Res() res: Response) {
    const filename = `${randomUUID()}.bin`;
    const size = parseInt(req.headers['content-length'] ?? '0', 10);
    this.filesService.upload(filename, req as unknown as Readable, size)

    res.json({ filename, message: 'uploaded to MinIO' })
  }
  
  @Get()
  async list() {
    return this.filesService.list();
  }

  @Get(':filename')
  async download(@Param('filename') filename: string, @Res() res: Response ) {
    const url = await this.filesService.getDownloadUrl(filename);
    res.redirect(url)
  }

  @Post('multipart/start')
  async startUpload(@Req() req: Request) {
    const incomingFilename = decodeURIComponent(req.headers['x-filename'] as string)
    const filename =  `${randomUUID()}_${incomingFilename}`;
    const uploadId = await this.filesService.startMultipartUpload(filename);
    return { filename, uploadId }
  }

  @Post('multipart/:filename/:uploadId/complete')
  async completeUpload(
    @Param('filename') filename: string,
    @Param('uploadId') uploadId: string,
    @Body() body: { parts: { partNumber: number, etag: string }[] }
  ) {
    await this.filesService.completeMultipartUpload(filename, uploadId, body.parts);
    return { filename, message: 'upload complete' }
  }
  @Get('multipart/:filename/:uploadId/parts')
  async listParts(
    @Param('filename') filename: string,
    @Param('uploadId') uploadId: string,
  ) {
    return this.filesService.listParts(filename, uploadId);
  }

  @Post('multipart/:filename/:uploadId/:partNumber')
  async uploadPart(
    @Param('filename') filename: string,
    @Param('uploadId') uploadId: string,
    @Param('partNumber') partNumber: string,
    @Req() req: Request,
  ) {
    const size = parseInt(req.headers['content-length'] ?? '0', 10);
    const result = await this.filesService.uploadPart(
      filename, uploadId, parseInt(partNumber, 10), req as unknown as Readable, size,
    );
    return result;
  }
}
