package messaging

import (
	"log"

	"github.com/streadway/amqp"
)

type Publisher struct {
	Conn    *amqp.Connection
	Channel *amqp.Channel
}

func NewPublisher(url string) (*Publisher, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, err
	}

	ch, err := conn.Channel()
	if err != nil {
		return nil, err
	}

	log.Println("[info] Connected to RabbitMQ successfully")
	return &Publisher{Conn: conn, Channel: ch}, nil
}
