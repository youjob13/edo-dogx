package grpcadapter

import (
	"context"

	"edo/services/document-service/internal/adapters/inbound/grpc/pb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type TaskAssignmentNotifier interface {
	NotifyTaskAssigned(
		ctx context.Context,
		actorUserID string,
		recipientUserID string,
		organizationID string,
		taskID string,
		taskTitle string,
	) error
}

type NotificationClient struct {
	client pb.NotificationServiceClient
}

func NewNotificationClient(address string) (*NotificationClient, error) {
	conn, err := grpc.NewClient(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}
	return &NotificationClient{client: pb.NewNotificationServiceClient(conn)}, nil
}

func (c *NotificationClient) NotifyTaskAssigned(
	ctx context.Context,
	actorUserID string,
	recipientUserID string,
	organizationID string,
	taskID string,
	taskTitle string,
) error {
	_, err := c.client.CreateNotification(ctx, &pb.CreateNotificationRequest{
		ActorUserId:     actorUserID,
		RecipientUserId: recipientUserID,
		OrganizationId:  organizationID,
		EventType:       "task.assigned",
		Title:           "Назначена задача",
		Body:            "Вам назначена задача: " + taskTitle,
		EntityType:      "TASK",
		EntityId:        taskID,
	})
	return err
}
