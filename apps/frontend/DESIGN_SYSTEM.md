---
name: Precision EDMS
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#271901'
  on-tertiary-container: '#98805d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#fcdeb5'
  tertiary-fixed-dim: '#dec29a'
  on-tertiary-fixed: '#271901'
  on-tertiary-fixed-variant: '#574425'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  h1:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  h2:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-xs:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  table-data:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  gutter: 12px
  margin: 20px
---

## Brand & Style

This design system is built for the high-stakes environment of electronic document management, where speed of recognition and data density are paramount. The brand personality is clinical, authoritative, and frictionless. It avoids decorative elements in favor of functional clarity.

The visual style is a hybrid of **Minimalism** and **Corporate Modernism**. It utilizes a "reductionist" approach: every line and pixel must serve a purpose. The goal is to evoke a sense of organized calm, transforming complex document hierarchies into a manageable, high-density interface that rewards expert users while remaining intuitive for novices.

## Colors

The palette is rooted in a professional, neutral foundation to minimize eye fatigue during long sessions. The primary color is a deep Slate, used for core navigation and text to provide high contrast without the harshness of pure black. 

Accents are strictly reserved for functional feedback and status indicators:
- **Emerald (Success/Approved):** High visibility for completed workflows.
- **Amber (Warning/Pending):** Immediate attention for items requiring action.
- **Slate (Neutral/Draft):** De-emphasized for items in progress.
- **Backgrounds:** Utilize subtle shifts between white and off-white to define different functional zones (e.g., sidebars vs. content areas).

## Typography

This design system utilizes **Inter** for its exceptional legibility at small sizes and its neutral, systematic character. The scale is intentionally tight (compact) to maximize the information displayed on a single screen.

- **Headlines:** Kept small to prioritize content over container labels.
- **Body Text:** Set at 13px for the primary data layer to balance readability with high-density requirements.
- **Labels:** Uppercase styles are used sparingly for table headers and section dividers to create clear visual anchors.
- **Numerical Data:** Tabular lining should be enabled to ensure columns of figures align perfectly for easy scanning.

## Layout & Spacing

The layout employs a **Fluid Grid** model with a focus on horizontal efficiency. A 12-column system is used, but the primary logic is based on a 4px baseline grid to ensure a tight, "high-density" feel.

- **Density:** Padding within table cells and list items is compressed (8px vertical, 12px horizontal).
- **Margins:** Outer page margins are kept to a minimum (20px) to reclaim screen real estate for document viewing and metadata tables.
- **Hierarchy:** Use spacing to group related metadata; larger gaps (16px+) are only used to separate primary functional blocks like the navigation rail from the workspace.

## Elevation & Depth

To maintain the clean, "flat-plus" aesthetic, this design system avoids heavy shadows. Depth is communicated through **Tonal Layers** and **Low-Contrast Outlines**.

- **Surfaces:** The primary workspace is white (#FFFFFF), while the background "canvas" is a very light slate (#F8FAFC).
- **Borders:** Use 1px solid borders (#E2E8F0) to define sections. This creates a "blueprint" feel that is more structured than shadow-based systems.
- **Modals/Popovers:** Only these elements receive a subtle, ambient shadow (0px 4px 12px rgba(0,0,0,0.05)) to indicate temporary interaction without breaking the compact layout.
- **Focus States:** High-contrast 2px outlines in the primary color ensure accessibility within dense forms.

## Shapes

The shape language is disciplined and geometric. A **Soft (0.25rem)** roundedness is applied to buttons, input fields, and containers. This slight softening prevents the UI from feeling overly aggressive or dated (brutalist) while maintaining the professional rigor of a document management tool.

Large containers like cards or panels use a maximum of 0.5rem (rounded-lg) to keep the layout feeling structural and aligned with the grid.

## Components

- **Buttons:** Compact height (32px for standard, 28px for small). Primary buttons use the deep Slate background; secondary buttons use a ghost style with a 1px border.
- **Status Chips:** Small, pill-shaped indicators with subtle background tints and high-contrast text (e.g., Emerald text on a 10% opacity Emerald background).
- **Data Tables:** The core of the system. Rows have a 32px height, no vertical borders, and a subtle hover state (#F1F5F9).
- **Input Fields:** Minimalist design with a 1px border. Labels should be placed above the input in the `body-xs` bold style to save horizontal space.
- **Document Preview:** A dedicated component with a neutral gray background to frame the document content, utilizing "Glassmorphism" only for floating toolbars over the document.
- **Tree Navigation:** Used for folder structures, using 16px indentations and "chevron" icons for collapse/expand states.