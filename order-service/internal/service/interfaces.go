package service

import "github.com/dandiagusm/microservices-product-order/order-service/internal/domain"

type OrderDB interface {
	CreateOrder(order *domain.Order) error
	GetOrdersByProductID(productID int) ([]*domain.Order, error)
	UpdateOrderStatus(orderID int, status string) error
}

type CacheClient interface {
	Get(key string) ([]byte, error)
	Set(key string, value interface{}, ttl int) error
}

type Publisher interface {
	Publish(topic string, event map[string]interface{}) error
	Subscribe(topic string, handler func([]byte)) error
}
