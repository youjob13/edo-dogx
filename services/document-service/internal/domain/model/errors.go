package model

import "fmt"

var ErrNotImplemented = fmt.Errorf("not implemented")

var ErrInvalidDocumentTitle = fmt.Errorf("invalid document title")
var ErrInvalidDocumentContent = fmt.Errorf("invalid document content")
