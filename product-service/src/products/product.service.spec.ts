import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { RedisCacheService } from '../common/utils/redis.util';
import { RabbitmqPublisher } from '../common/utils/rabbitmq.publisher';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreateProductDto } from './dto/create-product.dto';

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
    createdAt: new Date(),
  } as Product;

  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn().mockReturnValue(mockProduct),
    save: jest.fn().mockResolvedValue(mockProduct),
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };

  const mockPublisher = {
    ready: Promise.resolve(),
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
  } as unknown as RabbitmqPublisher;

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
    repo = module.get<Repository<Product>>(getRepositoryToken(Product));
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
    it('should create product, refresh cache, and publish event', async () => {
      const dto: CreateProductDto = { name: 'Test Product', price: 100, qty: 10 };

      const refreshSpy = jest.spyOn(service as any, 'refreshCache').mockResolvedValue(undefined);

      const result = await service.create(dto, 'REQ123');

      expect(result).toEqual(mockProduct);
      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalledWith(mockProduct);

      expect(refreshSpy).toHaveBeenCalledWith(mockProduct.id, 'REQ123');

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'product.created',
        expect.objectContaining({
          id: mockProduct.id,
          name: mockProduct.name,
          price: mockProduct.price,
          qty: mockProduct.qty,
          createdAt: mockProduct.createdAt,
        }),
      );
    });
  });

  describe('reduceQty', () => {
    it('should reduce product quantity and refresh cache', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockProduct });
      mockRepo.save.mockResolvedValue({ ...mockProduct, qty: 7 });

      const result = await service.reduceQty(mockProduct.id, 3, 'REQ123');

      // expect(result.qty).toEqual(7);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: mockProduct.id } });
      expect(mockRepo.save).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledWith(`product:${mockProduct.id}`, expect.any(Object), 600);
    });

    it('should throw NotFoundException if product does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.reduceQty(9999, 3, 'REQ123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('onModuleInit', () => {
    it('should subscribe to order.created', async () => {
      await service.onModuleInit();
      expect(mockPublisher.subscribe).toHaveBeenCalledWith('order.created', expect.any(Function));
    });

    it('should handle order.created message', async () => {
      let callback: (msg: any) => void;
      mockPublisher.subscribe = jest.fn(async (_key, cb) => {
        callback = cb;
      });
      await service.onModuleInit();

      const orderMessage = { orderId: 1, productId: 1, quantity: 2, requestId: 'REQ123' };
      mockRepo.findOne.mockResolvedValue({ ...mockProduct });
      mockRepo.save.mockResolvedValue({ ...mockProduct, qty: 8 });

      await callback!(orderMessage);

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
      );
    });
  });
});
