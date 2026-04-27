import { Injectable } from '@angular/core';
import { Observable, delay, map, of, throwError } from 'rxjs';
import {
  ActivityItem,
  DashboardDocumentStatus,
  DashboardDocumentType,
  DashboardEditDocumentPayload,
  DashboardPreviewDocument,
  DashboardQuery,
  DashboardSummary,
  DocumentItem,
  PaginatedResult,
  StorageUsage,
  WeeklyVolumePoint,
} from '../../domain/dashboard/dashboard.models';
import { DashboardApiPort } from '../../ports/outbound/dashboard-api.port';

const LATENCY_MS = 180;

const MOCK_WEEKLY_VOLUME: ReadonlyArray<WeeklyVolumePoint> = [
  { day: 'mon', value: 22 },
  { day: 'tue', value: 45 },
  { day: 'wed', value: 30 },
  { day: 'thu', value: 80 },
  { day: 'fri', value: 100 },
  { day: 'sat', value: 63 },
  { day: 'sun', value: 40 },
];

const MOCK_ACTIVITY: ReadonlyArray<ActivityItem> = [
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

@Injectable({ providedIn: 'root' })
export class DashboardMockHttpAdapter implements DashboardApiPort {
  private documents = mockDocumentsSeed();

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

  public getWeeklyVolume(): Observable<ReadonlyArray<WeeklyVolumePoint>> {
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

  public getActivity(query: DashboardQuery): Observable<ReadonlyArray<ActivityItem>> {
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

  public updateDocument(
    id: string,
    payload: DashboardEditDocumentPayload,
  ): Observable<DocumentItem> {
    const current = this.documents.find((item) => item.id === id);

    if (!current) {
      return throwError(() => new Error('Документ для обновления не найден')).pipe(
        delay(LATENCY_MS),
      );
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

    return of(updated).pipe(delay(LATENCY_MS));
  }
}
