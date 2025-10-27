package controller

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/dandiagusm/microservices-product-order/order-service/internal/domain"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/service"
	"github.com/gorilla/mux"
)

type OrderController struct {
	service *service.OrderService
}

func NewOrderController(s *service.OrderService) *OrderController {
	return &OrderController{
		service: s,
	}
}

func (c *OrderController) RegisterRoutes(r *mux.Router) {
	r.HandleFunc("/orders", c.CreateOrder).Methods("POST")
	r.HandleFunc("/orders/product/{id}", c.GetOrdersByProduct).Methods("GET")
}

func (c *OrderController) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var input domain.CreateOrderDTO
	json.NewDecoder(r.Body).Decode(&input)

	order, err := c.service.CreateOrder(input)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(order)
}

func (c *OrderController) GetOrdersByProduct(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])

	orders, err := c.service.GetOrdersByProduct(id)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(orders)
}
