import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitmqPublisher implements OnModuleInit {
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private readonly logger = new Logger(RabbitmqPublisher.name);

  async onModuleInit() {
    try {
      const rabbitUrl = process.env.RABBITMQ_URL;
      if (!rabbitUrl) throw new Error('RABBITMQ_URL not defined');

      this.connection = await amqp.connect(rabbitUrl);
      this.channel = await this.connection.createChannel();
      this.logger.log('RabbitMQ channel initialized');
    } catch (error) {
      this.logger.error('Failed to initialize RabbitMQ', error);
      throw error;
    }
  }

  async publish(queue: string, data: any) {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }
    await this.channel.assertQueue(queue, { durable: true });
    this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)));
    this.logger.log(`Message sent to queue ${queue}`);
  }

  async close() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }
}
