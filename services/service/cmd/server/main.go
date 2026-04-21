package main

import (
	"log/slog"
	"net"
	"os"

	"google.golang.org/grpc"
)

func main() {
	addr := os.Getenv("GRPC_ADDR")
	if addr == "" {
		addr = ":50051"
	}

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		slog.Error("failed to listen", "err", err)
		os.Exit(1)
	}

	srv := grpc.NewServer()

	// TODO: register service server implementations here
	// pb.RegisterExampleServiceServer(srv, adapters.NewExampleGRPCAdapter(...))

	slog.Info("gRPC server listening", "addr", addr)

	if err := srv.Serve(lis); err != nil {
		slog.Error("failed to serve", "err", err)
		os.Exit(1)
	}
}
