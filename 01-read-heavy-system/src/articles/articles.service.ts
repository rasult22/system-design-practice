import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { Article } from './article.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly repo: Repository<Article>,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

  async findAll(page = 1, limit = 20): Promise<{ data: Article[]; total: number; page: number; totalPages: number }> {
    const cacheKey = `articles:page:${page}:limit:${limit}`;

    const cached = await this.cache.get<{ data: Article[]; total: number; page: number; totalPages: number }>(cacheKey);
    if (cached) {
      return cached;
    }

    const [data, total] = await this.repo.findAndCount({
      order: { publishedAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const result = { data, total, page, totalPages: Math.ceil(total / limit) };
    await this.cache.set(cacheKey, result, 60000);
    return result;
  }

  async findOne(id: number): Promise<Article> {
    return this.repo.findOneBy({ id });
  }

  async findByCategory(category: string): Promise<Article[]> {
    return this.repo.find({
      where: { category },
      order: { publishedAt: 'DESC' },
      take: 20,
    });
  }

  async create(data: Partial<Article>): Promise<Article> {
    const article = this.repo.create(data);
    return this.repo.save(article);
  }
}
