import { notFound, redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { getOwnerRequestDetail } from "@/server/services/audits/visibility";
import { RequestDetailView } from "@/components/audits/detail/RequestDetailView";
import { SubmissionReceipt } from "@/components/audits/detail/SubmissionReceipt";

interface AuditRequestPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}

export default async function AuditRequestPage({ params, searchParams }: AuditRequestPageProps) {
  const session = await getAuthSession();
  // Owner-only page, not in PROTECTED_PATHS: anonymous visitors go to the
  // public landing instead of a login placeholder.
  if (!session?.user?.id) redirect("/audits");

  const { id } = await params;
  const { submitted } = await searchParams;

  const detail = await getOwnerRequestDetail(session.user.id, id);
  if (!detail) notFound();
  if (detail.status === "draft") redirect(`/audits/new?draft=${detail.id}`);

  return (
    <main className="container relative max-w-[1400px]">
      {/* Submission now lands in pending_review, and the receipt is the
          screen that explains the wait. Collecting stays valid so an
          approved request keeps a shareable receipt URL. */}
      {submitted === "1" && (detail.status === "pending_review" || detail.status === "collecting") ? (
        <SubmissionReceipt
          requestId={detail.id}
          projectName={detail.project_name || "Your request"}
          submittedAt={detail.submitted_at}
          quoteDeadline={detail.quote_deadline}
        />
      ) : (
        <RequestDetailView detail={detail} userId={session.user.id} />
      )}
    </main>
  );
}
