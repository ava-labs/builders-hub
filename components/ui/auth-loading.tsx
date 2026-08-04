export function AuthLoading() {
  return (
    <main className="container relative max-w-[1400px] pt-4 pb-16">
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-50" />
      </div>
    </main>
  );
}
