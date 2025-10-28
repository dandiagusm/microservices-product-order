import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { RedisCacheService } from '../common/utils/redis.util';
import { RabbitmqPublisher } from '../common/utils/rabbitmq.publisher';
import { EVENTS } from '../common/constants/events';

@Injectable()
export class ProductsService implements OnModuleInit {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private repo: Repository<Product>,
    private redis: RedisCacheService,
    private publisher: RabbitmqPublisher,
  ) {}

  async onModuleInit() {
    await this.publisher.ready;
  
    await this.publisher.subscribe('order.created', async (order: any) => {
      try {
        if (!order.productId || !order.quantity) {
          this.logger.error('Invalid order message received', order);
          return;
        }
      
        await this.reduceQty(order.productId, order.quantity);
        this.logger.log(`Reduced product ${order.productId} qty by ${order.quantity}`);
      } catch (err) {
        this.logger.error(`Failed to reduce product ${order.productId} qty`, err);
      }
    });
  }

  async create(dto: CreateProductDto) {
    const product = this.repo.create(dto);
    const saved = await this.repo.save(product);

    // Publish product.created event
    await this.publisher.publish(EVENTS.PRODUCT_CREATED, {
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
    if (!id || isNaN(id)) {
      throw new Error(`Invalid product id: ${id}`);
    }
    if (!delta || isNaN(delta)) {
      throw new Error(`Invalid delta quantity: ${delta}`);
    }

    const product = await this.repo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    product.qty = Math.max(0, product.qty - delta);
    const updated = await this.repo.save(product);

    // Update cache
    await this.redis.set(`product:${id}`, updated, 600);

    return updated;
  }

}
