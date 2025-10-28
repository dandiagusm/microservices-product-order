import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis'; 

@Injectable()
export class RedisCacheService {
  private client: Redis; 
  private readonly logger = new Logger(RedisCacheService.name);

  constructor() {
    const host = process.env.REDIS_HOST;
    const port = process.env.REDIS_PORT;

    if (!host || !port) {
      throw new Error('REDIS_HOST or REDIS_PORT is not defined in .env');
    }

    this.client = new Redis({
      host,
      port: parseInt(port, 10),
    });

    this.client.on('connect', () => this.logger.log('Connected to Redis'));
    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }

  async set(key: string, value: any, ttlSeconds: number) {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async get(key: string): Promise<any | null> {
    const data = await this.client.get(key);
    if (!data) return null;
    return JSON.parse(data);
  }
}
