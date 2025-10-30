package messaging

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/streadway/amqp"
)

type Publisher struct {
	url         string
	exchange    string
	serviceName string
	conn        *amqp.Connection
	channel     *amqp.Channel
	mutex       sync.Mutex
	isClosed    bool
}

// NewPublisher connects to RabbitMQ, declares exchange
func NewPublisher(url, exchange, serviceName string) (*Publisher, error) {
	p := &Publisher{url: url, exchange: exchange, serviceName: serviceName}
	if err := p.connect(); err != nil {
		return nil, err
	}
	go p.reconnectWatcher()
	return p, nil
}

func (p *Publisher) connect() error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if p.isClosed {
		return fmt.Errorf("publisher CLOSED")
	}

	conn, err := amqp.Dial(p.url)
	if err != nil {
		return fmt.Errorf("FAILED to connect to RabbitMQ: %v", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return fmt.Errorf("failed to open channel: %v", err)
	}

	if err := ch.ExchangeDeclare(p.exchange, "topic", true, false, false, false, nil); err != nil {
		conn.Close()
		return fmt.Errorf("FAILED to declare exchange: %v", err)
	}

	p.conn = conn
	p.channel = ch
	log.Println("CONNECTED to RabbitMQ and exchange declared:", p.exchange)
	return nil
}

func (p *Publisher) reconnectWatcher() {
	errChan := make(chan *amqp.Error)
	p.conn.NotifyClose(errChan)

	for err := range errChan {
		if err != nil {
			log.Printf("RabbitMQ connection closed: %v. Reconnecting...", err)
			for {
				time.Sleep(5 * time.Second)
				if err := p.connect(); err == nil {
					log.Println("RECONNECTED to RabbitMQ")
					break
				}
				log.Println("Retry reconnect FAILED, retrying...")
			}
		}
	}
}

// Publish marshals data inside, no Base64
func (p *Publisher) Publish(routingKey string, data interface{}) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if p.channel == nil {
		return fmt.Errorf("channel not initialized")
	}

	body, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("FAILED to marshal data: %v", err)
	}

	err = p.channel.Publish(
		p.exchange,
		routingKey,
		false,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Body:         body,
			Timestamp:    time.Now(),
		},
	)
	if err != nil {
		return fmt.Errorf("FAILED to publish: %v", err)
	}

	log.Printf("Message PUBLISHED to exchange '%s' with key '%s'", p.exchange, routingKey)
	return nil
}

// Subscribe binds a durable queue per service and routing key
func (p *Publisher) Subscribe(routingKey string, handler func([]byte)) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if p.channel == nil {
		return fmt.Errorf("channel not initialized")
	}

	queueName := fmt.Sprintf("%s-%s", p.serviceName, routingKey) // unique per service
	_, err := p.channel.QueueDeclare(queueName, true, false, false, false, nil)
	if err != nil {
		return fmt.Errorf("queue declare FAILED: %v", err)
	}

	if err := p.channel.QueueBind(queueName, routingKey, p.exchange, false, nil); err != nil {
		return fmt.Errorf("queue bind FAILED: %v", err)
	}

	log.Printf("SUBSCRIBED queue [%s] to exchange [%s] with key [%s]", queueName, p.exchange, routingKey)

	msgs, err := p.channel.Consume(queueName, "", false, false, false, false, nil)
	if err != nil {
		return fmt.Errorf("queue consume FAILED: %v", err)
	}

	go func() {
		for msg := range msgs {
			func(m amqp.Delivery) {
				defer func() {
					if r := recover(); r != nil {
						log.Printf("Panic while handling message: %v", r)
						m.Nack(false, true)
					}
				}()
				handler(m.Body)
				m.Ack(false)
			}(msg)
		}
	}()

	return nil
}

func (p *Publisher) Close() {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	p.isClosed = true
	if p.channel != nil {
		_ = p.channel.Close()
	}
	if p.conn != nil {
		_ = p.conn.Close()
	}
	log.Println("🔌 RabbitMQ connection CLOSED")
}
