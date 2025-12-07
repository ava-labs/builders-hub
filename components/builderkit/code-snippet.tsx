import React from "react";
import { cn } from "@/utils/cn";
import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-bash";

interface CodeSnippetProps {
  code: string;
  language?: string;
  className?: string;
}

export const CodeSnippet: React.FC<CodeSnippetProps> = ({
  code,
  language = "typescript",
  className,
}) => {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const highlightedCode = React.useMemo(() => {
    return isMounted ? Prism.highlight(code, Prism.languages[language], language) : "";
  }, [code, language, isMounted]);

  return (
    <pre className={cn("text-sm", className)}>
      <code
        className={isMounted ? `language-${language}` : ""}
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
      />
    </pre>
  );
};
