package main

import (
	"context"
	"database/sql"
	"log/slog"
	"net"
	"os"
	"time"

	grpcadapter "edo/services/search-notification-service/internal/adapters/inbound/grpc"
	esadapter "edo/services/search-notification-service/internal/adapters/outbound/elasticsearch"
	pgadapter "edo/services/search-notification-service/internal/adapters/outbound/postgres"
	appservice "edo/services/search-notification-service/internal/application/service"
	_ "github.com/lib/pq"
)

func main() {
	addr := os.Getenv("GRPC_ADDR")
	if addr == "" {
		addr = ":50055"
	}

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		slog.Error("failed to listen", "err", err)
		os.Exit(1)
	}

	server := grpcadapter.NewServer()

	db, err := openDB()
	if err != nil {
		slog.Error("failed to connect postgres", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	source := pgadapter.NewSearchSourceRepository(db)
	store := esadapter.NewProjectionStore(os.Getenv("ELASTICSEARCH_URL"))
	searchService := appservice.NewSearchNotificationService(source, store)
	if err := searchService.BootstrapIndexes(context.Background()); err != nil {
		slog.Error("failed to bootstrap search indexes", "err", err)
		os.Exit(1)
	}
	server.AddRegistrar(grpcadapter.NewSearchNotificationHandler(searchService))
	server.RegisterServices()

	slog.Info("search-notification-service gRPC listening", "addr", addr)

	if err := server.GRPCServer().Serve(lis); err != nil {
		slog.Error("failed to serve", "err", err)
		os.Exit(1)
	}
}

func openDB() (*sql.DB, error) {
	host := getenvDefault("POSTGRES_HOST", "postgres")
	port := getenvDefault("POSTGRES_PORT", "5432")
	user := getenvDefault("POSTGRES_USER", "edo_user")
	password := os.Getenv("POSTGRES_PASSWORD")
	dbName := getenvDefault("POSTGRES_DB", "edo")
	dsn := "host=" + host + " port=" + port + " user=" + user + " password=" + password + " dbname=" + dbName + " sslmode=disable"
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return nil, err
	}
	return db, nil
}

func getenvDefault(key, value string) string {
	raw := os.Getenv(key)
	if raw == "" {
		return value
	}
	return raw
}
