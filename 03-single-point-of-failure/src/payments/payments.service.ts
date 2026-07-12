import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Payment, PaymentStatus } from './payment.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  async processPayment(
    manager: EntityManager,
    orderId: number,
    amount: number,
  ): Promise<Payment> {
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 30% шанс отказа платежа
    if (Math.random() < 0.3) {
      throw new Error('Payment declined by bank');
    }

    const payment = manager.create(Payment, {
      orderId,
      amount,
      status: PaymentStatus.SUCCESS,
    });

    return manager.save(payment);
  }

  findAll() {
    return this.paymentRepo.find({ order: { processedAt: 'DESC' } });
  }
}
