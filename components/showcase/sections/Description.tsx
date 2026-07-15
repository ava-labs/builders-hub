import { Separator } from "@/components/ui/separator";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  description: string;
};
export default function Description({ description }: Props) {
  return (
    <div>
      <h1 className="text-2xl font-bold">Full Description</h1>
      <Separator className="my-4 bg-zinc-300 dark:bg-zinc-800" />
      {/* react-markdown renders markdown as React elements and does not
          execute JSX expressions or pass raw HTML to the DOM, preventing
          the stored XSS possible with next-mdx-remote's MDXRemote. */}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {description}
      </ReactMarkdown>
    </div>
  );
}
