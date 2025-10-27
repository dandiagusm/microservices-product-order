package service

import (
	"github.com/dandiagusm/microservices-product-order/order-service/internal/domain"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/repository"
)

type OrderService struct {
	repo *repository.OrderRepository
}

func NewOrderService(repo *repository.OrderRepository) *OrderService {
	return &OrderService{repo: repo}
}

func (s *OrderService) CreateOrder(order *domain.Order) error {
	return s.repo.Create(order)
}

func (s *OrderService) GetOrder(id uint) (*domain.Order, error) {
	return s.repo.GetByID(id)
}
