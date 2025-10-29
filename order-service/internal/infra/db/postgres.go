package db

import (
	"database/sql"
	"fmt"
	"log"

	"github.com/dandiagusm/microservices-product-order/order-service/internal/domain"
	_ "github.com/lib/pq"
)

type PostgresDB struct {
	Conn *sql.DB
}

func NewPostgresDB(host, user, password, dbname string, port int) (*PostgresDB, error) {
	connStr := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, dbname)
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}
	if err = db.Ping(); err != nil {
		return nil, err
	}

	pg := &PostgresDB{Conn: db}
	pg.AutoMigrate() // auto-create orders table
	return pg, nil
}

// Auto-create orders table if not exists
func (p *PostgresDB) AutoMigrate() {
	query := `
	CREATE TABLE IF NOT EXISTS orders (
		id SERIAL PRIMARY KEY,
		product_id INT NOT NULL,
		total_price DOUBLE PRECISION NOT NULL,
		status TEXT NOT NULL,
		created_at TIMESTAMP NOT NULL DEFAULT now()
	)`
	if _, err := p.Conn.Exec(query); err != nil {
		log.Fatalf("Failed to auto-migrate orders table: %v", err)
	}
}

func (p *PostgresDB) CreateOrder(order *domain.Order) error {
	query := `INSERT INTO orders (product_id, total_price, status, created_at)
	          VALUES ($1, $2, $3, $4) RETURNING id`
	return p.Conn.QueryRow(query, order.ProductID, order.TotalPrice, order.Status, order.CreatedAt).Scan(&order.ID)
}

func (p *PostgresDB) GetOrdersByProductID(productID int) ([]*domain.Order, error) {
	query := `SELECT id, product_id, total_price, status, created_at FROM orders WHERE product_id=$1`
	rows, err := p.Conn.Query(query, productID)
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

	// Safety: ensure slice is non-nil
	if orders == nil {
		orders = []*domain.Order{}
	}
	return orders, nil
}

func (db *PostgresDB) UpdateOrderStatus(orderID int, status string) error {
	_, err := db.Conn.Exec(`UPDATE orders SET status = $1 WHERE id = $2`, status, orderID)
	return err
}
