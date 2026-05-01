package grpcadapter

import "google.golang.org/grpc"

type ServiceRegistrar interface {
	Register(server *grpc.Server)
}

type Server struct {
	grpcServer *grpc.Server
	registrars []ServiceRegistrar
}

func NewServer(opts ...grpc.ServerOption) *Server {
	return &Server{
		grpcServer: grpc.NewServer(opts...),
		registrars: []ServiceRegistrar{},
	}
}

func (s *Server) AddRegistrar(registrar ServiceRegistrar) {
	s.registrars = append(s.registrars, registrar)
}

func (s *Server) RegisterServices() {
	for _, registrar := range s.registrars {
		registrar.Register(s.grpcServer)
	}
}

func (s *Server) GRPCServer() *grpc.Server {
	return s.grpcServer
}
