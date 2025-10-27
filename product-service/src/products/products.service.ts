import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { RedisCacheService } from '../common/utils/redis.util';
import { RabbitmqPublisher } from '../common/utils/rabbitmq.publisher';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private repo: Repository<Product>,
    private cache: RedisCacheService,
    private publisher: RabbitmqPublisher,
  ) {}

  async create(dto: CreateProductDto) {
    const product = this.repo.create(dto);
    const saved = await this.repo.save(product);

    // publish event to RabbitMQ with retry inside publisher
    await this.publisher.publish('product.created', {
      id: saved.id,
      name: saved.name,
      price: saved.price,
      qty: saved.qty,
      createdAt: saved.createdAt,
    });

    // cache the product
    await this.cache.set(`product:${saved.id}`, JSON.stringify(saved), 600);

    return saved;
  }

  async findById(id: number) {
    const key = `product:${id}`;
    const cached = await this.cache.get(key);
    if (cached) return JSON.parse(cached);

    const product = await this.repo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    await this.cache.set(key, JSON.stringify(product), 600);
    return product;
  }

  async reduceQty(id: number, delta: number) {
    const product = await this.repo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    product.qty = Math.max(0, product.qty - delta);
    const updated = await this.repo.save(product);
    await this.cache.set(`product:${id}`, JSON.stringify(updated), 600);
    return updated;
  }
}
