import { Module, Global } from '@nestjs/common';
import { RedisCacheService } from './utils/redis.util';
import { RabbitmqPublisher } from './utils/rabbitmq.publisher';

@Global()
@Module({
  providers: [RedisCacheService, RabbitmqPublisher],
  exports: [RedisCacheService, RabbitmqPublisher],
})
export class CommonModule {}
