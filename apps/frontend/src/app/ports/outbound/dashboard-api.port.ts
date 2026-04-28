import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActivityItem,
  DashboardEditDocumentPayload,
  DashboardPreviewDocument,
  DashboardQuery,
  DashboardSummary,
  DocumentItem,
  PaginatedResult,
  StorageUsage,
  WeeklyVolumePoint,
} from '../../domain/dashboard/dashboard.models';

export interface DashboardApiPort {
  getDashboardSummary(query: DashboardQuery): Observable<DashboardSummary>;
  getWeeklyVolume(): Observable<Array<WeeklyVolumePoint>>;
  getDocuments(query: DashboardQuery): Observable<PaginatedResult<DocumentItem>>;
  getActivity(query: DashboardQuery): Observable<Array<ActivityItem>>;
  getStorageUsage(): Observable<StorageUsage>;
  previewDocument(id: string): Observable<DashboardPreviewDocument>;
  downloadDocument(id: string): Observable<void>;
  updateDocument(id: string, payload: DashboardEditDocumentPayload): Observable<DocumentItem>;
}

export const DASHBOARD_API_PORT = new InjectionToken<DashboardApiPort>(
  'DASHBOARD_API_PORT',
);
