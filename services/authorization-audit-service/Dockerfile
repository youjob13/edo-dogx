# syntax=docker/dockerfile:1
FROM golang:1.26-alpine AS builder
WORKDIR /app

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -o server ./cmd/server

FROM alpine:3.20 AS runner
WORKDIR /app
RUN apk --no-cache add ca-certificates tzdata
COPY --from=builder /app/server .
EXPOSE 50053
CMD ["./server"]
