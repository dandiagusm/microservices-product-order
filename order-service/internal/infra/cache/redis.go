package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisClient struct {
	client *redis.Client
	ctx    context.Context
}

// NewRedisClient creates a Redis client and verifies the connection.
func NewRedisClient(host, port string) (*RedisClient, error) {
	if host == "" || port == "" {
		return nil, fmt.Errorf("REDIS_HOST or REDIS_PORT is not defined")
	}

	rdb := redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", host, port),
	})

	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return &RedisClient{client: rdb, ctx: ctx}, nil
}

// Set stores a value in Redis with TTL in seconds.
func (r *RedisClient) Set(key string, value interface{}, ttlSeconds int) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}
	return r.client.Set(r.ctx, key, data, time.Duration(ttlSeconds)*time.Second).Err()
}

// Get retrieves a value from Redis.
func (r *RedisClient) Get(key string) ([]byte, error) {
	data, err := r.client.Get(r.ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, nil // key not found
		}
		return nil, err
	}
	return data, nil
}
