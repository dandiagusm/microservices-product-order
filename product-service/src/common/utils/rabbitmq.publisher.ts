import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import * as crypto from 'crypto';

@Injectable()
export class RabbitmqPublisher implements OnModuleInit {
  private connection: amqp.Connection;
  private channel: amqp.Channel;
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

  private async setupConnection() {
    const rabbitUrl = process.env.RABBITMQ_URL;
    if (!rabbitUrl) throw new Error('RABBITMQ_URL not defined');

    const connect = async () => {
      try {
        this.connection = await amqp.connect(rabbitUrl);

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

    this.logger.log(
      `[RequestID: ${message.requestId}] [${routingKey}] PUBLISHED: ${JSON.stringify(data)}`,
    );
  }

  async subscribe(
    routingKey: string,
    callback: (msg: any) => void | Promise<void>,
  ) {
    await this.ready;
    if (!this.channel) throw new Error('RabbitMQ channel not initialized');

    const serviceName = process.env.SERVICE_NAME || 'product-service';
    const queueName = `${routingKey}.${serviceName}`;

    await this.channel.assertQueue(queueName, { durable: true });
    await this.channel.bindQueue(queueName, this.EXCHANGE, routingKey);

    this.logger.log(
      `SUBSCRIBED queue [${queueName}] to exchange [${this.EXCHANGE}] with key [${routingKey}]`,
    );

    this.channel.consume(queueName, async (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());
        const reqId = content.requestId || 'N/A';
        this.logger.log(`[RequestID: ${reqId}] RECEIVED: ${routingKey}`);

        await callback(content);
        this.channel.ack(msg);
      } catch (err) {
        this.logger.error(`FAILED to handle message on ${routingKey}`, err);
        this.channel.nack(msg, false, true);
      }
    });
  }

  async close() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
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
