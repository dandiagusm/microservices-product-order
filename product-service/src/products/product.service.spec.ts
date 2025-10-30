import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { RedisCacheService } from '../common/utils/redis.util';
import { RabbitmqPublisher } from '../common/utils/rabbitmq.publisher';
import { NotFoundException } from '@nestjs/common';

describe('ProductsService', () => {
  let service: ProductsService;
  let repo: Repository<Product>;
  let redis: RedisCacheService;
  let publisher: RabbitmqPublisher;

  const mockProduct = {
    id: 1,
    name: 'Test Product',
    price: 100,
    qty: 10,
  };

  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn().mockReturnValue(mockProduct),
    save: jest.fn(),
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockPublisher = {
    ready: Promise.resolve(),
    publish: jest.fn(),
    subscribe: jest.fn(),
  } as unknown as RabbitmqPublisher;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: Repository, useValue: mockRepo },
        { provide: RedisCacheService, useValue: mockRedis },
        { provide: RabbitmqPublisher, useValue: mockPublisher },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    repo = module.get<Repository<Product>>(Repository);
    redis = module.get<RedisCacheService>(RedisCacheService);
    publisher = module.get<RabbitmqPublisher>(RabbitmqPublisher);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return product from cache if exists', async () => {
      mockRedis.get.mockResolvedValue(mockProduct);

      const result = await service.findById(mockProduct.id, 'REQ123');

      expect(result).toEqual(mockProduct);
      expect(mockRedis.get).toHaveBeenCalledWith(`product:${mockProduct.id}`);
      expect(mockRepo.findOne).not.toHaveBeenCalled();
    });

    it('should fetch product from DB and set cache if not in cache', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRepo.findOne.mockResolvedValue(mockProduct);

      const result = await service.findById(mockProduct.id, 'REQ123');

      expect(result).toEqual(mockProduct);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: mockProduct.id } });
      expect(mockRedis.set).toHaveBeenCalledWith(`product:${mockProduct.id}`, mockProduct, 600);
    });

    it('should throw NotFoundException if product not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(9999, 'REQ123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create product and refresh cache', async () => {
      mockRepo.save.mockResolvedValue(mockProduct);

      const result = await service.create({ name: 'Test Product', price: 100, qty: 10 }, 'REQ123');

      expect(result).toEqual(mockProduct);
      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalledWith(mockProduct);
      expect(mockRedis.set).toHaveBeenCalledWith(`product:${mockProduct.id}`, mockProduct, 600);
    });
  });

  describe('reduceQty', () => {
    it('should reduce product quantity and refresh cache', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockProduct });
      mockRepo.save.mockResolvedValue({ ...mockProduct, qty: 7 });

      const result = await service.reduceQty(mockProduct.id, 3, 'REQ123');

      expect(result.qty).toEqual(7);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: mockProduct.id } });
      expect(mockRepo.save).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledWith(`product:${mockProduct.id}`, expect.any(Object), 600);
    });

    it('should throw NotFoundException if product does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.reduceQty(9999, 3, 'REQ123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('onModuleInit - order.created', () => {
    it('should subscribe to RabbitMQ messages', async () => {
      await service.onModuleInit();
      expect(mockPublisher.subscribe).toHaveBeenCalledWith('order.created', expect.any(Function));
    });

    it('should handle order.created message', async () => {
      const orderMessage = { orderId: 1, productId: 1, quantity: 2, requestId: 'REQ123' };
      const callback = jest.fn();
      mockPublisher.subscribe = jest.fn(async (_key, cb) => {
        callback.mockImplementation(cb);
      });

      await service.onModuleInit();
      await callback(orderMessage);

      expect(mockRepo.findOne).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalled();
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'order.updated',
        expect.objectContaining({
          orderId: 1,
          productId: 1,
          status: 'done',
          requestId: 'REQ123',
        }),
        undefined,
      );
    });
  });
});
