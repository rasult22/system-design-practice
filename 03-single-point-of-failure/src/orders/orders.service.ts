import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order, OrderStatus } from './order.entity';
import { Product } from '../products/product.entity';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly paymentsService: PaymentsService,
    private readonly dataSource: DataSource,
  ) {}

  findAll() {
    return this.orderRepo.find({ order: { createdAt: 'DESC' } });
  }

  async create(productId: number, quantity: number) {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager.findOneBy(Product, { id: productId });
      if (!product) throw new NotFoundException('Product not found');

      // 1. Создаём заказ в статусе pending
      const order = manager.create(Order, {
        productId,
        quantity,
        total: product.price * quantity,
        status: OrderStatus.PENDING,
      });
      const savedOrder = await manager.save(order);

      // 2. Списываем stock
      product.stock -= quantity;
      await manager.save(product);

      // 3. Обрабатываем платёж (500ms задержка)
      const payment = await this.paymentsService.processPayment(
        manager,
        savedOrder.id,
        savedOrder.total,
      );

      // 4. Обновляем статус заказа → paid
      savedOrder.status = OrderStatus.PAID;
      await manager.save(savedOrder);

      return { order: savedOrder, payment };
    });
  }
}
