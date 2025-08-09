/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Content, ContentListUnion, Part, PartUnion } from '@google/genai';

export function toContentList(contents: ContentListUnion): Content[] {
  if (Array.isArray(contents)) {
    return contents.map(toContent);
  }
  return [toContent(contents)];
}

export function toContent(
  content: Content | PartUnion[] | string | PartUnion,
): Content {
  if (Array.isArray(content)) {
    return { role: 'user', parts: toParts(content) };
  }
  if (typeof content === 'string') {
    return { role: 'user', parts: [{ text: content }] } as Content;
  }
  if ((content as Content).parts) {
    return content as Content;
  }
  return { role: 'user', parts: [content as Part] } as Content;
}

export function toParts(parts: PartUnion[]): Part[] {
  return parts.map((p) =>
    typeof p === 'string' ? ({ text: p } as Part) : (p as Part),
  );
}

export function partToText(p: Part | string): string {
  return typeof p === 'string' ? p : p.text || '';
}

export function contentsToText(contents: Content[]): string {
  return contents
    .map((c) => (c.parts || []).map(partToText).join(''))
    .join('\n');
}
