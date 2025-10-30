package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/dandiagusm/microservices-product-order/order-service/internal/domain"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/infra/cache"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/infra/db"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/infra/messaging"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/middleware"
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

func (s *OrderService) CreateOrder(ctx context.Context, productID, quantity int) (*domain.Order, error) {
	requestID := middleware.GetRequestID(ctx)

	req, err := http.NewRequest("GET", fmt.Sprintf("%s/products/%d", s.ProductServiceURL, productID), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("X-Request-ID", requestID)
	client := &http.Client{Timeout: 5 * time.Second}

	res, err := client.Do(req)
	if err != nil || res.StatusCode != http.StatusOK {
		log.Printf("[RequestID: %s] FAILED to fetch product %d: %v", requestID, productID, err)
		return nil, fmt.Errorf("product not found")
	}
	defer res.Body.Close()

	var prod productResponse
	if err := json.NewDecoder(res.Body).Decode(&prod); err != nil {
		log.Printf("[RequestID: %s] FAILED to decode product response: %v", requestID, err)
		return nil, fmt.Errorf("failed to decode product")
	}

	log.Printf("[RequestID: %s] Product %d fetched successfully", requestID, productID)

	order := &domain.Order{
		ProductID:  productID,
		TotalPrice: float64(quantity) * prod.Price,
		Status:     "waiting",
		CreatedAt:  time.Now(),
	}

	if err := s.Db.CreateOrder(order); err != nil {
		log.Printf("[RequestID: %s] FAILED to create order: %v", requestID, err)
		return nil, err
	}

	log.Printf("[RequestID: %s] Order %d created successfully", requestID, order.ID)

	if err := s.refreshProductOrdersCache(productID); err != nil {
		log.Printf("[RequestID: %s] FAILED to refresh cache: %v", requestID, err)
	}

	event := map[string]interface{}{
		"orderId":   order.ID,
		"productId": order.ProductID,
		"quantity":  quantity,
		"status":    order.Status,
		"createdAt": order.CreatedAt,
		"requestId": requestID, // consistent key
	}

	if err := s.RMQ.Publish("order.created", event); err != nil {
		log.Printf("[RequestID: %s] FAILED to publish order.created: %v", requestID, err)
	} else {
		log.Printf("[RequestID: %s] PUBLISHED order.created → orderId=%d productId=%d", requestID, order.ID, order.ProductID)
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
			RequestID string `json:"requestId"` // consistent key
		}

		if err := json.Unmarshal(body, &msg); err != nil {
			log.Println("FAILED to decode order.updated:", err)
			return
		}

		reqID := msg.RequestID
		if reqID == "" {
			reqID = "no-request-id"
		}

		log.Printf("[RequestID: %s] RECEIVED order.updated: %+v", reqID, msg)

		if err := s.Db.UpdateOrderStatus(msg.OrderID, msg.Status); err != nil {
			log.Printf("[RequestID: %s] FAILED to update order %d: %v", reqID, msg.OrderID, err)
			return
		}

		if err := s.refreshProductOrdersCache(msg.ProductID); err != nil {
			log.Printf("[RequestID: %s] FAILED to refresh cache: %v", reqID, err)
		}

		log.Printf("[RequestID: %s] Order %d updated to '%s'", reqID, msg.OrderID, msg.Status)
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
