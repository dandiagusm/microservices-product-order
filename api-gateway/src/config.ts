export const services = {
  product: { url: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001' },
  order: { url: process.env.ORDER_SERVICE_URL || 'http://localhost:3002' },
  redis: { host: process.env.REDIS_HOST || 'localhost', port: +process.env.REDIS_PORT! || 6379 },
  rabbitMQ: { url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672/' },
};
