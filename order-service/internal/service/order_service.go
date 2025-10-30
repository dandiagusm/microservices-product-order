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
	Qty   int     `json:"qty"`
}

func (s *OrderService) CreateOrder(productID, quantity int) (*domain.Order, error) {
	res, err := http.Get(fmt.Sprintf("%s/products/%d", s.ProductServiceURL, productID))
	if err != nil || res.StatusCode != 200 {
		return nil, fmt.Errorf("product not found")
	}
	defer res.Body.Close()

	var prod productResponse
	if err := json.NewDecoder(res.Body).Decode(&prod); err != nil {
		return nil, fmt.Errorf("failed to decode product")
	}

	// if prod.Qty < quantity {
	// 	return nil, fmt.Errorf("insufficient stock")
	// }

	order := &domain.Order{
		ProductID:  productID,
		TotalPrice: float64(quantity) * prod.Price,
		Status:     "waiting",
		CreatedAt:  time.Now(),
	}

	if err := s.Db.CreateOrder(order); err != nil {
		return nil, err
	}

	if err := s.refreshProductOrdersCache(productID); err != nil {
		log.Printf("FAILED to refresh cache: %v", err)
	}

	event := map[string]interface{}{
		"orderId":   order.ID,
		"productId": order.ProductID,
		"quantity":  quantity,
		"status":    order.Status,
		"createdAt": order.CreatedAt,
	}

	if err := s.RMQ.Publish("order.created", event); err != nil {
		log.Println("FAILED to publish order.created:", err)
	} else {
		log.Printf("PUBLISHED order.created → orderId=%d productId=%d", order.ID, order.ProductID)
	}

	return order, nil
}

func (s *OrderService) ListenOrderUpdated() error {
	return s.RMQ.Subscribe("order.updated", func(body []byte) {
		var msg struct {
			OrderID   int    `json:"orderId"`
			ProductID int    `json:"productId"`
			Status    string `json:"status"`
			UpdatedAt string `json:"updatedAt"`
		}

		if err := json.Unmarshal(body, &msg); err != nil {
			log.Println("FAILED to decode order.updated:", err)
			return
		}

		log.Printf("RECEIVED order.updated: %+v", msg)

		if err := s.Db.UpdateOrderStatus(msg.OrderID, msg.Status); err != nil {
			log.Printf("FAILED to update order %d: %v", msg.OrderID, err)
			return
		}

		if err := s.refreshProductOrdersCache(msg.ProductID); err != nil {
			log.Printf("FAILED to refresh cache: %v", err)
		}

		log.Printf("Order %d updated to '%s'", msg.OrderID, msg.Status)
	})
}

func (s *OrderService) refreshProductOrdersCache(productID int) error {
	orders, err := s.Db.GetOrdersByProductID(productID)
	if err != nil {
		return err
	}
	key := fmt.Sprintf("orders:product:%d", productID)
	return s.Cache.Set(key, orders, 60)
}

func (s *OrderService) GetOrdersByProductID(productID int) ([]*domain.Order, error) {
	cacheKey := fmt.Sprintf("orders:product:%d", productID)
	if data, err := s.Cache.Get(cacheKey); err == nil && data != nil {
		var orders []*domain.Order
		if err := json.Unmarshal(data, &orders); err == nil {
			return orders, nil
		}
	}

	orders, err := s.Db.GetOrdersByProductID(productID)
	if err != nil {
		return nil, err
	}

	if err := s.Cache.Set(cacheKey, orders, 60); err != nil {
		log.Printf("FAILED to set cache: %v", err)
	}

	return orders, nil
}
