package main

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net"
	"net/url"
	"os"
	"strconv"
	"time"

	grpcadapter "edo/services/document-service/internal/adapters/inbound/grpc"
	postgresadapter "edo/services/document-service/internal/adapters/outbound/postgres"
	appservice "edo/services/document-service/internal/application/service"

	_ "github.com/lib/pq"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

func main() {
	addr := os.Getenv("GRPC_ADDR")
	if addr == "" {
		addr = ":50052"
	}

	db, err := connectPostgres()
	if err != nil {
		slog.Error("failed to connect postgres", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	minioClient, bucketName, err := connectMinIO()
	if err != nil {
		slog.Error("failed to connect minio", "err", err)
		os.Exit(1)
	}

	presignedExpirySeconds, err := strconv.Atoi(getEnv("MINIO_PRESIGNED_EXPIRY_SECONDS", "900"))
	if err != nil {
		slog.Error("invalid MINIO_PRESIGNED_EXPIRY_SECONDS", "err", err)
		os.Exit(1)
	}

	publicMinIOURL, err := getOptionalURL("MINIO_PUBLIC_BASE_URL")
	if err != nil {
		slog.Error("invalid MINIO_PUBLIC_BASE_URL", "err", err)
		os.Exit(1)
	}

	publicMinIOClient, err := connectPublicMinIO(publicMinIOURL)
	if err != nil {
		slog.Error("invalid public minio client configuration", "err", err)
		os.Exit(1)
	}

	documentRepository := postgresadapter.NewDocumentRepository(
		db,
		minioClient,
		publicMinIOClient,
		bucketName,
		time.Duration(presignedExpirySeconds)*time.Second,
	)
	versionRepository := postgresadapter.NewDocumentVersionRepository(db)
	lifecycleService := appservice.NewDocumentLifecycleService(documentRepository, versionRepository)

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		slog.Error("failed to listen", "err", err)
		os.Exit(1)
	}

	server := grpcadapter.NewServer()
	server.AddRegistrar(grpcadapter.NewDocumentHandler(lifecycleService))
	server.RegisterServices()

	slog.Info("document-service gRPC listening", "addr", addr)

	if err := server.GRPCServer().Serve(lis); err != nil {
		slog.Error("failed to serve", "err", err)
		os.Exit(1)
	}
}

func connectPostgres() (*sql.DB, error) {
	port, err := strconv.Atoi(getEnv("POSTGRES_PORT", "5432"))
	if err != nil {
		return nil, fmt.Errorf("invalid POSTGRES_PORT: %w", err)
	}

	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		getEnv("POSTGRES_HOST", "postgres"),
		port,
		getEnv("POSTGRES_USER", "edo_user"),
		getEnv("POSTGRES_PASSWORD", ""),
		getEnv("POSTGRES_DB", "edo"),
		getEnv("POSTGRES_SSLMODE", "disable"),
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

func connectMinIO() (*minio.Client, string, error) {
	endpoint := getEnv("MINIO_ENDPOINT", "minio:9000")
	bucketName := getEnv("MINIO_BUCKET", "edo-exports")
	client, err := newMinIOClient(endpoint, getEnv("MINIO_USE_SSL", "false") == "true")
	if err != nil {
		return nil, "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	exists, err := client.BucketExists(ctx, bucketName)
	if err != nil {
		return nil, "", err
	}
	if !exists {
		if err := client.MakeBucket(ctx, bucketName, minio.MakeBucketOptions{}); err != nil {
			return nil, "", err
		}
	}

	return client, bucketName, nil
}

func connectPublicMinIO(publicURL *url.URL) (*minio.Client, error) {
	if publicURL == nil {
		return nil, nil
	}

	return newMinIOClient(publicURL.Host, publicURL.Scheme == "https")
}

func newMinIOClient(endpoint string, secure bool) (*minio.Client, error) {
	accessKey := getEnv("MINIO_ACCESS_KEY", "minioadmin")
	secretKey := getEnv("MINIO_SECRET_KEY", "minioadmin")
	region := getEnv("MINIO_REGION", "us-east-1")

	return minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: secure,
		Region: region,
	})
}

func getEnv(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func getOptionalURL(key string) (*url.URL, error) {
	value := os.Getenv(key)
	if value == "" {
		return nil, nil
	}

	parsed, err := url.Parse(value)
	if err != nil {
		return nil, err
	}
	if parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("%s must include scheme and host", key)
	}

	return parsed, nil
}
