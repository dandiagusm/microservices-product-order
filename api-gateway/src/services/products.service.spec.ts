import { ProductsService } from './products.service';
import { Logger } from '@nestjs/common';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductsService();
  });

  describe('getProduct', () => {
    it('should return product data successfully', async () => {
      const mockProduct = { id: 1, name: 'Laptop', price: 1000, qty: 5 };

      mockedAxios.create.mockReturnValueOnce({
        get: jest.fn().mockResolvedValueOnce({ data: mockProduct }),
      } as any);

      service = new ProductsService();

      const result = await service.getProduct(1, 'req-001');
      expect(result).toEqual(mockProduct);
    });

    it('should throw error when request fails', async () => {
      const error = new Error('Not Found');

      mockedAxios.create.mockReturnValueOnce({
        get: jest.fn().mockRejectedValueOnce(error),
      } as any);

      service = new ProductsService();

      await expect(service.getProduct(999)).rejects.toThrow('Not Found');
    });
  });

  describe('createProduct', () => {
    it('should create product successfully', async () => {
      const dto = { name: 'Phone', price: 500, qty: 10 };
      const mockResponse = { id: 101, ...dto };

      mockedAxios.create.mockReturnValueOnce({
        post: jest.fn().mockResolvedValueOnce({ data: mockResponse }),
      } as any);

      service = new ProductsService();

      const result = await service.createProduct(dto, 'req-002');
      expect(result).toEqual(mockResponse);
    });

    it('should throw error when create fails', async () => {
      const dto = { name: 'Phone', price: 500, qty: 10 };
      const error = new Error('Internal Server Error');

      mockedAxios.create.mockReturnValueOnce({
        post: jest.fn().mockRejectedValueOnce(error),
      } as any);

      service = new ProductsService();

      await expect(service.createProduct(dto)).rejects.toThrow('Internal Server Error');
    });
  });
});