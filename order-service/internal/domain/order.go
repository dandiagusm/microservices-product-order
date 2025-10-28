package domain

import "time"

type Order struct {
	ID         int       `json:"id"`
	ProductID  int       `json:"productId"`
	TotalPrice float64   `json:"totalPrice"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"createdAt"`
}
