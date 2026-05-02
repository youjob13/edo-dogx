import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
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

@Component({
  selector: 'edo-dogx-dashboard-document-edit',
  imports: [ReactiveFormsModule, PageSectionComponent, CardComponent, InputComponent, ButtonComponent],
  templateUrl: './dashboard-document-edit.component.html',
  styleUrl: './dashboard-document-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardDocumentEditComponent implements UnsavedChangesAware, AfterViewInit, OnDestroy {
  private readonly useCases = inject(DashboardUseCases);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  @ViewChild('editorHost') private editorHost?: ElementRef<HTMLDivElement>;
  private editor: Editor | null = null;

  protected readonly titleControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(300)],
  });
  protected readonly statusControl = new FormControl<DashboardDocumentStatus>('pending', {
    nonNullable: true,
  });

  protected readonly loading = signal(false);
  protected readonly message = signal('');
  protected readonly documentId = signal<string>('');
  protected readonly version = signal<number>(1);
  protected readonly activeControls = signal<Array<string>>([]);
  protected readonly exportLoading = signal(false);
  protected readonly exportRequestId = signal<string>('');
  protected readonly exportStatus = signal<DashboardExportStatus | null>(null);
  protected readonly exportFormat = signal<DashboardExportFormat>('PDF');
  protected readonly exportMessage = signal('');
  private initialContent: DashboardRichContentDocument = {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  };

  constructor() {
    const documentId = this.route.snapshot.paramMap.get('id') ?? '';
    this.documentId.set(documentId);
    if (documentId) {
      this.loadDocument(documentId);
    }
  }

  public ngAfterViewInit(): void {
    this.useCases
      .getEditorControlProfile('CATEGORY', 'GENERAL')
      .pipe(take(1))
      .subscribe({
        next: (profile) => this.initializeEditor(profile),
        error: () =>
          this.initializeEditor({
            id: 'fallback',
            contextType: 'CATEGORY',
            contextKey: 'GENERAL',
            enabledControls: ['bold', 'italic', 'heading', 'list', 'table', 'link', 'image'],
            disabledControls: [],
            isActive: true,
            updatedByUserId: 'system',
            updatedAt: new Date().toISOString(),
          }),
      });
  }

  public ngOnDestroy(): void {
    this.editor?.destroy();
    this.editor = null;
  }

  public hasUnsavedChanges(): boolean {
    return this.titleControl.dirty || this.statusControl.dirty || this.editor?.isEmpty === false;
  }

  protected runToolbarAction(action: 'bold' | 'italic' | 'heading' | 'bulletList' | 'orderedList'): void {
    if (!this.editor) {
      return;
    }

    const chain = this.editor.chain().focus();
    if (action === 'bold') {
      chain.toggleBold().run();
      return;
    }
    if (action === 'italic') {
      chain.toggleItalic().run();
      return;
    }
    if (action === 'heading') {
      chain.toggleHeading({ level: 2 }).run();
      return;
    }
    if (action === 'bulletList') {
      chain.toggleBulletList().run();
      return;
    }
    chain.toggleOrderedList().run();
  }

  protected saveDocument(): void {
    if (this.titleControl.invalid || !this.documentId()) {
      this.titleControl.markAsTouched();
      return;
    }

    this.loading.set(true);
    this.message.set('');

    this.useCases
      .updateDraft(this.documentId(), {
        filename: this.titleControl.value.trim(),
        status: this.statusControl.value,
        contentDocument: this.editor?.getJSON() as DashboardRichContentDocument,
        expectedVersion: this.version(),
      })
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: () => {
          this.version.update((value) => value + 1);
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

  protected requestExport(format: DashboardExportFormat): void {
    if (!this.documentId()) {
      return;
    }

    this.exportLoading.set(true);
    this.exportMessage.set('');
    this.exportFormat.set(format);

    this.useCases
      .createExportRequest(this.documentId(), {
        format,
        sourceVersion: this.version(),
      })
      .pipe(
        take(1),
        finalize(() => this.exportLoading.set(false)),
      )
      .subscribe({
        next: (request) => {
          this.exportRequestId.set(request.id);
          this.exportStatus.set(request.status);
          this.exportMessage.set('Экспорт запрошен. Файл готовится к скачиванию.');
          this.refreshExportStatus();
        },
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Не удалось запустить экспорт';
          this.exportMessage.set(message);
        },
      });
  }

  protected refreshExportStatus(): void {
    if (!this.documentId() || !this.exportRequestId()) {
      return;
    }

    this.exportLoading.set(true);
    this.useCases
      .getExportRequest(this.documentId(), this.exportRequestId())
      .pipe(
        take(1),
        finalize(() => this.exportLoading.set(false)),
      )
      .subscribe({
        next: (request) => {
          this.exportStatus.set(request.status);
          if (request.status === 'SUCCEEDED') {
            this.exportMessage.set('Экспорт завершен. Нажмите кнопку скачивания.');
            return;
          }
          if (request.status === 'FAILED') {
            this.exportMessage.set(request.errorMessage ?? 'Экспорт завершился с ошибкой.');
            return;
          }
          this.exportMessage.set('Экспорт в обработке. Обновите статус через несколько секунд.');
        },
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Не удалось обновить статус экспорта';
          this.exportMessage.set(message);
        },
      });
  }

  protected downloadExport(): void {
    if (!this.documentId() || !this.exportRequestId() || this.exportStatus() !== 'SUCCEEDED') {
      return;
    }

    this.exportLoading.set(true);
    this.useCases
      .downloadExportArtifact(this.documentId(), this.exportRequestId())
      .pipe(
        take(1),
        finalize(() => this.exportLoading.set(false)),
      )
      .subscribe({
        next: () => this.exportMessage.set('Файл скачан.'),
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Не удалось скачать файл';
          this.exportMessage.set(message);
        },
      });
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

  private loadDocument(documentId: string): void {
    this.loading.set(true);

    this.useCases
      .getDocumentById(documentId)
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (document) => {
          this.titleControl.setValue(document.title, { emitEvent: false });
          this.statusControl.setValue(document.status, { emitEvent: false });
          this.version.set(document.version);
          this.initialContent = document.contentDocument ?? {
            type: 'doc',
            content: [{ type: 'paragraph' }],
          };
          this.editor?.commands.setContent(this.initialContent);
          this.titleControl.markAsPristine();
          this.statusControl.markAsPristine();
        },
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Не удалось загрузить документ';
          this.message.set(message);
        },
      });
  }

  private initializeEditor(profile: DashboardEditorControlProfile): void {
    this.activeControls.set(profile.enabledControls);
    if (!this.editorHost?.nativeElement) {
      return;
    }

    this.editor = new Editor({
      element: this.editorHost.nativeElement,
      extensions: [StarterKit],
      content: this.initialContent,
      editorProps: {
        attributes: {
          class: 'dashboard-rich-editor__content',
          'aria-label': 'Поле редактирования содержимого документа',
        },
      },
    });
  }
}
