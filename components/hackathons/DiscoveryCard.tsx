import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { EYEBROW } from './events/utils';

interface DiscoveryCardProps {
  title: string;
  description: string;
  image: string;
  url: string;
  /** Optional mono eyebrow label, e.g. "lu.ma · external". */
  meta?: string;
}

export default function DiscoveryCard({ title, description, image, url, meta }: DiscoveryCardProps) {
  const isExternal = /^https?:/i.test(url);

  return (
    <a
      href={url}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="group block h-full"
    >
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all duration-200 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
        <div className="relative aspect-[16/9] overflow-hidden">
          <Image
            src={image}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-5">
          {meta && <span className={EYEBROW}>{meta}</span>}
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[15px] font-medium text-zinc-900 dark:text-zinc-50">{title}</h3>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-400 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-red-500" />
          </div>
          <p className="line-clamp-3 text-sm font-light text-zinc-600 dark:text-zinc-400">{description}</p>
        </div>
      </div>
    </a>
  );
}
