package service

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"net/http"

	"github.com/dandiagusm/microservices-product-order/order-service/internal/domain"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/infra/cache"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/infra/messaging"
)

type OrderService struct {
	db    *sql.DB
	cache *cache.RedisClient
	rmq   *messaging.Publisher
}

func NewOrderService(db *sql.DB, cache *cache.RedisClient, rmq *messaging.Publisher) *OrderService {
	return &OrderService{
		db:    db,
		cache: cache,
		rmq:   rmq,
	}
}

// Create order
func (s *OrderService) CreateOrder(input domain.CreateOrderDTO) (*domain.Order, error) {
	// Validate product exists
	resp, err := http.Get(fmt.Sprintf("%s/products/%d", s.cache.ProductServiceURL(), input.ProductID))
	if err != nil || resp.StatusCode != http.StatusOK {
		return nil, errors.New("product not found")
	}

	// Calculate total price (for simplicity assume quantity * 10)
	totalPrice := float64(input.Quantity) * 10

	// Insert order
	var orderID int
	err = s.db.QueryRow(
		"INSERT INTO orders (product_id, total_price) VALUES ($1, $2) RETURNING id",
		input.ProductID,
		totalPrice,
	).Scan(&orderID)
	if err != nil {
		return nil, err
	}

	order := &domain.Order{
		ID:         orderID,
		ProductID:  input.ProductID,
		TotalPrice: totalPrice,
		Status:     "pending",
		CreatedAt:  time.Now(),
	}

	// Publish event
	data, _ := json.Marshal(order)
	if err := s.rmq.Publish("order.created", data); err != nil {
		log.Printf("[RMQ] Failed to publish: %v", err)
	}

	// Cache by product_id
	key := fmt.Sprintf("orders:product:%d", input.ProductID)
	_ = s.cache.Set(key, data, 5*time.Minute)

	return order, nil
}

// Get orders by product ID
func (s *OrderService) GetOrdersByProduct(productID int) ([]domain.Order, error) {
	key := fmt.Sprintf("orders:product:%d", productID)
	cached, err := s.cache.Get(key)
	if err == nil && cached != "" {
		var orders []domain.Order
		_ = json.Unmarshal([]byte(cached), &orders)
		return orders, nil
	}

	rows, err := s.db.Query("SELECT id, product_id, total_price, status, created_at FROM orders WHERE product_id=$1", productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []domain.Order
	for rows.Next() {
		var o domain.Order
		_ = rows.Scan(&o.ID, &o.ProductID, &o.TotalPrice, &o.Status, &o.CreatedAt)
		orders = append(orders, o)
	}

	data, _ := json.Marshal(orders)
	_ = s.cache.Set(key, data, 5*time.Minute)

	return orders, nil
}

func (s *OrderService) RMQ() *messaging.Publisher {
	return s.rmq
}
