import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, PLATFORM_ID, ViewEncapsulation, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Editor } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { finalize, take } from 'rxjs';
import { ButtonComponent, CardComponent, InputComponent, PageSectionComponent } from '../../../../design-system/ui-kit';
import { DashboardEditorControlProfile, DashboardRichContentDocument } from '../../../../domain/dashboard/dashboard.models';
import {
  Action,
  DASHBOARD_EDITOR_TOOLBAR_ACTIONS,
  DashboardEditorToolbarActionId,
} from './dashboard-rich-editor-toolbar';
import { DocumentUseCases } from '../../../../application/dashboard/document.use-cases';
import Placeholder from '@tiptap/extension-placeholder';

@Component({
  selector: 'edo-dogx-dashboard-document-create',
  encapsulation: ViewEncapsulation.None,
  imports: [ReactiveFormsModule, PageSectionComponent, CardComponent, InputComponent, ButtonComponent, TiptapEditorDirective],
  templateUrl: './dashboard-document-create.component.html',
  styleUrl: './dashboard-document-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardDocumentCreateComponent implements AfterViewInit, OnDestroy {
  private readonly documentUseCases = inject(DocumentUseCases);
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

  protected getToolbarLabel(actionId: DashboardEditorToolbarActionId): string {
    return DASHBOARD_EDITOR_TOOLBAR_ACTIONS[actionId].label;
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

    this.documentUseCases
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

  private promptForUrl(message: string): string | null {
    if (!this.isBrowser || typeof globalThis.prompt !== 'function') {
      return null;
    }

    const value = globalThis.prompt(message)?.trim() ?? '';
    return value.length > 0 ? value : null;
  }

  getAction(action: string | Action) {
    return this.actions[action as keyof typeof this.actions]
  }

  ngAfterViewInit() {
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

    this.loadEditorControlProfile(this.categoryControl.value);
    this.categoryControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((category) => this.loadEditorControlProfile(category));

  }

  ngOnDestroy() {
    this.editor!.destroy();
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
