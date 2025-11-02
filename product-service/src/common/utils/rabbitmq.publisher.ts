import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import * as crypto from 'crypto';

interface SubscribeOptions {
  consumers?: number; // number of concurrent workers
  prefetch?: number;  // max unacked messages per consumer
}

@Injectable()
export class RabbitmqPublisher implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.Connection;
  private channel: amqp.Channel; // default channel for asserts/publish
  private readonly logger = new Logger(RabbitmqPublisher.name);
  private readonly EXCHANGE = 'events';
  public ready: Promise<void>;
  private readyResolve: () => void;

  constructor() {
    this.ready = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
  }

  async onModuleInit() {
    await this.setupConnection();
  }

  async onModuleDestroy() {
    await this.close();
  }

  /** Setup RabbitMQ connection and main channel (with auto-reconnect). */
  private async setupConnection() {
    const rabbitUrl = process.env.RABBITMQ_URL;
    if (!rabbitUrl) throw new Error('RABBITMQ_URL not defined');

    const connect = async () => {
      try {
        this.connection = await amqp.connect(rabbitUrl, { heartbeat: 30 });

        this.connection.on('close', () => {
          this.logger.warn('RabbitMQ connection CLOSED. Reconnecting...');
          setTimeout(connect, 5000);
        });

        this.connection.on('error', (err) => {
          this.logger.error('RabbitMQ connection ERROR:', err);
        });

        this.channel = await this.connection.createChannel();
        await this.channel.assertExchange(this.EXCHANGE, 'topic', { durable: true });

        this.logger.log('RabbitMQ CONNECTED');
        this.readyResolve();
      } catch (err) {
        this.logger.error('RabbitMQ connection failed. Retrying in 5s', err);
        setTimeout(connect, 5000);
      }
    };

    await connect();
  }

  /** Publish message to topic exchange. */
  async publish(routingKey: string, data: any, requestId?: string) {
    await this.ready;
    if (!this.channel) throw new Error('RabbitMQ channel not initialized');

    const message = {
      ...data,
      requestId: requestId || data?.requestId || this.generateRequestId(),
      timestamp: new Date().toISOString(),
    };

    this.channel.publish(
      this.EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      { persistent: true, contentType: 'application/json' },
    );

    this.logger.debug(`[RequestID: ${message.requestId}] [${routingKey}] PUBLISHED`);
  }

  /**
   * Subscribe with multiple parallel consumers.
   * Each consumer uses its own channel and handles messages concurrently.
   */
  async subscribe(
    routingKey: string,
    callback: (msg: any) => void | Promise<void>,
    options?: SubscribeOptions,
  ) {
    await this.ready;
    if (!this.connection) throw new Error('RabbitMQ connection not initialized');

    const consumers = options?.consumers ?? 5; // default 5 workers
    const prefetch = options?.prefetch ?? 10;
    const serviceName = 'product-service';
    const queueName = `${routingKey}.${serviceName}`;

    // Ensure queue and binding exist once globally
    await this.channel.assertQueue(queueName, { durable: true });
    await this.channel.bindQueue(queueName, this.EXCHANGE, routingKey);

    this.logger.log(
      `SUBSCRIBING ${consumers} workers on queue [${queueName}] from exchange [${this.EXCHANGE}] with key [${routingKey}]`,
    );

    // Spawn multiple workers
    for (let i = 0; i < consumers; i++) {
      const workerChannel = await this.connection.createChannel();
      await workerChannel.prefetch(prefetch);

      workerChannel.consume(queueName, async (msg) => {
        if (!msg) return;
        try {
          const content = JSON.parse(msg.content.toString());
          const reqId = content.requestId || 'N/A';
          this.logger.debug(`[Worker ${i}] [${routingKey}] [RequestID: ${reqId}] Processing message...`);

          await callback(content);
          workerChannel.ack(msg);
        } catch (err) {
          this.logger.error(`[Worker ${i}] FAILED to process ${routingKey}`, err);
          workerChannel.nack(msg, false, true);
        }
      });

      this.logger.log(`[Worker ${i}] started for [${routingKey}]`);
    }
  }

  /** Graceful shutdown. */
  async close() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      this.logger.log('RabbitMQ connection closed cleanly.');
    } catch (err) {
      this.logger.warn('Error closing RabbitMQ', err);
    }
  }

  private generateRequestId(): string {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 12);
  }
}
