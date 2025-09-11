import { loader } from 'fumadocs-core/source';
import { createElement } from 'react';
import { icons } from 'lucide-react';
import { createMDXSource } from 'fumadocs-mdx';
import { meta, docs, blog as blogs, course, courseMeta, integrations, codebaseEntrepreneur, codebaseEntrepreneurMeta } from '@/.source';
import type { InferMetaType, InferPageType } from 'fumadocs-core/source';

export const documentation = loader({
  baseUrl: '/docs',
  icon(icon) {
    if (icon && icon in icons)
      return createElement(icons[icon as keyof typeof icons]);
  },
  source: createMDXSource(docs, meta),
});

export const academy = loader({
  baseUrl: '/academy',
  icon(icon) {
    if (icon && icon in icons)
      return createElement(icons[icon as keyof typeof icons]);
  },
  source: createMDXSource(course, courseMeta),
});

export const codebaseEntrepreneurAcademy = loader({
  baseUrl: '/codebase-entrepreneur-academy',
  icon(icon) {
    if (icon && icon in icons)
      return createElement(icons[icon as keyof typeof icons]);
  },
  source: createMDXSource(codebaseEntrepreneur, codebaseEntrepreneurMeta),
});

export const blog = loader({
  baseUrl: '/blog',
  source: createMDXSource(blogs, []),
});

export const integration = loader({
  baseUrl: '/integrations',
  source: createMDXSource(integrations, []),
});

export type Page = InferPageType<typeof documentation>;
export type Meta = InferMetaType<typeof documentation>;
