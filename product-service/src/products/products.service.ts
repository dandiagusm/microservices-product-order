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

    // subscribe to order.created 
    await this.publisher.subscribe('order.created', async (order: any) => {
      const requestId: string = order.requestId ?? 'N/A';

      try {
        const { orderId, productId, quantity } = order;
        if (!productId || !quantity) {
          this.logger.error(`[RequestID: ${requestId}] Invalid order message`, order);
          return;
        }

        const updated = await this.reduceQty(productId, quantity, requestId);

        this.logger.log(
          `[RequestID: ${requestId}] Reduced product ${productId} qty by ${quantity}. Remaining: ${updated.qty}`,
        );

        await this.publisher.publish('order.updated', {
          orderId,
          productId,
          status: 'done',
          updatedAt: new Date().toISOString(),
          requestId,
        });

        this.logger.log(`[RequestID: ${requestId}] Published order.updated for order ${orderId}`);
      } catch (err) {
        this.logger.error(`[RequestID: ${requestId}] Failed to handle order.created`, err);
      }
    });
  }

  async create(dto: CreateProductDto, requestId?: string) {
    const product = this.repo.create(dto);
    const saved = await this.repo.save(product);

    // Emit product.created event
    await this.publisher.publish('product.created', {
      id: saved.id,
      name: saved.name,
      price: saved.price,
      qty: saved.qty,
      createdAt: saved.createdAt,
    });

    this.logger.log(`[RequestID: ${requestId ?? 'N/A'}] Created product ${saved.id} (${saved.name})`);

    this.refreshCache(saved.id, requestId).catch((err) => this.logger.warn(err));
    return saved;
  }

  async findById(id: number, requestId?: string) {
    const key = `product:${id}`;
    const cached = await this.redis.get<Product>(key);
    if (cached) {
      this.logger.log(`[RequestID: ${requestId ?? 'N/A'}] Cache hit for product:${id}`);
      return cached;
    }

    const product = await this.repo.findOne({ where: { id } });
    if (!product) {
      this.logger.warn(`[RequestID: ${requestId ?? 'N/A'}] Product not found: ${id}`);
      throw new NotFoundException('Product not found');
    }

    this.redis.set(key, product, 600).catch((err) => this.logger.warn(err));
    this.logger.log(`[RequestID: ${requestId ?? 'N/A'}] Cache miss → fetched product:${id}`);
    return product;
  }

  async reduceQty(id: number, delta: number, requestId?: string) {
    const product = await this.repo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    const newQty = Math.max(0, product.qty - delta);
    product.qty = newQty;
    const updated = await this.repo.save(product);

    this.logger.log(
      `[RequestID: ${requestId ?? 'N/A'}] Reduced qty for product:${id} by ${delta}. Remaining: ${updated.qty}`,
    );

    this.refreshCache(id, requestId).catch((err) => this.logger.warn(err));
    return updated;
  }

  private async refreshCache(id: number, requestId?: string) {
    try {
      const product = await this.repo.findOne({ where: { id } });
      if (product) {
        await this.redis.set(`product:${id}`, product, 600);
        this.logger.debug(`[RequestID: ${requestId ?? 'N/A'}] Cache refreshed for product:${id}`);
      } else {
        await this.redis.del(`product:${id}`);
        this.logger.debug(`[RequestID: ${requestId ?? 'N/A'}] Cache deleted for product:${id}`);
      }
    } catch (err) {
      this.logger.warn(`[RequestID: ${requestId ?? 'N/A'}] Cache refresh failed for product:${id}`, err);
    }
  }
}
