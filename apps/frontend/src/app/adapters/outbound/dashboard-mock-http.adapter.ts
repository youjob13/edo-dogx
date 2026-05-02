import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, delay, map, of, throwError } from 'rxjs';
import {
  ActivityItem,
  KanbanBoardDetails,
  KanbanBoardMember,
  KanbanBoardSummary,
  KanbanTask,
  KanbanTaskAssignPayload,
  KanbanTaskComment,
  KanbanTaskCommentPayload,
  KanbanTaskDetails,
  KanbanTaskMovePayload,
  DashboardCreateDocumentPayload,
  DashboardCreateExportPayload,
  DashboardEditableDocument,
  DashboardEditorContextType,
  DashboardEditorControlProfile,
  DashboardExportRequest,
  DashboardExportStatus,
  KanbanTaskStatus,
  DashboardDocumentStatus,
  DashboardDocumentType,
  DashboardEditDocumentPayload,
  DashboardPreviewDocument,
  DashboardQuery,
  DashboardRichContentDocument,
  DashboardSummary,
  DocumentItem,
  PaginatedResult,
  StorageUsage,
  DashboardUpdateEditorControlProfilePayload,
  WeeklyVolumePoint,
} from '../../domain/dashboard/dashboard.models';
import { DashboardApiPort } from '../../ports/outbound/dashboard-api.port';

const LATENCY_MS = 180;

const MOCK_WEEKLY_VOLUME: Array<WeeklyVolumePoint> = [
  { day: 'mon', value: 22 },
  { day: 'tue', value: 45 },
  { day: 'wed', value: 30 },
  { day: 'thu', value: 80 },
  { day: 'fri', value: 100 },
  { day: 'sat', value: 63 },
  { day: 'sun', value: 40 },
];

const MOCK_ACTIVITY: Array<ActivityItem> = [
  {
    id: 'a1',
    actor: 'Сара Миллер',
    description: 'подтвердила Procurement_04.pdf',
    timestampLabel: '12 минут назад',
    linkedDocumentId: 'd1',
  },
  {
    id: 'a2',
    actor: 'Система',
    description: 'загрузила 124 записи из API_Inbound',
    timestampLabel: '45 минут назад',
  },
  {
    id: 'a3',
    actor: 'Дэвид Чен',
    description: 'отметил несоответствие в Tax_Return_2023.pdf',
    timestampLabel: '1 час назад',
    linkedDocumentId: 'd6',
  },
  {
    id: 'a4',
    actor: 'Внешний доступ',
    description: 'предоставлен группе Legal Partners Group',
    timestampLabel: '2 часа назад',
  },
];

const mockDocumentsSeed = (): Array<DocumentItem> => [
  {
    id: 'd1',
    filename: 'Q3_Financial_Audit_v2.pdf',
    type: 'pdf',
    status: 'finalized',
    modifiedAtLabel: '2 часа назад',
    modifiedAtIso: '2026-04-28T09:00:00.000Z',
    sizeKb: 2450,
  },
  {
    id: 'd2',
    filename: 'Vendor_Agreement_Draft.docx',
    type: 'legal',
    status: 'review',
    modifiedAtLabel: '5 часов назад',
    modifiedAtIso: '2026-04-28T06:00:00.000Z',
    sizeKb: 860,
  },
  {
    id: 'd3',
    filename: 'HR_Payroll_Export_June.xlsx',
    type: 'spreadsheet',
    status: 'archived',
    modifiedAtLabel: 'вчера',
    modifiedAtIso: '2026-04-27T10:30:00.000Z',
    sizeKb: 5120,
  },
  {
    id: 'd4',
    filename: 'Project_Blueprint_Alpha.jpg',
    type: 'image',
    status: 'pending',
    modifiedAtLabel: 'вчера',
    modifiedAtIso: '2026-04-27T08:10:00.000Z',
    sizeKb: 3320,
  },
  {
    id: 'd5',
    filename: 'Incident_Report_2026_04.pdf',
    type: 'pdf',
    status: 'pending',
    modifiedAtLabel: '2 дня назад',
    modifiedAtIso: '2026-04-26T12:15:00.000Z',
    sizeKb: 1280,
  },
  {
    id: 'd6',
    filename: 'Tax_Return_2023.pdf',
    type: 'legal',
    status: 'review',
    modifiedAtLabel: '3 дня назад',
    modifiedAtIso: '2026-04-25T07:30:00.000Z',
    sizeKb: 2980,
  },
  {
    id: 'd7',
    filename: 'Facility_Inspection_Photos.zip',
    type: 'image',
    status: 'archived',
    modifiedAtLabel: '4 дня назад',
    modifiedAtIso: '2026-04-24T16:00:00.000Z',
    sizeKb: 9120,
  },
  {
    id: 'd8',
    filename: 'Budget_Forecast_Q4.xlsx',
    type: 'spreadsheet',
    status: 'finalized',
    modifiedAtLabel: '5 дней назад',
    modifiedAtIso: '2026-04-23T14:00:00.000Z',
    sizeKb: 4410,
  },
];

const typeOrder = (type: DashboardDocumentType): number => {
  switch (type) {
    case 'pdf':
      return 1;
    case 'legal':
      return 2;
    case 'spreadsheet':
      return 3;
    case 'image':
      return 4;
    default:
      return 99;
  }
};

const statusOrder = (status: DashboardDocumentStatus): number => {
  switch (status) {
    case 'pending':
      return 1;
    case 'review':
      return 2;
    case 'finalized':
      return 3;
    case 'archived':
      return 4;
    default:
      return 99;
  }
};

const CURRENT_USER_ID = 'u1';

interface MutableTaskBoard {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly description: string;
  readonly allowedGrouping: Array<'assignee' | 'department' | 'group'>;
  readonly members: Array<KanbanBoardMember>;
  readonly tasks: Array<KanbanTask>;
}

interface MutableEditableDocument {
  id: string;
  title: string;
  category: 'HR' | 'FINANCE' | 'GENERAL';
  status: DashboardDocumentStatus;
  contentDocument: DashboardRichContentDocument;
  version: number;
  modifiedAtIso: string;
}

const emptyRichDocument = (): DashboardRichContentDocument => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

interface MutableEditorControlProfile {
  id: string;
  contextType: DashboardEditorContextType;
  contextKey: string;
  enabledControls: string[];
  disabledControls: string[];
  isActive: boolean;
  updatedByUserId: string;
  updatedAt: string;
}

interface MutableExportRequest {
  id: string;
  documentId: string;
  format: 'PDF' | 'DOCX';
  sourceVersion: number;
  status: DashboardExportStatus;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

const cloneComment = (comment: KanbanTaskComment): KanbanTaskComment => ({ ...comment });

const cloneTask = (task: KanbanTask): KanbanTask => ({
  ...task,
  comments: task.comments.map(cloneComment),
});

const cloneBoardMember = (member: KanbanBoardMember): KanbanBoardMember => ({ ...member });

const cloneBoard = (board: MutableTaskBoard): MutableTaskBoard => ({
  ...board,
  allowedGrouping: [...board.allowedGrouping],
  members: board.members.map(cloneBoardMember),
  tasks: board.tasks.map(cloneTask),
});

const toBoardSummary = (board: MutableTaskBoard): KanbanBoardSummary => ({
  id: board.id,
  organizationId: board.organizationId,
  name: board.name,
  description: board.description,
  membersCount: board.members.length,
  tasksCount: board.tasks.length,
});

const statusSequence: Array<KanbanTaskStatus> = ['todo', 'inProgress', 'review', 'done'];

const mockTaskBoardsSeed = (): Array<MutableTaskBoard> => {
  const legalMembers: Array<KanbanBoardMember> = [
    { id: 'u1', fullName: 'Ирина Ковалева', department: 'Юридический отдел' },
    { id: 'u2', fullName: 'Олег Сафонов', department: 'Финансовый отдел' },
    { id: 'u3', fullName: 'Марина Жукова', department: 'Канцелярия' },
  ];

  const hrMembers: Array<KanbanBoardMember> = [
    { id: 'u1', fullName: 'Ирина Ковалева', department: 'Юридический отдел' },
    { id: 'u4', fullName: 'Станислав Ким', department: 'HR' },
    { id: 'u5', fullName: 'Наталья Петрова', department: 'IT' },
  ];

  return [
    {
      id: 'board-legal',
      organizationId: 'org-main',
      name: 'Юр. договоры и согласования',
      description: 'Поток обработки договоров с внутренним и внешним согласованием.',
      allowedGrouping: ['assignee', 'department', 'group'],
      members: legalMembers,
      tasks: [
        {
          id: 't-101',
          title: 'Проверка NDA для подрядчика',
          description: 'Проверить риски и внести правки в NDA перед подписанием.',
          status: 'todo',
          assigneeId: 'u1',
          assigneeName: 'Ирина Ковалева',
          department: 'Юридический отдел',
          groupId: 'g-contract-17',
          groupName: 'Договор 17/2026',
          dueDateLabel: 'до 12 мая',
          comments: [
            {
              id: 'c-1001',
              authorId: 'u3',
              authorName: 'Марина Жукова',
              text: 'Отправила актуальную версию приложения.',
              createdAtLabel: '2 часа назад',
            },
          ],
        },
        {
          id: 't-102',
          title: 'Согласовать лимит по штрафам',
          description: 'Нужно финальное согласование от финансов перед отправкой.',
          status: 'inProgress',
          assigneeId: 'u2',
          assigneeName: 'Олег Сафонов',
          department: 'Финансовый отдел',
          groupId: 'g-contract-17',
          groupName: 'Договор 17/2026',
          dueDateLabel: 'до 8 мая',
          comments: [],
        },
        {
          id: 't-103',
          title: 'Подготовить карточку контрагента',
          description: 'Проверить реквизиты и статус аккредитации в системе.',
          status: 'review',
          assigneeId: null,
          assigneeName: 'Не назначен',
          department: 'Канцелярия',
          groupId: 'g-vendor-9',
          groupName: 'Контрагент Альфа',
          dueDateLabel: 'до 6 мая',
          comments: [],
        },
        {
          id: 't-104',
          title: 'Архивировать подписанный пакет',
          description: 'Загрузить финальные документы в архив и закрыть задачу.',
          status: 'done',
          assigneeId: 'u3',
          assigneeName: 'Марина Жукова',
          department: 'Канцелярия',
          groupId: 'g-archive-4',
          groupName: 'Архив Q2',
          dueDateLabel: 'завершено',
          comments: [],
        },
      ],
    },
    {
      id: 'board-hr',
      organizationId: 'org-main',
      name: 'Адаптация сотрудников',
      description: 'План задач для онбординга и выдачи доступов новым сотрудникам.',
      allowedGrouping: ['assignee', 'department', 'group'],
      members: hrMembers,
      tasks: [
        {
          id: 't-201',
          title: 'Выдать доступ в ЭДО и CRM',
          description: 'Создать учетные записи и передать временный пароль.',
          status: 'todo',
          assigneeId: 'u5',
          assigneeName: 'Наталья Петрова',
          department: 'IT',
          groupId: 'g-onboard-77',
          groupName: 'Онбординг #77',
          dueDateLabel: 'до 5 мая',
          comments: [],
        },
        {
          id: 't-202',
          title: 'Подписать политику ИБ',
          description: 'Сотрудник должен ознакомиться и подтвердить подписание.',
          status: 'inProgress',
          assigneeId: 'u4',
          assigneeName: 'Станислав Ким',
          department: 'HR',
          groupId: 'g-onboard-77',
          groupName: 'Онбординг #77',
          dueDateLabel: 'до 7 мая',
          comments: [],
        },
      ],
    },
  ];
};

@Injectable({ providedIn: 'root' })
export class DashboardMockHttpAdapter implements DashboardApiPort {
  private readonly http = inject(HttpClient);
  private documents = mockDocumentsSeed();
  private taskBoards = mockTaskBoardsSeed();
  private editableDocuments: Array<MutableEditableDocument> = [
    {
      id: 'd1',
      title: 'Q3 Financial Audit v2',
      category: 'FINANCE',
      status: 'finalized',
      contentDocument: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Аудит финансового отчета Q3.' }] }],
      },
      version: 3,
      modifiedAtIso: '2026-04-28T09:00:00.000Z',
    },
    {
      id: 'd2',
      title: 'Vendor Agreement Draft',
      category: 'GENERAL',
      status: 'review',
      contentDocument: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Черновик договора с поставщиком.' }] }],
      },
      version: 2,
      modifiedAtIso: '2026-04-28T06:00:00.000Z',
    },
    {
      id: 'd4',
      title: 'Project Blueprint Alpha',
      category: 'HR',
      status: 'pending',
      contentDocument: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Описание этапов проекта Alpha.' }] }],
      },
      version: 1,
      modifiedAtIso: '2026-04-27T08:10:00.000Z',
    },
  ];
  private editorControlProfiles: Array<MutableEditorControlProfile> = [
    {
      id: 'profile-category-general',
      contextType: 'CATEGORY',
      contextKey: 'GENERAL',
      enabledControls: ['bold', 'italic', 'heading', 'list', 'table', 'link', 'image'],
      disabledControls: [],
      isActive: true,
      updatedByUserId: 'system',
      updatedAt: '2026-05-02T10:00:00.000Z',
    },
  ];
  private exportRequests: Array<MutableExportRequest> = [];

  private toEditableDocument(item: MutableEditableDocument): DashboardEditableDocument {
    return {
      id: item.id,
      title: item.title,
      category: item.category,
      status: item.status,
      version: item.version,
      contentDocument: item.contentDocument,
    };
  }

  public getDashboardSummary(query: DashboardQuery): Observable<DashboardSummary> {
    return this.getDocuments(query).pipe(
      map((result) => {
        const pendingApprovalCount = result.items.filter(
          (documentItem) => documentItem.status === 'pending',
        ).length;

        const actionItemsCount = result.items.filter(
          (documentItem) => documentItem.status === 'review',
        ).length;

        return {
          pendingApprovalCount,
          pendingApprovalDelta: 2,
          actionItemsCount,
          overdueNoticesCount: 3,
        };
      }),
    );
  }

  public getWeeklyVolume(): Observable<Array<WeeklyVolumePoint>> {
    return of(MOCK_WEEKLY_VOLUME).pipe(delay(LATENCY_MS));
  }

  public getDocuments(query: DashboardQuery): Observable<PaginatedResult<DocumentItem>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, query.pageSize ?? 5);
    const text = query.text?.trim().toLowerCase();

    let filtered = [...this.documents];

    if (text && text.length > 0) {
      filtered = filtered.filter((documentItem) =>
        [
          documentItem.filename,
          documentItem.type,
          documentItem.status,
          documentItem.modifiedAtLabel,
        ]
          .join(' ')
          .toLowerCase()
          .includes(text),
      );
    }

    if (query.status) {
      filtered = filtered.filter((documentItem) => documentItem.status === query.status);
    }

    if (query.type) {
      filtered = filtered.filter((documentItem) => documentItem.type === query.type);
    }

    const sortBy = query.sortBy ?? 'modifiedAtIso';
    const sortDirection = query.sortDirection ?? 'desc';

    filtered.sort((left, right) => {
      let compareResult = 0;

      if (sortBy === 'filename') {
        compareResult = left.filename.localeCompare(right.filename, 'ru');
      }

      if (sortBy === 'type') {
        compareResult = typeOrder(left.type) - typeOrder(right.type);
      }

      if (sortBy === 'status') {
        compareResult = statusOrder(left.status) - statusOrder(right.status);
      }

      if (sortBy === 'modifiedAtIso') {
        compareResult =
          new Date(left.modifiedAtIso).getTime() - new Date(right.modifiedAtIso).getTime();
      }

      return sortDirection === 'asc' ? compareResult : compareResult * -1;
    });

    const totalItems = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return of({
      items,
      totalItems,
      page,
      pageSize,
    }).pipe(delay(LATENCY_MS));
  }

  public getActivity(query: DashboardQuery): Observable<Array<ActivityItem>> {
    const text = query.text?.trim().toLowerCase();
    let activity = [...MOCK_ACTIVITY];

    if (text && text.length > 0) {
      activity = activity.filter((activityItem) =>
        `${activityItem.actor} ${activityItem.description}`
          .toLowerCase()
          .includes(text),
      );
    }

    return of(activity).pipe(delay(LATENCY_MS));
  }

  public getStorageUsage(): Observable<StorageUsage> {
    return of({
      usedTb: 1.2,
      totalTb: 1.5,
      usedPercent: 80,
    }).pipe(delay(LATENCY_MS));
  }

  public previewDocument(id: string): Observable<DashboardPreviewDocument> {
    const documentItem = this.documents.find((item) => item.id === id);
    if (!documentItem) {
      return throwError(() => new Error('Документ не найден')).pipe(delay(LATENCY_MS));
    }

    return of({
      id: documentItem.id,
      title: documentItem.filename,
      body: `Предпросмотр документа ${documentItem.filename} (мок-данные).`,
    }).pipe(delay(LATENCY_MS));
  }

  public downloadDocument(id: string): Observable<void> {
    const exists = this.documents.some((item) => item.id === id);
    if (!exists) {
      return throwError(() => new Error('Документ для скачивания не найден')).pipe(
        delay(LATENCY_MS),
      );
    }

    return of(void 0).pipe(delay(LATENCY_MS));
  }

  public createDocument(payload: DashboardCreateDocumentPayload): Observable<DashboardEditableDocument> {
    return this.http
      .post<{ id: string; title: string; category: 'HR' | 'FINANCE' | 'GENERAL'; status?: string; version?: number }>(
        '/api/documents',
        payload,
      )
      .pipe(
        map((response) => {
          const mappedStatus: DashboardDocumentStatus =
            response.status === 'archived' ||
            response.status === 'review' ||
            response.status === 'finalized'
              ? response.status
              : 'pending';

          return {
            id: response.id,
            title: response.title,
            category: response.category,
            status: mappedStatus,
            contentDocument: payload.contentDocument ?? emptyRichDocument(),
            version: response.version ?? 1,
          };
        }),
        catchError(() => this.createDocumentLocally(payload)),
      );
  }

  private createDocumentLocally(payload: DashboardCreateDocumentPayload): Observable<DashboardEditableDocument> {
    const trimmedTitle = payload.title.trim();
    if (!trimmedTitle) {
      return throwError(() => new Error('Название документа обязательно')).pipe(delay(LATENCY_MS));
    }

    const id = `d${Date.now()}`;
    const nowIso = new Date().toISOString();
    const editable: MutableEditableDocument = {
      id,
      title: trimmedTitle,
      category: payload.category,
      status: 'pending',
      contentDocument: payload.contentDocument ?? emptyRichDocument(),
      version: 1,
      modifiedAtIso: nowIso,
    };

    this.editableDocuments = [editable, ...this.editableDocuments];
    this.documents = [
      {
        id,
        filename: `${trimmedTitle}.pdf`,
        type: 'pdf',
        status: editable.status,
        modifiedAtLabel: 'только что',
        modifiedAtIso: nowIso,
        sizeKb: 256,
      },
      ...this.documents,
    ];

    return of(this.toEditableDocument(editable)).pipe(delay(LATENCY_MS));
  }

  public getDocumentById(id: string): Observable<DashboardEditableDocument> {
    const editable = this.editableDocuments.find((item) => item.id === id);
    if (!editable) {
      return throwError(() => new Error('Документ не найден')).pipe(delay(LATENCY_MS));
    }

    return of(this.toEditableDocument(editable)).pipe(delay(LATENCY_MS));
  }

  public updateDocument(
    id: string,
    payload: DashboardEditDocumentPayload,
  ): Observable<DocumentItem> {
    const current = this.documents.find((item) => item.id === id);
    const editable = this.editableDocuments.find((item) => item.id === id);

    if (!current || !editable) {
      return throwError(() => new Error('Документ для обновления не найден')).pipe(
        delay(LATENCY_MS),
      );
    }

    if (typeof payload.expectedVersion === 'number' && payload.expectedVersion !== editable.version) {
      return throwError(() => {
        const error = new Error(`VERSION_CONFLICT expected=${payload.expectedVersion} current=${editable.version}`);
        (error as Error & { code?: string }).code = 'VERSION_CONFLICT';
        return error;
      }).pipe(delay(LATENCY_MS));
    }

    const updated: DocumentItem = {
      ...current,
      filename: payload.filename,
      status: payload.status,
      modifiedAtIso: new Date().toISOString(),
      modifiedAtLabel: 'только что',
    };

    this.documents = this.documents.map((item) =>
      item.id === id ? updated : item,
    );

    this.editableDocuments = this.editableDocuments.map((item) =>
      item.id === id
        ? {
            ...item,
            title: payload.filename,
            status: payload.status,
            contentDocument: payload.contentDocument ?? item.contentDocument,
            version: item.version + 1,
            modifiedAtIso: updated.modifiedAtIso,
          }
        : item,
    );

    return of(updated).pipe(delay(LATENCY_MS));
  }

  public updateDraft(
    id: string,
    payload: DashboardEditDocumentPayload,
  ): Observable<DocumentItem> {
    return this.updateDocument(id, payload);
  }

  public getEditorControlProfile(
    contextType: DashboardEditorContextType,
    contextKey: string,
  ): Observable<DashboardEditorControlProfile> {
    return this.http
      .get<DashboardEditorControlProfile>(`/api/editor-control-profiles/${contextType}/${contextKey}`)
      .pipe(
        catchError(() => {
          const profile = this.editorControlProfiles.find(
            (item) => item.contextType === contextType && item.contextKey === contextKey,
          );
          if (profile) {
            return of(profile as DashboardEditorControlProfile);
          }

          const fallback: DashboardEditorControlProfile = {
            id: `${contextType}:${contextKey}`,
            contextType,
            contextKey,
            enabledControls: ['bold', 'italic', 'heading', 'list'],
            disabledControls: ['table', 'image'],
            isActive: true,
            updatedByUserId: 'system',
            updatedAt: new Date().toISOString(),
          };
          return of(fallback);
        }),
        delay(LATENCY_MS),
      );
  }

  public updateEditorControlProfile(
    profileId: string,
    payload: DashboardUpdateEditorControlProfilePayload,
  ): Observable<DashboardEditorControlProfile> {
    return this.http
      .put<DashboardEditorControlProfile>(`/api/editor-control-profiles/${profileId}`, payload)
      .pipe(
        catchError(() => {
          const now = new Date().toISOString();
          const existingIndex = this.editorControlProfiles.findIndex((item) => item.id === profileId);
          const contextType = payload.contextType ?? 'CATEGORY';
          const contextKey = payload.contextKey ?? 'GENERAL';
          const next: MutableEditorControlProfile = {
            id: profileId,
            contextType,
            contextKey,
            enabledControls: [...payload.enabledControls],
            disabledControls: [...payload.disabledControls],
            isActive: payload.isActive,
            updatedByUserId: CURRENT_USER_ID,
            updatedAt: now,
          };

          if (existingIndex >= 0) {
            this.editorControlProfiles = this.editorControlProfiles.map((item, idx) =>
              idx === existingIndex ? next : item,
            );
          } else {
            this.editorControlProfiles = [next, ...this.editorControlProfiles];
          }

          return of(next as DashboardEditorControlProfile);
        }),
        delay(LATENCY_MS),
      );
  }

  public createExportRequest(
    documentId: string,
    payload: DashboardCreateExportPayload,
  ): Observable<DashboardExportRequest> {
    return this.http
      .post<DashboardExportRequest>(`/api/documents/${documentId}/exports`, payload)
      .pipe(
        catchError(() => {
          const now = new Date().toISOString();
          const created: MutableExportRequest = {
            id: `exp-${Date.now()}`,
            documentId,
            format: payload.format,
            sourceVersion: payload.sourceVersion,
            status: 'QUEUED',
            createdAt: now,
            updatedAt: now,
          };

          this.exportRequests = [created, ...this.exportRequests];
          return of(created as DashboardExportRequest);
        }),
        delay(LATENCY_MS),
      );
  }

  public getExportRequest(documentId: string, exportRequestId: string): Observable<DashboardExportRequest> {
    return this.http
      .get<DashboardExportRequest>(`/api/documents/${documentId}/exports/${exportRequestId}`)
      .pipe(
        catchError(() => {
          const existing = this.exportRequests.find(
            (item) => item.documentId === documentId && item.id === exportRequestId,
          );
          if (!existing) {
            return throwError(() => new Error('Запрос экспорта не найден'));
          }

          const nextStatus: DashboardExportStatus =
            existing.status === 'QUEUED' ? 'RUNNING' : existing.status === 'RUNNING' ? 'SUCCEEDED' : existing.status;
          const updated: MutableExportRequest = {
            ...existing,
            status: nextStatus,
            updatedAt: new Date().toISOString(),
          };

          this.exportRequests = this.exportRequests.map((item) =>
            item.id === exportRequestId ? updated : item,
          );

          return of(updated as DashboardExportRequest);
        }),
        delay(LATENCY_MS),
      );
  }

  public downloadExportArtifact(documentId: string, exportRequestId: string): Observable<void> {
    return this.http
      .get(`/api/documents/${documentId}/exports/${exportRequestId}/download`, {
        responseType: 'blob',
      })
      .pipe(
        map(() => void 0),
        catchError(() => {
          const existing = this.exportRequests.find(
            (item) => item.documentId === documentId && item.id === exportRequestId,
          );
          if (!existing || existing.status !== 'SUCCEEDED') {
            return throwError(() => new Error('Файл экспорта пока не готов к скачиванию'));
          }

          return of(void 0);
        }),
        delay(LATENCY_MS),
      );
  }

  public getTaskBoards(organizationId: string): Observable<Array<KanbanBoardSummary>> {
    const boards = this.taskBoards
      .filter((board) => board.organizationId === organizationId)
      .map((board) => toBoardSummary(cloneBoard(board)));

    return of(boards).pipe(delay(LATENCY_MS));
  }

  public getTaskBoard(boardId: string): Observable<KanbanBoardDetails> {
    const board = this.taskBoards.find((item) => item.id === boardId);

    if (!board) {
      return throwError(() => new Error('Канбан-доска не найдена')).pipe(delay(LATENCY_MS));
    }

    const cloned = cloneBoard(board);

    return of({
      id: cloned.id,
      organizationId: cloned.organizationId,
      name: cloned.name,
      description: cloned.description,
      allowedGrouping: [...cloned.allowedGrouping],
      members: cloned.members,
      tasks: cloned.tasks,
    }).pipe(delay(LATENCY_MS));
  }

  public getTaskDetails(boardId: string, taskId: string): Observable<KanbanTaskDetails> {
    const board = this.taskBoards.find((item) => item.id === boardId);

    if (!board) {
      return throwError(() => new Error('Канбан-доска не найдена')).pipe(delay(LATENCY_MS));
    }

    const task = board.tasks.find((item) => item.id === taskId);
    if (!task) {
      return throwError(() => new Error('Задача не найдена')).pipe(delay(LATENCY_MS));
    }

    const canManage = board.members.some((member) => member.id === CURRENT_USER_ID);

    return of({
      board: toBoardSummary(cloneBoard(board)),
      task: cloneTask(task),
      members: board.members.map(cloneBoardMember),
      currentUserId: CURRENT_USER_ID,
      canManage,
    }).pipe(delay(LATENCY_MS));
  }

  public assignTask(
    boardId: string,
    taskId: string,
    payload: KanbanTaskAssignPayload,
  ): Observable<KanbanTask> {
    const board = this.taskBoards.find((item) => item.id === boardId);
    if (!board) {
      return throwError(() => new Error('Канбан-доска не найдена')).pipe(delay(LATENCY_MS));
    }

    const task = board.tasks.find((item) => item.id === taskId);
    if (!task) {
      return throwError(() => new Error('Задача не найдена')).pipe(delay(LATENCY_MS));
    }

    let updated: KanbanTask;

    if (payload.assigneeId) {
      const assignee = board.members.find((member) => member.id === payload.assigneeId);
      if (!assignee) {
        return throwError(() => new Error('Исполнитель не входит в доску')).pipe(
          delay(LATENCY_MS),
        );
      }

      updated = {
        ...task,
        assigneeId: assignee.id,
        assigneeName: assignee.fullName,
        department: assignee.department,
      };
    } else {
      updated = {
        ...task,
        assigneeId: null,
        assigneeName: 'Не назначен',
      };
    }

    this.taskBoards = this.taskBoards.map((item) =>
      item.id === boardId
        ? {
            ...item,
            tasks: item.tasks.map((boardTask) =>
              boardTask.id === taskId ? updated : boardTask,
            ),
          }
        : item,
    );

    return of(cloneTask(updated)).pipe(delay(LATENCY_MS));
  }

  public moveTask(
    boardId: string,
    taskId: string,
    payload: KanbanTaskMovePayload,
  ): Observable<KanbanTask> {
    const board = this.taskBoards.find((item) => item.id === boardId);
    if (!board) {
      return throwError(() => new Error('Канбан-доска не найдена')).pipe(delay(LATENCY_MS));
    }

    const task = board.tasks.find((item) => item.id === taskId);
    if (!task) {
      return throwError(() => new Error('Задача не найдена')).pipe(delay(LATENCY_MS));
    }

    if (!statusSequence.includes(payload.status)) {
      return throwError(() => new Error('Некорректный статус задачи')).pipe(delay(LATENCY_MS));
    }

    const updated: KanbanTask = {
      ...task,
      status: payload.status,
    };

    this.taskBoards = this.taskBoards.map((item) =>
      item.id === boardId
        ? {
            ...item,
            tasks: item.tasks.map((boardTask) =>
              boardTask.id === taskId ? updated : boardTask,
            ),
          }
        : item,
    );

    return of(cloneTask(updated)).pipe(delay(LATENCY_MS));
  }

  public addTaskComment(
    boardId: string,
    taskId: string,
    payload: KanbanTaskCommentPayload,
  ): Observable<KanbanTask> {
    const board = this.taskBoards.find((item) => item.id === boardId);
    if (!board) {
      return throwError(() => new Error('Канбан-доска не найдена')).pipe(delay(LATENCY_MS));
    }

    const task = board.tasks.find((item) => item.id === taskId);
    if (!task) {
      return throwError(() => new Error('Задача не найдена')).pipe(delay(LATENCY_MS));
    }

    const text = payload.text.trim();
    if (!text) {
      return throwError(() => new Error('Комментарий не может быть пустым')).pipe(
        delay(LATENCY_MS),
      );
    }

    const author = board.members.find((member) => member.id === CURRENT_USER_ID);
    const updated: KanbanTask = {
      ...task,
      comments: [
        ...task.comments,
        {
          id: `c-${Date.now()}`,
          authorId: CURRENT_USER_ID,
          authorName: author?.fullName ?? 'Пользователь',
          text,
          createdAtLabel: 'только что',
        },
      ],
    };

    this.taskBoards = this.taskBoards.map((item) =>
      item.id === boardId
        ? {
            ...item,
            tasks: item.tasks.map((boardTask) =>
              boardTask.id === taskId ? updated : boardTask,
            ),
          }
        : item,
    );

    return of(cloneTask(updated)).pipe(delay(LATENCY_MS));
  }
}
