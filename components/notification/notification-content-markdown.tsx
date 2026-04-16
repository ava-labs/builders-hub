// NotificationContent.tsx
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type Props = {
  content: string
}

export default function NotificationContent({ content }: Props) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
}
