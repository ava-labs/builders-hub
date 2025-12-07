import { ReactNode } from "react";

import {
  CodeBlock,
  type CodeBlockProps,
  Pre as PreComponent,
} from "fumadocs-ui/components/codeblock";

export default function Pre({ children }: { children: ReactNode }) {
  return (
    <CodeBlock allowCopy={true}>
      <PreComponent>{children}</PreComponent>
    </CodeBlock>
  );
}
