import { TransactionLifecycle } from "@/components/sae/TransactionLifecycle"

export default function SAEPage() {
  return (
    <main className="min-h-screen" style={{ paddingTop: "var(--fd-banner-height, 0rem)" }}>
      <TransactionLifecycle />
    </main>
  )
}
