import { OrdersService } from './orders.service';
import { Logger } from '@nestjs/common';
import axios from 'axios';

// Mock axios globally
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService();
  });

  describe('createOrder', () => {
    it('should create order successfully', async () => {
      // Arrange
      const mockResponse = { id: 1, productId: 10, quantity: 2 };
      mockedAxios.create.mockReturnValueOnce({
        post: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
      } as any);

      service = new OrdersService(); // Reinitialize after mock

      // Act
      const result = await service.createOrder(10, 2, 'req-123');

      // Assert
      expect(result).toEqual(mockResponse);
    });

    it('should throw error if API fails', async () => {
      const error = new Error('Network error');
      mockedAxios.create.mockReturnValueOnce({
        post: jest.fn().mockRejectedValueOnce(error),
      } as any);

      service = new OrdersService();

      await expect(service.createOrder(1, 1)).rejects.toThrow('Network error');
    });
  });

  describe('getOrdersByProduct', () => {
    it('should fetch orders successfully', async () => {
      const mockOrders = [{ id: 1, productId: 10 }];
      mockedAxios.create.mockReturnValueOnce({
        get: jest.fn().mockResolvedValueOnce({ data: mockOrders }),
      } as any);

      service = new OrdersService();

      const result = await service.getOrdersByProduct(10, 'req-xyz');
      expect(result).toEqual(mockOrders);
    });

    it('should throw error if API fails', async () => {
      const error = new Error('Service unavailable');
      mockedAxios.create.mockReturnValueOnce({
        get: jest.fn().mockRejectedValueOnce(error),
      } as any);

      service = new OrdersService();

      await expect(service.getOrdersByProduct(10)).rejects.toThrow('Service unavailable');
    });
  });
});