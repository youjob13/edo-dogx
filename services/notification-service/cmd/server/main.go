package main

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net"
	"os"
	"strconv"
	"time"

	grpcadapter "edo/services/notification-service/internal/adapters/inbound/grpc"
	pg "edo/services/notification-service/internal/adapters/outbound/postgres"
	app "edo/services/notification-service/internal/application/service"

	_ "github.com/lib/pq"
)

func main() {
	addr := getenv("GRPC_ADDR", ":50056")
	db, err := connectPostgres()
	if err != nil {
		slog.Error("failed to connect postgres", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	if err := pg.EnsureSchema(ctx, db); err != nil {
		cancel()
		slog.Error("failed to ensure schema", "err", err)
		os.Exit(1)
	}
	cancel()

	store := pg.NewStore(db)
	service := app.NewNotificationService(store)
	go runCleanup(service)

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		slog.Error("failed to listen", "err", err)
		os.Exit(1)
	}

	server := grpcadapter.NewServer()
	server.AddRegistrar(grpcadapter.NewNotificationHandler(service))
	server.RegisterServices()
	slog.Info("notification-service gRPC listening", "addr", addr)

	if err := server.GRPCServer().Serve(lis); err != nil {
		slog.Error("failed to serve", "err", err)
		os.Exit(1)
	}
}

func runCleanup(service *app.NotificationService) {
	ticker := time.NewTicker(12 * time.Hour)
	defer ticker.Stop()
	for range ticker.C {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		_, _ = service.Cleanup(ctx, 90)
		cancel()
	}
}

func connectPostgres() (*sql.DB, error) {
	port, err := strconv.Atoi(getenv("POSTGRES_PORT", "5432"))
	if err != nil {
		return nil, err
	}
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		getenv("POSTGRES_HOST", "postgres"),
		port,
		getenv("POSTGRES_USER", "edo_user"),
		getenv("POSTGRES_PASSWORD", ""),
		getenv("POSTGRES_DB", "edo"),
		getenv("POSTGRES_SSLMODE", "disable"),
	)
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return nil, err
	}
	return db, nil
}

func getenv(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}
