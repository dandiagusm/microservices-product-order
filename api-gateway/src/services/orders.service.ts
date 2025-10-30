import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { services } from '../config';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly orderClient: AxiosInstance;

  constructor() {
    this.orderClient = axios.create({ baseURL: services.order.url });
  }

  async createOrder(productId: number, quantity: number, requestId?: string) {
    try {
      const { data } = await this.orderClient.post(
        '/orders',
        { productId, quantity },
        {
          headers: requestId ? { 'x-request-id': requestId } : {},
        },
      );

      this.logger.log(
        `[RequestID: ${requestId ?? 'N/A'}] Created order for productId=${productId}, qty=${quantity}`,
      );

      return data;
    } catch (error) {
      this.logger.error(
        `[RequestID: ${requestId ?? 'N/A'}] Failed to create order: ${error.message}`,
      );
      throw error;
    }
  }

  async getOrdersByProduct(productId: number, requestId?: string) {
    try {
      const { data } = await this.orderClient.get(
        `/orders/product/${productId}`,
        {
          headers: requestId ? { 'x-request-id': requestId } : {},
        },
      );

      this.logger.log(
        `[RequestID: ${requestId ?? 'N/A'}] Retrieved orders for productId=${productId}`,
      );

      return data;
    } catch (error) {
      this.logger.error(
        `[RequestID: ${requestId ?? 'N/A'}] Failed to fetch orders for productId=${productId}: ${error.message}`,
      );
      throw error;
    }
  }
}
