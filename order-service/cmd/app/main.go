package main

import (
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/dandiagusm/microservices-product-order/order-service/internal/controller"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/infra/cache"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/infra/db"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/infra/messaging"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/service"
)

func main() {
	// Load environment variables with defaults
	port := getEnvAsInt("PORT", 3002)
	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnvAsInt("DB_PORT", 5432)
	dbUser := getEnv("DB_USER", "order_user")
	dbPassword := getEnv("DB_PASSWORD", "order_pass")
	dbName := getEnv("DB_NAME", "orders_db")
	redisHost := getEnv("REDIS_HOST", "localhost")
	redisPort := getEnv("REDIS_PORT", "6379")
	rabbitURL := getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
	productServiceURL := getEnv("PRODUCT_SERVICE_URL", "http://localhost:3001")

	// Initialize Postgres DB
	pg, err := db.NewPostgresDB(dbHost, dbUser, dbPassword, dbName, dbPort)
	if err != nil {
		log.Fatalf("Failed to connect to DB: %v", err)
	}

	// Initialize Redis
	rdb, err := cache.NewRedisClient(redisHost, redisPort)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	// Initialize RabbitMQ
	rmq, err := messaging.NewPublisher(rabbitURL)
	if err != nil {
		log.Fatalf("Failed to connect to RabbitMQ: %v", err)
	}

	// Initialize Order Service
	orderService := service.NewOrderService(pg, rdb, rmq, productServiceURL)

	// Initialize Router
	router := controller.NewRouter(orderService)

	log.Printf("Order service listening on port %d", port)
	if err := http.ListenAndServe(":"+strconv.Itoa(port), router); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// Helper to get environment variable or default value
func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

// Helper to get environment variable as int or default
func getEnvAsInt(key string, defaultVal int) int {
	if valStr := os.Getenv(key); valStr != "" {
		if val, err := strconv.Atoi(valStr); err == nil {
			return val
		}
	}
	return defaultVal
}
