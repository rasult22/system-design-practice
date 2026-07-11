import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column('text')
  content: string;

  @Column()
  author: string;

  @Column({ default: 'general' })
  category: string;

  @Column({ default: 0 })
  views: number;

  @CreateDateColumn()
  publishedAt: Date;
}
