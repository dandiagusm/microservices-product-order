package controller

import (
	"github.com/gorilla/mux"
)

func NewRouter(orderCtrl *OrderController) *mux.Router {
	r := mux.NewRouter()

	r.HandleFunc("/orders", orderCtrl.CreateOrder).Methods("POST")
	r.HandleFunc("/orders/{id}", orderCtrl.GetOrder).Methods("GET")

	return r
}
