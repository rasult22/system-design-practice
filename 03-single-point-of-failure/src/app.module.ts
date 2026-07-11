import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { Order } from './order.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: +(process.env.DB_PORT || 5432),
      username: process.env.DB_USER || 'admin',
      password: process.env.DB_PASS || 'admin',
      database: process.env.DB_NAME || 'ecommerce',
      entities: [Product, Order],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Product, Order]),
  ],
  controllers: [ProductsController, OrdersController],
  providers: [ProductsService, OrdersService],
})
export class AppModule {}
