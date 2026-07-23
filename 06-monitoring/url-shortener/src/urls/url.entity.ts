import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity('urls')
export class Url {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  originalUrl: string;

  @Column({ unique: true })
  code: string

  @CreateDateColumn()
  createdAt: Date;
}