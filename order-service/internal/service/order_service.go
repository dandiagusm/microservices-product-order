package service

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/dandiagusm/microservices-product-order/order-service/internal/domain"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/infra/cache"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/infra/db"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/infra/messaging"
)

type OrderService struct {
	Db                *db.PostgresDB
	Cache             *cache.RedisClient
	RMQ               *messaging.Publisher
	ProductServiceURL string
}

func NewOrderService(pg *db.PostgresDB, r *cache.RedisClient, rmq *messaging.Publisher, productURL string) *OrderService {
	return &OrderService{
		Db:                pg,
		Cache:             r,
		RMQ:               rmq,
		ProductServiceURL: productURL,
	}
}

type productResponse struct {
	ID    int     `json:"id"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
}

func (s *OrderService) CreateOrder(productID, quantity int) (*domain.Order, error) {
	// Fetch product info
	res, err := http.Get(fmt.Sprintf("%s/products/%d", s.ProductServiceURL, productID))
	if err != nil || res.StatusCode != 200 {
		return nil, fmt.Errorf("product not found")
	}
	defer res.Body.Close()

	var prod productResponse
	if err := json.NewDecoder(res.Body).Decode(&prod); err != nil {
		return nil, fmt.Errorf("failed to decode product")
	}

	totalPrice := float64(quantity) * prod.Price
	order := &domain.Order{
		ProductID:  productID,
		TotalPrice: totalPrice,
		Status:     "created",
		CreatedAt:  time.Now(),
	}

	// Save in DB
	if err := s.Db.CreateOrder(order); err != nil {
		return nil, err
	}

	// Cache orders by product
	orders, _ := s.Db.GetOrdersByProductID(productID)
	_ = s.Cache.Set(fmt.Sprintf("orders:product:%d", productID), orders, 60)

	// Publish event
	body, _ := json.Marshal(order)
	if err := s.RMQ.Publish("order.created", body); err != nil {
		log.Println("Failed to publish order.created:", err)
	}

	return order, nil
}

func (s *OrderService) GetOrdersByProductID(productID int) ([]*domain.Order, error) {
	if data, err := s.Cache.Get(fmt.Sprintf("orders:product:%d", productID)); err == nil {
		var orders []*domain.Order
		if err := json.Unmarshal(data, &orders); err == nil {
			return orders, nil
		}
	}

	orders, err := s.Db.GetOrdersByProductID(productID)
	if err != nil {
		return nil, err
	}

	_ = s.Cache.Set(fmt.Sprintf("orders:product:%d", productID), orders, 60)
	return orders, nil
}
