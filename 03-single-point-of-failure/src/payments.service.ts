import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from './payment.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  async processPayment(orderId: number, amount: number): Promise<Payment> {
    // Имитация обработки платежа (задержка как у платёжного шлюза)
    await new Promise((resolve) => setTimeout(resolve, 500));

    const payment = this.paymentRepo.create({
      orderId,
      amount,
      status: PaymentStatus.SUCCESS,
    });

    return this.paymentRepo.save(payment);
  }

  findAll() {
    return this.paymentRepo.find({ order: { processedAt: 'DESC' } });
  }
}
