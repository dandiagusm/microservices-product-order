import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { RedisCacheService } from '../common/utils/redis.util';
import { RabbitmqPublisher } from '../common/utils/rabbitmq.publisher';
import { NotFoundException } from '@nestjs/common';

describe('ProductsService', () => {
  let service: ProductsService;

  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };
  const mockRedis = { get: jest.fn(), set: jest.fn() };
  const mockPublisher = { publish: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: mockRepo },
        { provide: RedisCacheService, useValue: mockRedis },
        { provide: RabbitmqPublisher, useValue: mockPublisher },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should create a product and publish event', async () => {
    const dto = { name: 'Test', price: 10, qty: 5 };
    const product = { id: 1, ...dto };
    mockRepo.create.mockReturnValue(dto);
    mockRepo.save.mockResolvedValue(product);

    const result = await service.create(dto);

    expect(mockRepo.create).toHaveBeenCalledWith(dto);
    expect(mockRepo.save).toHaveBeenCalledWith(dto);
    expect(mockPublisher.publish).toHaveBeenCalledWith('product.created', expect.any(Object));
    expect(result).toEqual(product);
  });

  it('should find product by id (cache hit)', async () => {
    const cached = { id: 1, name: 'Cached', price: 20, qty: 10 };
    mockRedis.get.mockResolvedValue(cached);

    const result = await service.findById(1);
    expect(result).toEqual(cached);
  });

  it('should throw NotFoundException if product missing', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    mockRedis.get.mockResolvedValue(null);

    await expect(service.findById(999)).rejects.toThrow(NotFoundException);
  });

  it('should reduce product quantity and update cache', async () => {
    const product = { id: 1, qty: 10, name: 'A', price: 5 };
    mockRepo.findOne.mockResolvedValue(product);
    mockRepo.save.mockResolvedValue({ ...product, qty: 7 });

    const result = await service.reduceQty(1, 3);
    expect(result.qty).toBe(7);
    expect(mockRedis.set).toHaveBeenCalled();
  });
});
