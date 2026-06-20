import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, take } from 'rxjs';
import { DocumentUseCases } from '../../../../application/dashboard/document.use-cases';
import {
  DashboardCreateProductPayload,
  DashboardProduct,
  DocumentItem,
} from '../../../../domain/dashboard/dashboard.models';
import {
  ButtonComponent,
  CardComponent,
  InputComponent,
  PageSectionComponent,
  StatusChipComponent,
} from '../../../../design-system/ui-kit';

@Component({
  selector: 'edo-dogx-dashboard-products',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageSectionComponent,
    CardComponent,
    InputComponent,
    ButtonComponent,
    StatusChipComponent,
  ],
  templateUrl: './dashboard-products.component.html',
  styleUrl: './dashboard-products.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardProductsComponent {
  private readonly documentUseCases = inject(DocumentUseCases);
  private readonly route = inject(ActivatedRoute);

  protected readonly nameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly modelControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly typeControl = new FormControl('Противопожарная дверь', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly descriptionControl = new FormControl('', { nonNullable: true });

  protected readonly products = signal<Array<DashboardProduct>>([]);
  protected readonly selectedProduct = signal<DashboardProduct | null>(null);
  protected readonly selectedDocuments = computed(() => this.selectedProduct()?.documents ?? []);
  protected readonly certificateDocuments = computed(() =>
    this.selectedDocuments().filter((document) => document.documentType === 'CERTIFICATE'),
  );
  protected readonly validCertificateCount = computed(
    () => this.certificateDocuments().filter((document) => document.certificateStatus === 'VALID').length,
  );
  protected readonly loading = signal(false);
  protected readonly message = signal('');

  constructor() {
    this.loadProducts();
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const productId = params.get('productId');
      if (productId) {
        this.loadProduct(productId);
      } else {
        this.selectedProduct.set(null);
      }
    });
  }

  protected createProduct(): void {
    if (this.nameControl.invalid || this.modelControl.invalid || this.typeControl.invalid) {
      this.nameControl.markAsTouched();
      this.modelControl.markAsTouched();
      this.typeControl.markAsTouched();
      return;
    }

    const payload: DashboardCreateProductPayload = {
      name: this.nameControl.value.trim(),
      model: this.modelControl.value.trim(),
      type: this.typeControl.value.trim(),
      description: this.descriptionControl.value.trim() || undefined,
    };

    this.loading.set(true);
    this.message.set('');
    this.documentUseCases
      .createProduct(payload)
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (product) => {
          this.products.update((items) => [product, ...items]);
          this.nameControl.reset('');
          this.modelControl.reset('');
          this.descriptionControl.reset('');
          this.message.set('Изделие создано.');
        },
        error: () => this.message.set('Не удалось создать изделие.'),
      });
  }

  protected loadProduct(productId: string): void {
    this.documentUseCases
      .getProductById(productId)
      .pipe(take(1))
      .subscribe({
        next: (product) => this.selectedProduct.set(product),
        error: () => this.message.set('Не удалось загрузить изделие.'),
      });
  }

  protected certificateLabel(document: DocumentItem): string {
    if (document.certificateStatus === 'EXPIRED') {
      return 'Истек';
    }
    if (document.certificateStatus === 'EXPIRING_SOON') {
      return 'Истекает';
    }
    return 'Действует';
  }

  private loadProducts(): void {
    this.loading.set(true);
    this.documentUseCases
      .getProducts()
      .pipe(
        take(1),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (items) => this.products.set(items),
        error: () => this.message.set('Не удалось загрузить изделия.'),
      });
  }
}
