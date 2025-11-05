# VIDEO
Please check the video_url in docs folder or go directly to [Link Video](https://drive.google.com/file/d/1mSTbEGRmQELOfolM7sGasJ4XAOooAlWq/view?usp=sharing)

# Microservices Product & Order System
## Run Locally with Docker

1. Make .env from .env.example in each folder services
2. Build and Start All Services
```bash
docker-compose up --build
```

This will start all microservices and dependencies:
- PostgreSQL (each for products & orders)
- Redis (each for products & orders)
- RabbitMQ (message broker)
- Product Service
- Order Service
- k6 (load testing)

---

## API Request
Go to `docs/` folder and get / import `Product Order.postman_collection.json` into `Postman`
or
Go to [Link Postman](https://documenter.getpostman.com/view/9425838/2sB3WnxMs8)

---

## Access Redis Containers
Make request first to fill the data needed (Create and Get)
### Product Redis
```bash
docker exec -it product-redis redis-cli
```
```bash
GET "product:1"
```
### Order Redis
```bash
docker exec -it order-redis redis-cli
```
```bash
GET "orders:product:1"
```

---

## Access RabbitMQ Dashboard

RabbitMQ Management UI: [http://localhost:15672](http://localhost:15672)  
**Username:** `guest`  
**Password:** `guest`

---
## Testing
### order service 
in folder order-service
```
go test ./internal/service/order_service_test.go -v
```
### product service & api gateway
in folder product-service and api-gateway
```
npm run test
```

---

## Load Testing with k6

The load test script is located in:
```
k6-tests/script.js
```
This test sends load to: POST http://order-service:3002/orders

How to Run 
```
.\test-load.ps1
```
or 
```
docker compose exec k6 k6 run /scripts/script.js
```

### Example Test Output

```
  █ THRESHOLDS

    errors
    ✓ 'count<1000' count=0

    http_req_duration
    ✓ 'p(95)<1000' p(95)=9.77ms

    http_req_failed
    ✓ 'rate<0.05' rate=0.00%

    latency_ms
    ✓ 'p(95)<1000' p(95)=9.77682


  █ TOTAL RESULTS

    checks_total.......: 175998  1600.061977/s
    checks_succeeded...: 100.00% 175998 out of 175998
    checks_failed......: 0.00%   0 out of 175998

    ✓ status is 200
    ✓ duration < 1s

    CUSTOM
    errors.........................: 0     0/s
    latency_ms.....................: avg=4.445527 min=0.861288 med=3.29435 max=233.995741 p(90)=7.522462 p(95)=9.77682

    HTTP
    http_req_duration..............: avg=4.44ms   min=861.28µs med=3.29ms  max=233.99ms   p(90)=7.52ms   p(95)=9.77ms
      { expected_response:true }...: avg=4.44ms   min=861.28µs med=3.29ms  max=233.99ms   p(90)=7.52ms   p(95)=9.77ms
    http_req_failed................: 0.00% 0 out of 87999
    http_reqs......................: 87999 800.030988/s

    EXECUTION
    iteration_duration.............: avg=6.07ms   min=3.13ms   med=4.94ms  max=235.87ms   p(90)=9.18ms   p(95)=11.6ms
    iterations.....................: 87999 800.030988/s
    vus............................: 0     min=0          max=25
    vus_max........................: 500   min=500        max=500

    NETWORK
    data_received..................: 24 MB 215 kB/s
    data_sent......................: 14 MB 130 kB/s
```
Based on http_reqs, RPS (Requests per second) is 800

# Architecture

`product-service` (NestJS) and `order-service` (Go) communicate asynchronously through **RabbitMQ**, and each maintains its own **PostgreSQL** database and **Redis** for frequently requested data.

![Architecture Diagram](docs/architecture.png)

## API Gateway & Middleware  
All client requests first pass through the **API Gateway**, which acts as a unified entry point to the system. It handles routing requests to the correct service and includes several **middleware layers**:

- **Validation Middleware** – ensures incoming requests contain valid data before reaching the services.  
- **Request/Trace ID Middleware** – attaches a unique trace ID to every request for distributed logging and debugging across services.  
- **Response Standardization Middleware** – unifies API response format from different services.  
- **Error Handling Middleware** – catches and formats service or network errors into consistent API responses.  

## Data Flow and Event Communication  
1. **Creating an Order**  
   - The user sends a `POST /orders` request through the API Gateway.  
   - The `order-service` validates the product by calling `product-service` or retrieving it from Redis.  
   - Once validated, it saves the new order in PostgreSQL and emits an **`order.created`** event to RabbitMQ.  

2. **Product Service Reaction**  
   - The `product-service` listens for the `order.created` event.  
   - When received, it reduces the product’s stock (`qty`) and updates its database and Redis cache.  
   - After successfully updated product, it emits an **`order.updated`** event to RabbitMQ to signal that the order can be marked as done.  

3. **Order Service Reaction**  
   - The `order-service` listens for the `order.updated` event.  
   - Upon receiving it, the order status is updated to `done` in the order database, and the cache is refreshed if necessary.  

## How the Flow Works (Example: Order Creation)
1. Client sends POST /orders to API Gateway
2. Gateway forwards request to Order Service → OrderController.CreateOrder()
3. Controller calls OrderService.CreateOrder()
4. Service fetches product info:
    - Checks Redis cache first
    - If cache miss, queries Product Service via HTTP
    - Caches the result
5. Service creates order in Postgres
6. Service asynchronously:
    - Updates order cache
    - Publishes order.created event to RabbitMQ
7. Product Service receives order.created:
    - Reduces product quantity
    - Publishes order.updated
8. Order Service may listen for order.updated to refresh cache
9. Controller responds to client with order info

## Layer Mapping


| **Layer** | **Purpose / Responsibility** | **Where It Exists** | **Example Components** |
|------------|-------------------------------|---------------------|--------------------------|
| **Infrastructure** | Handles technical details — databases, caches, message brokers| All services | `PostgresDB`, `RedisClient`, `RMQPublisher`|
| **Service / Business Logic** | Implements application-specific operations using domain and infrastructure.| All services | `OrderService`, `ProductService` |
| **Controller / API** | Maps routes to services. Handles request | All services | `OrderController`, `ProductController` |
| **Event / Messaging** | Publishes or consumes domain events to communicate across services asynchronously. | All services | `RabbitMQ`, `order.created`, `order.updated` |

## Project Structure
```
microservices-product-order/
├── mock/                      # Mock JSON data untuk testing
│   └── products.json
├── order-service/             # Microservice Order
│   ├── cmd/                   # Entry point
│   │   └── main.go
│   ├── internal/
│   │   ├── controller/        # HTTP handler / routes
│   │   │   └── order_controller.go
│   │   ├── service/           # Business logic
│   │   │   ├── order_service.go
│   │   │   └── order_service_test.go
│   │   ├── domain/            # Entity / models
│   │   │   └── order.go
│   │   ├── infra/             # Infrastructure layer
│   │   │   ├── db/            # Database
│   │   │   │   └── postgres.go
│   │   │   ├── cache/         # Redis cache
│   │   │   │   └── redis.go
│   │   │   └── messaging/     # RabbitMQ publisher/subscriber
│   │   │       └── publisher.go
│   │   └── middleware/        # Middleware helper
│   │       └── requestid.go
│   └── go.mod
├── product-service/           # Microservice Product
│   ├── src/
│   │   ├── products/          # Module products
│   │   │   ├── dto/
│   │   │   │   └── create-product.dto.ts
│   │   │   ├── entities/
│   │   │   │   └── product.entity.ts
│   │   │   └── products.service.ts
│   │   ├── common/            # Utils (Redis, RabbitMQ)
│   │   │   ├── utils/         
│   │   │   │   ├── redis.util.ts
│   │   │   │   └── rabbitmq.publisher.ts
│   │   │   └── filters/
│   │   │       └── error.handler.ts
│   │   └── main.ts
├── api-gateway/               # Gateway (NestJS/Express)
│   ├── src/
│   │   ├── modules/
│   │   │   ├── products.module.ts
│   │   │   └── orders.module.ts
│   │   ├── common/
│   │   │   ├── filters/
│   │   │   │   └── error.handler.ts
│   │   │   └── utils/
│   │   │       ├── redis.util.ts
│   │   │       └── rabbitmq.publisher.ts
│   │   └── main.ts
│   └── package.json
```

