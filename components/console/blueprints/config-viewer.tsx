"use client";

import Link from "next/link";

interface ConfigAnnotation {
  marker: number;
  key: string;
  highlight: string;
  description: string;
}

interface ConfigSectionData {
  display: string;
  annotations: ConfigAnnotation[];
  data: object;
}

interface ConfigViewerProps {
  genesis: ConfigSectionData;
  chainConfig: ConfigSectionData;
  blueprintType?: 'gaming' | 'defi' | 'rwa';
}

function ConfigSection({
  filename,
  display,
  annotations,
  data,
}: {
  filename: string;
  display: string;
  annotations: ConfigAnnotation[];
  data: object;
}) {
  // Convert circled numbers to styled markers
  const renderCode = (json: string) => {
    const markerMap: Record<string, string> = {
      "①": "1", "②": "2", "③": "3", "④": "4", "⑤": "5",
      "⑥": "6", "⑦": "7", "⑧": "8", "⑨": "9", "⑩": "10"
    };

    const parts = json.split(/(①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)/g);

    return parts.map((part, idx) => {
      if (markerMap[part]) {
        return (
          <span
            key={idx}
            className="inline-flex items-center justify-center w-4 h-4 rounded bg-zinc-200 dark:bg-zinc-700 text-[10px] font-medium text-zinc-600 dark:text-zinc-300 ml-1"
          >
            {markerMap[part]}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100">{filename}</span>
        <button
          onClick={() => navigator.clipboard.writeText(JSON.stringify(data, null, 2))}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          Copy
        </button>
      </div>

      {/* Code */}
      <div className="p-5 bg-zinc-50 dark:bg-zinc-950">
        <pre className="text-sm overflow-x-auto">
          <code className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {renderCode(display)}
          </code>
        </pre>
      </div>

      {/* Annotations */}
      {annotations.length > 0 && (
        <div className="px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
          {annotations.map((annotation) => (
            <div key={annotation.marker} className="flex gap-3 text-sm">
              <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {annotation.marker}
              </span>
              <div className="text-zinc-600 dark:text-zinc-400">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{annotation.key}</span>
                {" — "}
                <span className="text-zinc-900 dark:text-zinc-200">{annotation.highlight}</span>
                {" "}
                {annotation.description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ConfigViewer({ genesis, chainConfig, blueprintType }: ConfigViewerProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Configuration</h3>

      <div className="grid gap-6 lg:grid-cols-2">
        <ConfigSection
          filename="genesis.json"
          display={genesis.display}
          annotations={genesis.annotations}
          data={genesis.data}
        />

        <ConfigSection
          filename="chain-config.json"
          display={chainConfig.display}
          annotations={chainConfig.annotations}
          data={chainConfig.data}
        />
      </div>

      <div className="flex gap-3">
        <Link
          href={`/console/layer-1/create${blueprintType ? `?blueprint=${blueprintType}` : ''}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
        >
          Deploy with this config
        </Link>
      </div>
    </div>
  );
}

interface Integration {
  category: string;
  emoji: string;
  categoryColor: string;
  title: string;
  description: string;
  href: string;
}

interface IntegrationsSectionProps {
  title?: string;
  description?: string;
  integrations: Integration[];
}

export function IntegrationsSection({
  title = "Integrations",
  description,
  integrations,
}: IntegrationsSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration, idx) => (
          <Link
            key={idx}
            href={integration.href}
            className="group p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">{integration.emoji}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                {integration.category}
              </span>
            </div>
            <div className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
              {integration.title}
            </div>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
              {integration.description}
            </p>
          </Link>
        ))}
      </div>

      <Link
        href="/integrations"
        className="inline-flex text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
      >
        Browse all integrations →
      </Link>
    </div>
  );
}
