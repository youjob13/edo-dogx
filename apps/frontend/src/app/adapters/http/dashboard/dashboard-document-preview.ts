import {
  DashboardRichContentDocument,
  DashboardRichContentNode,
} from '../../../domain/dashboard/dashboard.models';

export interface DashboardDocumentPreviewBlock {
  readonly kind: 'heading' | 'paragraph' | 'listItem';
  readonly text: string;
  readonly level?: number;
  readonly ordered?: boolean;
  readonly index?: number;
}

const collectText = (node: DashboardRichContentNode | undefined): string => {
  if (!node) {
    return '';
  }

  if (node.type === 'hardBreak') {
    return '\n';
  }

  const children = node.content?.map(collectText).join('') ?? '';

  return `${node.text ?? ''}${children}`;
};

const normalizeText = (value: string): string => value.replace(/[ \t]+\n/g, '\n').replace(/\s+/g, ' ').trim();

const listItemText = (node: DashboardRichContentNode): string => {
  const text = node.content?.map(collectText).join(' ') ?? '';

  return normalizeText(text);
};

export const buildDocumentPreviewBlocks = (
  document: DashboardRichContentDocument | undefined,
  fallbackBody: string,
): Array<DashboardDocumentPreviewBlock> => {
  if (!document?.content?.length) {
    const fallback = normalizeText(fallbackBody);
    return fallback ? [{ kind: 'paragraph', text: fallback }] : [];
  }

  const blocks: Array<DashboardDocumentPreviewBlock> = [];

  for (const node of document.content) {
    if (node.type === 'heading') {
      const text = normalizeText(collectText(node));
      const level = node.attrs?.['level'];
      if (text) {
        blocks.push({
          kind: 'heading',
          text,
          level: typeof level === 'number' ? level : 2,
        });
      }
      continue;
    }

    if (node.type === 'paragraph') {
      const text = normalizeText(collectText(node));
      if (text) {
        blocks.push({ kind: 'paragraph', text });
      }
      continue;
    }

    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const start = node.attrs?.['start'];
      let index = typeof start === 'number' ? start : 1;
      for (const item of node.content ?? []) {
        const text = listItemText(item);
        if (text) {
          blocks.push({
            kind: 'listItem',
            text,
            ordered: node.type === 'orderedList',
            index: node.type === 'orderedList' ? index : undefined,
          });
          index += 1;
        }
      }
      continue;
    }

    const text = normalizeText(collectText(node));
    if (text) {
      blocks.push({ kind: 'paragraph', text });
    }
  }

  return blocks;
};
