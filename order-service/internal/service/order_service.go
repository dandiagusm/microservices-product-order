package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
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
	HttpClient        *http.Client

	rmqWorkerPool chan map[string]interface{}
	cacheWorker   chan int
	wg            sync.WaitGroup
}

const (
	RMQWorkerCount    = 100
	CacheWorkerBatch  = 1000 * time.Millisecond
	CacheWorkerBuffer = 1000
)

func NewOrderService(pg *db.PostgresDB, r *cache.RedisClient, rmq *messaging.Publisher, productURL string) *OrderService {
	s := &OrderService{
		Db:                pg,
		Cache:             r,
		RMQ:               rmq,
		ProductServiceURL: productURL,
		HttpClient: &http.Client{
			Timeout: 2 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        200,
				MaxIdleConnsPerHost: 200,
			},
		},
		rmqWorkerPool: make(chan map[string]interface{}, 1000),
		cacheWorker:   make(chan int, CacheWorkerBuffer),
	}

	for i := 0; i < RMQWorkerCount; i++ {
		s.wg.Add(1)
		go s.rmqWorker()
	}

	go s.cacheWorkerLoop()

	return s
}

func (s *OrderService) rmqWorker() {
	defer s.wg.Done()
	for event := range s.rmqWorkerPool {
		if err := s.RMQ.Publish("order.created", event); err != nil {
			log.Printf("[RequestID: %v] FAILED to publish order.created: %v", event["requestId"], err)
		}
	}
}

// batch cache refresher
func (s *OrderService) cacheWorkerLoop() {
	productSet := map[int]struct{}{}
	ticker := time.NewTicker(CacheWorkerBatch)
	defer ticker.Stop()

	for {
		select {
		case pid, ok := <-s.cacheWorker:
			if !ok {
				// flush remaining products before exit
				for p := range productSet {
					_ = s.refreshProductOrdersCache(p)
				}
				return
			}
			productSet[pid] = struct{}{}
		case <-ticker.C:
			for p := range productSet {
				_ = s.refreshProductOrdersCache(p)
			}
			productSet = map[int]struct{}{}
		}
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

	product, err := s.fetchProduct(productID, requestID)
	if err != nil {
		return nil, err
	}

	order := &domain.Order{
		ProductID:  productID,
		TotalPrice: float64(quantity) * product.Price,
		Status:     "waiting",
		CreatedAt:  time.Now(),
	}

	if err := s.Db.CreateOrder(order); err != nil {
		log.Printf("[RequestID: %s] FAILED to create order: %v", requestID, err)
		return nil, err
	}

	select {
	case s.cacheWorker <- productID:
	default:
		go func(pid int) { _ = s.refreshProductOrdersCache(pid) }(productID)
	}

	event := map[string]interface{}{
		"orderId":   order.ID,
		"productId": order.ProductID,
		"quantity":  quantity,
		"status":    order.Status,
		"createdAt": order.CreatedAt,
		"requestId": requestID,
	}

	select {
	case s.rmqWorkerPool <- event:
	default:
		go func() { _ = s.RMQ.Publish("order.created", event) }()
	}

	log.Printf("[RequestID: %s] Order %d created successfully", requestID, order.ID)
	return order, nil
}

func (s *OrderService) fetchProduct(productID int, requestID string) (*productResponse, error) {
	cacheKey := fmt.Sprintf("product:%d", productID)
	if data, err := s.Cache.Get(cacheKey); err == nil && data != nil {
		var prod productResponse
		if err := json.Unmarshal(data, &prod); err == nil {
			return &prod, nil
		}
	}

	req, _ := http.NewRequest("GET", fmt.Sprintf("%s/products/%d", s.ProductServiceURL, productID), nil)
	req.Header.Set("X-Request-ID", requestID)
	res, err := s.HttpClient.Do(req)
	if err != nil || res.StatusCode != http.StatusOK {
		log.Printf("[RequestID: %s] FAILED to fetch product %d: %v", requestID, productID, err)
		return nil, fmt.Errorf("product not found")
	}
	defer res.Body.Close()

	var prod productResponse
	if err := json.NewDecoder(res.Body).Decode(&prod); err != nil {
		return nil, fmt.Errorf("failed to decode product")
	}

	go func() { _ = s.Cache.Set(cacheKey, prod, 300) }()
	return &prod, nil
}

func (s *OrderService) ListenOrderUpdated() error {
	return s.RMQ.Subscribe("order.updated", func(body []byte) {
		go s.handleOrderUpdated(body)
	})
}

func (s *OrderService) handleOrderUpdated(body []byte) {
	var msg struct {
		OrderID   int    `json:"orderId"`
		ProductID int    `json:"productId"`
		Status    string `json:"status"`
		UpdatedAt string `json:"updatedAt"`
		RequestID string `json:"requestId"`
	}

	if err := json.Unmarshal(body, &msg); err != nil {
		log.Println("FAILED to decode order.updated:", err)
		return
	}

	reqID := msg.RequestID
	if reqID == "" {
		reqID = "no-request-id"
	}

	if err := s.Db.UpdateOrderStatus(msg.OrderID, msg.Status); err != nil {
		log.Printf("[RequestID: %s] FAILED to update order %d: %v", reqID, msg.OrderID, err)
		return
	}

	select {
	case s.cacheWorker <- msg.ProductID:
	default:
		go func(pid int) { _ = s.refreshProductOrdersCache(pid) }(msg.ProductID)
	}

	log.Printf("[RequestID: %s] Order %d updated to '%s'", reqID, msg.OrderID, msg.Status)
}

func (s *OrderService) refreshProductOrdersCache(productID int) error {
	orders, err := s.Db.GetOrdersByProductID(productID)
	if err != nil {
		return err
	}
	key := fmt.Sprintf("orders:product:%d", productID)
	return s.Cache.Set(key, orders, 600)
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

	_ = s.Cache.Set(cacheKey, orders, 600)
	return orders, nil
}

func (s *OrderService) Close() {
	close(s.rmqWorkerPool)
	close(s.cacheWorker)
	s.wg.Wait()
}
