# Microservices Product & Order System

## Run Locally with Docker

### Build and Start All Services

```bash
docker compose up -d --build
```

This will start all microservices and dependencies:
- PostgreSQL (each for products & orders)
- Redis (each for products & orders)
- RabbitMQ (message broker)
- Product Service
- Order Service
- k6 (load testing)

---

## Access Redis Containers

### Product Redis
```bash
docker exec -it product-redis redis-cli
```

### Order Redis
```bash
docker exec -it order-redis redis-cli
```

Example commands:
```bash
GET "product:1"
GET "orders:product:1"
```

---

## Access RabbitMQ Dashboard

RabbitMQ Management UI:  
👉 [http://localhost:15672](http://localhost:15672)  
**Username:** `guest`  
**Password:** `guest`

---

## Load Testing with k6

The load test script is located in:
```
k6-tests/script.js
```

This test sends load to:
```
POST http://order-service:3002/orders
```

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
checks_total.......: 44248
http_req_failed....: 65.43%
http_req_duration..: p(95)=15.71s
```

# Architecture Explanation

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
   - After successfully updating inventory, it emits an **`order.updated`** event to RabbitMQ to signal that the order can be marked as completed.  

3. **Order Service Reaction**  
   - The `order-service` listens for the `order.updated` event.  
   - Upon receiving it, the order status is updated to `done` in the order database, and the cache is refreshed if necessary.  


## 🧾 Environment Overview

Each microservice is isolated and connected via the same Docker network `appnet`.

| Service | Port | Depends On | Description |
|----------|------|-------------|--------------|
| **Product DB** | 5433 | - | PostgreSQL for product data |
| **Order DB** | 5434 | - | PostgreSQL for order data |
| **Product Redis** | 6379 | - | Cache for product lookups |
| **Order Redis** | 6380 | - | Cache for order lookups |
| **RabbitMQ** | 5672 / 15672 | - | Message broker & management UI |
| **Product Service** | 3001 | product-db, product-redis, rabbitmq | REST API for product operations |
| **Order Service** | 3002 | order-db, order-redis, rabbitmq, product-service | REST API for order management |
| **k6** | N/A | - | Load testing container |

---