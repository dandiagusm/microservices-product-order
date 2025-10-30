export const services = {
  product: { url: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001' },
  order: { url: process.env.ORDER_SERVICE_URL || 'http://localhost:3002' },
};
