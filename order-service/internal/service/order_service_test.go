package service_test

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/dandiagusm/microservices-product-order/order-service/internal/domain"
)

type Product struct {
	ID    int     `json:"id"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
	Qty   int     `json:"qty"`
}

type JSONOrderService struct {
	productData map[int]Product
	ordersData  map[int][]*domain.Order
	nextID      int
}

func NewJSONOrderService() *JSONOrderService {
	s := &JSONOrderService{
		productData: make(map[int]Product),
		ordersData:  make(map[int][]*domain.Order),
		nextID:      1,
	}

	data, err := os.ReadFile("../../../mock/product_1.json")
	if err != nil {
		panic(err)
	}
	var prod Product
	_ = json.Unmarshal(data, &prod)
	s.productData[prod.ID] = prod

	odata, err := os.ReadFile("../../../mock/orders_product_1.json")
	if err == nil {
		var orders []*domain.Order
		_ = json.Unmarshal(odata, &orders)
		s.ordersData[1] = orders
		if len(orders) > 0 {
			s.nextID = orders[len(orders)-1].ID + 1
		}
	}

	return s
}

func (s *JSONOrderService) CreateOrder(ctx context.Context, productID, quantity int) (*domain.Order, error) {
	prod, ok := s.productData[productID]
	if !ok {
		return nil, nil
	}

	order := &domain.Order{
		ID:         s.nextID,
		ProductID:  productID,
		TotalPrice: float64(quantity) * prod.Price,
		Status:     "waiting",
		CreatedAt:  time.Now(),
	}

	s.nextID++
	s.ordersData[productID] = append(s.ordersData[productID], order)
	return order, nil
}

func (s *JSONOrderService) GetOrdersByProductID(productID int) ([]*domain.Order, error) {
	orders, ok := s.ordersData[productID]
	if !ok {
		return []*domain.Order{}, nil
	}
	return orders, nil
}

func TestCreateOrder_JSON(t *testing.T) {
	svc := NewJSONOrderService()

	order, err := svc.CreateOrder(context.Background(), 1, 2)
	if err != nil {
		t.Fatalf("CreateOrder failed: %v", err)
	}

	if order == nil {
		t.Fatal("Expected order, got nil")
	}

	if order.ProductID != 1 {
		t.Errorf("Expected ProductID 1, got %d", order.ProductID)
	}
	if order.TotalPrice != 100 {
		t.Errorf("Expected TotalPrice 100, got %f", order.TotalPrice)
	}
	if order.Status != "waiting" {
		t.Errorf("Expected Status 'waiting', got %s", order.Status)
	}
	if time.Since(order.CreatedAt) > time.Minute {
		t.Errorf("CreatedAt too old")
	}
}

func TestGetOrdersByProductID_JSON(t *testing.T) {
	svc := NewJSONOrderService()

	_, _ = svc.CreateOrder(context.Background(), 1, 1)

	orders, err := svc.GetOrdersByProductID(1)
	if err != nil {
		t.Fatalf("GetOrdersByProductID failed: %v", err)
	}

	if len(orders) == 0 {
		t.Fatal("Expected at least 1 order, got 0")
	}
	if orders[0].ProductID != 1 {
		t.Errorf("Expected ProductID 1, got %d", orders[0].ProductID)
	}
}
