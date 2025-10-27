package messaging

import (
	"os"

	"github.com/streadway/amqp"
)

type Publisher struct {
	conn    *amqp.Connection
	channel *amqp.Channel
}

func NewPublisher() (*Publisher, error) {
	url := os.Getenv("RABBITMQ_URL")
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, err
	}

	ch, err := conn.Channel()
	if err != nil {
		return nil, err
	}

	return &Publisher{
		conn:    conn,
		channel: ch,
	}, nil
}

func (p *Publisher) Publish(exchange string, body []byte) error {
	return p.channel.Publish(
		"",       // exchange
		exchange, // routing key
		false,
		false,
		amqp.Publishing{
			ContentType: "application/json",
			Body:        body,
		},
	)
}
