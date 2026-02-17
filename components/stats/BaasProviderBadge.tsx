import Link from "next/link";
import { BaasProvider } from "@/types/stats";

interface BaasProviderBadgeProps {
  provider: BaasProvider;
}

export function BaasProviderBadge({ provider }: BaasProviderBadgeProps) {
  return (
    <Link
      href={`/integrations/${provider.slug}`}
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 transition-colors"
    >
      {provider.name}
    </Link>
  );
}

interface BaasProviderListProps {
  providers?: BaasProvider[];
  showLabel?: boolean;
}

export function BaasProviderList({ providers, showLabel = false }: BaasProviderListProps) {
  if (!providers || providers.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {showLabel && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">BaaS:</span>
      )}
      {providers.map((provider) => (
        <BaasProviderBadge key={provider.slug} provider={provider} />
      ))}
    </div>
  );
}
