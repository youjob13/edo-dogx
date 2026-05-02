import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { finalize, take } from 'rxjs';
import { ButtonComponent, CardComponent, InputComponent, PageSectionComponent } from '../../../../design-system/ui-kit';
import { DashboardUseCases } from '../../../../application/dashboard/dashboard.use-cases';
import { DashboardEditorControlProfile, DashboardRichContentDocument } from '../../../../domain/dashboard/dashboard.models';

@Component({
  selector: 'edo-dogx-dashboard-document-create',
  imports: [ReactiveFormsModule, PageSectionComponent, CardComponent, InputComponent, ButtonComponent],
  templateUrl: './dashboard-document-create.component.html',
  styleUrl: './dashboard-document-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardDocumentCreateComponent implements AfterViewInit, OnDestroy {
  private readonly useCases = inject(DashboardUseCases);
  private readonly router = inject(Router);
  @ViewChild('editorHost') private editorHost?: ElementRef<HTMLDivElement>;
  private editor: Editor | null = null;

  protected readonly titleControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(300)],
  });

  protected readonly categoryControl = new FormControl<'HR' | 'FINANCE' | 'GENERAL'>('GENERAL', {
    nonNullable: true,
  });

  protected readonly loading = signal(false);
  protected readonly message = signal('');
  protected readonly activeControls = signal<Array<string>>([]);

  public ngAfterViewInit(): void {
    this.useCases
      .getEditorControlProfile('CATEGORY', this.categoryControl.value)
      .pipe(take(1))
      .subscribe({
        next: (profile) => this.initializeEditor(profile),
        error: () =>
          this.initializeEditor({
            id: 'fallback',
            contextType: 'CATEGORY',
            contextKey: this.categoryControl.value,
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

  protected createDocument(): void {
    if (this.titleControl.invalid) {
      this.titleControl.markAsTouched();
      return;
    }

    const contentDocument = this.editor?.getJSON() as DashboardRichContentDocument | undefined;
    const hasContent = Array.isArray(contentDocument?.content) && contentDocument.content.length > 0;
    if (!hasContent) {
      this.message.set('Добавьте содержимое документа перед сохранением.');
      return;
    }

    this.loading.set(true);
    this.message.set('');

    this.useCases
      .createDocument({
        title: this.titleControl.value.trim(),
        category: this.categoryControl.value,
        contentDocument,
      })
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (document) => {
          this.message.set('Черновик создан.');
          this.router.navigate(['/dashboard/documents', document.id, 'edit']);
        },
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Не удалось создать документ';
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
      content: {
        type: 'doc',
        content: [{ type: 'paragraph' }],
      },
      editorProps: {
        attributes: {
          class: 'dashboard-rich-editor__content',
          'aria-label': 'Поле ввода содержимого документа',
        },
      },
    });
  }
}
