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

    await this.publisher.subscribe(
      'order.created',
      async (order: any) => {
        const requestId = order.requestId ?? 'N/A';
        const { orderId, productId, quantity } = order;

        if (!productId || !quantity) {
          this.logger.warn(`[${requestId}] Invalid order message`, order);
          return;
        }

        try {
          await this.repo
            .createQueryBuilder()
            .update(Product)
            .set({ qty: () => `GREATEST(qty - ${quantity}, 0)` })
            .where('id = :id', { id: productId })
            .execute();

          this.logger.debug(
            `[${requestId}] Reduced product ${productId} qty by ${quantity}`
          );

          this.publisher.publish('order.updated', {
            orderId,
            productId,
            status: 'done',
            updatedAt: new Date().toISOString(),
            requestId,
          }).catch(err => this.logger.error(`[${requestId}] Publish failed`, err));

          this.refreshCache(productId, requestId).catch(err =>
            this.logger.warn(`[${requestId}] Cache refresh failed`, err)
          );

        } catch (err) {
          this.logger.error(`[${requestId}] Failed to handle order.created`, err);
        }
      },
      { consumers: 50, prefetch: 100 },
    );
  }

  async create(dto: CreateProductDto, requestId?: string) {
    const product = this.repo.create(dto);
    const saved = await this.repo.save(product);

    this.publisher.publish('product.created', {
      id: saved.id,
      name: saved.name,
      price: saved.price,
      qty: saved.qty,
      createdAt: saved.createdAt,
      requestId,
    }).catch(err => this.logger.warn(`[${requestId ?? 'N/A'}] Publish failed`, err));

    this.logger.log(`[${requestId ?? 'N/A'}] Created product ${saved.id}`);
    this.refreshCache(saved.id, requestId).catch(err => this.logger.warn(err));
    return saved;
  }

  async findById(id: number, requestId?: string) {
    const key = `product:${id}`;
    const cached = await this.redis.get<Product>(key);
    if (cached) {
      this.logger.debug(`[${requestId ?? 'N/A'}] Cache hit product:${id}`);
      return cached;
    }

    const product = await this.repo.findOne({ where: { id } });
    if (!product) {
      this.logger.warn(`[${requestId ?? 'N/A'}] Product not found: ${id}`);
      throw new NotFoundException('Product not found');
    }

    this.redis.set(key, product, 600).catch(err =>
      this.logger.warn(`[${requestId ?? 'N/A'}] Cache set failed`, err)
    );

    this.logger.debug(`[${requestId ?? 'N/A'}] Cache miss → fetched product:${id}`);
    return product;
  }

  async reduceQty(id: number, delta: number, requestId?: string) {
    await this.repo
      .createQueryBuilder()
      .update(Product)
      .set({ qty: () => `GREATEST(qty - ${delta}, 0)` })
      .where('id = :id', { id })
      .execute();

    this.logger.debug(`[${requestId ?? 'N/A'}] Reduced qty for product:${id} by ${delta}`);

    this.refreshCache(id, requestId).catch(err =>
      this.logger.warn(`[${requestId ?? 'N/A'}] Cache refresh failed`, err)
    );
  }

  private async refreshCache(id: number, requestId?: string) {
    try {
      const product = await this.repo.findOne({ where: { id } });
      if (product) {
        await this.redis.set(`product:${id}`, product, 600);
        this.logger.debug(`[${requestId ?? 'N/A'}] Cache refreshed for product:${id}`);
      } else {
        await this.redis.del(`product:${id}`);
        this.logger.debug(`[${requestId ?? 'N/A'}] Cache deleted for product:${id}`);
      }
    } catch (err) {
      this.logger.warn(`[${requestId ?? 'N/A'}] Cache refresh failed`, err);
    }
  }
}
