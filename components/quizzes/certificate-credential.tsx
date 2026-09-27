import { Award, Linkedin, Twitter } from 'lucide-react';
import { AvalancheLogo } from '@/components/navigation/avalanche-logo';
import { certificateAcademyFor, type CertificateAcademy } from '@/components/academy/certificate/certificate-artwork';
import type { CourseOutlineFacts } from '@/components/academy/course/course-outline-context';
import quizData from '@/components/quizzes/data';
import { buttonVariants } from '@/components/ui/button';
import { getCourseConfig } from '@/content/courses';
import { cn } from '@/utils/cn';

export interface CredentialFact {
  label: string;
  value: string;
}

/** Modules and Lessons from the course outline (a count it lacks is left out), then Format (spec 4.8, R5: no Course cell). */
export function credentialFacts(outline: CourseOutlineFacts | null): CredentialFact[] {
  const counts = outline
    ? [
        { label: 'Modules', count: outline.modules },
        { label: 'Lessons', count: outline.lessons },
      ]
    : [];
  return [
    ...counts.filter((fact) => fact.count > 0).map((fact) => ({ label: fact.label, value: String(fact.count) })),
    { label: 'Format', value: 'PDF' },
  ];
}

/** The course as its certificate names it (index C6: the content/courses.tsx entry the PDF prints), else the outline's name, else the quiz data title. */
export function credentialTitle(courseId: string, outline: CourseOutlineFacts | null): string {
  return getCourseConfig()[courseId]?.name ?? outline?.name ?? quizData.courses[courseId]?.title ?? '';
}

/** The academy the certificate names (index C6), from the track: the page's first folder under /academy/. */
export function credentialAcademy(pathname: string): CertificateAcademy {
  return certificateAcademyFor(pathname.split('/')[2] ?? '');
}

export interface CertificateCredentialProps {
  academy: CertificateAcademy;
  courseTitle: string;
  facts: readonly CredentialFact[];
  isGenerating: boolean;
  certificatePdfUrl: string | null;
  linkedInUrl: string;
  onGenerate: () => void;
  onShareOnX: () => void;
  onViewCertificate: () => void;
}

// Keyboard focus takes a 2 px ink ring outside the control in place of the translucent shadcn ring;
// outline-solid restores the style that buttonVariants' outline-none clears.
const FOCUS_RING =
  'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac-ink focus-visible:ring-0';

// The Generate button carries buttonVariants' inline-flex items-center gap-2, which an Academy rule
// for article buttons may recolour; its text colours are !important so ink never lands on ink.
const GENERATE_CLASS = cn(
  buttonVariants({ variant: 'default' }),
  'relative mb-6 h-auto overflow-hidden rounded-lg bg-ac-ink px-[22px] py-3 text-[15px] leading-[calc(1.75/1.125)] text-ac-paper! hover:bg-ac-ink/90 disabled:bg-ac-tile disabled:text-ac-ink-2! disabled:opacity-100',
  FOCUS_RING,
);

const SHARE_CLASS = cn(
  buttonVariants({ variant: 'secondary' }),
  'flex items-center rounded-lg border border-ac-rule bg-transparent px-4 py-2 text-ac-ink hover:bg-ac-panel',
  FOCUS_RING,
);

/**
 * The completed certificate page (spec 4.8): the framed credential, then production's Generate and share controls.
 * The frame opts out of the course page's prose rules (not-prose), whose heading margins beat m-0.
 */
export function CertificateCredential({
  academy,
  courseTitle,
  facts,
  isGenerating,
  certificatePdfUrl,
  linkedInUrl,
  onGenerate,
  onShareOnX,
  onViewCertificate,
}: CertificateCredentialProps) {
  return (
    <div className="not-prose relative mx-[7px] mb-2 mt-10 rounded-[3px] border border-ac-ink bg-ac-paper px-12 pb-9 pt-11 shadow-[0_0_0_6px_var(--ac-paper),0_0_0_7px_var(--ac-rule)] max-md:px-[22px] max-md:pb-6 max-md:pt-7">
      <CredentialHead academy={academy} courseTitle={courseTitle} facts={facts} />
      <button className={GENERATE_CLASS} onClick={onGenerate} disabled={isGenerating}>
        {isGenerating ? (
          <span className="flex items-center justify-center">
            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current"></span>
            Generating Certificate...
          </span>
        ) : (
          'Generate My Certificate'
        )}
      </button>
      <ShareBlock
        certificatePdfUrl={certificatePdfUrl}
        linkedInUrl={linkedInUrl}
        onShareOnX={onShareOnX}
        onViewCertificate={onViewCertificate}
      />
    </div>
  );
}

function CredentialHead({
  academy,
  courseTitle,
  facts,
}: Pick<CertificateCredentialProps, 'academy' | 'courseTitle' | 'facts'>) {
  return (
    <div className="mb-7">
      <div className="mb-7 flex items-center justify-between border-b border-ac-rule pb-4">
        <span className="text-[15px] leading-[1.75] tracking-[0.09em] text-ac-ink-3 [font-variant-caps:all-small-caps]">
          {academy}
        </span>
        {/* The logo hard-codes id="Layer_1"; unset it so the page keeps a single element with that id. */}
        <AvalancheLogo id={undefined} className="size-7" aria-hidden="true" />
      </div>
      <p className="mb-2 mt-0 text-[13.5px] leading-[1.75] text-ac-ink-3">Certificate of completion</p>
      <h2 className="m-0 font-ac-display text-[38px] font-medium leading-[1.06] tracking-[-0.02em] text-ac-ink max-md:text-[30px]">
        {courseTitle}
      </h2>
      <p className="mb-0 mt-3 text-[15.5px] leading-[1.75] text-ac-ink-2">
        Every quiz in this course is complete. Generate the certificate to download it as a PDF.
      </p>
      <dl className="mb-0 mt-7 grid grid-cols-3 border-t border-ac-rule">
        {facts.map((fact) => (
          <div key={fact.label} className="pr-3.5 pt-3">
            <dt className="mt-[1.25em] text-[12.5px] font-semibold leading-[1.75] text-ac-ink-3">{fact.label}</dt>
            <dd className="m-0 mt-1 p-0 text-[14.5px] font-medium leading-[1.75] text-ac-ink">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ShareBlock({
  certificatePdfUrl,
  linkedInUrl,
  onShareOnX,
  onViewCertificate,
}: Pick<CertificateCredentialProps, 'certificatePdfUrl' | 'linkedInUrl' | 'onShareOnX' | 'onViewCertificate'>) {
  return (
    <div className="border-t border-ac-rule pt-6">
      <p className="mb-2 mt-[1.25em] text-[13.5px] font-semibold leading-[1.75] text-ac-ink">Share your achievement:</p>
      <p className="mb-4 mt-[1.25em] text-sm text-ac-ink-3">
        Your certificate PDF has been downloaded. You can attach it when sharing on social media.
      </p>
      <div className="flex flex-wrap justify-start gap-2">
        {certificatePdfUrl && (
          <button onClick={onViewCertificate} className={SHARE_CLASS}>
            <Award className="mr-2 h-5 w-5" />
            View Certificate
          </button>
        )}
        <a
          href={linkedInUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none' }}
          className={SHARE_CLASS}
        >
          <Linkedin className="mr-2 h-5 w-5" />
          Add to LinkedIn
        </a>
        <button className={SHARE_CLASS} onClick={onShareOnX}>
          <Twitter className="mr-2 h-5 w-5" />
          Share on X
        </button>
      </div>
    </div>
  );
}
