import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, PLATFORM_ID, OnDestroy, inject, signal, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Editor } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { TableKit} from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { finalize, take } from 'rxjs';
import { DashboardUseCases } from '../../../../application/dashboard/dashboard.use-cases';
import {
  DashboardDocumentStatus,
  DashboardEditorControlProfile,
  DashboardExportFormat,
  DashboardExportStatus,
  DashboardRichContentDocument,
} from '../../../../domain/dashboard/dashboard.models';
import { ButtonComponent, CardComponent, InputComponent, PageSectionComponent } from '../../../../design-system/ui-kit';
import { UnsavedChangesAware } from '../../../../guards/unsaved-changes.guard';
import {
  Action,
  DASHBOARD_EDITOR_TOOLBAR_ACTIONS,
  DashboardEditorToolbarActionId,
} from './dashboard-rich-editor-toolbar';
import { DocumentUseCases } from '../../../../application/dashboard/document.use-cases';
import Placeholder from '@tiptap/extension-placeholder';

@Component({
  selector: 'edo-dogx-dashboard-document-edit',
  encapsulation: ViewEncapsulation.None,
  imports: [ReactiveFormsModule, PageSectionComponent, CardComponent, InputComponent, ButtonComponent, TiptapEditorDirective],
  templateUrl: './dashboard-document-edit.component.html',
  styleUrl: './dashboard-document-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardDocumentEditComponent implements UnsavedChangesAware, AfterViewInit, OnDestroy {
  private readonly useCases = inject(DashboardUseCases);
  private readonly documentUseCases = inject(DocumentUseCases);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  protected editor: Editor | null = null;

  protected readonly titleControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(300)],
  });
  protected readonly statusControl = new FormControl<DashboardDocumentStatus>('DRAFT', {
    nonNullable: true,
  });

  protected readonly loading = signal(false);
  protected readonly message = signal('');
  protected readonly documentId = signal<string>('');
  protected readonly version = signal<number>(1);
  protected readonly activeControls = signal<Array<string>>([]);
  protected readonly disabledControls = signal<Array<string>>([]);
  // protected readonly toolbarGroups = DASHBOARD_EDITOR_TOOLBAR_GROUPS;
  protected readonly exportLoading = signal(false);
  protected readonly exportRequestId = signal<string>('');
  protected readonly exportStatus = signal<DashboardExportStatus | null>(null);
  protected readonly exportFormatControl = new FormControl<DashboardExportFormat>('PDF', {
    nonNullable: true,
  });
  protected readonly exportMessage = signal('');
  protected readonly category = signal<'HR' | 'FINANCE' | 'GENERAL'>('GENERAL');
  private exportPollTimer: ReturnType<typeof setTimeout> | null = null;
  private initialContent: DashboardRichContentDocument = {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  };
  private initialEditorSnapshot = JSON.stringify(this.initialContent);

  toolbarGroups = [
    { id: 'text', actionIds: ['bold', 'italic', 'underline'] },
    { id: 'headings', actionIds: ['heading1', 'heading2'] },
    { id: 'list', actionIds: ['bulletList'] },
    { id: 'align', actionIds: ['alignLeft', 'alignCenter'] },
    { id: 'insert', actionIds: ['setLink', 'insertTable', 'insertImage'] },
    { id: 'table', actionIds: ['addRowAfter', 'addColumnAfter', 'deleteTable'] },
  ];

   actions: Record<Action, { icon: string }> = {
      bold: { icon: 'B' },
      italic: { icon: 'I' },
      underline: { icon: 'U' },
  
      heading1: { icon: 'H1' },
      heading2: { icon: 'H2' },
  
      bulletList: { icon: '•' },
  
      alignLeft: { icon: '⟸' },
      alignCenter: { icon: '≡' },
  
      setLink: { icon: '🔗' },
  
      insertTable: { icon: '▦' },
      insertImage: { icon: '🖼️' },
  
      addRowAfter: { icon: '↓' },
      addColumnAfter: { icon: '→' },
      deleteTable: { icon: '✕' },
    };

  constructor() {
    const documentId = this.route.snapshot.paramMap.get('id') ?? '';
    const autoOpenExport = this.route.snapshot.queryParamMap.get('autoOpenExport') === '1';
    this.documentId.set(documentId);

    if (documentId) {
      this.loadDocument(documentId);
    }

    if (autoOpenExport) {
      this.exportMessage.set('Черновик создан. Сохраните изменения при необходимости и экспортируйте в PDF или DOCX.');
    }
  }
  
  getAction(action: string | Action) {
    return this.actions[action as keyof typeof this.actions]
  }

  public ngAfterViewInit(): void {
    if (!this.isBrowser) {
      return;
    }

    if (!this.isBrowser) {
      return;
    }

    this.editor = new Editor({
      extensions: [
        StarterKit,
        Underline,
        Link.configure({ openOnClick: false }),
        Image,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        TableKit.configure({ table: { resizable: true, HTMLAttributes: {} }, tableHeader: { HTMLAttributes: { class: 'table-header' } }, tableCell: { HTMLAttributes: { class: 'table-cell' } } }),
        Placeholder.configure({
          placeholder: 'Start writing your document...',
        }),
      ],
      content: {
        type: 'doc',
        content: [{ type: 'paragraph' }],
      },
    });
    
    this.loadEditorControlProfile(this.category());
  }

  public ngOnDestroy(): void {
    this.clearExportPollTimer();
    this.editor?.destroy();
    this.editor = null;
  }

  public hasUnsavedChanges(): boolean {
    const snapshot = this.editor ? JSON.stringify(this.editor.getJSON()) : this.initialEditorSnapshot;
    return this.titleControl.dirty || this.statusControl.dirty || snapshot !== this.initialEditorSnapshot;
  }

  protected getToolbarLabel(actionId: DashboardEditorToolbarActionId): string {
    return DASHBOARD_EDITOR_TOOLBAR_ACTIONS[actionId].label;
  }

  // protected isToolbarActionEnabled(actionId: DashboardEditorToolbarActionId): boolean {
  //   const action = DASHBOARD_EDITOR_TOOLBAR_ACTIONS[actionId];
  //   return isToolbarControlEnabled(this.activeControls(), this.disabledControls(), action.controlKey);
  // }

  // protected isToolbarActionActive(actionId: DashboardEditorToolbarActionId): boolean {
  //   if (!this.editor) {
  //     return false;
  //   }

  //   if (actionId === 'bold') {
  //     return this.editor.isActive('bold');
  //   }
  //   if (actionId === 'italic') {
  //     return this.editor.isActive('italic');
  //   }
  //   if (actionId === 'underline') {
  //     return this.editor.isActive('underline');
  //   }
  //   if (actionId === 'heading1') {
  //     return this.editor.isActive('heading', { level: 1 });
  //   }
  //   if (actionId === 'heading2') {
  //     return this.editor.isActive('heading', { level: 2 });
  //   }
  //   if (actionId === 'heading3') {
  //     return this.editor.isActive('heading', { level: 3 });
  //   }
  //   if (actionId === 'bulletList') {
  //     return this.editor.isActive('bulletList');
  //   }
  //   if (actionId === 'orderedList') {
  //     return this.editor.isActive('orderedList');
  //   }
  //   if (actionId === 'alignLeft') {
  //     return this.editor.isActive({ textAlign: 'left' });
  //   }
  //   if (actionId === 'alignCenter') {
  //     return this.editor.isActive({ textAlign: 'center' });
  //   }
  //   if (actionId === 'alignRight') {
  //     return this.editor.isActive({ textAlign: 'right' });
  //   }
  //   if (actionId === 'alignJustify') {
  //     return this.editor.isActive({ textAlign: 'justify' });
  //   }
  //   if (actionId === 'setLink' || actionId === 'unsetLink') {
  //     return this.editor.isActive('link');
  //   }
  //   if (actionId === 'insertTable' || actionId === 'deleteTable') {
  //     return this.editor.isActive('table');
  //   }

  //   return false;
  // }

  // protected runToolbarAction(action: DashboardEditorToolbarActionId): void {
  //   if (!this.editor || !this.isToolbarActionEnabled(action)) {
  //     return;
  //   }

  //   const chain = this.editor.chain().focus();
  //   if (action === 'undo') {
  //     chain.undo().run();
  //     return;
  //   }
  //   if (action === 'redo') {
  //     chain.redo().run();
  //     return;
  //   }
  //   if (action === 'bold') {
  //     chain.toggleBold().run();
  //     return;
  //   }
  //   if (action === 'italic') {
  //     chain.toggleItalic().run();
  //     return;
  //   }
  //   if (action === 'underline') {
  //     chain.toggleUnderline().run();
  //     return;
  //   }
  //   if (action === 'heading1') {
  //     chain.toggleHeading({ level: 1 }).run();
  //     return;
  //   }
  //   if (action === 'heading2') {
  //     chain.toggleHeading({ level: 2 }).run();
  //     return;
  //   }
  //   if (action === 'heading3') {
  //     chain.toggleHeading({ level: 3 }).run();
  //     return;
  //   }
  //   if (action === 'bulletList') {
  //     chain.toggleBulletList().run();
  //     return;
  //   }
  //   if (action === 'orderedList') {
  //     chain.toggleOrderedList().run();
  //     return;
  //   }
  //   if (action === 'alignLeft') {
  //     chain.setTextAlign('left').run();
  //     return;
  //   }
  //   if (action === 'alignCenter') {
  //     chain.setTextAlign('center').run();
  //     return;
  //   }
  //   if (action === 'alignRight') {
  //     chain.setTextAlign('right').run();
  //     return;
  //   }
  //   if (action === 'alignJustify') {
  //     chain.setTextAlign('justify').run();
  //     return;
  //   }
  //   if (action === 'setLink') {
  //     const href = this.promptForUrl('Укажите URL ссылки');
  //     if (!href) {
  //       return;
  //     }
  //     chain.extendMarkRange('link').setLink({ href }).run();
  //     return;
  //   }
  //   if (action === 'unsetLink') {
  //     chain.extendMarkRange('link').unsetLink().run();
  //     return;
  //   }
  //   if (action === 'insertTable') {
  //     chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  //     return;
  //   }
  //   if (action === 'deleteTable') {
  //     chain.deleteTable().run();
  //     return;
  //   }
  //   if (action === 'insertImage') {
  //     const src = this.promptForUrl('Укажите URL изображения');
  //     if (!src) {
  //       return;
  //     }
  //     chain.setImage({ src, alt: 'Изображение документа' }).run();
  //     return;
  //   }

  //   chain.unsetAllMarks().clearNodes().run();
  // }

  protected saveDocument(): void {
    if (this.titleControl.invalid || !this.documentId()) {
      this.titleControl.markAsTouched();
      return;
    }

    this.loading.set(true);
    this.message.set('');

    this.documentUseCases
      .updateDocument(this.documentId(), {
        title: this.titleControl.value.trim(),
        status: this.statusControl.value,
        contentDocument: this.editor?.getJSON() as DashboardRichContentDocument,
        expectedVersion: this.version(),
      })
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (updatedDocument) => {
          if (updatedDocument.version !== undefined) {
            this.version.set(updatedDocument.version);
          } else {
            this.version.update((value) => value + 1);
          }
          this.initialEditorSnapshot = this.editor
            ? JSON.stringify(this.editor.getJSON())
            : this.initialEditorSnapshot;
          this.titleControl.markAsPristine();
          this.statusControl.markAsPristine();
          this.message.set('Изменения сохранены.');
        },
        error: (error: unknown) => {
          const conflict = this.useCases.parseConflictError(error);
          if (conflict) {
            this.message.set('Документ изменился в другой сессии. Обновите страницу и попробуйте снова.');
            return;
          }
          const errMessage = error instanceof Error ? error.message : 'Не удалось сохранить изменения';
          this.message.set(errMessage);
        },
      });
  }

  protected goBack(): void {
    this.router.navigate(['/dashboard/documents']);
  }

  protected downloadSelectedFormat(): void {
    if (!this.documentId()) {
      return;
    }

    const format = this.exportFormatControl.value;
    this.clearExportPollTimer();
    this.exportLoading.set(true);
    this.exportRequestId.set('');
    this.exportStatus.set(null);
    this.exportMessage.set(`Готовим ${format}. Скачивание начнется автоматически.`);

    this.documentUseCases
      .createExportRequest(this.documentId(), {
        format,
        sourceVersion: this.version(),
      })
      .pipe(
        take(1),
      )
      .subscribe({
        next: (request) => {
          this.exportRequestId.set(request.id);
          this.exportStatus.set(request.status);
          this.handleExportStatus(request.status, request.errorMessage);
        },
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Не удалось запустить экспорт';
          this.exportMessage.set(message);
          this.exportLoading.set(false);
        },
      });
  }

  private refreshExportStatus(): void {
    if (!this.documentId() || !this.exportRequestId()) {
      return;
    }

    this.documentUseCases
      .getExportRequest(this.documentId(), this.exportRequestId())
      .pipe(take(1))
      .subscribe({
        next: (request) => {
          this.exportStatus.set(request.status);
          this.handleExportStatus(request.status, request.errorMessage);
        },
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Не удалось обновить статус экспорта';
          this.exportMessage.set(message);
          this.exportLoading.set(false);
        },
      });
  }

  private downloadExport(): void {
    if (!this.documentId() || !this.exportRequestId() || this.exportStatus() !== 'SUCCEEDED') {
      return;
    }

    if (!this.isBrowser) {
      return;
    }

    const downloadUrl = `/api/documents/${this.documentId()}/exports/${this.exportRequestId()}/download`;
    const link = globalThis.document.createElement('a');
    link.href = downloadUrl;
    link.download = '';
    link.rel = 'noopener';
    globalThis.document.body.append(link);
    link.click();
    link.remove();
    this.exportMessage.set('Файл готов. Скачивание началось.');
    this.exportLoading.set(false);
  }

  protected exportStatusLabel(): string {
    const status = this.exportStatus();
    if (status === 'QUEUED') {
      return 'В очереди';
    }
    if (status === 'RUNNING') {
      return 'Выполняется';
    }
    if (status === 'SUCCEEDED') {
      return 'Успешно';
    }
    if (status === 'FAILED') {
      return 'Ошибка';
    }
    return 'Не запускался';
  }

  private handleExportStatus(status: DashboardExportStatus, errorMessage?: string): void {
    if (status === 'SUCCEEDED') {
      this.downloadExport();
      return;
    }

    if (status === 'FAILED') {
      this.exportMessage.set(errorMessage ?? 'Экспорт завершился с ошибкой.');
      this.exportLoading.set(false);
      return;
    }

    this.exportMessage.set(`Готовим ${this.exportFormatControl.value}. Скачивание начнется автоматически.`);
    this.exportPollTimer = setTimeout(() => this.refreshExportStatus(), 1500);
  }

  private clearExportPollTimer(): void {
    if (this.exportPollTimer) {
      clearTimeout(this.exportPollTimer);
      this.exportPollTimer = null;
    }
  }

  private loadDocument(documentId: string): void {
    this.loading.set(true);

    this.documentUseCases
      .getDocumentById(documentId)
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (document) => {
          this.titleControl.setValue(document.title, { emitEvent: false });
          this.statusControl.setValue(document.status, { emitEvent: false });
          this.category.set(document.category);
          this.version.set(document.version);
          this.initialContent = document.contentDocument ?? {
            type: 'doc',
            content: [{ type: 'paragraph' }],
          };
          this.initialEditorSnapshot = JSON.stringify(this.initialContent);
          this.editor?.commands.setContent(this.initialContent);
          this.loadEditorControlProfile(document.category);
          this.titleControl.markAsPristine();
          this.statusControl.markAsPristine();
        },
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Не удалось загрузить документ';
          this.message.set(message);
        },
      });
  }

  private loadEditorControlProfile(category: 'HR' | 'FINANCE' | 'GENERAL'): void {
    this.documentUseCases
      .getEditorControlProfile('CATEGORY', category)
      .pipe(take(1))
      .subscribe({
        next: (profile) => this.applyControlProfile(profile),
        error: () =>
          this.applyControlProfile({
            id: 'fallback',
            contextType: 'CATEGORY',
            contextKey: category,
            enabledControls: ['history', 'bold', 'italic', 'underline', 'heading', 'list', 'align', 'table', 'link', 'image', 'clearFormatting'],
            disabledControls: [],
            isActive: true,
            updatedByUserId: 'system',
            updatedAt: new Date().toISOString(),
          }),
      });
  }

  private applyControlProfile(profile: DashboardEditorControlProfile): void {
    this.activeControls.set(Array.isArray(profile.enabledControls) ? profile.enabledControls : []);
    this.disabledControls.set(Array.isArray(profile.disabledControls) ? profile.disabledControls : []);
  }

  // private initializeEditor(): void {
  //   if (this.editor) {
  //     return;
  //   }

  //   this.editor = new Editor({
  //     extensions: [
  //       StarterKit.configure({
  //         heading: {
  //           levels: [1, 2, 3],
  //         },
  //       }),
  //       Underline,
  //       Link.configure({
  //         openOnClick: false,
  //         autolink: true,
  //         linkOnPaste: true,
  //       }),
  //       Image,
  //       Table.configure({
  //         resizable: true,
  //       }),
  //       TableRow,
  //       TableHeader,
  //       TableCell,
  //       TextAlign.configure({
  //         types: ['heading', 'paragraph'],
  //       }),
  //     ],
  //     content: this.initialContent,
  //     editorProps: {
  //       attributes: {
  //         class: 'dashboard-rich-editor__content',
  //         'aria-label': 'Поле редактирования содержимого документа',
  //       },
  //     },
  //   });
  // }

  private promptForUrl(message: string): string | null {
    if (!this.isBrowser || typeof globalThis.prompt !== 'function') {
      return null;
    }

    const value = globalThis.prompt(message)?.trim() ?? '';
    return value.length > 0 ? value : null;
  }

    run(action: string | Action) {
    const chain = this.editor!.chain().focus();

    switch (action) {
      case 'bold': return chain.toggleBold().run();
      case 'italic': return chain.toggleItalic().run();
      case 'underline': return chain.toggleUnderline().run();

      case 'heading1': return chain.toggleHeading({ level: 1 }).run();
      case 'heading2': return chain.toggleHeading({ level: 2 }).run();

      case 'bulletList': return chain.toggleBulletList().run();

      case 'alignLeft': return chain.setTextAlign('left').run();
      case 'alignCenter': return chain.setTextAlign('center').run();

      case 'setLink': {
        const url = prompt('Enter URL');
        if (url) chain.setLink({ href: url }).run();
        return;
      }

      case 'insertTable':
        return chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();

      case 'insertImage': {
        const src = this.promptForUrl('Укажите URL изображения');
        if (!src) {
          return;
        }
        chain.setImage({ src, alt: 'Изображение документа' }).run();
        return;
      }

      case 'addRowAfter': return chain.addRowAfter().run();
      case 'addColumnAfter': return chain.addColumnAfter().run();
      case 'deleteTable': return chain.deleteTable().run();
    }

    return
  }

  isActive(action: string | Action): boolean {
    if (!this.editor) {
      return false;
    }

    switch (action) {
      case 'bold': return this.editor.isActive('bold');
      case 'italic': return this.editor.isActive('italic');
      case 'underline': return this.editor.isActive('underline');
      case 'heading1': return this.editor.isActive('heading', { level: 1 });
      case 'heading2': return this.editor.isActive('heading', { level: 2 });
      case 'bulletList': return this.editor.isActive('bulletList');
      case 'alignLeft': return this.editor.isActive({ textAlign: 'left' });
      case 'alignCenter': return this.editor.isActive({ textAlign: 'center' });
      default: return false;
    }
  }

  shouldShowAction(action: string | Action): boolean {
    const isTable = this.editor?.isActive('table');

    const tableActions = ['addRowAfter', 'addColumnAfter', 'deleteTable'];

    if (tableActions.includes(action)) {
      return isTable!;
    }

    return true;
  }
}
