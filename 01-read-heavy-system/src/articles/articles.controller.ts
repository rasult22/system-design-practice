import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { Article } from './article.entity';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  async findAll(
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.min(50, Math.max(1, parseInt(limit) || 20));
    if (category) {
      return this.articlesService.findByCategory(category);
    }
    return this.articlesService.findAll(p, l);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Article> {
    return this.articlesService.findOne(id);
  }

  @Post()
  async create(@Body() data: Partial<Article>): Promise<Article> {
    return this.articlesService.create(data);
  }
}
