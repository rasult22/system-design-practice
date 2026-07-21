import { Controller, Get, Param, Post, Req, Res,} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Response, Request } from 'express';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, readdir } from 'fs/promises';
import { join } from 'path';
import { pipeline } from 'stream/promises';


@Controller('files')
export class FilesController {
  @Post('upload')
  async upload(@Req() req: Request, @Res() res: Response) {
    const uploadDir = join(process.cwd(), 'uploads');
    mkdir(uploadDir, { recursive: true });

    const filename = `${randomUUID()}.bin`;
    const filePath = join(uploadDir, filename);

    await pipeline(req, createWriteStream(filePath));

    res.json({ filename, message: 'uploaded via stream' })
  }
  
  @Get()
  async list() {
    const uploadDir = join(process.cwd(), 'uploads');
    const files = await readdir(uploadDir);
    return files
  }

  @Get(':filename')
  async download(@Param('filename') filename: string, @Res() res: Response ) {
    const filePath = join(process.cwd(), 'uploads', filename);
    const stat = await import('fs/promises').then(fs => fs.stat(filePath));

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    const fileStream = createReadStream(filePath);
    fileStream.pipe(res);
  }
}
