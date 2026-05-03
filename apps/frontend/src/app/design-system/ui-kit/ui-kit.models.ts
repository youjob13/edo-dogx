export type UiKitChipTone =
  | 'success'
  | 'warning'
  | 'draft'
  | 'error'
  | 'finalized'
  | 'in_review'
  | 'archived'
  | 'pending';

export type UiKitIconName =
  | 'dashboard'
  | 'documents'
  | 'tasks'
  | 'archive'
  | 'settings'
  | 'search'
  | 'upload'
  | 'notifications'
  | 'history'
  | 'account'
  | 'add'
  | 'more'
  | 'download'
  | 'edit'
  | 'preview'
  | 'warning'
  | 'success'
  | 'pending'
  | 'file'
  | 'spreadsheet'
  | 'image';

export interface UiKitTableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
}

export type UiKitSortDirection = 'asc' | 'desc';

export interface UiKitSortState {
  key: string;
  direction: UiKitSortDirection;
}

export interface UiKitPaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
}

export interface UiKitNavItem {
  label: string;
  route: string;
  icon: UiKitIconName;
}

export interface UiKitChartBar {
  label: string;
  value: number;
  highlighted?: boolean;
}

export interface UiKitActivityItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  icon?: UiKitIconName;
  tone?: UiKitChipTone;
}

export interface UiKitDropdownItem {
  id: string;
  label: string;
  icon?: UiKitIconName;
  danger?: boolean;
}

export type UiKitButtonAppearance = 'primary' | 'secondary' | 'tertiary';
export type UiKitButtonSize = 's' | 'm' | 'l';
