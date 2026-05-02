package service

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"strings"
	"time"

	"edo/services/document-service/internal/domain/model"

	"github.com/jung-kurt/gofpdf"
)

type exportImage struct {
	Src string
	Alt string
}

func buildExportContent(document model.Document) ([]string, []exportImage) {
	generatedAt := time.Now().UTC().Format(time.RFC3339)
	contentLines, contentImages := extractExportContent(document)
	lines := []string{
		"Title: " + strings.TrimSpace(document.Title),
		"Category: " + strings.TrimSpace(document.Category),
		"Generated at: " + generatedAt,
		"Source version: " + fmt.Sprintf("%d", document.Version),
		"",
	}
	lines = append(lines, contentLines...)

	return lines, contentImages
}

func generatePDFExport(lines []string, images []exportImage) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetAutoPageBreak(true, 12)
	pdf.AddPage()
	pdf.SetFont("Arial", "", 12)

	for _, line := range lines {
		for _, row := range wrapLine(line, 95) {
			pdf.MultiCell(0, 6, row, "", "L", false)
		}
	}

	for index, img := range images {
		pdf.Ln(2)
		data, imageType, err := loadImageBytes(img.Src)
		if err != nil {
			pdf.MultiCell(0, 6, fmt.Sprintf("[Image unavailable: %s]", img.Src), "", "L", false)
			continue
		}

		name := fmt.Sprintf("image-%d", index+1)
		options := gofpdf.ImageOptions{ImageType: strings.ToUpper(imageType)}
		imageInfo := pdf.RegisterImageOptionsReader(name, options, bytes.NewReader(data))

		x := pdf.GetX()
		y := pdf.GetY()
		pageWidth, pageHeight := pdf.GetPageSize()
		leftMargin, _, rightMargin, bottomMargin := pdf.GetMargins()
		maxWidth := pageWidth - leftMargin - rightMargin
		imageWidth, imageHeight := imageInfo.Extent()
		if imageWidth <= 0 || imageHeight <= 0 {
			pdf.MultiCell(0, 6, fmt.Sprintf("[Image unsupported: %s]", img.Src), "", "L", false)
			continue
		}

		scaledHeight := imageHeight * (maxWidth / imageWidth)
		if y+scaledHeight+bottomMargin > pageHeight {
			pdf.AddPage()
			y = pdf.GetY()
		}

		pdf.ImageOptions(name, x, y, maxWidth, 0, false, options, 0, "")
		pdf.SetY(y + scaledHeight + 3)
	}

	buf := bytes.NewBuffer(nil)
	if err := pdf.Output(buf); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func generateDOCXExport(lines []string, images []exportImage) ([]byte, error) {
	paragraphs := make([]string, 0, len(lines))
	for _, line := range lines {
		for _, row := range wrapLine(line, 140) {
			paragraphs = append(paragraphs, fmt.Sprintf(`<w:p><w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>`, escapeXMLText(row)))
		}
	}

	type mediaFile struct {
		name   string
		relID  string
		bytes  []byte
		width  int
		height int
	}
	mediaFiles := make([]mediaFile, 0, len(images))
	for index, img := range images {
		data, _, err := loadImageBytes(img.Src)
		if err != nil {
			paragraphs = append(paragraphs, fmt.Sprintf(`<w:p><w:r><w:t xml:space="preserve">[Image unavailable: %s]</w:t></w:r></w:p>`, escapeXMLText(img.Src)))
			continue
		}

		cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
		if err != nil || cfg.Width <= 0 || cfg.Height <= 0 {
			paragraphs = append(paragraphs, fmt.Sprintf(`<w:p><w:r><w:t xml:space="preserve">[Image unsupported: %s]</w:t></w:r></w:p>`, escapeXMLText(img.Src)))
			continue
		}

		ext := normalizeImageExtension(format)
		relID := fmt.Sprintf("rId%d", index+1)
		fileName := fmt.Sprintf("image%d.%s", index+1, ext)
		cx, cy := docxImageExtentEMU(cfg.Width, cfg.Height)
		paragraphs = append(paragraphs, buildDOCXImageParagraph(relID, index+1, fileName, cx, cy))
		mediaFiles = append(mediaFiles, mediaFile{
			name:   "word/media/" + fileName,
			relID:  relID,
			bytes:  data,
			width:  cfg.Width,
			height: cfg.Height,
		})
	}

	if len(paragraphs) == 0 {
		paragraphs = append(paragraphs, `<w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>`)
	}

	documentXML := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" mc:Ignorable="w14 wp14">
  <w:body>
    ` + strings.Join(paragraphs, "\n    ") + `
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
      <w:cols w:space="708"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`

	contentTypesXML := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

	relsXML := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

	documentRels := []string{`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`, `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`}
	for _, file := range mediaFiles {
		documentRels = append(documentRels, fmt.Sprintf(`<Relationship Id="%s" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/%s"/>`, file.relID, strings.TrimPrefix(file.name, "word/media/")))
	}
	documentRels = append(documentRels, `</Relationships>`)
	documentRelsXML := strings.Join(documentRels, "\n")

	buf := bytes.NewBuffer(nil)
	zipWriter := zip.NewWriter(buf)
	if err := writeZipFile(zipWriter, "[Content_Types].xml", contentTypesXML); err != nil {
		return nil, err
	}
	if err := writeZipFile(zipWriter, "_rels/.rels", relsXML); err != nil {
		return nil, err
	}
	if err := writeZipFile(zipWriter, "word/_rels/document.xml.rels", documentRelsXML); err != nil {
		return nil, err
	}
	if err := writeZipFile(zipWriter, "word/document.xml", documentXML); err != nil {
		return nil, err
	}
	for _, file := range mediaFiles {
		if err := writeZipBytes(zipWriter, file.name, file.bytes); err != nil {
			return nil, err
		}
	}
	if err := zipWriter.Close(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func writeZipFile(zipWriter *zip.Writer, name string, content string) error {
	writer, err := zipWriter.Create(name)
	if err != nil {
		return err
	}
	_, err = writer.Write([]byte(content))
	return err
}

func writeZipBytes(zipWriter *zip.Writer, name string, content []byte) error {
	writer, err := zipWriter.Create(name)
	if err != nil {
		return err
	}
	_, err = writer.Write(content)
	return err
}

func extractExportContent(document model.Document) ([]string, []exportImage) {
	if document.ContentDocument == nil {
		return []string{"(document content is empty)"}, nil
	}

	content, ok := document.ContentDocument["content"].([]any)
	if !ok || len(content) == 0 {
		payload, err := json.Marshal(document.ContentDocument)
		if err != nil {
			return []string{"(document content is unavailable)"}, nil
		}
		return []string{string(payload)}, nil
	}

	lines := make([]string, 0, len(content))
	images := make([]exportImage, 0)
	for _, node := range content {
		collectImageNodes(node, &images)
		line := strings.TrimSpace(nodeText(node))
		if line != "" {
			lines = append(lines, line)
		}
	}

	if len(lines) == 0 {
		lines = []string{"(document content is empty)"}
	}

	return lines, images
}

func collectImageNodes(node any, images *[]exportImage) {
	mapNode, ok := node.(map[string]any)
	if !ok {
		return
	}

	nodeType, _ := mapNode["type"].(string)
	if nodeType == "image" {
		attrs, _ := mapNode["attrs"].(map[string]any)
		src, _ := attrs["src"].(string)
		alt, _ := attrs["alt"].(string)
		if strings.TrimSpace(src) != "" {
			*images = append(*images, exportImage{Src: src, Alt: alt})
		}
	}

	children, _ := mapNode["content"].([]any)
	for _, child := range children {
		collectImageNodes(child, images)
	}
}

func nodeText(node any) string {
	mapNode, ok := node.(map[string]any)
	if !ok {
		return ""
	}

	nodeType, _ := mapNode["type"].(string)
	if nodeType == "text" {
		if text, ok := mapNode["text"].(string); ok {
			return text
		}
	}
	if nodeType == "hardBreak" {
		return "\n"
	}

	children, _ := mapNode["content"].([]any)
	if len(children) == 0 {
		return ""
	}

	parts := make([]string, 0, len(children))
	for _, child := range children {
		part := nodeText(child)
		if part != "" {
			parts = append(parts, part)
		}
	}

	return strings.Join(parts, "")
}

func wrapLine(line string, width int) []string {
	if width <= 0 {
		return []string{line}
	}
	if line == "" {
		return []string{""}
	}

	words := strings.Fields(line)
	if len(words) == 0 {
		return []string{""}
	}

	wrapped := make([]string, 0, 1)
	current := words[0]
	for _, word := range words[1:] {
		candidate := current + " " + word
		if len(candidate) > width {
			wrapped = append(wrapped, current)
			current = word
			continue
		}
		current = candidate
	}
	wrapped = append(wrapped, current)
	return wrapped
}

func escapeXMLText(value string) string {
	replacer := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;", "'", "&apos;")
	return replacer.Replace(value)
}

func normalizeImageExtension(imageType string) string {
	imageType = strings.ToLower(strings.TrimSpace(imageType))
	if imageType == "jpeg" {
		return "jpg"
	}
	if imageType == "png" || imageType == "jpg" {
		return imageType
	}
	return "png"
}

func docxImageExtentEMU(widthPx int, heightPx int) (int64, int64) {
	const emuPerPixel = 9525
	const maxWidthEmu int64 = 5500000

	width := int64(widthPx * emuPerPixel)
	height := int64(heightPx * emuPerPixel)
	if width <= 0 || height <= 0 {
		return 2000000, 1500000
	}
	if width > maxWidthEmu {
		height = (height * maxWidthEmu) / width
		width = maxWidthEmu
	}

	return width, height
}

func buildDOCXImageParagraph(relID string, imageID int, name string, cx int64, cy int64) string {
	return fmt.Sprintf(`<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="%d" cy="%d"/><wp:docPr id="%d" name="%s"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="%s"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="%s"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="%d" cy="%d"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`, cx, cy, imageID, escapeXMLText(name), escapeXMLText(name), relID, cx, cy)
}

func loadImageBytes(src string) ([]byte, string, error) {
	src = strings.TrimSpace(src)
	if src == "" {
		return nil, "", fmt.Errorf("image src is empty")
	}

	lower := strings.ToLower(src)
	if strings.HasPrefix(lower, "data:") {
		return decodeDataURL(src)
	}
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") {
		client := &http.Client{Timeout: 8 * time.Second}
		resp, err := client.Get(src)
		if err != nil {
			return nil, "", err
		}
		defer resp.Body.Close()

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return nil, "", fmt.Errorf("image fetch failed with status %d", resp.StatusCode)
		}
		data, err := io.ReadAll(io.LimitReader(resp.Body, 10*1024*1024))
		if err != nil {
			return nil, "", err
		}

		contentType := strings.ToLower(resp.Header.Get("Content-Type"))
		if strings.Contains(contentType, "jpeg") || strings.Contains(contentType, "jpg") {
			return data, "jpg", nil
		}
		return data, "png", nil
	}

	return nil, "", fmt.Errorf("unsupported image src")
}

func decodeDataURL(value string) ([]byte, string, error) {
	comma := strings.Index(value, ",")
	if comma <= 0 {
		return nil, "", fmt.Errorf("invalid data url")
	}

	meta := strings.ToLower(value[:comma])
	payload := value[comma+1:]
	if !strings.Contains(meta, ";base64") {
		return nil, "", fmt.Errorf("only base64 data urls are supported")
	}

	imageType := "png"
	if strings.Contains(meta, "image/jpeg") || strings.Contains(meta, "image/jpg") {
		imageType = "jpg"
	}

	data, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return nil, "", err
	}

	return data, imageType, nil
}
