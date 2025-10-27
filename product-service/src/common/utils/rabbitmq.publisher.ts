import { Injectable } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitmqPublisher {
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  async connect() {
    const host = process.env.RABBITMQ_HOST || 'rabbitmq';
    const port = +(process.env.RABBITMQ_PORT || 5672);

    let retries = 5;
    while (retries > 0) {
      try {
        this.connection = await amqp.connect(`amqp://${host}:${port}`);
        this.channel = await this.connection.createChannel();
        break;
      } catch (err) {
        console.log(`RabbitMQ connection failed. Retries left: ${retries}`);
        retries--;
        await new Promise((res) => setTimeout(res, 5000));
      }
    }

    if (!this.connection) throw new Error('Unable to connect to RabbitMQ');
  }

  async publish(queue: string, message: any) {
    if (!this.channel) await this.connect();
    await this.channel.assertQueue(queue, { durable: true });
    this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
  }
}
