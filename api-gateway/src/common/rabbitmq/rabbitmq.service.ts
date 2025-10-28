import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitmqService implements OnModuleInit {
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private readonly logger = new Logger(RabbitmqService.name);

  async onModuleInit() {
    await this.init();
  }

  private async init() {
    try {
      const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
      this.connection = await amqp.connect(rabbitUrl);
      this.channel = await this.connection.createChannel();
      this.logger.log('RabbitMQ channel initialized');
    } catch (error) {
      this.logger.error('Failed to initialize RabbitMQ', error);
      // Retry after delay
      setTimeout(() => this.init(), 5000);
    }
  }

  async publish(queue: string, data: any) {
    if (!this.channel) {
      // Wait until channel is initialized
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (this.channel) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
    }

    await this.channel.assertQueue(queue, { durable: true });
    this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)));
    this.logger.log(`Message sent to queue ${queue}`);
  }

  async subscribe(queue: string, callback: (msg: any) => void) {
    if (!this.channel) {
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (this.channel) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
    }

    await this.channel.assertQueue(queue, { durable: true });
    this.channel.consume(queue, (msg) => {
      if (!msg) return;
      try {
        const data = JSON.parse(msg.content.toString());
        callback(data);
        this.channel.ack(msg);
      } catch (err) {
        this.logger.error('Failed to process message', err);
        this.channel.nack(msg, false, true);
      }
    });
    this.logger.log(`Subscribed to queue ${queue}`);
  }
}
