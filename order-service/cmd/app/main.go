package main

import (
	"log"
	"net/http"
	"os"

	"github.com/dandiagusm/microservices-product-order/order-service/internal/controller"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/infra/cache"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/infra/db"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/infra/messaging"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/service"
)

func main() {
	// Load env
	port := os.Getenv("PORT")
	if port == "" {
		port = "3002"
	}

	// Init DB
	dbConn, err := db.NewPostgresDB()
	if err != nil {
		log.Fatalf("[DB] Failed to connect: %v", err)
	}

	// Auto-create orders table
	_, err = dbConn.Exec(`
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            product_id INT NOT NULL,
            total_price NUMERIC NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `)
	if err != nil {
		log.Fatalf("[DB] Failed to create orders table: %v", err)
	}

	// Init Redis
	redisClient, err := cache.NewRedisClient()
	if err != nil {
		log.Fatalf("[Redis] Failed to connect: %v", err)
	}

	// Init RabbitMQ
	publisher, err := messaging.NewPublisher()
	if err != nil {
		log.Fatalf("[RabbitMQ] Failed to connect: %v", err)
	}

	// Init Order Service
	orderService := service.NewOrderService(dbConn, redisClient, publisher)

	// Init Controller
	orderController := controller.NewOrderController(orderService)

	router := controller.NewRouter(orderController)

	log.Printf("Order service listening on %s", port)
	log.Fatal(http.ListenAndServe(":"+port, router))
}
