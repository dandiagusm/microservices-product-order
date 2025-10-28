package controller

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/dandiagusm/microservices-product-order/order-service/internal/service"
	"github.com/gorilla/mux"
)

type OrderController struct {
	service *service.OrderService
}

func NewOrderController(s *service.OrderService) *OrderController {
	return &OrderController{service: s}
}

func (c *OrderController) RegisterRoutes(r *mux.Router) {
	r.HandleFunc("/orders", c.CreateOrderHandler).Methods("POST")
	r.HandleFunc("/orders/product/{id}", c.GetOrdersHandler).Methods("GET")
}

type createOrderRequest struct {
	ProductID int `json:"productId"`
	Quantity  int `json:"quantity"` // only used for totalPrice calculation
}

func (c *OrderController) CreateOrderHandler(w http.ResponseWriter, r *http.Request) {
	var req createOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid input", http.StatusBadRequest)
		return
	}

	order, err := c.service.CreateOrder(req.ProductID, req.Quantity)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	json.NewEncoder(w).Encode(order)
}

func (c *OrderController) GetOrdersHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, _ := strconv.Atoi(idStr)

	orders, err := c.service.GetOrdersByProductID(id)
	if err != nil {
		http.Error(w, "failed to get orders", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(orders)
}
