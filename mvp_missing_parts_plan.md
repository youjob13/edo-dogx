# MVP Missing Parts Plan

## Objective

Implement only the minimum missing business functionality required for the Guar-S EDO MVP:

- product passports;
- certificates;
- certificate expiry notifications;
- simple linking between products and their documents.

## Scope

### 1. Document Types

Add explicit document types:

- `PRODUCT_PASSPORT`;
- `CERTIFICATE`.

Keep existing document lifecycle:

- draft;
- in review;
- changes requested;
- approved;
- archived.

No complex certification workflow is required for MVP.

### 2. Product Registry

Add a simple product entity:

- product ID;
- product name;
- product model;
- product type;
- optional description.

Example:

```text
Product: Противопожарная дверь EI-60
Model: ДПМ-EI60
Type: Fire door
```

### 3. Product-Document Link

Allow one product to have multiple documents.

Minimum relation:

- product ID;
- document ID;
- document type.

Rules:

- one product may have many passports;
- one product may have many certificates;
- one document belongs to one product for MVP simplicity.

### 4. Certificate Metadata

For certificate documents, store required structured fields:

- certificate number;
- issue date;
- expiry date;
- product ID;
- status.

Certificate status:

- valid;
- expiring soon;
- expired.

Status can be calculated from `expiryDate`.

### 5. Expiry Notifications

Create notification when certificate expiry is near.

Minimum rule:

- notify responsible users 30 days before expiry;
- notify again when certificate is expired.

Notification text must include:

- certificate number;
- product name/model;
- expiry date.

### 6. UI Changes

Add minimal UI support:

- product list;
- product details page with linked documents;
- document create/edit form with document type;
- certificate fields shown only for certificate documents;
- visible expiry status in document/product view.

Do not build advanced dashboards for MVP.

### 7. Search

Extend search minimally:

- search documents by title;
- search products by name/model;
- filter documents by document type;
- show linked product in document search result.

Advanced filters by department, batch, legal category, and production stage are out of scope.

## Technical Implementation Order

1. Extend shared contracts with `DocumentType`, product DTOs, certificate metadata, and product-document relation.
2. Add database tables/columns for products, document type, product link, and certificate metadata.
3. Update document-service domain model and repositories.
4. Add gateway endpoints for products and product-document linking.
5. Update frontend document forms and product screens.
6. Add expiry notification job/service logic.
7. Extend search projection with product name/model and document type.

## Out Of Scope For MVP

- patents;
- licenses;
- batch tracking;
- serial number tracking;
- full production route;
- complex multi-step approval;
- external digital signature provider integration;
- advanced compliance reports;
- automated certificate renewal workflow.

## Success Criteria

MVP is complete when:

- user can create a product;
- user can create a product passport and link it to a product;
- user can create a certificate and link it to a product;
- certificate has issue and expiry dates;
- system shows whether certificate is valid, expiring soon, or expired;
- system sends notification before certificate expiry;
- user can find product documents through simple search.
