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
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 50, 2000), // retry on failure
    });

    this.client.on('connect', () =>
      this.logger.log(`✅ Connected to Redis at ${host}:${port}`),
    );
    this.client.on('error', (err) =>
      this.logger.error('❌ Redis connection error:', err.message),
    );
  }

  /** Save key/value pair to Redis with TTL (in seconds) */
  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      this.logger.debug(`💾 Redis SET key=${key}`);
    } catch (err) {
      this.logger.warn(`⚠️ Redis set failed for ${key}: ${err.message}`);
    }
  }

  /** Retrieve and JSON-parse a key’s value */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      this.logger.debug(`📦 Redis GET key=${key}`);
      return JSON.parse(data) as T;
    } catch (err) {
      this.logger.warn(`⚠️ Redis get failed for ${key}: ${err.message}`);
      return null;
    }
  }

  /** 🗑️ Delete a key */
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
      this.logger.debug(`🗑️ Redis DEL key=${key}`);
    } catch (err) {
      this.logger.warn(`⚠️ Redis del failed for ${key}: ${err.message}`);
    }
  }

  /** Optional: disconnect cleanly on shutdown */
  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.log('👋 Redis connection closed');
    } catch (err) {
      this.logger.warn('⚠️ Failed to close Redis connection:', err.message);
    }
  }
}
