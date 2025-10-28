import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitmqPublisher implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private readonly logger = new Logger(RabbitmqPublisher.name);
  public ready: Promise<void>;
  private readyResolve: () => void;
  private readonly DLX_NAME = 'dead_letter_exchange';

  constructor() {
    this.ready = new Promise((resolve) => (this.readyResolve = resolve));
  }

  async onModuleInit() {
    await this.connect();
  }

  private async connect() {
    try {
      const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
      this.connection = await amqp.connect(rabbitUrl);
      this.channel = await this.connection.createChannel();

      // Declare DLX (dead-letter exchange)
      await this.channel.assertExchange(this.DLX_NAME, 'fanout', { durable: true });

      this.logger.log('RabbitMQ connection and DLX initialized');
      this.readyResolve();

      // Handle unexpected connection closures
      this.connection.on('close', async () => {
        this.logger.warn('RabbitMQ connection closed. Reconnecting...');
        await new Promise((r) => setTimeout(r, 5000));
        await this.connect();
      });

      this.connection.on('error', (err) => {
        this.logger.error('RabbitMQ connection error', err);
      });
    } catch (err) {
      this.logger.error('Failed to connect to RabbitMQ', err);
      setTimeout(() => this.connect(), 5000);
    }
  }

  async publish(queue: string, data: any) {
    await this.ready;
    if (!this.channel) throw new Error('RabbitMQ channel not initialized');

    // Main queue with DLX support
    await this.channel.assertQueue(queue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.DLX_NAME, // send failed messages to DLX
      },
    });

    const success = this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)), {
      contentType: 'application/json',
      persistent: true,
    });

    if (success) this.logger.log(`✅ Message published to ${queue}`);
    else this.logger.warn(`⚠️ Message to ${queue} might not be delivered`);
  }

  async subscribe(queue: string, callback: (msg: any) => Promise<void> | void) {
    await this.ready;
    if (!this.channel) throw new Error('RabbitMQ channel not initialized');

    // Declare DLX and main queue with DLX binding
    await this.channel.assertExchange(this.DLX_NAME, 'fanout', { durable: true });
    await this.channel.assertQueue('dead_letters', { durable: true });
    await this.channel.bindQueue('dead_letters', this.DLX_NAME, '');

    await this.channel.assertQueue(queue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.DLX_NAME,
      },
    });

    this.channel.consume(
      queue,
      async (msg) => {
        if (!msg) return;

        try {
          const content = JSON.parse(msg.content.toString());
          await callback(content);
          this.channel.ack(msg);
        } catch (err) {
          this.logger.error(`Failed to process message from ${queue}`, err);
          this.channel.nack(msg, false, false); // move to DLX
        }
      },
      { noAck: false },
    );

    this.logger.log(`📡 Subscribed to queue: ${queue}`);
  }

  async onModuleDestroy() {
    await this.close();
  }

  async close() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }
}
