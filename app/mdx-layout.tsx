export default function MdxLayout({ children }: { children: React.ReactNode }) {
  // Create any shared layout or styles here
  return (
    <div className="prose prose-li:text-zinc-900 prose-li:dark:text-zinc-50 prose-ul:text-zinc-900 prose-ul:dark:text-zinc-50 prose-p:text-zinc-900 prose-p:dark:text-zinc-50">
      {children}
    </div>
  )
}