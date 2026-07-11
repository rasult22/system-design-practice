import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { Product } from './product.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  findAll() {
    return this.orderRepo.find({ order: { createdAt: 'DESC' } });
  }

  async create(productId: number, quantity: number) {
    const product = await this.productRepo.findOneBy({ id: productId });
    if (!product) throw new NotFoundException('Product not found');

    const order = this.orderRepo.create({
      productId,
      quantity,
      total: product.price * quantity,
    });

    product.stock -= quantity;
    await this.productRepo.save(product);
    return this.orderRepo.save(order);
  }
}
