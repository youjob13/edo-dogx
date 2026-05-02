import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Editor } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { finalize, take } from 'rxjs';
import { ButtonComponent, CardComponent, InputComponent, PageSectionComponent } from '../../../../design-system/ui-kit';
import { DashboardUseCases } from '../../../../application/dashboard/dashboard.use-cases';
import { DashboardEditorControlProfile, DashboardRichContentDocument } from '../../../../domain/dashboard/dashboard.models';
import {
  DASHBOARD_EDITOR_TOOLBAR_ACTIONS,
  DASHBOARD_EDITOR_TOOLBAR_GROUPS,
  DashboardEditorToolbarActionId,
  isToolbarControlEnabled,
} from './dashboard-rich-editor-toolbar';

@Component({
  selector: 'edo-dogx-dashboard-document-create',
  imports: [ReactiveFormsModule, PageSectionComponent, CardComponent, InputComponent, ButtonComponent, TiptapEditorDirective],
  templateUrl: './dashboard-document-create.component.html',
  styleUrl: './dashboard-document-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardDocumentCreateComponent implements AfterViewInit, OnDestroy {
  private readonly useCases = inject(DashboardUseCases);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  protected editor: Editor | null = null;

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
  protected readonly disabledControls = signal<Array<string>>([]);
  protected readonly toolbarGroups = DASHBOARD_EDITOR_TOOLBAR_GROUPS;

  public ngAfterViewInit(): void {
    if (!this.isBrowser) {
      return;
    }

    this.initializeEditor();
    this.loadEditorControlProfile(this.categoryControl.value);

    this.categoryControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((category) => this.loadEditorControlProfile(category));
  }

  public ngOnDestroy(): void {
    this.editor?.destroy();
    this.editor = null;
  }

  protected getToolbarLabel(actionId: DashboardEditorToolbarActionId): string {
    return DASHBOARD_EDITOR_TOOLBAR_ACTIONS[actionId].label;
  }

  protected isToolbarActionEnabled(actionId: DashboardEditorToolbarActionId): boolean {
    const action = DASHBOARD_EDITOR_TOOLBAR_ACTIONS[actionId];
    return isToolbarControlEnabled(this.activeControls(), this.disabledControls(), action.controlKey);
  }

  protected isToolbarActionActive(actionId: DashboardEditorToolbarActionId): boolean {
    if (!this.editor) {
      return false;
    }

    if (actionId === 'bold') {
      return this.editor.isActive('bold');
    }
    if (actionId === 'italic') {
      return this.editor.isActive('italic');
    }
    if (actionId === 'underline') {
      return this.editor.isActive('underline');
    }
    if (actionId === 'heading1') {
      return this.editor.isActive('heading', { level: 1 });
    }
    if (actionId === 'heading2') {
      return this.editor.isActive('heading', { level: 2 });
    }
    if (actionId === 'heading3') {
      return this.editor.isActive('heading', { level: 3 });
    }
    if (actionId === 'bulletList') {
      return this.editor.isActive('bulletList');
    }
    if (actionId === 'orderedList') {
      return this.editor.isActive('orderedList');
    }
    if (actionId === 'alignLeft') {
      return this.editor.isActive({ textAlign: 'left' });
    }
    if (actionId === 'alignCenter') {
      return this.editor.isActive({ textAlign: 'center' });
    }
    if (actionId === 'alignRight') {
      return this.editor.isActive({ textAlign: 'right' });
    }
    if (actionId === 'alignJustify') {
      return this.editor.isActive({ textAlign: 'justify' });
    }
    if (actionId === 'setLink' || actionId === 'unsetLink') {
      return this.editor.isActive('link');
    }
    if (actionId === 'insertTable' || actionId === 'deleteTable') {
      return this.editor.isActive('table');
    }

    return false;
  }

  protected runToolbarAction(action: DashboardEditorToolbarActionId): void {
    if (!this.editor || !this.isToolbarActionEnabled(action)) {
      return;
    }

    const chain = this.editor.chain().focus();
    if (action === 'undo') {
      chain.undo().run();
      return;
    }
    if (action === 'redo') {
      chain.redo().run();
      return;
    }
    if (action === 'bold') {
      chain.toggleBold().run();
      return;
    }
    if (action === 'italic') {
      chain.toggleItalic().run();
      return;
    }
    if (action === 'underline') {
      chain.toggleUnderline().run();
      return;
    }
    if (action === 'heading1') {
      chain.toggleHeading({ level: 1 }).run();
      return;
    }
    if (action === 'heading2') {
      chain.toggleHeading({ level: 2 }).run();
      return;
    }
    if (action === 'heading3') {
      chain.toggleHeading({ level: 3 }).run();
      return;
    }
    if (action === 'bulletList') {
      chain.toggleBulletList().run();
      return;
    }
    if (action === 'orderedList') {
      chain.toggleOrderedList().run();
      return;
    }
    if (action === 'alignLeft') {
      chain.setTextAlign('left').run();
      return;
    }
    if (action === 'alignCenter') {
      chain.setTextAlign('center').run();
      return;
    }
    if (action === 'alignRight') {
      chain.setTextAlign('right').run();
      return;
    }
    if (action === 'alignJustify') {
      chain.setTextAlign('justify').run();
      return;
    }
    if (action === 'setLink') {
      const href = this.promptForUrl('Укажите URL ссылки');
      if (!href) {
        return;
      }
      chain.extendMarkRange('link').setLink({ href }).run();
      return;
    }
    if (action === 'unsetLink') {
      chain.extendMarkRange('link').unsetLink().run();
      return;
    }
    if (action === 'insertTable') {
      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      return;
    }
    if (action === 'deleteTable') {
      chain.deleteTable().run();
      return;
    }
    if (action === 'insertImage') {
      const src = this.promptForUrl('Укажите URL изображения');
      if (!src) {
        return;
      }
      chain.setImage({ src, alt: 'Изображение документа' }).run();
      return;
    }

    chain.unsetAllMarks().clearNodes().run();
  }

  protected createDocument(): void {
    if (this.titleControl.invalid) {
      this.titleControl.markAsTouched();
      return;
    }

    const contentDocument = this.editor?.getJSON() as DashboardRichContentDocument | undefined;
    const hasContent = Boolean(this.editor && !this.editor.isEmpty);
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
          this.router.navigate(['/dashboard/documents', document.id, 'edit'], {
            queryParams: { autoOpenExport: '1' },
          });
        },
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Не удалось создать документ';
          this.message.set(message);
        },
      });
  }

  private loadEditorControlProfile(category: 'HR' | 'FINANCE' | 'GENERAL'): void {
    this.useCases
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

  private initializeEditor(): void {
    if (this.editor) {
      return;
    }

    this.editor = new Editor({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
        }),
        Image,
        Table.configure({
          resizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
      ],
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

  private promptForUrl(message: string): string | null {
    if (!this.isBrowser || typeof globalThis.prompt !== 'function') {
      return null;
    }

    const value = globalThis.prompt(message)?.trim() ?? '';
    return value.length > 0 ? value : null;
  }
}
