import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './order.entity';
import { Product } from '../products/product.entity';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly paymentsService: PaymentsService,
  ) {}

  findAll() {
    return this.orderRepo.find({ order: { createdAt: 'DESC' } });
  }

  async create(productId: number, quantity: number) {
    const product = await this.productRepo.findOneBy({ id: productId });
    if (!product) throw new NotFoundException('Product not found');

    // 1. Создаём заказ в статусе pending
    const order = this.orderRepo.create({
      productId,
      quantity,
      total: product.price * quantity,
      status: OrderStatus.PENDING,
    });
    const savedOrder = await this.orderRepo.save(order);

    // 2. Списываем stock
    product.stock -= quantity;
    await this.productRepo.save(product);

    // 3. Обрабатываем платёж (500ms задержка)
    const payment = await this.paymentsService.processPayment(
      savedOrder.id,
      savedOrder.total,
    );

    // 4. Обновляем статус заказа → paid
    savedOrder.status = OrderStatus.PAID;
    await this.orderRepo.save(savedOrder);

    return { order: savedOrder, payment };
  }
}
