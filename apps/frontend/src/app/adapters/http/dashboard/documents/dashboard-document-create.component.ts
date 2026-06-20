import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
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
import {
  ButtonComponent,
  CardComponent,
  InputComponent,
  PageSectionComponent,
} from '../../../../design-system/ui-kit';
import {
  DashboardDocumentCategory,
  DashboardDocumentType,
  DashboardEditorControlProfile,
  DashboardProduct,
  DashboardRichContentDocument,
} from '../../../../domain/dashboard/dashboard.models';
import {
  DASHBOARD_EDITOR_TOOLBAR_GROUPS,
  DASHBOARD_EDITOR_TOOLBAR_ACTIONS,
  DashboardEditorToolbarActionId,
  isToolbarControlEnabled,
} from './dashboard-rich-editor-toolbar';
import { DocumentUseCases } from '../../../../application/dashboard/document.use-cases';
import Placeholder from '@tiptap/extension-placeholder';
import {
  DASHBOARD_DOCUMENT_TEMPLATES,
  DashboardDocumentTemplate,
} from './dashboard-document-templates';

const EMPTY_DOCUMENT: DashboardRichContentDocument = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

const IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'edo-dogx-dashboard-document-create',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ReactiveFormsModule,
    PageSectionComponent,
    CardComponent,
    InputComponent,
    ButtonComponent,
    TiptapEditorDirective,
  ],
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

  @ViewChild('imageInput') private readonly imageInput?: ElementRef<HTMLInputElement>;

  protected editor: Editor | null = null;

  protected readonly titleControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(300)],
  });

  protected readonly categoryControl = new FormControl<DashboardDocumentCategory>('GENERAL', {
    nonNullable: true,
  });
  protected readonly documentTypeControl = new FormControl<DashboardDocumentType>('GENERAL', {
    nonNullable: true,
  });
  protected readonly productIdControl = new FormControl('', { nonNullable: true });
  protected readonly certificateNumberControl = new FormControl('', { nonNullable: true });
  protected readonly issueDateControl = new FormControl('', { nonNullable: true });
  protected readonly expiryDateControl = new FormControl('', { nonNullable: true });

  protected readonly templateControl = new FormControl('blank_ru', {
    nonNullable: true,
  });

  protected readonly loading = signal(false);
  protected readonly message = signal('');
  protected readonly activeControls = signal<Array<string>>([]);
  protected readonly disabledControls = signal<Array<string>>([]);
  protected readonly toolbarState = signal(0);
  protected readonly templates = DASHBOARD_DOCUMENT_TEMPLATES;
  protected readonly products = signal<Array<DashboardProduct>>([]);
  protected readonly toolbarGroups = DASHBOARD_EDITOR_TOOLBAR_GROUPS;

  protected readonly actions: Record<DashboardEditorToolbarActionId, { icon: string }> = {
    undo: { icon: '↶' },
    redo: { icon: '↷' },
    bold: { icon: 'B' },
    italic: { icon: 'I' },
    underline: { icon: 'U' },
    heading1: { icon: 'H1' },
    heading2: { icon: 'H2' },
    heading3: { icon: 'H3' },
    bulletList: { icon: '•' },
    orderedList: { icon: '1.' },
    alignLeft: { icon: '←' },
    alignCenter: { icon: '≡' },
    alignRight: { icon: '→' },
    alignJustify: { icon: '☰' },
    setLink: { icon: '⛓' },
    unsetLink: { icon: '−' },
    insertTable: { icon: '▦' },
    addRowAfter: { icon: '↓' },
    deleteRow: { icon: '− строка' },
    addColumnAfter: { icon: '→' },
    deleteColumn: { icon: '− столбец' },
    deleteTable: { icon: '✕' },
    insertImage: { icon: 'IMG' },
    clearFormatting: { icon: 'Tx' },
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
    const documentType = this.documentTypeControl.value;
    const selectedProduct = this.products().find((product) => product.id === this.productIdControl.value);
    if ((documentType === 'PRODUCT_PASSPORT' || documentType === 'CERTIFICATE') && !this.productIdControl.value) {
      this.message.set('Выберите изделие для паспорта или сертификата.');
      return;
    }
    if (
      documentType === 'CERTIFICATE' &&
      (!this.certificateNumberControl.value || !this.issueDateControl.value || !this.expiryDateControl.value)
    ) {
      this.message.set('Для сертификата укажите номер, дату выдачи и срок действия.');
      return;
    }
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
        documentType,
        productId: this.productIdControl.value || undefined,
        productName: selectedProduct?.name,
        productModel: selectedProduct?.model,
        certificateNumber: this.certificateNumberControl.value || undefined,
        issueDate: this.issueDateControl.value || undefined,
        expiryDate: this.expiryDateControl.value || undefined,
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

  protected getAction(action: DashboardEditorToolbarActionId): { icon: string } {
    return this.actions[action];
  }

  protected getTemplateName(template: DashboardDocumentTemplate): string {
    return template.category === 'GENERAL'
      ? template.name
      : `${template.name} · ${template.category}`;
  }

  protected loadTemplate(templateId: string): void {
    const template = this.templates.find((item) => item.id === templateId);
    if (!template || !this.editor) {
      return;
    }

    this.editor.commands.setContent(this.cloneDocument(template.content));
    this.message.set('');
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
    this.disabledControls.set(
      Array.isArray(profile.disabledControls) ? profile.disabledControls : [],
    );
  }

  private promptForUrl(message: string): string | null {
    if (!this.isBrowser || typeof globalThis.prompt !== 'function') {
      return null;
    }

    const value = globalThis.prompt(message)?.trim() ?? '';
    return value.length > 0 ? value : null;
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) {
      return;
    }

    this.editor = new Editor({
      extensions: [
        StarterKit,
        Underline,
        Link.configure({ openOnClick: false }),
        Image.configure({
          inline: false,
          allowBase64: true,
        }),
        TextAlign.configure({
          types: ['heading', 'paragraph'],
          alignments: ['left', 'center', 'right', 'justify'],
        }),
        TableKit.configure({
          table: { resizable: true, HTMLAttributes: {} },
          tableHeader: { HTMLAttributes: { class: 'table-header' } },
          tableCell: { HTMLAttributes: { class: 'table-cell' } },
        }),
        Placeholder.configure({
          placeholder: 'Начните вводить текст документа...',
        }),
      ],
      content: this.cloneDocument(EMPTY_DOCUMENT),
      onUpdate: () => this.refreshToolbarState(),
      onSelectionUpdate: () => this.refreshToolbarState(),
      onTransaction: () => this.refreshToolbarState(),
    });

    this.loadTemplate(this.templateControl.value);
    this.documentUseCases
      .getProducts()
      .pipe(take(1))
      .subscribe({ next: (items) => this.products.set(items), error: () => this.products.set([]) });
    this.loadEditorControlProfile(this.categoryControl.value);
    this.categoryControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((category) => this.loadEditorControlProfile(category));
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
    this.editor = null;
  }

  protected run(action: DashboardEditorToolbarActionId): void {
    if (!this.editor || !this.shouldShowAction(action) || this.isActionDisabled(action)) {
      return;
    }

    const chain = this.editor.chain().focus();

    switch (action) {
      case 'undo':
        chain.undo().run();
        return;
      case 'redo':
        chain.redo().run();
        return;
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
      case 'heading3':
        chain.toggleHeading({ level: 3 }).run();
        return;
      case 'bulletList':
        chain.toggleBulletList().run();
        return;
      case 'orderedList':
        chain.toggleOrderedList().run();
        return;
      case 'alignLeft':
        chain.setTextAlign('left').run();
        return;
      case 'alignCenter':
        chain.setTextAlign('center').run();
        return;
      case 'alignRight':
        chain.setTextAlign('right').run();
        return;
      case 'alignJustify':
        chain.setTextAlign('justify').run();
        return;
      case 'setLink': {
        const previousUrl = this.editor.getAttributes('link')['href'];
        const url = this.promptForUrl('Введите URL') ?? previousUrl;
        if (typeof url === 'string' && url.trim().length > 0) {
          chain.extendMarkRange('link').setLink({ href: url.trim() }).run();
        }
        return;
      }
      case 'unsetLink':
        chain.extendMarkRange('link').unsetLink().run();
        return;
      case 'insertTable':
        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        return;
      case 'insertImage':
        this.openImagePicker();
        return;
      case 'addRowAfter':
        chain.addRowAfter().run();
        return;
      case 'deleteRow':
        chain.deleteRow().run();
        return;
      case 'addColumnAfter':
        chain.addColumnAfter().run();
        return;
      case 'deleteColumn':
        chain.deleteColumn().run();
        return;
      case 'deleteTable':
        chain.deleteTable().run();
        return;
      case 'clearFormatting':
        chain.unsetAllMarks().clearNodes().run();
        return;
    }
  }

  protected isActive(action: DashboardEditorToolbarActionId): boolean {
    this.toolbarState();
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
      case 'heading3':
        return this.editor.isActive('heading', { level: 3 });
      case 'bulletList':
        return this.editor.isActive('bulletList');
      case 'orderedList':
        return this.editor.isActive('orderedList');
      case 'alignLeft':
        return this.editor.isActive({ textAlign: 'left' });
      case 'alignCenter':
        return this.editor.isActive({ textAlign: 'center' });
      case 'alignRight':
        return this.editor.isActive({ textAlign: 'right' });
      case 'alignJustify':
        return this.editor.isActive({ textAlign: 'justify' });
      case 'setLink':
      case 'unsetLink':
        return this.editor.isActive('link');
      default:
        return false;
    }
  }

  protected isActionDisabled(action: DashboardEditorToolbarActionId): boolean {
    this.toolbarState();
    if (!this.editor || this.loading()) {
      return true;
    }

    const chain = this.editor.can().chain().focus();

    switch (action) {
      case 'undo':
        return !chain.undo().run();
      case 'redo':
        return !chain.redo().run();
      case 'addRowAfter':
        return !chain.addRowAfter().run();
      case 'deleteRow':
        return !chain.deleteRow().run();
      case 'addColumnAfter':
        return !chain.addColumnAfter().run();
      case 'deleteColumn':
        return !chain.deleteColumn().run();
      case 'deleteTable':
        return !chain.deleteTable().run();
      default:
        return false;
    }
  }

  protected shouldShowAction(action: DashboardEditorToolbarActionId): boolean {
    this.toolbarState();
    const controlKey = DASHBOARD_EDITOR_TOOLBAR_ACTIONS[action].controlKey;
    const isEnabled = isToolbarControlEnabled(
      this.activeControls(),
      this.disabledControls(),
      controlKey,
    );
    if (!isEnabled) {
      return false;
    }

    if (this.isContextualTableAction(action)) {
      return Boolean(this.editor?.isActive('table'));
    }

    return true;
  }

  protected handleImageInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file || !this.editor) {
      return;
    }

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      this.message.set('Загрузите изображение в формате PNG или JPG.');
      return;
    }

    if (file.size > IMAGE_MAX_SIZE_BYTES) {
      this.message.set('Размер изображения не должен превышать 5 МБ.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      if (!src) {
        this.message.set('Не удалось прочитать изображение.');
        return;
      }

      this.editor?.chain().focus().setImage({ src, alt: file.name }).run();
      this.message.set('');
    };
    reader.onerror = () => this.message.set('Не удалось загрузить изображение.');
    reader.readAsDataURL(file);
  }

  private openImagePicker(): void {
    if (!this.isBrowser) {
      return;
    }

    this.imageInput?.nativeElement.click();
  }

  private refreshToolbarState(): void {
    this.toolbarState.update((value) => value + 1);
  }

  private isContextualTableAction(action: DashboardEditorToolbarActionId): boolean {
    return ['addRowAfter', 'deleteRow', 'addColumnAfter', 'deleteColumn', 'deleteTable'].includes(
      action,
    );
  }

  private cloneDocument(document: DashboardRichContentDocument): DashboardRichContentDocument {
    return JSON.parse(JSON.stringify(document)) as DashboardRichContentDocument;
  }
}
