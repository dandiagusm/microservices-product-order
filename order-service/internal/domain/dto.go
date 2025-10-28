package domain

type CreateOrderDTO struct {
	ProductID int `json:"productId"`
	Quantity  int `json:"quantity"` // client sends quantity
}
