import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService {
  private client: Redis;
  private readonly logger = new Logger(RedisCacheService.name);

  constructor() {
    const host = process.env.REDIS_HOST;
    const port = process.env.REDIS_PORT;

    if (!host || !port) throw new Error('REDIS_HOST or REDIS_PORT not defined');

    this.client = new Redis({
      host,
      port: parseInt(port, 10),
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
    });

    this.client.on('connect', () => this.logger.log(`Connected to Redis at ${host}:${port}`));
    this.client.on('error', (err) => this.logger.error('Redis connection ERROR:', err));
  }

  async get<T>(key: string): Promise<T | null> {
    const val = await this.client.get(key);
    return val ? (JSON.parse(val) as T) : null;
  }

  async set(key: string, value: any, ttlSeconds: number) {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string) {
    await this.client.del(key);
  }

  async disconnect() {
    await this.client.quit();
  }
}
