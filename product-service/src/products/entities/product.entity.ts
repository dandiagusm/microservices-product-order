import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column('double precision')
  price: number;

  @Column()
  qty: number;

  @CreateDateColumn()
  createdAt: Date;
}
