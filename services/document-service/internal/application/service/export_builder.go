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
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"edo/services/document-service/internal/domain/model"

	"github.com/jung-kurt/gofpdf"
)

const (
	exportFontFamily     = "EdoDocument"
	exportRegularFont    = "DejaVuSans-Regular.ttf"
	exportBoldFont       = "DejaVuSans-Bold.ttf"
	exportPageMarginMM   = 14.0
	exportLineHeightMM   = 6.0
	exportCellPaddingMM  = 2.0
	exportMaxImageWidth  = 175.0
	exportDefaultFontMM  = 11.0
	exportTableHeaderRGB = 238
)

type exportDocument struct {
	Blocks []exportBlock
}

type exportBlock struct {
	Type  string
	Align string
	Level int
	Runs  []exportRun
	Image *exportImage
	Rows  []exportTableRow
}

type exportRun struct {
	Text      string
	Bold      bool
	Italic    bool
	Underline bool
	Link      string
}

type exportImage struct {
	Src string
	Alt string
}

type exportTableRow struct {
	Cells []exportTableCell
}

type exportTableCell struct {
	Header bool
	Blocks []exportBlock
}

type docxMediaFile struct {
	Name  string
	RelID string
	Bytes []byte
}

type docxRenderContext struct {
	Media []docxMediaFile
}

func buildExportDocument(document model.Document) exportDocument {
	if document.ContentDocument == nil {
		return exportDocument{Blocks: []exportBlock{plainParagraph("(document content is empty)")}}
	}

	content, ok := document.ContentDocument["content"].([]any)
	if !ok || len(content) == 0 {
		payload, err := json.Marshal(document.ContentDocument)
		if err != nil {
			return exportDocument{Blocks: []exportBlock{plainParagraph("(document content is unavailable)")}}
		}
		return exportDocument{Blocks: []exportBlock{plainParagraph(string(payload))}}
	}

	blocks := parseBlocks(content)
	if len(blocks) == 0 {
		blocks = []exportBlock{plainParagraph("(document content is empty)")}
	}

	return exportDocument{Blocks: blocks}
}

func plainParagraph(text string) exportBlock {
	return exportBlock{Type: "paragraph", Runs: []exportRun{{Text: text}}}
}

func generatePDFExport(document exportDocument) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(exportPageMarginMM, exportPageMarginMM, exportPageMarginMM)
	pdf.SetAutoPageBreak(true, exportPageMarginMM)
	if err := registerPDFFonts(pdf); err != nil {
		return nil, err
	}
	pdf.AddPage()
	pdf.SetFont(exportFontFamily, "", exportDefaultFontMM)

	for _, block := range document.Blocks {
		renderPDFBlock(pdf, block, 0, availablePDFWidth(pdf))
	}

	buf := bytes.NewBuffer(nil)
	if err := pdf.Output(buf); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func generateDOCXExport(document exportDocument) ([]byte, error) {
	ctx := &docxRenderContext{}
	parts := make([]string, 0, len(document.Blocks))
	for _, block := range document.Blocks {
		parts = append(parts, renderDOCXBlock(ctx, block))
	}
	if len(parts) == 0 {
		parts = append(parts, `<w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>`)
	}

	documentXML := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" mc:Ignorable="w14 wp14">
  <w:body>
    ` + strings.Join(parts, "\n    ") + `
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
      <w:cols w:space="708"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`

	buf := bytes.NewBuffer(nil)
	zipWriter := zip.NewWriter(buf)
	if err := writeZipFile(zipWriter, "[Content_Types].xml", buildContentTypesXML()); err != nil {
		return nil, err
	}
	if err := writeZipFile(zipWriter, "_rels/.rels", buildPackageRelsXML()); err != nil {
		return nil, err
	}
	if err := writeZipFile(zipWriter, "word/_rels/document.xml.rels", buildDocumentRelsXML(ctx.Media)); err != nil {
		return nil, err
	}
	if err := writeZipFile(zipWriter, "word/document.xml", documentXML); err != nil {
		return nil, err
	}
	for _, file := range ctx.Media {
		if err := writeZipBytes(zipWriter, file.Name, file.Bytes); err != nil {
			return nil, err
		}
	}
	if err := zipWriter.Close(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func parseBlocks(nodes []any) []exportBlock {
	blocks := make([]exportBlock, 0, len(nodes))
	for _, raw := range nodes {
		node, ok := raw.(map[string]any)
		if !ok {
			continue
		}

		switch nodeType(node) {
		case "paragraph":
			blocks = append(blocks, exportBlock{
				Type:  "paragraph",
				Align: textAlign(node),
				Runs:  parseRuns(children(node)),
			})
		case "heading":
			blocks = append(blocks, exportBlock{
				Type:  "heading",
				Align: textAlign(node),
				Level: headingLevel(node),
				Runs:  parseRuns(children(node)),
			})
		case "image":
			if img := parseImage(node); img != nil {
				blocks = append(blocks, exportBlock{Type: "image", Image: img})
			}
		case "table":
			blocks = append(blocks, parseTable(node))
		case "bulletList", "orderedList":
			blocks = append(blocks, parseList(node, nodeType(node) == "orderedList")...)
		default:
			nested := parseBlocks(children(node))
			blocks = append(blocks, nested...)
		}
	}
	return blocks
}

func parseList(node map[string]any, ordered bool) []exportBlock {
	items := children(node)
	blocks := make([]exportBlock, 0, len(items))
	for index, raw := range items {
		item, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		prefix := "• "
		if ordered {
			prefix = strconv.Itoa(index+1) + ". "
		}
		runs := []exportRun{{Text: prefix}}
		runs = append(runs, parseRuns(children(item))...)
		if len(runs) == 1 {
			runs = append(runs, exportRun{Text: strings.TrimSpace(nodeText(item))})
		}
		blocks = append(blocks, exportBlock{Type: "paragraph", Runs: runs})
	}
	return blocks
}

func parseTable(node map[string]any) exportBlock {
	rows := make([]exportTableRow, 0)
	for _, rawRow := range children(node) {
		rowNode, ok := rawRow.(map[string]any)
		if !ok {
			continue
		}
		row := exportTableRow{Cells: make([]exportTableCell, 0)}
		for _, rawCell := range children(rowNode) {
			cellNode, ok := rawCell.(map[string]any)
			if !ok {
				continue
			}
			row.Cells = append(row.Cells, exportTableCell{
				Header: nodeType(cellNode) == "tableHeader",
				Blocks: parseBlocks(children(cellNode)),
			})
		}
		rows = append(rows, row)
	}
	return exportBlock{Type: "table", Rows: rows}
}

func parseRuns(nodes []any) []exportRun {
	runs := make([]exportRun, 0)
	for _, raw := range nodes {
		node, ok := raw.(map[string]any)
		if !ok {
			continue
		}

		switch nodeType(node) {
		case "text":
			text, _ := node["text"].(string)
			run := exportRun{Text: text}
			for _, mark := range marks(node) {
				switch nodeType(mark) {
				case "bold":
					run.Bold = true
				case "italic":
					run.Italic = true
				case "underline":
					run.Underline = true
				case "link":
					run.Link = attrString(mark, "href")
					run.Underline = true
				}
			}
			runs = append(runs, run)
		case "hardBreak":
			runs = append(runs, exportRun{Text: "\n"})
		default:
			runs = append(runs, parseRuns(children(node))...)
		}
	}
	return runs
}

func parseImage(node map[string]any) *exportImage {
	src := attrString(node, "src")
	if strings.TrimSpace(src) == "" {
		return nil
	}
	return &exportImage{Src: src, Alt: attrString(node, "alt")}
}

func renderPDFBlock(pdf *gofpdf.Fpdf, block exportBlock, indent float64, width float64) {
	switch block.Type {
	case "heading":
		size := 17.0
		if block.Level == 2 {
			size = 14
		}
		if block.Level >= 3 {
			size = 12.5
		}
		pdf.Ln(2)
		pdf.SetFont(exportFontFamily, "B", size)
		renderPDFText(pdf, runsText(block.Runs), block.Align, width-indent, 8)
		pdf.SetFont(exportFontFamily, "", exportDefaultFontMM)
		pdf.Ln(2)
	case "paragraph":
		pdf.SetFont(exportFontFamily, "", exportDefaultFontMM)
		renderPDFText(pdf, runsText(block.Runs), block.Align, width-indent, exportLineHeightMM)
		pdf.Ln(1)
	case "image":
		if block.Image != nil {
			renderPDFImage(pdf, *block.Image, width-indent)
		}
	case "table":
		renderPDFTable(pdf, block, width-indent)
	}
}

func renderPDFText(pdf *gofpdf.Fpdf, text string, align string, width float64, lineHeight float64) {
	text = strings.TrimRight(text, "\n")
	if strings.TrimSpace(text) == "" {
		pdf.Ln(lineHeight)
		return
	}
	pdf.MultiCell(width, lineHeight, text, "", pdfAlign(align), false)
}

func renderPDFImage(pdf *gofpdf.Fpdf, img exportImage, maxWidth float64) {
	data, imageType, err := loadImageBytes(img.Src)
	if err != nil {
		pdf.MultiCell(maxWidth, exportLineHeightMM, fmt.Sprintf("[Image unavailable: %s]", img.Alt), "", "L", false)
		return
	}

	name := fmt.Sprintf("image-%d", time.Now().UnixNano())
	options := gofpdf.ImageOptions{ImageType: strings.ToUpper(imageType)}
	imageInfo := pdf.RegisterImageOptionsReader(name, options, bytes.NewReader(data))
	imageWidth, imageHeight := imageInfo.Extent()
	if imageWidth <= 0 || imageHeight <= 0 {
		pdf.MultiCell(maxWidth, exportLineHeightMM, fmt.Sprintf("[Image unsupported: %s]", img.Alt), "", "L", false)
		return
	}

	renderWidth := math.Min(maxWidth, exportMaxImageWidth)
	renderHeight := imageHeight * (renderWidth / imageWidth)
	ensurePDFSpace(pdf, renderHeight+3)
	x := pdf.GetX()
	y := pdf.GetY()
	pdf.ImageOptions(name, x, y, renderWidth, 0, false, options, 0, "")
	pdf.SetY(y + renderHeight + 3)
}

func renderPDFTable(pdf *gofpdf.Fpdf, table exportBlock, width float64) {
	cols := maxTableColumns(table)
	if cols == 0 {
		return
	}
	cellWidth := width / float64(cols)
	for _, row := range table.Rows {
		rowHeight := estimatePDFRowHeight(pdf, row, cellWidth)
		ensurePDFSpace(pdf, rowHeight)
		startX := pdf.GetX()
		startY := pdf.GetY()
		for index := 0; index < cols; index++ {
			cell := exportTableCell{}
			if index < len(row.Cells) {
				cell = row.Cells[index]
			}
			x := startX + float64(index)*cellWidth
			if cell.Header {
				pdf.SetFillColor(exportTableHeaderRGB, exportTableHeaderRGB, exportTableHeaderRGB)
				pdf.Rect(x, startY, cellWidth, rowHeight, "FD")
			} else {
				pdf.Rect(x, startY, cellWidth, rowHeight, "D")
			}
			pdf.SetXY(x+exportCellPaddingMM, startY+exportCellPaddingMM)
			renderPDFCellContent(pdf, cell, cellWidth-(exportCellPaddingMM*2), rowHeight-(exportCellPaddingMM*2))
		}
		pdf.SetXY(startX, startY+rowHeight)
	}
	pdf.Ln(2)
}

func renderPDFCellContent(pdf *gofpdf.Fpdf, cell exportTableCell, width float64, height float64) {
	startX := pdf.GetX()
	startY := pdf.GetY()
	for _, block := range cell.Blocks {
		switch block.Type {
		case "image":
			if block.Image == nil {
				continue
			}
			data, imageType, err := loadImageBytes(block.Image.Src)
			if err != nil {
				continue
			}
			name := fmt.Sprintf("cell-image-%d", time.Now().UnixNano())
			options := gofpdf.ImageOptions{ImageType: strings.ToUpper(imageType)}
			info := pdf.RegisterImageOptionsReader(name, options, bytes.NewReader(data))
			imageWidth, imageHeight := info.Extent()
			if imageWidth <= 0 || imageHeight <= 0 {
				continue
			}
			renderWidth := math.Min(width, imageWidth)
			renderHeight := imageHeight * (renderWidth / imageWidth)
			if renderHeight > height {
				renderHeight = height
				renderWidth = imageWidth * (renderHeight / imageHeight)
			}
			pdf.ImageOptions(name, startX, pdf.GetY(), renderWidth, renderHeight, false, options, 0, "")
			pdf.SetY(pdf.GetY() + renderHeight + 1)
		default:
			text := strings.TrimSpace(runsText(block.Runs))
			if text == "" {
				continue
			}
			if cell.Header {
				pdf.SetFont(exportFontFamily, "B", exportDefaultFontMM)
			} else {
				pdf.SetFont(exportFontFamily, "", exportDefaultFontMM)
			}
			pdf.MultiCell(width, 5, text, "", pdfAlign(block.Align), false)
		}
		if pdf.GetY() > startY+height {
			break
		}
		pdf.SetX(startX)
	}
	pdf.SetFont(exportFontFamily, "", exportDefaultFontMM)
}

func estimatePDFRowHeight(pdf *gofpdf.Fpdf, row exportTableRow, cellWidth float64) float64 {
	maxHeight := 14.0
	innerWidth := cellWidth - (exportCellPaddingMM * 2)
	for _, cell := range row.Cells {
		cellHeight := exportCellPaddingMM * 2
		for _, block := range cell.Blocks {
			if block.Type == "image" && block.Image != nil {
				cellHeight += 38
				continue
			}
			text := runsText(block.Runs)
			lines := estimateTextLines(pdf, text, innerWidth)
			cellHeight += math.Max(1, float64(lines)) * 5
		}
		if cellHeight > maxHeight {
			maxHeight = cellHeight
		}
	}
	return math.Min(maxHeight, 75)
}

func estimateTextLines(pdf *gofpdf.Fpdf, text string, width float64) int {
	if strings.TrimSpace(text) == "" || width <= 0 {
		return 1
	}
	lineWidth := 0.0
	lines := 1
	for _, word := range strings.Fields(text) {
		wordWidth := pdf.GetStringWidth(word + " ")
		if lineWidth > 0 && lineWidth+wordWidth > width {
			lines++
			lineWidth = wordWidth
			continue
		}
		lineWidth += wordWidth
	}
	return lines
}

func renderDOCXBlock(ctx *docxRenderContext, block exportBlock) string {
	switch block.Type {
	case "heading":
		return renderDOCXParagraph(block.Runs, block.Align, block.Level)
	case "paragraph":
		return renderDOCXParagraph(block.Runs, block.Align, 0)
	case "image":
		if block.Image == nil {
			return ""
		}
		return renderDOCXImage(ctx, *block.Image, 5200000)
	case "table":
		return renderDOCXTable(ctx, block)
	default:
		return ""
	}
}

func renderDOCXParagraph(runs []exportRun, align string, headingLevel int) string {
	runXML := make([]string, 0, len(runs))
	for _, run := range runs {
		runXML = append(runXML, renderDOCXRun(run, headingLevel > 0))
	}
	if len(runXML) == 0 {
		runXML = append(runXML, `<w:r><w:t xml:space="preserve"> </w:t></w:r>`)
	}

	props := []string{}
	if align != "" {
		props = append(props, fmt.Sprintf(`<w:jc w:val="%s"/>`, docxAlign(align)))
	}
	if headingLevel > 0 {
		props = append(props, fmt.Sprintf(`<w:pStyle w:val="Heading%d"/>`, headingLevel))
	}
	propXML := ""
	if len(props) > 0 {
		propXML = `<w:pPr>` + strings.Join(props, "") + `</w:pPr>`
	}
	return `<w:p>` + propXML + strings.Join(runXML, "") + `</w:p>`
}

func renderDOCXRun(run exportRun, heading bool) string {
	props := []string{}
	if run.Bold || heading {
		props = append(props, `<w:b/>`)
	}
	if run.Italic {
		props = append(props, `<w:i/>`)
	}
	if run.Underline || run.Link != "" {
		props = append(props, `<w:u w:val="single"/>`)
	}
	if run.Link != "" {
		props = append(props, `<w:color w:val="0563C1"/>`)
	}
	if heading {
		props = append(props, `<w:sz w:val="32"/>`)
	}
	propXML := ""
	if len(props) > 0 {
		propXML = `<w:rPr>` + strings.Join(props, "") + `</w:rPr>`
	}
	parts := strings.Split(run.Text, "\n")
	textParts := make([]string, 0, len(parts)*2)
	for index, part := range parts {
		if index > 0 {
			textParts = append(textParts, `<w:br/>`)
		}
		textParts = append(textParts, fmt.Sprintf(`<w:t xml:space="preserve">%s</w:t>`, escapeXMLText(part)))
	}
	return `<w:r>` + propXML + strings.Join(textParts, "") + `</w:r>`
}

func renderDOCXTable(ctx *docxRenderContext, table exportBlock) string {
	rows := make([]string, 0, len(table.Rows))
	cols := maxTableColumns(table)
	if cols == 0 {
		return ""
	}
	cellWidth := 9360 / cols
	for _, row := range table.Rows {
		cells := make([]string, 0, cols)
		for index := 0; index < cols; index++ {
			cell := exportTableCell{}
			if index < len(row.Cells) {
				cell = row.Cells[index]
			}
			content := make([]string, 0, len(cell.Blocks))
			for _, block := range cell.Blocks {
				content = append(content, renderDOCXBlock(ctx, block))
			}
			if len(content) == 0 {
				content = append(content, `<w:p/>`)
			}
			shading := ""
			if cell.Header {
				shading = `<w:shd w:fill="EEF0F2"/>`
			}
			cells = append(cells, fmt.Sprintf(`<w:tc><w:tcPr><w:tcW w:w="%d" w:type="dxa"/>%s</w:tcPr>%s</w:tc>`, cellWidth, shading, strings.Join(content, "")))
		}
		rows = append(rows, `<w:tr>`+strings.Join(cells, "")+`</w:tr>`)
	}

	return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="C6C6CD"/><w:left w:val="single" w:sz="4" w:color="C6C6CD"/><w:bottom w:val="single" w:sz="4" w:color="C6C6CD"/><w:right w:val="single" w:sz="4" w:color="C6C6CD"/><w:insideH w:val="single" w:sz="4" w:color="C6C6CD"/><w:insideV w:val="single" w:sz="4" w:color="C6C6CD"/></w:tblBorders></w:tblPr>` + strings.Join(rows, "") + `</w:tbl>`
}

func renderDOCXImage(ctx *docxRenderContext, img exportImage, maxWidthEMU int64) string {
	data, _, err := loadImageBytes(img.Src)
	if err != nil {
		return renderDOCXParagraph([]exportRun{{Text: fmt.Sprintf("[Image unavailable: %s]", img.Alt)}}, "", 0)
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || cfg.Width <= 0 || cfg.Height <= 0 {
		return renderDOCXParagraph([]exportRun{{Text: fmt.Sprintf("[Image unsupported: %s]", img.Alt)}}, "", 0)
	}

	ext := normalizeImageExtension(format)
	relID := fmt.Sprintf("rId%d", len(ctx.Media)+1)
	fileName := fmt.Sprintf("image%d.%s", len(ctx.Media)+1, ext)
	cx, cy := docxImageExtentEMU(cfg.Width, cfg.Height, maxWidthEMU)
	ctx.Media = append(ctx.Media, docxMediaFile{
		Name:  "word/media/" + fileName,
		RelID: relID,
		Bytes: data,
	})
	return buildDOCXImageParagraph(relID, len(ctx.Media), fileName, cx, cy)
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

func nodeText(node any) string {
	mapNode, ok := node.(map[string]any)
	if !ok {
		return ""
	}

	if nodeType(mapNode) == "text" {
		if text, ok := mapNode["text"].(string); ok {
			return text
		}
	}
	if nodeType(mapNode) == "hardBreak" {
		return "\n"
	}

	parts := make([]string, 0)
	for _, child := range children(mapNode) {
		part := nodeText(child)
		if part != "" {
			parts = append(parts, part)
		}
	}

	return strings.Join(parts, "")
}

func runsText(runs []exportRun) string {
	var builder strings.Builder
	for _, run := range runs {
		builder.WriteString(run.Text)
	}
	return builder.String()
}

func nodeType(node map[string]any) string {
	value, _ := node["type"].(string)
	return value
}

func children(node map[string]any) []any {
	value, _ := node["content"].([]any)
	return value
}

func marks(node map[string]any) []map[string]any {
	rawMarks, _ := node["marks"].([]any)
	result := make([]map[string]any, 0, len(rawMarks))
	for _, raw := range rawMarks {
		if mark, ok := raw.(map[string]any); ok {
			result = append(result, mark)
		}
	}
	return result
}

func attrString(node map[string]any, key string) string {
	attrs, _ := node["attrs"].(map[string]any)
	value, _ := attrs[key].(string)
	return value
}

func textAlign(node map[string]any) string {
	align := attrString(node, "textAlign")
	switch align {
	case "center", "right", "justify":
		return align
	default:
		return "left"
	}
}

func headingLevel(node map[string]any) int {
	attrs, _ := node["attrs"].(map[string]any)
	switch value := attrs["level"].(type) {
	case int:
		return value
	case int64:
		return int(value)
	case float64:
		return int(value)
	case string:
		parsed, _ := strconv.Atoi(value)
		if parsed > 0 {
			return parsed
		}
	}
	return 1
}

func maxTableColumns(table exportBlock) int {
	maxCols := 0
	for _, row := range table.Rows {
		if len(row.Cells) > maxCols {
			maxCols = len(row.Cells)
		}
	}
	return maxCols
}

func availablePDFWidth(pdf *gofpdf.Fpdf) float64 {
	pageWidth, _ := pdf.GetPageSize()
	left, _, right, _ := pdf.GetMargins()
	return pageWidth - left - right
}

func ensurePDFSpace(pdf *gofpdf.Fpdf, neededHeight float64) {
	_, pageHeight := pdf.GetPageSize()
	_, _, _, bottom := pdf.GetMargins()
	if pdf.GetY()+neededHeight+bottom > pageHeight {
		pdf.AddPage()
	}
}

func pdfAlign(align string) string {
	switch align {
	case "center":
		return "C"
	case "right":
		return "R"
	case "justify":
		return "J"
	default:
		return "L"
	}
}

func docxAlign(align string) string {
	switch align {
	case "center":
		return "center"
	case "right":
		return "right"
	case "justify":
		return "both"
	default:
		return "left"
	}
}

func registerPDFFonts(pdf *gofpdf.Fpdf) error {
	regular, err := exportFontPath(exportRegularFont)
	if err != nil {
		return err
	}
	bold, err := exportFontPath(exportBoldFont)
	if err != nil {
		return err
	}
	pdf.AddUTF8Font(exportFontFamily, "", regular)
	pdf.AddUTF8Font(exportFontFamily, "B", bold)
	return pdf.Error()
}

func exportFontPath(name string) (string, error) {
	candidates := []string{
		filepath.Join("assets", "fonts", name),
		filepath.Join("/app", "assets", "fonts", name),
		filepath.Join("services", "document-service", "assets", "fonts", name),
	}
	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("export font %s is not available", name)
}

func buildContentTypesXML() string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
}

func buildPackageRelsXML() string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
}

func buildDocumentRelsXML(media []docxMediaFile) string {
	documentRels := []string{`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`, `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`}
	for _, file := range media {
		documentRels = append(documentRels, fmt.Sprintf(`<Relationship Id="%s" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/%s"/>`, file.RelID, strings.TrimPrefix(file.Name, "word/media/")))
	}
	documentRels = append(documentRels, `</Relationships>`)
	return strings.Join(documentRels, "\n")
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

func docxImageExtentEMU(widthPx int, heightPx int, maxWidthEmu int64) (int64, int64) {
	const emuPerPixel = 9525

	width := int64(widthPx * emuPerPixel)
	height := int64(heightPx * emuPerPixel)
	if width <= 0 || height <= 0 {
		return 2000000, 1500000
	}
	if maxWidthEmu <= 0 {
		maxWidthEmu = 5500000
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
