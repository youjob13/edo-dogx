import { HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  OnDestroy,
  computed,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Editor } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { finalize, take } from 'rxjs';
import { AuthSessionStore } from '../../../../application/auth-session.store';
import { DocumentUseCases } from '../../../../application/dashboard/document.use-cases';
import { TaskBoardUseCases } from '../../../../application/dashboard/task-board.use-cases';
import {
  DashboardDocumentCapabilities,
  DashboardDocumentCategory,
  DashboardDocumentType,
  DashboardDocumentStatus,
  DashboardEditorControlProfile,
  DashboardExportFormat,
  DashboardExportStatus,
  DashboardRichContentDocument,
  DashboardProduct,
  DashboardWorkflowEvent,
  DashboardWorkflowInstance,
  OrganizationMember,
} from '../../../../domain/dashboard/dashboard.models';
import {
  ButtonComponent,
  CardComponent,
  InputComponent,
  PageSectionComponent,
  StatusChipComponent,
  UiKitChipTone,
} from '../../../../design-system/ui-kit';
import { UnsavedChangesAware } from '../../../../guards/unsaved-changes.guard';
import {
  Action,
  DASHBOARD_EDITOR_TOOLBAR_ACTIONS,
  DashboardEditorToolbarActionId,
} from './dashboard-rich-editor-toolbar';

@Component({
  selector: 'edo-dogx-dashboard-document-edit',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ReactiveFormsModule,
    PageSectionComponent,
    CardComponent,
    InputComponent,
    ButtonComponent,
    StatusChipComponent,
    TiptapEditorDirective,
  ],
  templateUrl: './dashboard-document-edit.component.html',
  styleUrl: './dashboard-document-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardDocumentEditComponent implements UnsavedChangesAware, AfterViewInit, OnDestroy {
  private readonly taskBoardUseCases = inject(TaskBoardUseCases);
  private readonly documentUseCases = inject(DocumentUseCases);
  private readonly authSessionStore = inject(AuthSessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  protected editor: Editor | null = null;

  protected readonly titleControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(300)],
  });
  protected readonly approverControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly decisionCommentControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(1000)],
  });
  protected readonly documentTypeControl = new FormControl<DashboardDocumentType>('GENERAL', {
    nonNullable: true,
  });
  protected readonly productIdControl = new FormControl('', { nonNullable: true });
  protected readonly certificateNumberControl = new FormControl('', { nonNullable: true });
  protected readonly issueDateControl = new FormControl('', { nonNullable: true });
  protected readonly expiryDateControl = new FormControl('', { nonNullable: true });

  protected readonly loading = signal(false);
  protected readonly workflowActionLoading = signal(false);
  protected readonly workflowLoading = signal(false);
  protected readonly message = signal('');
  protected readonly workflowMessage = signal('');
  protected readonly documentId = signal<string>('');
  protected readonly documentStatus = signal<DashboardDocumentStatus>('DRAFT');
  protected readonly version = signal<number>(1);
  protected readonly activeControls = signal<Array<string>>([]);
  protected readonly disabledControls = signal<Array<string>>([]);
  protected readonly exportLoading = signal(false);
  protected readonly exportRequestId = signal<string>('');
  protected readonly exportStatus = signal<DashboardExportStatus | null>(null);
  protected readonly exportFormatControl = new FormControl<DashboardExportFormat>('PDF', {
    nonNullable: true,
  });
  protected readonly exportMessage = signal('');
  protected readonly category = signal<DashboardDocumentCategory>('GENERAL');
  protected readonly workflow = signal<DashboardWorkflowInstance | null>(null);
  protected readonly workflowEvents = signal<Array<DashboardWorkflowEvent>>([]);
  protected readonly approvers = signal<Array<OrganizationMember>>([]);
  protected readonly products = signal<Array<DashboardProduct>>([]);
  protected readonly documentCapabilities = signal<DashboardDocumentCapabilities>({
    canEdit: false,
    canSubmit: false,
    canApprove: false,
    canRequestChanges: false,
    canArchive: false,
  });
  protected readonly currentUser = this.authSessionStore.currentUser;

  protected readonly currentUserId = computed(() => this.currentUser()?.userId ?? '');
  protected readonly effectiveCapabilities = computed<DashboardDocumentCapabilities>(() => {
    const workflow = this.workflow();
    if (workflow) {
      return this.extractCapabilities(workflow);
    }

    return this.documentCapabilities();
  });
  protected readonly isEditable = computed(() => this.effectiveCapabilities().canEdit);
  protected readonly canSubmit = computed(
    () =>
      this.effectiveCapabilities().canSubmit &&
      !this.loading() &&
      !this.workflowActionLoading() &&
      this.approvers().length > 0,
  );
  protected readonly canApprove = computed(
    () => this.effectiveCapabilities().canApprove && !this.workflowActionLoading(),
  );
  protected readonly canRequestChanges = computed(
    () => this.effectiveCapabilities().canRequestChanges && !this.workflowActionLoading(),
  );
  protected readonly canArchive = computed(
    () => this.effectiveCapabilities().canArchive && !this.workflowActionLoading(),
  );

  protected readonly statusLabel = computed(() => this.getStatusLabel(this.documentStatus()));
  protected readonly statusTone = computed(() => this.getStatusTone(this.documentStatus()));

  protected readonly toolbarGroups = [
    { id: 'text', actionIds: ['bold', 'italic', 'underline'] },
    { id: 'headings', actionIds: ['heading1', 'heading2'] },
    { id: 'list', actionIds: ['bulletList'] },
    { id: 'align', actionIds: ['alignLeft', 'alignCenter'] },
    { id: 'insert', actionIds: ['setLink', 'insertTable', 'insertImage'] },
    { id: 'table', actionIds: ['addRowAfter', 'addColumnAfter', 'deleteTable'] },
  ] as const;

  protected readonly actions: Record<Action, { icon: string }> = {
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

  private exportPollTimer: ReturnType<typeof setTimeout> | null = null;
  private initialContent: DashboardRichContentDocument = {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  };
  private initialEditorSnapshot = JSON.stringify(this.initialContent);

  constructor() {
    const documentId = this.route.snapshot.paramMap.get('id') ?? '';
    const autoOpenExport = this.route.snapshot.queryParamMap.get('autoOpenExport') === '1';
    this.documentId.set(documentId);

    if (documentId) {
      this.loadDocument(documentId);
      this.loadWorkflow(documentId);
      this.loadWorkflowEvents(documentId);
      this.loadApprovers();
      this.loadProducts();
    }

    if (autoOpenExport) {
      this.exportMessage.set(
        'Черновик создан. Сохраните изменения при необходимости и экспортируйте в PDF или DOCX.',
      );
    }
  }

  public ngAfterViewInit(): void {
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
        TableKit.configure({
          table: { resizable: true, HTMLAttributes: {} },
          tableHeader: { HTMLAttributes: { class: 'table-header' } },
          tableCell: { HTMLAttributes: { class: 'table-cell' } },
        }),
        Placeholder.configure({
          placeholder: 'Начните вводить текст документа...',
        }),
      ],
      editable: this.isEditable(),
      content: {
        ...this.initialContent,
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
    return this.titleControl.dirty || snapshot !== this.initialEditorSnapshot;
  }

  protected getAction(action: string | Action): { icon: string } {
    return this.actions[action as keyof typeof this.actions];
  }

  protected getToolbarLabel(actionId: DashboardEditorToolbarActionId): string {
    return DASHBOARD_EDITOR_TOOLBAR_ACTIONS[actionId].label;
  }

  protected saveDocument(): void {
    if (!this.isEditable()) {
      this.message.set('Редактирование доступно только для черновика или документа на доработке.');
      return;
    }

    if (this.titleControl.invalid || !this.documentId()) {
      this.titleControl.markAsTouched();
      return;
    }

    this.loading.set(true);
    this.message.set('');

    this.documentUseCases
      .updateDocument(this.documentId(), {
        title: this.titleControl.value.trim(),
        contentDocument: this.editor?.getJSON() as DashboardRichContentDocument,
        expectedVersion: this.version(),
        documentType: this.documentTypeControl.value,
        productId: this.productIdControl.value || undefined,
        productName: this.products().find((product) => product.id === this.productIdControl.value)?.name,
        productModel: this.products().find((product) => product.id === this.productIdControl.value)?.model,
        certificateNumber: this.certificateNumberControl.value || undefined,
        issueDate: this.issueDateControl.value || undefined,
        expiryDate: this.expiryDateControl.value || undefined,
      })
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (updatedDocument) => {
          this.documentStatus.set(updatedDocument.status);
          this.documentCapabilities.set(this.extractCapabilities(updatedDocument));
          if (updatedDocument.version !== undefined) {
            this.version.set(updatedDocument.version);
          } else {
            this.version.update((value) => value + 1);
          }
          this.initialEditorSnapshot = this.editor
            ? JSON.stringify(this.editor.getJSON())
            : this.initialEditorSnapshot;
          this.titleControl.markAsPristine();
          this.message.set('Изменения сохранены.');
        },
        error: (error: unknown) => {
          const conflict = this.documentUseCases.parseConflictError(error);
          if (conflict) {
            this.message.set(
              'Документ изменился в другой сессии. Обновите страницу и попробуйте снова.',
            );
            return;
          }

          const errMessage = error instanceof Error ? error.message : 'Не удалось сохранить изменения';
          this.message.set(errMessage);
        },
      });
  }

  protected submitWorkflow(): void {
    if (!this.canSubmit()) {
      return;
    }

    if (this.approverControl.invalid) {
      this.approverControl.markAsTouched();
      return;
    }

    this.workflowActionLoading.set(true);
    this.workflowMessage.set('');

    this.documentUseCases
      .submitWorkflow(this.documentId(), {
        approverUserId: this.approverControl.value,
        expectedVersion: this.version(),
      })
      .pipe(
        take(1),
        finalize(() => this.workflowActionLoading.set(false)),
      )
      .subscribe({
        next: (workflow) => {
          this.applyWorkflowState(workflow);
          this.loadDocument(this.documentId());
          this.workflowMessage.set('Документ отправлен на согласование.');
          this.loadWorkflowEvents(this.documentId());
        },
        error: (error: unknown) => {
          this.workflowMessage.set(
            error instanceof Error ? error.message : 'Не удалось отправить документ на согласование',
          );
        },
      });
  }

  protected approveWorkflow(): void {
    if (!this.canApprove()) {
      return;
    }

    this.workflowActionLoading.set(true);
    this.workflowMessage.set('');

    this.documentUseCases
      .approveWorkflow(this.documentId(), {
        expectedVersion: this.version(),
      })
      .pipe(
        take(1),
        finalize(() => this.workflowActionLoading.set(false)),
      )
      .subscribe({
        next: (workflow) => {
          this.applyWorkflowState(workflow);
          this.loadDocument(this.documentId());
          this.workflowMessage.set('Документ согласован.');
          this.loadWorkflowEvents(this.documentId());
        },
        error: (error: unknown) => {
          this.workflowMessage.set(
            error instanceof Error ? error.message : 'Не удалось согласовать документ',
          );
        },
      });
  }

  protected requestChanges(): void {
    if (!this.canRequestChanges()) {
      return;
    }

    const comment = this.decisionCommentControl.value.trim();
    if (!comment) {
      this.workflowMessage.set('Добавьте комментарий для автора, чтобы отправить документ на доработку.');
      return;
    }

    this.workflowActionLoading.set(true);
    this.workflowMessage.set('');

    this.documentUseCases
      .requestWorkflowChanges(this.documentId(), {
        comment,
        expectedVersion: this.version(),
      })
      .pipe(
        take(1),
        finalize(() => this.workflowActionLoading.set(false)),
      )
      .subscribe({
        next: (workflow) => {
          this.applyWorkflowState(workflow);
          this.loadDocument(this.documentId());
          this.workflowMessage.set('Запрос на изменения отправлен автору.');
          this.loadWorkflowEvents(this.documentId());
        },
        error: (error: unknown) => {
          this.workflowMessage.set(
            error instanceof Error ? error.message : 'Не удалось отправить документ на доработку',
          );
        },
      });
  }

  protected archiveDocument(): void {
    if (!this.canArchive()) {
      return;
    }

    this.workflowActionLoading.set(true);
    this.workflowMessage.set('');

    this.documentUseCases
      .archiveDocument(this.documentId(), {
        expectedVersion: this.version(),
      })
      .pipe(
        take(1),
        finalize(() => this.workflowActionLoading.set(false)),
      )
      .subscribe({
        next: () => {
          this.loadDocument(this.documentId());
          this.loadWorkflow(this.documentId());
          this.workflowMessage.set('Документ перенесен в архив.');
          this.loadWorkflowEvents(this.documentId());
        },
        error: (error: unknown) => {
          this.workflowMessage.set(
            error instanceof Error ? error.message : 'Не удалось архивировать документ',
          );
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
      .pipe(take(1))
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

  protected getApproverLabel(member: OrganizationMember): string {
    return member.department ? `${member.fullName} (${member.department})` : member.fullName;
  }

  protected getStatusText(status: DashboardDocumentStatus): string {
    return this.getStatusLabel(status);
  }

  protected getStatusChipTone(status: DashboardDocumentStatus): UiKitChipTone {
    return this.getStatusTone(status);
  }

  protected formatEventTitle(event: DashboardWorkflowEvent): string {
    const labels: Record<string, string> = {
      SUBMITTED: 'Отправлен на согласование',
      APPROVED: 'Согласован',
      CHANGES_REQUESTED: 'Отправлен на доработку',
      ARCHIVED: 'Архивирован',
    };

    return labels[event.eventType] ?? event.eventType;
  }

  protected formatDateTime(value: string | undefined): string {
    if (!value) {
      return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  protected run(action: string | Action): void {
    if (!this.editor || !this.isEditable()) {
      return;
    }

    const chain = this.editor.chain().focus();

    switch (action) {
      case 'bold':
        chain.toggleBold().run();
        return;
      case 'italic':
        chain.toggleItalic().run();
        return;
      case 'underline':
        chain.toggleUnderline().run();
        return;
      case 'heading1':
        chain.toggleHeading({ level: 1 }).run();
        return;
      case 'heading2':
        chain.toggleHeading({ level: 2 }).run();
        return;
      case 'bulletList':
        chain.toggleBulletList().run();
        return;
      case 'alignLeft':
        chain.setTextAlign('left').run();
        return;
      case 'alignCenter':
        chain.setTextAlign('center').run();
        return;
      case 'setLink': {
        const url = this.promptForUrl('Введите URL');
        if (url) {
          chain.setLink({ href: url }).run();
        }
        return;
      }
      case 'insertTable':
        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        return;
      case 'insertImage': {
        const src = this.promptForUrl('Укажите URL изображения');
        if (src) {
          chain.setImage({ src, alt: 'Изображение документа' }).run();
        }
        return;
      }
      case 'addRowAfter':
        chain.addRowAfter().run();
        return;
      case 'addColumnAfter':
        chain.addColumnAfter().run();
        return;
      case 'deleteTable':
        chain.deleteTable().run();
        return;
      default:
        return;
    }
  }

  protected isActive(action: string | Action): boolean {
    if (!this.editor) {
      return false;
    }

    switch (action) {
      case 'bold':
        return this.editor.isActive('bold');
      case 'italic':
        return this.editor.isActive('italic');
      case 'underline':
        return this.editor.isActive('underline');
      case 'heading1':
        return this.editor.isActive('heading', { level: 1 });
      case 'heading2':
        return this.editor.isActive('heading', { level: 2 });
      case 'bulletList':
        return this.editor.isActive('bulletList');
      case 'alignLeft':
        return this.editor.isActive({ textAlign: 'left' });
      case 'alignCenter':
        return this.editor.isActive({ textAlign: 'center' });
      default:
        return false;
    }
  }

  protected shouldShowAction(action: string | Action): boolean {
    const isTable = this.editor?.isActive('table');
    const tableActions = ['addRowAfter', 'addColumnAfter', 'deleteTable'];

    if (tableActions.includes(action)) {
      return Boolean(isTable);
    }

    return true;
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
          const message =
            error instanceof Error ? error.message : 'Не удалось обновить статус экспорта';
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

    this.exportMessage.set(
      `Готовим ${this.exportFormatControl.value}. Скачивание начнется автоматически.`,
    );
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
          this.category.set(document.category);
          this.documentTypeControl.setValue(document.documentType ?? 'GENERAL', { emitEvent: false });
          this.productIdControl.setValue(document.productId ?? '', { emitEvent: false });
          this.certificateNumberControl.setValue(document.certificateNumber ?? '', { emitEvent: false });
          this.issueDateControl.setValue(document.issueDate ?? '', { emitEvent: false });
          this.expiryDateControl.setValue(document.expiryDate ?? '', { emitEvent: false });
          this.documentStatus.set(document.status);
          this.documentCapabilities.set(this.extractCapabilities(document));
          this.version.set(document.version);
          this.initialContent = document.contentDocument ?? {
            type: 'doc',
            content: [{ type: 'paragraph' }],
          };
          this.initialEditorSnapshot = JSON.stringify(this.initialContent);
          this.editor?.commands.setContent(this.initialContent);
          this.editor?.setEditable(document.canEdit);
          this.syncDocumentFormEditability(document.canEdit);
          this.loadEditorControlProfile(document.category);
          this.titleControl.markAsPristine();
        },
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Не удалось загрузить документ';
          this.message.set(message);
        },
      });
  }

  private loadProducts(): void {
    this.documentUseCases
      .getProducts()
      .pipe(take(1))
      .subscribe({ next: (items) => this.products.set(items), error: () => this.products.set([]) });
  }

  private loadWorkflow(documentId: string): void {
    this.workflowLoading.set(true);

    this.documentUseCases
      .getWorkflow(documentId)
      .pipe(
        take(1),
        finalize(() => this.workflowLoading.set(false)),
      )
      .subscribe({
        next: (workflow) => {
          this.applyWorkflowState(workflow);
        },
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 404) {
            this.workflow.set(null);
            return;
          }

          this.workflowMessage.set(
            error instanceof Error ? error.message : 'Не удалось загрузить состояние workflow',
          );
        },
      });
  }

  private loadWorkflowEvents(documentId: string): void {
    this.documentUseCases
      .getWorkflowEvents(documentId, { limit: 20, offset: 0 })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.workflowEvents.set(response.items);
        },
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 404) {
            this.workflowEvents.set([]);
            return;
          }

          this.workflowMessage.set(
            error instanceof Error ? error.message : 'Не удалось загрузить историю workflow',
          );
        },
      });
  }

  private loadApprovers(): void {
    this.taskBoardUseCases
      .getOrganizationMembers('org-main')
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          const currentUserId = this.currentUserId();
          const approvers = response.items
            .filter((member) => member.id !== currentUserId)
            .sort((left, right) => left.fullName.localeCompare(right.fullName, 'ru'));
          this.approvers.set(approvers);

          if (!this.approverControl.value && approvers.length > 0) {
            this.approverControl.setValue(approvers[0].id);
          }
        },
        error: () => {
          this.approvers.set([]);
        },
      });
  }

  private applyWorkflowState(workflow: DashboardWorkflowInstance): void {
    this.workflow.set(workflow);
    this.documentStatus.set(workflow.status);
    this.editor?.setEditable(workflow.canEdit);
    this.syncDocumentFormEditability(workflow.canEdit);
    if (workflow.approverUserId && this.approverControl.value !== workflow.approverUserId) {
      this.approverControl.setValue(workflow.approverUserId);
    }
    if (workflow.decisionComment && !this.decisionCommentControl.value) {
      this.decisionCommentControl.setValue(workflow.decisionComment);
    }
  }

  private loadEditorControlProfile(category: DashboardDocumentCategory): void {
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
            enabledControls: [
              'history',
              'bold',
              'italic',
              'underline',
              'heading',
              'list',
              'align',
              'table',
              'link',
              'image',
              'clearFormatting',
            ],
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

  private syncDocumentFormEditability(canEdit: boolean): void {
    const controls = [
      this.titleControl,
      this.documentTypeControl,
      this.productIdControl,
      this.certificateNumberControl,
      this.issueDateControl,
      this.expiryDateControl,
    ];

    for (const control of controls) {
      if (canEdit) {
        control.enable({ emitEvent: false });
      } else {
        control.disable({ emitEvent: false });
      }
    }
  }

  private promptForUrl(message: string): string | null {
    if (!this.isBrowser || typeof globalThis.prompt !== 'function') {
      return null;
    }

    const value = globalThis.prompt(message)?.trim() ?? '';
    return value.length > 0 ? value : null;
  }

  private extractCapabilities(source: DashboardDocumentCapabilities): DashboardDocumentCapabilities {
    return {
      canEdit: source.canEdit,
      canSubmit: source.canSubmit,
      canApprove: source.canApprove,
      canRequestChanges: source.canRequestChanges,
      canArchive: source.canArchive,
    };
  }

  private getStatusLabel(status: DashboardDocumentStatus): string {
    const labels: Record<DashboardDocumentStatus, string> = {
      DRAFT: 'Черновик',
      IN_REVIEW: 'На согласовании',
      CHANGES_REQUESTED: 'На доработке',
      APPROVED: 'Согласован',
      ARCHIVED: 'Архивирован',
    };

    return labels[status];
  }

  private getStatusTone(status: DashboardDocumentStatus): UiKitChipTone {
    const tones: Record<DashboardDocumentStatus, UiKitChipTone> = {
      DRAFT: 'draft',
      IN_REVIEW: 'in_review',
      CHANGES_REQUESTED: 'warning',
      APPROVED: 'approved',
      ARCHIVED: 'archived',
    };

    return tones[status];
  }
}
