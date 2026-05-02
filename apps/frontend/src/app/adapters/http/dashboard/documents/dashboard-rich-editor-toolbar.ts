export type DashboardEditorToolbarControlKey =
  | 'history'
  | 'textStyle'
  | 'heading'
  | 'list'
  | 'align'
  | 'link'
  | 'table'
  | 'image'
  | 'clearFormatting';

export type DashboardEditorToolbarActionId =
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'orderedList'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'alignJustify'
  | 'setLink'
  | 'unsetLink'
  | 'insertTable'
  | 'deleteTable'
  | 'insertImage'
  | 'clearFormatting';

export interface DashboardEditorToolbarAction {
  readonly id: DashboardEditorToolbarActionId;
  readonly label: string;
  readonly controlKey: DashboardEditorToolbarControlKey;
}

export interface DashboardEditorToolbarGroup {
  readonly id: string;
  readonly label: string;
  readonly actionIds: Array<DashboardEditorToolbarActionId>;
}

export const DASHBOARD_EDITOR_TOOLBAR_ACTIONS: Record<DashboardEditorToolbarActionId, DashboardEditorToolbarAction> = {
  undo: { id: 'undo', label: 'Отменить', controlKey: 'history' },
  redo: { id: 'redo', label: 'Повторить', controlKey: 'history' },
  bold: { id: 'bold', label: 'Ж', controlKey: 'textStyle' },
  italic: { id: 'italic', label: 'К', controlKey: 'textStyle' },
  underline: { id: 'underline', label: 'Ч', controlKey: 'textStyle' },
  heading1: { id: 'heading1', label: 'H1', controlKey: 'heading' },
  heading2: { id: 'heading2', label: 'H2', controlKey: 'heading' },
  heading3: { id: 'heading3', label: 'H3', controlKey: 'heading' },
  bulletList: { id: 'bulletList', label: 'Список', controlKey: 'list' },
  orderedList: { id: 'orderedList', label: 'Нумерация', controlKey: 'list' },
  alignLeft: { id: 'alignLeft', label: 'По левому', controlKey: 'align' },
  alignCenter: { id: 'alignCenter', label: 'По центру', controlKey: 'align' },
  alignRight: { id: 'alignRight', label: 'По правому', controlKey: 'align' },
  alignJustify: { id: 'alignJustify', label: 'По ширине', controlKey: 'align' },
  setLink: { id: 'setLink', label: 'Ссылка', controlKey: 'link' },
  unsetLink: { id: 'unsetLink', label: 'Убрать ссылку', controlKey: 'link' },
  insertTable: { id: 'insertTable', label: 'Таблица', controlKey: 'table' },
  deleteTable: { id: 'deleteTable', label: 'Удалить таблицу', controlKey: 'table' },
  insertImage: { id: 'insertImage', label: 'Изображение', controlKey: 'image' },
  clearFormatting: { id: 'clearFormatting', label: 'Очистить формат', controlKey: 'clearFormatting' },
};

export const DASHBOARD_EDITOR_TOOLBAR_GROUPS: Array<DashboardEditorToolbarGroup> = [
  {
    id: 'history',
    label: 'История',
    actionIds: ['undo', 'redo'],
  },
  {
    id: 'text-style',
    label: 'Стиль текста',
    actionIds: ['bold', 'italic', 'underline', 'clearFormatting'],
  },
  {
    id: 'heading',
    label: 'Заголовки',
    actionIds: ['heading1', 'heading2', 'heading3'],
  },
  {
    id: 'lists',
    label: 'Списки',
    actionIds: ['bulletList', 'orderedList'],
  },
  {
    id: 'alignment',
    label: 'Выравнивание',
    actionIds: ['alignLeft', 'alignCenter', 'alignRight', 'alignJustify'],
  },
  {
    id: 'links-and-media',
    label: 'Ссылки и медиа',
    actionIds: ['setLink', 'unsetLink', 'insertImage'],
  },
  {
    id: 'table',
    label: 'Таблицы',
    actionIds: ['insertTable', 'deleteTable'],
  },
];

const CONTROL_ALIASES: Record<DashboardEditorToolbarControlKey, Array<string>> = {
  history: ['history', 'undo', 'redo'],
  textStyle: ['textStyle', 'text-style', 'bold', 'italic', 'underline'],
  heading: ['heading', 'h1', 'h2', 'h3'],
  list: ['list', 'bulletList', 'orderedList'],
  align: ['align', 'textAlign'],
  link: ['link'],
  table: ['table'],
  image: ['image'],
  clearFormatting: ['clearFormatting', 'clear'],
};

const normalizeControl = (value: string): string => value.trim().toLowerCase();

export const isToolbarControlEnabled = (
  enabledControls: Array<string>,
  disabledControls: Array<string>,
  controlKey: DashboardEditorToolbarControlKey,
): boolean => {
  const aliases = CONTROL_ALIASES[controlKey].map(normalizeControl);
  const enabled = new Set(enabledControls.map(normalizeControl));
  const disabled = new Set(disabledControls.map(normalizeControl));

  const hasExplicitEnablement = enabled.size > 0;
  const isAllowed = !hasExplicitEnablement || aliases.some((alias) => enabled.has(alias));
  const isBlocked = aliases.some((alias) => disabled.has(alias));

  return isAllowed && !isBlocked;
};
