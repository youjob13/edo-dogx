package model

type EditorControlProfile struct {
	ID               string
	ContextType      string
	ContextKey       string
	EnabledControls  []string
	DisabledControls []string
	IsActive         bool
	UpdatedByUserID  string
	UpdatedAt        string
}

type ExportFormat string

const (
	ExportFormatPDF  ExportFormat = "PDF"
	ExportFormatDOCX ExportFormat = "DOCX"
)

type ExportRequestStatus string

const (
	ExportRequestStatusQueued    ExportRequestStatus = "QUEUED"
	ExportRequestStatusRunning   ExportRequestStatus = "RUNNING"
	ExportRequestStatusSucceeded ExportRequestStatus = "SUCCEEDED"
	ExportRequestStatusFailed    ExportRequestStatus = "FAILED"
)

type ExportArtifact struct {
	ID          string
	FileName    string
	MIMEType    string
	SizeBytes   int64
	DataBase64  string
	DownloadURL string
	CreatedAt   string
}

type ExportRequest struct {
	ID              string
	DocumentID      string
	RequestedByUser string
	Format          ExportFormat
	SourceVersion   int64
	Status          ExportRequestStatus
	ErrorCode       string
	ErrorMessage    string
	Artifact        *ExportArtifact
	CreatedAt       string
	UpdatedAt       string
}
