import { Controller, Get, Param, Post, Req, Res,} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Response, Request } from 'express';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, readdir } from 'fs/promises';
import { join } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
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
}
