import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './products/product.entity';
import { Order } from './orders/order.entity';
import { Payment } from './payments/payment.entity';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: +(process.env.DB_PORT || 5432),
      username: process.env.DB_USER || 'admin',
      password: process.env.DB_PASS || 'admin',
      database: process.env.DB_NAME || 'ecommerce',
      entities: [Product, Order, Payment],
      synchronize: true,
      retryAttempts: 3,
      retryDelay: 1000,
      extra: {
        max: 5,
        connectionTimeoutMillis: 2000,
        query_timeout: 3000,
        idleTimeoutMillis: 1000,
        allowExitOnIdle: true,
      },
    }),
    ProductsModule,
    OrdersModule,
    PaymentsModule,
  ],
})
export class AppModule {}
