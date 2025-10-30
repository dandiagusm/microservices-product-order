import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { services } from '../config';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly productClient: AxiosInstance;

  constructor() {
    this.productClient = axios.create({ baseURL: services.product.url });
  }

  async getProduct(id: number, requestId?: string) {
    try {
      const { data } = await this.productClient.get(`/products/${id}`, {
        headers: requestId ? { 'x-request-id': requestId } : {},
      });

      this.logger.log(
        `[RequestID: ${requestId ?? 'N/A'}] Retrieved product ${id}`,
      );

      return data;
    } catch (error: any) {
      this.logger.error(
        `[RequestID: ${requestId ?? 'N/A'}] Failed to fetch product ${id}: ${error.message}`,
      );
      throw error;
    }
  }

  async createProduct(
    dto: { name: string; price: number; qty: number },
    requestId?: string,
  ) {
    try {
      const { data } = await this.productClient.post('/products', dto, {
        headers: requestId ? { 'x-request-id': requestId } : {},
      });

      this.logger.log(
        `[RequestID: ${requestId ?? 'N/A'}] Created product: ${data.id} (${dto.name})`,
      );

      return data;
    } catch (error: any) {
      this.logger.error(
        `[RequestID: ${requestId ?? 'N/A'}] Failed to create product: ${error.message}`,
      );
      throw error;
    }
  }
}
