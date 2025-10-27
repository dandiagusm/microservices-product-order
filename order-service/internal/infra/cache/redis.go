package cache

import (
	"context"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisClient struct {
	client *redis.Client
}

func NewRedisClient() (*RedisClient, error) {
	host := os.Getenv("REDIS_HOST")
	port := os.Getenv("REDIS_PORT")

	rdb := redis.NewClient(&redis.Options{
		Addr: host + ":" + port,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, err
	}

	return &RedisClient{client: rdb}, nil
}

func (r *RedisClient) Set(key string, value []byte, ttl time.Duration) error {
	return r.client.Set(context.Background(), key, value, ttl).Err()
}

func (r *RedisClient) Get(key string) (string, error) {
	return r.client.Get(context.Background(), key).Result()
}

func (r *RedisClient) ProductServiceURL() string {
	return os.Getenv("PRODUCT_SERVICE_URL")
}
