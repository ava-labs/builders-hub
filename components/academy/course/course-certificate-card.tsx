import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { CertificateArtwork, type CertificateAcademy } from '@/components/academy/certificate/certificate-artwork';

interface CourseCertificateCardProps {
  academy: CertificateAcademy;
  courseTitle: string;
  href: string;          // the certificate page
  label: string;         // the certificate page's sidebar text
  afterModules: boolean; // sits right under the Modules list
}

/** "Certificate": the course's certificate drawing in the one card anatomy, linking to the certificate page (spec 4.6). */
export function CourseCertificateCard({ academy, courseTitle, href, label, afterModules }: CourseCertificateCardProps) {
  return (
    <section data-academy-part="course-certificate" className={cn('mb-9', afterModules ? 'mt-2' : 'mt-10')}>
      <h2 className="mb-3.5 font-ac-display text-[25px] font-medium tracking-[-0.015em] text-ac-ink">Certificate</h2>
      <Link
        href={href}
        className="grid grid-cols-[320px_minmax(0,1fr)] items-center gap-6 rounded-[12px] border border-ac-rule bg-ac-paper p-4 text-inherit hover:border-ac-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac-ink max-md:grid-cols-1 max-md:gap-3.5"
      >
        <CertificateArtwork
          academy={academy}
          courseTitle={courseTitle}
          className="block h-auto w-full rounded-[3px] shadow-md dark:shadow-none dark:ring-1 dark:ring-ac-rule-2"
        />
        <span className="grid gap-3">
          <b className="text-[15.5px] font-semibold leading-[1.45] text-ac-ink">
            Answer every quiz in this course correctly to earn this certificate.
          </b>
          <span className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ac-ink-2">
            {label}
            <ArrowRight aria-hidden="true" className="size-[15px] shrink-0" />
          </span>
        </span>
      </Link>
    </section>
  );
}
