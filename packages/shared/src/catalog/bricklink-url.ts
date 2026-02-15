import type { BrickShape, BrickType } from '../types/index.js';
import { resolveBrickLinkPartId } from './bricklink-parts.js';
import { resolveBrickLinkColorId } from './bricklink-colors.js';

export interface BrickLinkPartInfo {
  partId: string | null;
  colorId: number | null;
  catalogUrl: string;
  isFallback: boolean;
}

/**
 * Resolve BrickLink catalog info for a single part.
 * Returns a direct catalog URL when mapped, or a search fallback.
 */
export function resolveBrickLinkInfo(
  shape: BrickShape,
  type: BrickType,
  width: number,
  length: number,
  color: string,
): BrickLinkPartInfo {
  const partId = resolveBrickLinkPartId(shape, type, width, length);
  const colorId = resolveBrickLinkColorId(color);

  if (partId) {
    let url = `https://www.bricklink.com/v2/catalog/catalogitem.page?P=${encodeURIComponent(partId)}`;
    if (colorId !== null) {
      url += `&C=${colorId}`;
    }
    return { partId, colorId, catalogUrl: url, isFallback: false };
  }

  // Fallback: search URL
  const query = `${width}x${length} ${type}`;
  const searchUrl = `https://www.bricklink.com/catalogList.asp?catType=P&q=${encodeURIComponent(query)}`;
  return { partId: null, colorId, catalogUrl: searchUrl, isFallback: true };
}

/** Minimal part shape accepted by generateWantedListXml */
export interface WantedListPart {
  shape: BrickShape;
  type: BrickType;
  color: string;
  dimensions: { width: number; length: number };
  quantity: number;
}

/**
 * Generate BrickLink Wanted List XML for bulk import.
 * Only includes parts with a known BrickLink part ID.
 */
export function generateWantedListXml(parts: WantedListPart[]): string {
  const items = parts
    .map((p) => {
      const partId = resolveBrickLinkPartId(p.shape, p.type, p.dimensions.width, p.dimensions.length);
      if (!partId) return null;
      const colorId = resolveBrickLinkColorId(p.color);
      let xml = '  <ITEM>\n';
      xml += '    <ITEMTYPE>P</ITEMTYPE>\n';
      xml += `    <ITEMID>${partId}</ITEMID>\n`;
      if (colorId !== null) {
        xml += `    <COLOR>${colorId}</COLOR>\n`;
      }
      xml += `    <MINQTY>${p.quantity}</MINQTY>\n`;
      xml += '  </ITEM>';
      return xml;
    })
    .filter(Boolean);

  return `<INVENTORY>\n${items.join('\n')}\n</INVENTORY>`;
}
