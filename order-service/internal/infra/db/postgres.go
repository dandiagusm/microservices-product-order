package db

import (
	"database/sql"
	"fmt"

	"github.com/dandiagusm/microservices-product-order/order-service/internal/domain"
	_ "github.com/lib/pq"
)

type PostgresDB struct {
	Conn *sql.DB
}

func NewPostgresDB(host, user, password, dbname string, port int) (*PostgresDB, error) {
	psqlInfo := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, dbname)

	db, err := sql.Open("postgres", psqlInfo)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	// Create table if not exists
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS orders (
		id SERIAL PRIMARY KEY,
		product_id INT NOT NULL,
		total_price NUMERIC(10,2) NOT NULL,
		status VARCHAR(50) NOT NULL,
		created_at TIMESTAMP NOT NULL
	)`)
	if err != nil {
		return nil, err
	}

	return &PostgresDB{Conn: db}, nil
}

func (p *PostgresDB) CreateOrder(order *domain.Order) error {
	query := `INSERT INTO orders (product_id, total_price, status, created_at)
	          VALUES ($1, $2, $3, $4) RETURNING id`
	return p.Conn.QueryRow(query, order.ProductID, order.TotalPrice, order.Status, order.CreatedAt).Scan(&order.ID)
}

func (p *PostgresDB) GetOrdersByProductID(productID int) ([]*domain.Order, error) {
	rows, err := p.Conn.Query(`SELECT id, product_id, total_price, status, created_at FROM orders WHERE product_id=$1`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []*domain.Order
	for rows.Next() {
		o := &domain.Order{}
		if err := rows.Scan(&o.ID, &o.ProductID, &o.TotalPrice, &o.Status, &o.CreatedAt); err != nil {
			return nil, err
		}
		orders = append(orders, o)
	}
	return orders, nil
}
