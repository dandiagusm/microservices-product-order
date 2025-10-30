package domain

import "time"

type Order struct {
	ID         int       `db:"id"`
	ProductID  int       `db:"product_id"`
	TotalPrice float64   `db:"total_price"`
	Status     string    `db:"status"`
	CreatedAt  time.Time `db:"created_at"`
}
