import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { services } from '../config';
import Redis from 'ioredis';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private productClient: AxiosInstance;
  private redis: Redis;

  constructor() {
    // Initialize HTTP clients
    this.productClient = axios.create({ baseURL: services.product.url });

    // Initialize Redis connection
    this.redis = new Redis({
      host: services.redis.host,
      port: services.redis.port,
    });
  }

  async getProduct(id: number) {
    const cacheKey = `product:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const { data } = await this.productClient.get(`/products/${id}`);
    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', 600);
    return data;
  }

  async createProduct(dto: { name: string; price: number; qty: number }) {
    const { data } = await this.productClient.post('/products', dto);
    this.logger.log(`✅ Product created: ${JSON.stringify(data)}`);
    return data;
  }

}
