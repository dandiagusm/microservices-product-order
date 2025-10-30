package controller

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/dandiagusm/microservices-product-order/order-service/internal/middleware"
	"github.com/dandiagusm/microservices-product-order/order-service/internal/service"
	"github.com/gorilla/mux"
)

type OrderController struct {
	Service *service.OrderService
}

func NewOrderController(s *service.OrderService) *OrderController {
	return &OrderController{Service: s}
}

func (c *OrderController) Routes(r *mux.Router) {
	r.HandleFunc("/orders", c.CreateOrder).Methods("POST")
	r.HandleFunc("/orders/product/{id}", c.GetOrdersByProduct).Methods("GET")
}

func (c *OrderController) CreateOrder(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())
	w.Header().Set("X-Request-ID", requestID)
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		ProductID int `json:"productId"`
		Quantity  int `json:"quantity"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	order, err := c.Service.CreateOrder(r.Context(), req.ProductID, req.Quantity)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(order)
}

func (c *OrderController) GetOrdersByProduct(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())
	w.Header().Set("X-Request-ID", requestID)
	w.Header().Set("Content-Type", "application/json")

	idStr := mux.Vars(r)["id"]
	id, _ := strconv.Atoi(idStr)

	orders, err := c.Service.GetOrdersByProductID(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(orders)
}
