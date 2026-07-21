import { Controller, Post, Req, Res,} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Response, Request } from 'express';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
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
}
