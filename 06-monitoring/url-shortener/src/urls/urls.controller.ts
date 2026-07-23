import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { UrlsService } from './urls.service';

@Controller()
export class UrlsController {
  constructor(private readonly urlService: UrlsService) {}

  @Post('shorten')
  async shorten(@Body('url') url: string) {
    const result = await this.urlService.shorten(url);
    return {
      code: result.code,
      shortUrl: `/${result.code}`,
      server: process.env.HOSTNAME
    };
  }

  @Get('health')
  health() {
    return { status: 'ok', server: process.env.HOSTNAME };
  }

  @Get(':code')
  async redirect(@Param('code') code: string, @Res() res: Response) {
    const url = await this.urlService.findByCode(code);
    if (!url) throw new NotFoundException();
    res.redirect(url.originalUrl);
  }
}
