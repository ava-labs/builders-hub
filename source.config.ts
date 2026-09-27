import {
  defineConfig,
  defineDocs,
  defineCollections,
  frontmatterSchema,
  getDefaultMDXOptions,
  metaSchema,
  type DefaultMDXOptions,
} from 'fumadocs-mdx/config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { z } from 'zod';
import { rehypeCodeDefaultOptions } from 'fumadocs-core/mdx-plugins';
import { transformerTwoslash } from 'fumadocs-twoslash';
import { indexedMdxAttribute, remarkCalloutLabels } from './lib/academy/remark-callout-labels';

const isDevelopment = process.env.NODE_ENV === 'development';

// MDX options for every collection. A collection's own mdxOptions replace these instead of
// extending them (fumadocs-mdx 13.0.8, dist/chunk-2E2JCOSO.js:97), so the Academy collection
// builds its options from this object and adds its callout marks.
const mdxOptions = {
  // When the build host can't reach a remote image (DNS / VPN / offline),
  // skip dimension probing instead of failing the whole MDX compile. Next.js
  // <Image> may warn about missing dimensions in dev but won't break the page.
  remarkImageOptions: {
    onError: 'ignore',
  },
  rehypeCodeOptions: {
    lazy: true,
    langs: ['ts', 'js', 'html', 'tsx', 'mdx'],
    inline: 'tailing-curly-colon',
    themes: {
      light: 'catppuccin-latte',
      dark: 'catppuccin-mocha',
    },
    transformers: [
      ...(rehypeCodeDefaultOptions.transformers ?? []),
      ...(!isDevelopment ? [transformerTwoslash()] : []),
      {
        name: 'transformers:remove-notation-escape',
        code(hast) {
          for (const line of hast.children) {
            if (line.type !== 'element') continue;

            const lastSpan = line.children.findLast(
              (v) => v.type === 'element',
            );

            const head = lastSpan?.children[0];
            if (head?.type !== 'text') return;

            head.value = head.value.replace(/\[\\!code/g, '[!code');
          }
        },
      },
    ],
  },
  remarkPlugins: [remarkMath],
  rehypePlugins: (v) => [rehypeKatex, ...v],
} satisfies DefaultMDXOptions;

export const { docs, meta } = defineDocs({
  docs: {
    async: true,
    schema: frontmatterSchema.extend({
      index: z.boolean().default(false),
      edit_url: z.string().optional(),
    }),
    postprocess: {
      includeProcessedMarkdown: !isDevelopment,
    },
  },
  meta: {
    schema: metaSchema.extend({
      description: z.string().optional(),
    }),
  },
});

export const course = defineCollections({
  type: 'doc',
  dir: 'content/academy',
  postprocess: {
    includeProcessedMarkdown: !isDevelopment,
  },
  // Callouts get their kind and label marks (spec 4.3), in this collection only; the marks stay
  // out of the search index built from structuredData.
  mdxOptions: getDefaultMDXOptions({
    ...mdxOptions,
    remarkPlugins: [remarkMath, remarkCalloutLabels],
    remarkStructureOptions: { allowedMdxAttributes: indexedMdxAttribute },
  }),
  schema: frontmatterSchema.extend({
    preview: z.string().optional(),
    index: z.boolean().default(false),
    updated: z.string().or(z.date()).transform((value, context) => {
      try {
        return new Date(value);
      } catch {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date" });
        return z.NEVER;
      }
    }).optional(),
    authors: z.array(z.string()).optional(),
    comments: z.boolean().default(false),
  }),
});

export const courseMeta = defineCollections({
  type: 'meta',
  dir: 'content/academy',
  schema: metaSchema.extend({
    description: z.string().optional(),
  }),
});

export const integrations = defineCollections({
  type: 'doc',
  async: true,
  dir: 'content/integrations',
  schema: frontmatterSchema.extend({
    category: z.union([z.string(), z.array(z.string())]),
    available: z.array(z.string()).optional(),
    logo: z.string().optional(),
    developer: z.string().optional(),
    website: z.string().optional(),
    documentation: z.string().optional(),
    baas_platform: z.string().optional(),
    featured: z.boolean().default(false).optional()
  }),
});

export const blog = defineCollections({
  type: 'doc',
  dir: 'content/blog',
  postprocess: {
    includeProcessedMarkdown: !isDevelopment,
  },
  schema: frontmatterSchema.extend({
    authors: z.array(z.string()).optional(),
    topics: z.array(z.string()).optional(),
    date: z.union([z.iso.date(), z.date()]).optional(),
    comments: z.boolean().default(false),
  }),
});

export default defineConfig({
  lastModifiedTime: isDevelopment ? undefined : 'git',
  mdxOptions,
});
