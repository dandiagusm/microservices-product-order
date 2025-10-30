package repository

import (
	"github.com/dandiagusm/microservices-product-order/order-service/internal/domain"
	"gorm.io/gorm"
)

type OrderRepository struct {
	db *gorm.DB
}

func NewOrderRepository(db *gorm.DB) *OrderRepository {
	return &OrderRepository{db: db}
}

func (r *OrderRepository) Create(order *domain.Order) error {
	return r.db.Create(order).Error
}

func (r *OrderRepository) GetByID(id uint) (*domain.Order, error) {
	var order domain.Order
	if err := r.db.First(&order, id).Error; err != nil {
		return nil, err
	}
	return &order, nil
}
