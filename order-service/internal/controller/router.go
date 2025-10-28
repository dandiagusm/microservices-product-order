package controller

import (
	"github.com/dandiagusm/microservices-product-order/order-service/internal/service"
	"github.com/gorilla/mux"
)

func NewRouter(s *service.OrderService) *mux.Router {
	r := mux.NewRouter()
	ctrl := NewOrderController(s)
	ctrl.RegisterRoutes(r)
	return r
}
