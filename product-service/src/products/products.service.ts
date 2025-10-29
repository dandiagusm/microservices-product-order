import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
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
    private readonly repo: Repository<Product>,
    private readonly redis: RedisCacheService,
    private readonly publisher: RabbitmqPublisher,
  ) {}

  async onModuleInit() {
    await this.publisher.ready;

    // Subscribe to order.created events
    await this.publisher.subscribe('order.created', async (order: any) => {
      try {
        const { orderId, productId, quantity } = order;
        if (!productId || !quantity) {
          this.logger.error('❌ Invalid order message received', order);
          return;
        }

        const updated = await this.reduceQty(productId, quantity);

        this.logger.log(
          `✅ Reduced product ${productId} qty by ${quantity}. Remaining: ${updated.qty}`,
        );

        // Emit order.updated
        await this.publisher.publish('order.updated', {
          orderId,
          productId,
          status: 'done',
          updatedAt: new Date().toISOString(),
        });

        this.logger.log(`📤 Published order.updated for order ${orderId}`);
      } catch (err) {
        this.logger.error('❌ Failed to handle order.created', err);
      }
    });
  }

  async create(dto: CreateProductDto) {
    const product = this.repo.create(dto);
    const saved = await this.repo.save(product);

    // Emit product.created event
    await this.publisher.publish(EVENTS.PRODUCT_CREATED, {
      id: saved.id,
      name: saved.name,
      price: saved.price,
      qty: saved.qty,
      createdAt: saved.createdAt,
    });

    await this.refreshCache(saved.id);
    return saved;
  }

  async findById(id: number) {
    const key = `product:${id}`;
    const cached = await this.redis.get<Product>(key);
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

    await this.refreshCache(id);
    return updated;
  }

  private async refreshCache(id: number) {
    try {
      const product = await this.repo.findOne({ where: { id } });
      if (product) {
        await this.redis.set(`product:${id}`, product, 600);
        this.logger.debug(`🔄 Cache refreshed for product:${id}`);
      } else {
        await this.redis.del(`product:${id}`);
        this.logger.debug(`🗑️ Cache deleted for product:${id}`);
      }
    } catch (err) {
      this.logger.warn(`⚠️ Cache refresh failed for product:${id}`, err);
    }
  }
}
