// NotificationContent.tsx
import { MDXRemote } from "next-mdx-remote/rsc"

type Props = {
  content: string
}

export default function NotificationContent({ content }: Props) {
  return <MDXRemote source={content} />
}
