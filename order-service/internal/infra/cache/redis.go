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

func NewRedisClient(host, port string) (*RedisClient, error) {
	if host == "" || port == "" {
		return nil, fmt.Errorf("REDIS_HOST or REDIS_PORT is not defined")
	}

	rdb := redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", host, port),
	})

	ctx := context.Background()
	// test connection
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, err
	}

	return &RedisClient{
		client: rdb,
		ctx:    ctx,
	}, nil
}

func (r *RedisClient) Set(key string, value interface{}, ttl int) error {
	data, _ := json.Marshal(value)
	return r.client.Set(r.ctx, key, data, time.Duration(ttl)*time.Second).Err()
}

func (r *RedisClient) Get(key string) ([]byte, error) {
	data, err := r.client.Get(r.ctx, key).Bytes()
	if err != nil {
		return nil, err
	}
	return data, nil
}
