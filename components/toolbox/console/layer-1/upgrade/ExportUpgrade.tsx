"use client";

import { useMemo, useState } from "react";
import { Copy, Download, Check, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/toolbox/components/Button";
import { useUpgradeStore } from "@/components/toolbox/stores/upgradeStore";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "@/components/toolbox/components/WithConsoleToolMetadata";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { validateEntries } from "./types";
import { genUpgradeJson } from "./genUpgradeJson";
import Link from "next/link";

const metadata: ConsoleToolMetadata = {
  title: "Export upgrade.json",
  description: "Review and download your generated upgrade.json file",
  toolRequirements: [],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function ExportUpgradeInner(_props: BaseConsoleToolProps) {
  const entries = useUpgradeStore(state => state.entries);

  const { errors } = useMemo(() => validateEntries(entries), [entries]);
  const hasBlockingErrors = Object.keys(errors).length > 0;

  const upgradeJson = useMemo(() => {
    try {
      return JSON.stringify(genUpgradeJson(entries), null, 2);
    } catch {
      return '{}';
    }
  }, [entries]);

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(upgradeJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: create a text area and copy
      const ta = document.createElement("textarea");
      ta.value = upgradeJson;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([upgradeJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "upgrade.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Validation errors */}
      {hasBlockingErrors && (
        <div className="rounded-lg border border-red-300 dark:border-red-700/50 bg-red-50 dark:bg-red-950/20 p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-medium text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            Fix these errors before exporting
          </div>
          <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-400 space-y-1">
            {Object.values(errors).map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* JSON preview */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Generated upgrade.json</h3>
        <pre className="rounded-lg border border-border bg-muted p-4 text-xs font-mono overflow-auto max-h-[400px] whitespace-pre-wrap break-all">
          {upgradeJson}
        </pre>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={handleCopy}
          variant="secondary"
          disabled={hasBlockingErrors}
          icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        >
          {copied ? "Copied!" : "Copy to Clipboard"}
        </Button>
        <Button
          onClick={handleDownload}
          disabled={hasBlockingErrors}
          icon={<Download className="h-4 w-4" />}
        >
          Download upgrade.json
        </Button>
      </div>

      {/* Deployment instructions */}
      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-sm font-semibold text-foreground">Deployment Instructions</h3>

        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="space-y-1">
            <p className="font-medium text-foreground">1. Place the file</p>
            <p>
              Copy <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">upgrade.json</code> to the chain configuration directory on each validator node:
            </p>
            <pre className="rounded bg-muted border border-border px-3 py-2 text-xs font-mono mt-1">
              {'{chain-config-dir}/{blockchainID}/upgrade.json'}
            </pre>
            <p className="text-xs">
              The default chain config directory is{' '}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">~/.avalanchego/configs/chains/</code>.
            </p>
          </div>

          <div className="space-y-1">
            <p className="font-medium text-foreground">2. Restart all validator nodes</p>
            <p>
              Every validator must have the file in place and the node restarted <strong>before</strong> the
              first upgrade timestamp. AvalancheGo will fail to process blocks if the upgrade activates
              without the file.
            </p>
          </div>

          <div className="space-y-1">
            <p className="font-medium text-foreground">3. Verify the upgrade was loaded</p>
            <p>
              After restarting, confirm the upgrade config was picked up via the RPC:
            </p>
            <pre className="rounded bg-muted border border-border px-3 py-2 text-xs font-mono mt-1 whitespace-pre-wrap">
{`curl -X POST --data '{"jsonrpc":"2.0","id":1,"method":"eth_getChainConfig","params":[]}' \\
  -H "Content-Type: application/json" \\
  <your-node-rpc-url>/ext/bc/<blockchainID>/rpc`}
            </pre>
            <p>Look for the <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">precompileUpgrades</code> field in the response.</p>
          </div>

          <div className="space-y-1">
            <p className="font-medium text-foreground">4. Preserve existing entries</p>
            <p>
              The <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">precompileUpgrades</code> list
              is <strong>append-only</strong>. Once an upgrade has activated, never remove its entry from the file.
              If you have an existing <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">upgrade.json</code>,
              paste any previously activated entries above the new ones before deploying.
            </p>
          </div>
        </div>

        <Link
          href="/docs/avalanche-l1s/upgrade/precompile-upgrades"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Read full documentation
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export default withConsoleToolMetadata(ExportUpgradeInner, metadata);
