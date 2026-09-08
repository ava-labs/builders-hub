import { getAuthSession } from "@/lib/auth/authSession";
import { getOwnerRequestDetail } from "@/server/services/audits/visibility";
import { AuthLoading } from "@/components/ui/auth-loading";
import { AuditWizard } from "@/components/audits/wizard/WizardShell";
import { draftToValues } from "@/components/audits/wizard/types";

interface NewAuditRequestPageProps {
  searchParams: Promise<{ draft?: string; project?: string }>;
}

export default async function NewAuditRequestPage({ searchParams }: NewAuditRequestPageProps) {
  const session = await getAuthSession();
  // /audits/new is in PROTECTED_PATHS: the login modal opens over this
  // placeholder for anonymous visitors.
  if (!session?.user?.id) return <AuthLoading />;

  const { draft, project } = await searchParams;
  const prefill = {
    contact_name: session.user.name ?? "",
    contact_email: session.user.email ?? "",
  };

  let initialDraft: { id: string; values: ReturnType<typeof draftToValues> } | null = null;
  if (draft && !session.user.id.startsWith("pending_")) {
    const detail = await getOwnerRequestDetail(session.user.id, draft);
    if (detail && detail.status === "draft") {
      initialDraft = { id: detail.id, values: draftToValues(detail, prefill) };
    }
  }

  return (
    <main className="container relative max-w-[1400px] px-4 py-6 lg:py-10">
      <AuditWizard
        initialDraft={initialDraft}
        prefill={prefill}
        importProjectId={project ?? null}
      />
    </main>
  );
}
