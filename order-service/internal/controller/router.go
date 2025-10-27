package controller

import "github.com/gorilla/mux"

func NewRouter(orderController *OrderController) *mux.Router {
	r := mux.NewRouter()
	orderController.RegisterRoutes(r)
	return r
}
