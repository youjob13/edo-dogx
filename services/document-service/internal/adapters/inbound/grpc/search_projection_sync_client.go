package grpcadapter

import (
	"context"
	"time"

	"edo/services/document-service/internal/adapters/inbound/grpc/pb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type ProjectionSyncer interface {
	Sync(ctx context.Context, entityType string, entityID string, deleted bool) error
}

type SearchProjectionSyncClient struct {
	client pb.SearchNotificationServiceClient
}

func NewSearchProjectionSyncClient(address string) (*SearchProjectionSyncClient, error) {
	conn, err := grpc.NewClient(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}
	return &SearchProjectionSyncClient{client: pb.NewSearchNotificationServiceClient(conn)}, nil
}

func (c *SearchProjectionSyncClient) Sync(ctx context.Context, entityType string, entityID string, deleted bool) error {
	_, err := c.client.SyncSearchProjection(ctx, &pb.SyncSearchProjectionRequest{
		ActorUserId: "document-service",
		EntityType:  entityType,
		EntityId:    entityID,
		Version:     time.Now().UTC().Format(time.RFC3339Nano),
		Deleted:     deleted,
	})
	return err
}
