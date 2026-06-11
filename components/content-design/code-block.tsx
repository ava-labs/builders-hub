import * as Base from 'fumadocs-ui/components/codeblock';
import { highlight } from 'fumadocs-core/highlight';
import { Components } from 'hast-util-to-jsx-runtime';

export interface CodeBlockProps {
  code: string;
  wrapper?: Base.CodeBlockProps;
  lang: string;
}

export async function CodeBlock({ code, lang, wrapper }: CodeBlockProps) {
  const rendered = await highlight(code, {
    lang,
    themes: {
      light: 'github-light',
      dark: 'vesper',
    },
    components: {
      pre: Base.Pre,
    } as Partial<Components>,
  });

  return <Base.CodeBlock {...wrapper}>{rendered}</Base.CodeBlock>;
}
