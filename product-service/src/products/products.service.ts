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
    private redis: RedisCacheService,
    private publisher: RabbitmqPublisher,
  ) {}

  async create(dto: CreateProductDto) {
    const product = this.repo.create(dto);
    const saved = await this.repo.save(product);

    // Publish product.created event
    await this.publisher.publish('product.created', {
      id: saved.id,
      name: saved.name,
      price: saved.price,
      qty: saved.qty,
      createdAt: saved.createdAt,
    });

    // Cache the product
    await this.redis.set(`product:${saved.id}`, saved, 600);

    return saved;
  }

  async findById(id: number) {
    const key = `product:${id}`;
    const cached = await this.redis.get(key);
    if (cached) return cached;

    const product = await this.repo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    await this.redis.set(key, product, 600);
    return product;
  }

  async reduceQty(id: number, delta: number) {
    const product = await this.repo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    product.qty = Math.max(0, product.qty - delta);
    const updated = await this.repo.save(product);
    await this.redis.set(`product:${id}`, updated, 600);

    return updated;
  }
}
