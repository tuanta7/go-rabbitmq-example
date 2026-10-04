package main

import (
	"fmt"
	"log"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

func declareQueue(ch *amqp.Channel, queueName string) error {
	_, err := ch.QueueDeclare(queueName,
		true,  // Metadata of a durable queue is stored on disk
		false, // Persist even when last consumer unsubscribes
		false, // Persist even when the only one connection close
		false, // waits for the broker's reply
		nil,
	)
	return err
}

func consumeResults(conn *amqp.Connection, resultsQueue string, handler func([]byte) error) error {
	channel, err := conn.Channel()
	if err != nil {
		log.Printf("open channel: %v", err)
		return err
	}
	defer channel.Close()

	if err := channel.Qos(1, 0, false); err != nil {
		return fmt.Errorf("set results prefetch: %w", err)
	}

	results, err := channel.Consume(
		resultsQueue, "",
		false, false, false, false,
		nil,
	)
	if err != nil {
		log.Printf("consume results queue: %v", err)
		return err
	}

	for msg := range results {
		if err := handler(msg.Body); err != nil {
			log.Printf("handle result message: %v", err)
			if err := msg.Nack(false, true); err != nil {
				return fmt.Errorf("requeue result message: %w", err)
			}
			time.Sleep(time.Second)
			continue
		}
		if err := msg.Ack(false); err != nil {
			return fmt.Errorf("ack result message: %w", err)
		}
	}

	return nil
}
