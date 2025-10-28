package messaging

import (
	"log"

	"github.com/streadway/amqp"
)

type Publisher struct {
	conn    *amqp.Connection
	channel *amqp.Channel
}

// NewPublisher connects to RabbitMQ and initializes a channel
func NewPublisher(url string) (*Publisher, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, err
	}
	ch, err := conn.Channel()
	if err != nil {
		return nil, err
	}
	return &Publisher{conn: conn, channel: ch}, nil
}

// Publish sends a message to the specified queue
func (p *Publisher) Publish(queue string, body []byte) error {
	_, err := p.channel.QueueDeclare(queue, true, false, false, false, nil)
	if err != nil {
		return err
	}
	return p.channel.Publish("", queue, false, false, amqp.Publishing{
		ContentType: "application/json",
		Body:        body,
	})
}

// Subscribe listens to a queue and calls handler for each message
func (p *Publisher) Subscribe(queue string, handler func([]byte)) error {
	_, err := p.channel.QueueDeclare(queue, true, false, false, false, nil)
	if err != nil {
		return err
	}

	msgs, err := p.channel.Consume(queue, "", false, false, false, false, nil)
	if err != nil {
		return err
	}

	go func() {
		for msg := range msgs {
			handler(msg.Body)
			msg.Ack(false)
		}
	}()

	log.Printf("Subscribed to queue: %s\n", queue)
	return nil
}

// Close the connection and channel
func (p *Publisher) Close() {
	if p.channel != nil {
		_ = p.channel.Close()
	}
	if p.conn != nil {
		_ = p.conn.Close()
	}
}
