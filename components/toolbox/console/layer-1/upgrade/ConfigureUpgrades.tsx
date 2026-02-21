"use client";

import { useMemo } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/toolbox/components/Button";
import { useUpgradeStore } from "@/components/toolbox/stores/upgradeStore";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "@/components/toolbox/components/WithConsoleToolMetadata";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { validateEntries } from "./types";
import { genUpgradeJson } from "./genUpgradeJson";
import UpgradeEntryCard from "./UpgradeEntryCard";

const metadata: ConsoleToolMetadata = {
  title: "Configure Upgrades",
  description: "Add and configure precompile upgrade entries for your upgrade.json file",
  toolRequirements: [],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function ConfigureUpgradesInner({ onSuccess }: BaseConsoleToolProps) {
  const entries = useUpgradeStore(state => state.entries);
  const addEntry = useUpgradeStore(state => state.addEntry);
  const removeEntry = useUpgradeStore(state => state.removeEntry);
  const updateEntry = useUpgradeStore(state => state.updateEntry);
  const reset = useUpgradeStore(state => state.reset);

  const { errors, warnings } = useMemo(() => validateEntries(entries), [entries]);

  const upgradeJson = useMemo(() => {
    try {
      return JSON.stringify(genUpgradeJson(entries), null, 2);
    } catch {
      return '{}';
    }
  }, [entries]);

  const hasBlockingErrors = Object.keys(errors).length > 0;

  return (
    <div className="space-y-6">
      {/* Warning callout */}
      <div className="flex gap-3 p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700/50">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1 text-sm">
          <p className="font-medium text-amber-800 dark:text-amber-200">Coordination required</p>
          <p className="text-amber-700 dark:text-amber-300">
            All validators must upgrade to a compatible AvalancheGo version and have the correct{' '}
            <code className="font-mono text-xs">upgrade.json</code> file before the first upgrade timestamp.
            Once an upgrade activates, its entry must remain in the file permanently.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel: entry list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Upgrade Entries</h3>
            {entries.length > 0 && (
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>

          {entries.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No entries yet. Click &ldquo;Add Upgrade Entry&rdquo; to begin.
            </div>
          )}

          <div className="space-y-3">
            {entries.map((entry, index) => (
              <UpgradeEntryCard
                key={entry.id}
                entry={entry}
                index={index}
                errors={errors}
                warnings={warnings}
                onUpdate={patch => updateEntry(entry.id, patch)}
                onRemove={() => removeEntry(entry.id)}
              />
            ))}
          </div>

          <Button
            onClick={addEntry}
            variant="secondary"
            icon={<Plus className="h-4 w-4" />}
          >
            Add Upgrade Entry
          </Button>

          {entries.length > 0 && !hasBlockingErrors && (
            <Button onClick={onSuccess}>
              Review &amp; Export
            </Button>
          )}

          {hasBlockingErrors && entries.length > 0 && (
            <div className="rounded-md bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-700/50 p-3 text-sm text-red-700 dark:text-red-300">
              Fix the errors above before proceeding.
            </div>
          )}
        </div>

        {/* Right panel: live JSON preview */}
        <div className="lg:sticky lg:top-4 space-y-2 self-start">
          <h3 className="text-sm font-semibold text-foreground">Live Preview</h3>
          <pre className="rounded-lg border border-border bg-muted p-4 text-xs font-mono overflow-auto max-h-[600px] whitespace-pre-wrap break-all">
            {upgradeJson}
          </pre>
          {errors.general && (
            <p className="text-xs text-muted-foreground italic">{errors.general}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default withConsoleToolMetadata(ConfigureUpgradesInner, metadata);
