import { Module } from '@nestjs/common';
import { UrlsModule } from './urls/urls.module';
import { Url } from './urls/url.entity';
import { TypeOrmModule } from '@nestjs/typeorm';


@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      database: process.env.DB_NAME || 'urlshortener',
      entities: [Url],
      synchronize: true,
      retryAttempts: 30,
      retryDelay: 3000,
      extra: {
        connectionTimeoutMillis: 5000
      }
    }),
    UrlsModule,
  ],
})
export class AppModule {}
