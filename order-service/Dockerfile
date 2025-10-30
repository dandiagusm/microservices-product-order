# Start from the official Go image
FROM golang:1.25.1-alpine

# Set working directory
WORKDIR /usr/src/app

# Install dependencies
RUN apk add --no-cache git bash

# Copy go.mod and go.sum first (for caching)
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the Go binary from cmd/app/main.go
RUN go build -o order-service ./cmd/app/main.go

# Expose port
EXPOSE 3002

# Run the service
CMD ["./order-service"]
