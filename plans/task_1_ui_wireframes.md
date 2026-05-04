# Task Orchestration - UI Wireframes and Specifications

## Overview
This document provides detailed wireframes and specifications for the enhanced task orchestration UI components.

## 1. Task Creation Modal

### Wireframe Description
```
┌─────────────────────────────────────────────────────────────┐
│                    Create New Task                          │
├─────────────────────────────────────────────────────────────┤
│ Task Title: [_______________________________] *             │
│                                                             │
│ Description:                                               │
│ [________________________________________________________] │
│ [________________________________________________________] │
│ [________________________________________________________] │
├─────────────────────────────────────────────────────────────┤
│ Assignee: [Select User ▼] *                    Department: │
│                                                             │
│ Approver: [Select User ▼]                      Task Type:  │
│                                                [Approval ▼] │
├─────────────────────────────────────────────────────────────┤
│ Attachments:                                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📎 NDA_Document.pdf (2.3 MB) [Remove]                  │ │
│ │ 📎 Contract_Template.docx (1.1 MB) [Remove]            │ │
│ │ 📎 Supporting_Letter.pdf (0.8 MB) [Remove]             │ │
│ └─────────────────────────────────────────────────────────┘ │
│ [📎 Add Document] [📁 Browse Files]                         │
├─────────────────────────────────────────────────────────────┤
│ Due Date: [📅 Select Date ▼]                                │
├─────────────────────────────────────────────────────────────┤
│                          [Cancel] [Create Task]             │
└─────────────────────────────────────────────────────────────┘
```

### Component Specifications

**Form Fields**:
- `title`: Text input, required, max 100 chars
- `description`: Textarea, optional, max 500 chars
- `assignee`: User selector dropdown, required
- `approver`: User selector dropdown, required for approval tasks
- `taskType`: Radio/Select (Approval, General), default Approval
- `attachments`: File upload area, multiple files, drag & drop
- `dueDate`: Date picker, optional

**Validation Rules**:
- Title required
- Assignee required
- Approver required when taskType = 'approval'
- File size limit: 10MB per file
- Supported formats: PDF, DOC, DOCX, XLS, XLSX

**Interactions**:
- Task type change shows/hides approver field
- File drag & drop highlights upload area
- Remove buttons for each attachment
- Browse opens file picker

## 2. Task Card with Attachments

### Wireframe Description
```
┌─────────────────────────────────────────────────────────────┐
│ 🏷️ Vacation Request 2026                           👤 Иван  │
│                                                             │
│ Request for 14 days vacation from May 15 to May 28, 2026   │
│ with attached medical certificate.                          │
│                                                             │
│ 📎 Medical_Certificate.pdf                                  │
│ 📎 Vacation_Request_Form.pdf                                │
│ 📎 Manager_Approval_Form.pdf                                │
│                                                             │
│ 👤 Assignee: Мария Петрова                    ⏰ Due: 12.05 │
│ 👤 Approver: Сергей Иванов                   📊 Pending     │
│                                                             │
│ 💬 3 comments                                    ⋯         │
└─────────────────────────────────────────────────────────────┘
```

### Component Specifications

**Layout**:
- Header: Title + Creator avatar
- Body: Description (truncated)
- Attachments: List with icons and names
- Footer: Assignee, Approver, Due date, Status, Comment count

**Status Indicators**:
- `pending`: 🟡 Yellow circle
- `in_review`: 🔵 Blue circle
- `approved`: 🟢 Green circle
- `declined`: 🔴 Red circle

**Interactions**:
- Click title → Open task details
- Click attachments → Download/view
- Click assignee/approver → Show user info
- Click comments → Expand comment thread

## 3. Approval Actions Panel

### Wireframe Description
```
┌─────────────────────────────────────────────────────────────┐
│                    Review Task                              │
├─────────────────────────────────────────────────────────────┤
│ Status: 🔵 In Review                                       │
│                                                             │
│ Decision Comment:                                          │
│ [________________________________________________________] │
│ [________________________________________________________] │
│ [________________________________________________________] │
│                                                             │
│                    [Decline] [Approve]                      │
└─────────────────────────────────────────────────────────────┘
```

### Component Specifications

**Visibility**: Only shown to approver when task status = 'in_review'

**Form Fields**:
- `decisionComment`: Textarea, optional for approve, required for decline

**Actions**:
- **Approve**: Sets status to 'approved', optional comment
- **Decline**: Sets status to 'declined', requires comment

**Validation**:
- Comment required for decline
- Max 500 characters
- HTML stripped for security

## 4. Document Selection Modal

### Wireframe Description
```
┌─────────────────────────────────────────────────────────────┐
│                 Select Documents                            │
├─────────────────────────────────────────────────────────────┤
│ Search: [_________________________] 🔍                     │
│                                                             │
│ 📄 NDA_Document.pdf              GENERAL     DRAFT    [ ]   │
│ 📄 Contract_Template.docx        GENERAL     APPROVED  [ ]   │
│ 📄 Vacation_Policy.pdf           HR          APPROVED  [✓]   │
│ 📄 Medical_Certificate.pdf       HR          DRAFT     [ ]   │
│ 📄 Manager_Approval_Form.pdf     GENERAL     DRAFT     [ ]   │
│                                                             │
│                    [Cancel] [Add Selected (1)]              │
└─────────────────────────────────────────────────────────────┘
```

### Component Specifications

**Features**:
- Search by filename or category
- Filter by category and status
- Multi-select with checkboxes
- Preview document info (size, modified date)
- Pagination for large lists

**Data Source**: `availableDocuments` from board API

## 5. Kanban Board Layout

### Wireframe Description
```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Legal Documents                           ➕ New Task   │
├─────────────────────────────────────────────────────────────┤
│         Pending          │      In Review       │  Approved │
├──────────────────────────┼──────────────────────┼───────────┤
│ ┌─────────────────────┐  │                      │           │
│ │ 🏷️ NDA Review      │  │                      │           │
│ │ 📎 2 documents      │  │                      │           │
│ │ 👤 Мария            │  │                      │           │
│ │ ⏰ Due: 12.05       │  │                      │           │
│ └─────────────────────┘  │                      │           │
│                          │                      │           │
│ ┌─────────────────────┐  │                      │           │
│ │ 🏷️ Contract Sign   │  │                      │           │
│ │ 📎 1 document       │  │                      │           │
│ │ 👤 Алексей          │  │                      │           │
│ │ ⏰ Due: 15.05       │  │                      │           │
│ └─────────────────────┘  │                      │           │
└─────────────────────────────────────────────────────────────┘
```

### Component Specifications

**Columns**: 4 columns (Pending, In Review, Approved, Declined)

**Drag & Drop Rules**:
- Only approvers can move from Pending → In Review
- No manual moves from In Review (only approve/decline actions)
- Declined tasks cannot be moved

**Visual Feedback**:
- Invalid drops show red highlight
- Status colors match task cards
- Column headers show task counts

## 6. Task Details View

### Wireframe Description
```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to Board                              ⋯             │
├─────────────────────────────────────────────────────────────┤
│ 🏷️ Vacation Request 2026                                │
│                                                             │
│ Request for 14 days vacation from May 15 to May 28, 2026   │
│ with attached medical certificate.                          │
│                                                             │
│ 👤 Creator: Иван Петров                        📊 Pending  │
│ 👤 Assignee: Мария Петрова                    ⏰ Due: 12.05 │
│ 👤 Approver: Сергей Иванов                                 │
│                                                             │
│ 📎 Attachments (3)                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📄 Medical_Certificate.pdf (2.3 MB) [Download]         │ │
│ │ 📄 Vacation_Request_Form.pdf (1.1 MB) [Download]       │ │
│ │ 📄 Manager_Approval_Form.pdf (0.8 MB) [Download]       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 💬 Comments (2)                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 👤 Сергей Иванов: Please review the medical cert.      │ │
│ │ 👤 Мария Петрова: Certificate attached.                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│ Add comment: [_______________________________] [Send]      │
└─────────────────────────────────────────────────────────────┘
```

### Component Specifications

**Sections**:
- Header with title and status
- Task metadata (creator, assignee, approver, dates)
- Attachments list with download links
- Comments thread with add new comment

**Permissions**:
- Creators can edit in pending state
- Approvers see action buttons in review state
- All can view and comment

## Implementation Notes

### Responsive Design
- Mobile: Single column layout, stacked cards
- Tablet: 2-column layout
- Desktop: Full 4-column layout

### Accessibility
- Keyboard navigation for all interactions
- Screen reader support for status changes
- High contrast mode support
- Focus management in modals

### Performance
- Lazy load attachment previews
- Virtual scrolling for large task lists
- Debounced search in document selector

### Error States
- File upload failures with retry
- Network errors with offline indicators
- Permission errors with clear messages