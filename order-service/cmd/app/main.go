package main

import (
	"log"
	"net/http"
	"os"

	"github.com/dandiagusm/microservices-product-order/order-service/internal/controller"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/infra/cache"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/infra/db"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/infra/messaging"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file
	err := godotenv.Load("../../.env")
	if err != nil {
		log.Println("No .env file found, using system env")
	}

	// Initialize Postgres
	postgresDB, err := db.NewPostgresDB()
	if err != nil {
		log.Fatalf("[error] Failed to connect to DB: %v", err)
	}

	// Initialize Redis
	redisClient := cache.NewRedisClient(
		os.Getenv("REDIS_HOST"),
		os.Getenv("REDIS_PORT"),
	)

	// Initialize RabbitMQ publisher
	rabbitMQPublisher, err := messaging.NewPublisher(os.Getenv("RABBITMQ_URL"))
	if err != nil {
		log.Fatalf("[error] Failed to connect to RabbitMQ: %v", err)
	}

	// Initialize Controller & Router
	orderController := controller.NewOrderController(postgresDB, redisClient, rabbitMQPublisher)
	router := controller.NewRouter(orderController)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "3002"
	}
	log.Printf("Order service listening on %s", port)
	if err := http.ListenAndServe(":"+port, router); err != nil {
		log.Fatalf("[error] Failed to start server: %v", err)
	}
}
