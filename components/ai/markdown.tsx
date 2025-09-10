'use client';

import {
  Children,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  useEffect,
  useState,
} from 'react';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import Link from 'fumadocs-core/link';
import { createProcessor, type Processor } from './markdown-processor';
import { cn } from '../../lib/cn';

function Pre(props: ComponentProps<'pre'>) {
  const code = Children.only(props.children) as ReactElement;
  const codeProps = code.props as ComponentProps<'code'>;

  let lang =
    codeProps.className
      ?.split(' ')
      .find((v) => v.startsWith('language-'))
      ?.slice('language-'.length) ?? 'text';

  if (lang === 'mdx') lang = 'md';

  return (
    <DynamicCodeBlock lang={lang} code={(codeProps.children ?? '') as string} />
  );
}

let processor: Processor | undefined;
const map = new Map<string, ReactNode>();

export function Markdown({ text, onToolClick }: { text: string; onToolClick?: (toolId: string) => void }) {
  const [rendered, setRendered] = useState<ReactNode>(null);

  useEffect(() => {
    let aborted = false;
    async function run() {
      let result = map.get(text);
      if (!result && text) {
        processor ??= createProcessor();

        // Custom link component to intercept console tool clicks
        const LinkWithConsoleDetection = (props: ComponentProps<'a'>) => {
          const href = props.href || '';
          const consoleMatch = href.match(/\/console\/([^\s)#?]+)/);

          if (consoleMatch && onToolClick) {
            // Sanitize extracted path: drop fragments/queries and trailing punctuation
            const rawPath = consoleMatch[1]
              .split(/[?#]/)[0]
              .replace(/[)\].,;:!?'"`]+$/g, '');

            return (
              <a
                {...props}
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  onToolClick(rawPath);
                }}
                className={cn(props.className, 'cursor-pointer hover:underline text-red-600')}
              />
            );
          }

          // On mobile or when no handler, just use regular link
          return <Link {...props} />;
        };

        result = await processor
          .process(text, {
            ...defaultMdxComponents,
            pre: Pre,
            a: LinkWithConsoleDetection,
            img: undefined, // use JSX
          })
          .catch(() => text);

        map.set(text, result);
      }

      if (!aborted && result) {
        setRendered(result);
      }
    }

    void run();
    return () => {
      aborted = true;
    };
  }, [text, onToolClick]);

  return <>{rendered || text}</>;
}
