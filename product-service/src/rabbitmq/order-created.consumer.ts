import { Injectable, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { ProductsService } from '../products/products.service';
import { EVENTS } from '../common/constants/events';

@Injectable()
export class OrderCreatedConsumer implements OnModuleInit {
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  constructor(private productService: ProductsService) {}

  async onModuleInit() {
    this.connection = await amqp.connect(process.env.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange('events', 'topic', { durable: true });
    const q = await this.channel.assertQueue('', { exclusive: true });
    await this.channel.bindQueue(q.queue, 'events', EVENTS.ORDER_CREATED);

    this.channel.consume(q.queue, async (msg) => {
      if (!msg) return;
      const order = JSON.parse(msg.content.toString());
      await this.productService.reduceQty(order.productId, 1);
      console.log(`Reduced qty for product ${order.productId}`);
      this.channel.ack(msg);
    });
  }
}
