import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  findAll() {
    return this.productRepo.find();
  }

  async seed() {
    const count = await this.productRepo.count();
    if (count > 0) return { message: `Already seeded (${count} products)` };

    const products = Array.from({ length: 50 }, (_, i) => ({
      name: `Product ${i + 1}`,
      price: +(Math.random() * 100 + 5).toFixed(2),
      stock: Math.floor(Math.random() * 200 + 10),
    }));

    await this.productRepo.save(products);
    return { message: `Seeded ${products.length} products` };
  }
}
