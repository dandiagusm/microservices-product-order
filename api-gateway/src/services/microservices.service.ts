import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { services } from '../config';
import { RabbitmqService } from '../common/rabbitmq/rabbitmq.service';
import Redis from 'ioredis';

@Injectable()
export class MicroservicesService {
  private productClient: AxiosInstance;
  private orderClient: AxiosInstance;
  private redis: Redis;
  private readonly logger = new Logger(MicroservicesService.name);

  constructor(private rabbit: RabbitmqService) {
    this.productClient = axios.create({ baseURL: services.product.url });
    this.orderClient = axios.create({ baseURL: services.order.url });
    this.redis = new Redis({ host: services.redis.host, port: services.redis.port });

    // Subscribe to order.created events
    this.rabbit.subscribe('order.created', async (msg) => {
      this.logger.log(`Received order.created event: ${JSON.stringify(msg)}`);
    });
  }

  // GET /products/:id
  async getProduct(id: number) {
    const cacheKey = `product:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const { data } = await this.productClient.get(`/products/${id}`);
    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', 600);
    return data;
  }

  // GET /products/:id/orders
  async getProductWithOrders(productId: number) {
    const [product, orders] = await Promise.all([
      this.getProduct(productId),
      this.getOrdersByProduct(productId),
    ]);
    return { product, orders };
  }

  // POST /orders
  async createOrder(productId: number, quantity: number) {
    const { data } = await this.orderClient.post('/orders', { productId, quantity });
    return data;
  }

  // GET /orders/product/:productId
  async getOrdersByProduct(productId: number) {
    const cacheKey = `orders:product:${productId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const { data } = await this.orderClient.get(`/orders/product/${productId}`);
    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', 60);
    return data;
  }
}
