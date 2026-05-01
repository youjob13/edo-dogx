package main

import (
	"log/slog"
	"net"
	"os"

	grpcadapter "edo/services/search-notification-service/internal/adapters/inbound/grpc"
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
	server.RegisterServices()

	slog.Info("search-notification-service gRPC listening", "addr", addr)

	if err := server.GRPCServer().Serve(lis); err != nil {
		slog.Error("failed to serve", "err", err)
		os.Exit(1)
	}
}
