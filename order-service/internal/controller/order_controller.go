package controller

import (
	"net/http"

	"github.com/dandiagusm/microservices-product-order/order-service/internal/infra/messaging"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type OrderController struct {
	DB        *gorm.DB
	Redis     *redis.Client
	Publisher *messaging.Publisher
}

func NewOrderController(db *gorm.DB, rdb *redis.Client, pub *messaging.Publisher) *OrderController {
	return &OrderController{
		DB:        db,
		Redis:     rdb,
		Publisher: pub,
	}
}

func (o *OrderController) CreateOrder(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("Create order endpoint"))
}

func (o *OrderController) GetOrder(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("Get order endpoint"))
}
