# Microservices Product-Order

---

## 🚀 Tech Stack / Requirements

- **Go** (1.21+) – for building microservices
- **Docker** (20.x+) & **Docker Compose** (1.29.x+)
- **PostgreSQL** (15+)
- **Redis** (7+)
- **RabbitMQ** (3+)
- **k6** (latest) – for load testing
- Optional: **Postman** for API testing

---

## 📦 Services Overview

| Service           | Container        | Internal Port | External Port |
|------------------|----------------|---------------|---------------|
| Product Service   | product-service | 3001          | 3001          |
| Order Service     | order-service   | 3002          | 3002          |
| Product DB        | product-db      | 5432          | 5433          |
| Order DB          | order-db        | 5432          | 5434          |
| Product Redis     | product-redis   | 6379          | 6379          |
| Order Redis       | order-redis     | 6379          | 6380          |
| RabbitMQ          | rabbitmq        | 5672 / 15672  | 5672 / 15672  |
| k6 Load Test      | k6              | -             | -             |

All services run on a custom Docker network called `appnet`.

---

## Run Locally with Docker

Build and start all services:

```bash
docker compose up -d --build


# Product Redis
docker exec -it product-redis redis-cli

# Order Redis
docker exec -it order-redis redis-cli

GET "product:1"
GET "orders:product:1"

## Load Testing with k6

The k6 scripts are in `k6-tests/script.js`.

### Run k6 Load Test

You can run the test directly from your host machine:

```bash
docker compose run --rm k6 k6 run /scripts/script.js
