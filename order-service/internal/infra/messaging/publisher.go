package messaging

import (
	"github.com/streadway/amqp"
)

type Publisher struct {
	conn    *amqp.Connection
	channel *amqp.Channel
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
	return &Publisher{conn: conn, channel: ch}, nil
}

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
