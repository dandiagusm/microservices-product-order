# 🧱 Microservices Product & Order System

A microservices-based system consisting of **Product Service** and **Order Service**,  
built using **Node.js**, **PostgreSQL**, **Redis**, **RabbitMQ**, and **Grafana k6** for load testing — all orchestrated via **Docker Compose**.

---

## 🧠 Tech Stack

| Component | Technology | Description |
|------------|-------------|--------------|
| **Language / Runtime** | Node.js | REST API microservices for Product & Order |
| **Database** | PostgreSQL 15 | Persistent storage for each service |
| **Cache** | Redis 7.4 | Caching layer for fast lookups |
| **Message Broker** | RabbitMQ 3 | For asynchronous communication between services |
| **Load Testing** | Grafana k6 | Load and stress testing framework |
| **Containerization** | Docker + Docker Compose | Multi-service orchestration |

---

## 📁 Project Structure

```
microservices-product-order/
├── product-service/
│   ├── Dockerfile
│   ├── src/
│   └── ...
├── order-service/
│   ├── Dockerfile
│   ├── src/
│   └── ...
├── k6-tests/
│   └── script.js
├── docker-compose.yml
└── README.md
```

---

## ⚙️ Prerequisites

You’ll need the following installed locally:

- [Docker](https://www.docker.com/)
- [Docker Compose v2+](https://docs.docker.com/compose/)
- (Optional) [Redis CLI](https://redis.io/docs/latest/develop/connect/cli/)

---

## 🚀 Run Locally with Docker

### 1️⃣ Build and Start All Services

```bash
docker compose up -d --build
```

This will start all microservices and dependencies:
- PostgreSQL (for products & orders)
- Redis (for products & orders)
- RabbitMQ (message broker)
- Product Service
- Order Service
- k6 (for load testing)

---

### 2️⃣ Check Running Containers

```bash
docker compose ps
```

Expected output:
```
NAME                 COMMAND                  STATUS          PORTS
product-db           "docker-entrypoint.s…"   Up              0.0.0.0:5433->5432/tcp
order-db             "docker-entrypoint.s…"   Up              0.0.0.0:5434->5432/tcp
product-redis        "redis-server"           Up              0.0.0.0:6379->6379/tcp
order-redis          "redis-server"           Up              0.0.0.0:6380->6379/tcp
rabbitmq             "docker-entrypoint.s…"   Up              0.0.0.0:5672->5672/tcp, 0.0.0.0:15672->15672/tcp
product-service      "npm start"              Up              0.0.0.0:3001->3001/tcp
order-service        "npm start"              Up              0.0.0.0:3002->3002/tcp
k6                   "tail -f /dev/null"      Up
```

---

## 🧠 Access Redis Containers

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

## 🐇 Access RabbitMQ Dashboard

RabbitMQ Management UI:  
👉 [http://localhost:15672](http://localhost:15672)  
**Username:** `guest`  
**Password:** `guest`

---

## 🧪 Load Testing with k6

The load test script is located in:
```
k6-tests/script.js
```

This test sends load to:
```
POST http://order-service:3002/orders
```

---

### ▶️ Run the k6 Load Test

You can run it directly using Docker Compose:

```bash
docker compose run --rm k6 k6 run /scripts/script.js
```

This will execute the load test defined in `k6-tests/script.js`.

---

### 💬 Example Test Output

```
checks_total.......: 44248
http_req_failed....: 65.43%
http_req_duration..: p(95)=15.71s
```

You can adjust test parameters (load rate, duration, thresholds) inside `k6-tests/script.js`:

```js
export const options = {
  scenarios: {
    high_load: {
      executor: "constant-arrival-rate",
      rate: 1000, // requests per second
      duration: "30s",
      preAllocatedVUs: 500,
      maxVUs: 2000,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};
```

---

## 🧹 Maintenance Commands

**View logs (live):**
```bash
docker compose logs -f
```

**Restart a specific service:**
```bash
docker compose restart order-service
```

**Stop all containers:**
```bash
docker compose down
```

**Rebuild and restart everything cleanly:**
```bash
docker compose down -v && docker compose up -d --build
```

---

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

## 🧰 Example Redis Keys

| Key | Description |
|------|--------------|
| `product:1` | Cached data for Product ID 1 |
| `orders:product:1` | Cached list of orders for Product ID 1 |

---

## 🧾 License

MIT License © 2025  
Created for educational and performance testing purposes.
