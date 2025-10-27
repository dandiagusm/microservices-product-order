package domain

type CreateOrderDTO struct {
	ProductID int `json:"product_id"`
	Quantity  int `json:"quantity"`
}

type GetOrdersDTO struct {
	ProductID int `json:"product_id"`
}
