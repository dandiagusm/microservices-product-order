package cache

import (
	"fmt"
	"log"

	"context"

	"github.com/redis/go-redis/v9"
)

func NewRedisClient(host, port string) *redis.Client {
	if host == "" {
		host = "localhost"
	}
	if port == "" {
		port = "6379"
	}

	rdb := redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", host, port),
	})

	// Test connection
	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("[error] Failed to connect to Redis: %v", err)
	}

	log.Println("[info] Connected to Redis successfully")
	return rdb
}
