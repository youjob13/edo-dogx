package grpcadapter

import (
	"context"
	"encoding/json"
	"errors"

	pb "edo/services/document-service/internal/adapters/inbound/grpc/pb"
	appservice "edo/services/document-service/internal/application/service"
	"edo/services/document-service/internal/domain/model"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type DocumentHandler struct {
	pb.UnimplementedDocumentWorkflowServiceServer
	lifecycle *appservice.DocumentLifecycleService
}

func NewDocumentHandler(lifecycle *appservice.DocumentLifecycleService) *DocumentHandler {
	if lifecycle == nil {
		lifecycle = appservice.NewInMemoryDocumentLifecycleService()
	}

	return &DocumentHandler{lifecycle: lifecycle}
}

func (h *DocumentHandler) Register(server *grpc.Server) {
	pb.RegisterDocumentWorkflowServiceServer(server, h)
}

func (h *DocumentHandler) CreateDraft(ctx context.Context, req *pb.CreateDraftRequest) (*pb.Document, error) {
	document, err := h.lifecycle.CreateDraft(ctx, appservice.CreateDraftInput{
		ActorUserID: req.GetActorUserId(),
		Title:       req.GetTitle(),
		Category:    req.GetCategory(),
	})
	if err != nil {
		return nil, toStatusError(err)
	}

	return mapDocument(document)
}

func (h *DocumentHandler) UpdateDraft(ctx context.Context, req *pb.UpdateDraftRequest) (*pb.Document, error) {
	document, err := h.lifecycle.UpdateDraft(ctx, appservice.UpdateDraftInput{
		ActorUserID:     req.GetActorUserId(),
		DocumentID:      req.GetDocumentId(),
		Title:           req.GetTitle(),
		ExpectedVersion: req.GetExpectedVersion(),
	})
	if err != nil {
		return nil, toStatusError(err)
	}

	return mapDocument(document)
}

func (h *DocumentHandler) GetDocument(ctx context.Context, req *pb.GetDocumentRequest) (*pb.Document, error) {
	document, err := h.lifecycle.GetDocument(ctx, appservice.GetDocumentInput{
		ActorUserID: req.GetActorUserId(),
		DocumentID:  req.GetDocumentId(),
	})
	if err != nil {
		return nil, toStatusError(err)
	}

	return mapDocument(document)
}

func (h *DocumentHandler) GetEditorControlProfile(ctx context.Context, req *pb.GetEditorControlProfileRequest) (*pb.EditorControlProfile, error) {
	profile, err := h.lifecycle.GetEditorControlProfile(ctx, appservice.GetEditorControlProfileInput{
		ActorUserID: req.GetActorUserId(),
		ContextType: req.GetContextType(),
		ContextKey:  req.GetContextKey(),
	})
	if err != nil {
		return nil, toStatusError(err)
	}

	return &pb.EditorControlProfile{
		Id:               profile.ID,
		ContextType:      profile.ContextType,
		ContextKey:       profile.ContextKey,
		EnabledControls:  profile.EnabledControls,
		DisabledControls: profile.DisabledControls,
		IsActive:         profile.IsActive,
		UpdatedByUserId:  profile.UpdatedByUserID,
		UpdatedAt:        profile.UpdatedAt,
	}, nil
}

func (h *DocumentHandler) UpdateEditorControlProfile(ctx context.Context, req *pb.UpdateEditorControlProfileRequest) (*pb.EditorControlProfile, error) {
	profile, err := h.lifecycle.UpdateEditorControlProfile(ctx, appservice.UpdateEditorControlProfileInput{
		ActorUserID:      req.GetActorUserId(),
		ProfileID:        req.GetProfileId(),
		EnabledControls:  req.GetEnabledControls(),
		DisabledControls: req.GetDisabledControls(),
		IsActive:         req.GetIsActive(),
	})
	if err != nil {
		return nil, toStatusError(err)
	}

	return &pb.EditorControlProfile{
		Id:               profile.ID,
		ContextType:      profile.ContextType,
		ContextKey:       profile.ContextKey,
		EnabledControls:  profile.EnabledControls,
		DisabledControls: profile.DisabledControls,
		IsActive:         profile.IsActive,
		UpdatedByUserId:  profile.UpdatedByUserID,
		UpdatedAt:        profile.UpdatedAt,
	}, nil
}

func (h *DocumentHandler) CreateExportRequest(ctx context.Context, req *pb.CreateExportPayload) (*pb.ExportRequest, error) {
	exportRequest, err := h.lifecycle.CreateExportRequest(ctx, appservice.CreateExportRequestInput{
		ActorUserID:   req.GetActorUserId(),
		DocumentID:    req.GetDocumentId(),
		Format:        model.ExportFormat(req.GetFormat()),
		SourceVersion: req.GetSourceVersion(),
	})
	if err != nil {
		return nil, toStatusError(err)
	}

	return mapExportRequest(exportRequest), nil
}

func (h *DocumentHandler) GetExportRequest(ctx context.Context, req *pb.GetExportRequestRequest) (*pb.ExportRequest, error) {
	exportRequest, err := h.lifecycle.GetExportRequest(ctx, appservice.GetExportRequestInput{
		ActorUserID:     req.GetActorUserId(),
		DocumentID:      req.GetDocumentId(),
		ExportRequestID: req.GetExportRequestId(),
	})
	if err != nil {
		return nil, toStatusError(err)
	}

	return mapExportRequest(exportRequest), nil
}

func (h *DocumentHandler) DownloadExportArtifact(ctx context.Context, req *pb.DownloadExportArtifactRequest) (*pb.DownloadExportArtifactResponse, error) {
	artifact, err := h.lifecycle.DownloadExportArtifact(ctx, appservice.DownloadExportArtifactInput{
		ActorUserID:     req.GetActorUserId(),
		DocumentID:      req.GetDocumentId(),
		ExportRequestID: req.GetExportRequestId(),
	})
	if err != nil {
		return nil, toStatusError(err)
	}

	if artifact.DownloadURL != "" {
		return &pb.DownloadExportArtifactResponse{
			Data:     []byte(artifact.DownloadURL),
			FileName: artifact.FileName,
			MimeType: artifact.MIMEType,
		}, nil
	}

	return nil, status.Error(codes.FailedPrecondition, "export artifact presigned URL is not available")
}

func mapDocument(document model.Document) (*pb.Document, error) {
	contentJSON := ""
	if document.ContentDocument != nil {
		payload, err := json.Marshal(document.ContentDocument)
		if err != nil {
			return nil, status.Error(codes.Internal, "failed to marshal document content")
		}
		contentJSON = string(payload)
	}

	return &pb.Document{
		Id:                  document.ID,
		Title:               document.Title,
		Category:            document.Category,
		Status:              string(document.Status),
		OwnerUserId:         document.OwnerUser,
		Version:             document.Version,
		UpdatedAt:           document.UpdatedAt,
		ContentDocumentJson: contentJSON,
	}, nil
}

func mapExportRequest(exportRequest model.ExportRequest) *pb.ExportRequest {
	response := &pb.ExportRequest{
		Id:            exportRequest.ID,
		DocumentId:    exportRequest.DocumentID,
		Format:        string(exportRequest.Format),
		SourceVersion: exportRequest.SourceVersion,
		Status:        string(exportRequest.Status),
		ErrorCode:     exportRequest.ErrorCode,
		ErrorMessage:  exportRequest.ErrorMessage,
		CreatedAt:     exportRequest.CreatedAt,
		UpdatedAt:     exportRequest.UpdatedAt,
	}

	if exportRequest.Artifact != nil {
		response.Artifact = &pb.ExportArtifact{
			Id:        exportRequest.Artifact.ID,
			FileName:  exportRequest.Artifact.FileName,
			MimeType:  exportRequest.Artifact.MIMEType,
			SizeBytes: exportRequest.Artifact.SizeBytes,
			CreatedAt: exportRequest.Artifact.CreatedAt,
		}
	}

	return response
}

func toStatusError(err error) error {
	if err == nil {
		return nil
	}

	if errors.Is(err, model.ErrDocumentNotFound) {
		return status.Error(codes.NotFound, err.Error())
	}
	if errors.Is(err, model.ErrInvalidDocumentTitle) || errors.Is(err, model.ErrInvalidDocumentContent) {
		return status.Error(codes.InvalidArgument, err.Error())
	}
	if errors.Is(err, model.ErrDocumentNotEditable) {
		return status.Error(codes.FailedPrecondition, err.Error())
	}

	var versionConflict model.VersionConflictError
	if errors.As(err, &versionConflict) {
		return status.Error(codes.Aborted, versionConflict.Error())
	}

	return status.Error(codes.Internal, err.Error())
}
