import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

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

  async publish(routingKey: string, data: any) {
    await this.ready;
    if (!this.channel) throw new Error('RabbitMQ channel not initialized');

    this.channel.publish(
      this.EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(data)),
      { persistent: true },
    );

    this.logger.log(`[${routingKey}] PUBLISHED: ${JSON.stringify(data)}`);
  }

  async subscribe(
    routingKey: string,
    callback: (msg: any) => void | Promise<void>,
  ) {
    await this.ready;
    if (!this.channel) throw new Error('RabbitMQ channel not initialized');

    // Dedicated queue per service + routing key
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
      this.logger.warn('⚠️ Error closing RabbitMQ', err);
    }
  }
}
