import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Url } from "./url.entity";
import { nanoid } from "nanoid";

@Injectable()
export class UrlsService {
  constructor(
    @InjectRepository(Url)
    private readonly urlRepo: Repository<Url>,
  ) {}

  async shorten(originalUrl: string): Promise<Url> {
    const code = nanoid(8);
    const url = this.urlRepo.create({ originalUrl, code })
    return this.urlRepo.save(url)
  }

  async findByCode(code: string): Promise<Url | null> {
    return this.urlRepo.findOne({ where: { code } })
  }
}