package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/dandiagusm/microservices-product-order/order-service/internal/domain"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/service"
)

// --- Minimal fake implementations ---
type FakeDB struct{}

func (f *FakeDB) CreateOrder(order *domain.Order) error {
	order.ID = 1
	return nil
}
func (f *FakeDB) GetOrdersByProductID(productID int) ([]*domain.Order, error) {
	return []*domain.Order{
		{ID: 1, ProductID: productID, TotalPrice: 200, Status: "waiting"},
	}, nil
}
func (f *FakeDB) UpdateOrderStatus(orderID int, status string) error { return nil }

type FakeCache struct{}

func (f *FakeCache) Get(key string) ([]byte, error)                 { return nil, nil }
func (f *FakeCache) Set(key string, val interface{}, ttl int) error { return nil }

type FakePublisher struct{}

func (f *FakePublisher) Publish(topic string, msg interface{}) error             { return nil }
func (f *FakePublisher) Subscribe(topic string, handler func(body []byte)) error { return nil }

// --- Tests ---
func TestCreateOrder(t *testing.T) {
	db := &FakeDB{}
	cache := &FakeCache{}
	rmq := &FakePublisher{}

	svc := service.NewOrderService(db, cache, rmq, "http://fake-product-service")

	ctx := context.Background()
	order, err := svc.CreateOrder(ctx, 1, 2)
	if err != nil {
		t.Fatal(err)
	}

	if order.ID != 1 {
		t.Errorf("expected order ID 1, got %d", order.ID)
	}
	if order.TotalPrice != 200 {
		t.Errorf("expected total price 200, got %f", order.TotalPrice)
	}
}

func TestGetOrdersByProductID(t *testing.T) {
	db := &FakeDB{}
	cache := &FakeCache{}
	rmq := &FakePublisher{}

	svc := service.NewOrderService(db, cache, rmq, "http://fake-product-service")

	orders, err := svc.GetOrdersByProductID(1)
	if err != nil {
		t.Fatal(err)
	}

	if len(orders) != 1 {
		t.Errorf("expected 1 order, got %d", len(orders))
	}
	if orders[0].TotalPrice != 200 {
		t.Errorf("expected total price 200, got %f", orders[0].TotalPrice)
	}
}

func TestRefreshProductOrdersCache(t *testing.T) {
	db := &FakeDB{}
	cache := &FakeCache{}
	rmq := &FakePublisher{}

	svc := service.NewOrderService(db, cache, rmq, "http://fake-product-service")

	// minimal test just calls the function to ensure no panic
	if err := svc.RefreshProductOrdersCache(1); err != nil {
		t.Fatal(err)
	}
}

func TestClose(t *testing.T) {
	db := &FakeDB{}
	cache := &FakeCache{}
	rmq := &FakePublisher{}

	svc := service.NewOrderService(db, cache, rmq, "http://fake-product-service")
	go func() {
		time.Sleep(100 * time.Millisecond)
		svc.Close() // should close channels safely
	}()
}
