"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { normalizeUrlInput } from "@/types/audits";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUDIT_PROJECT_TYPES, DEPLOYMENT_TARGET_LABELS } from "@/lib/audits/constants";
import { DEPLOYMENT_TARGETS } from "@/lib/audits/status";
import { ChipGroup, asChips } from "@/components/audits/shared/ChipGroup";
import {
  fetchMyProjects,
  projectToWizardPatch,
  type ImportableProject,
} from "@/components/audits/wizard/importProject";
import type { AuditWizardValues } from "@/components/audits/wizard/types";

const DEPLOYMENT_OPTIONS = DEPLOYMENT_TARGETS.map((value) => ({
  value,
  label: DEPLOYMENT_TARGET_LABELS[value],
}));

interface StepProjectProps {
  /** ?project=<id> entry point: pre-imports once, everything stays editable. */
  importProjectId: string | null;
}

export function StepProject({ importProjectId }: StepProjectProps) {
  const form = useFormContext<AuditWizardValues>();
  const [projects, setProjects] = useState<ImportableProject[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const appliedRef = useRef(false);

  const applyImport = useCallback(
    (project: ImportableProject) => {
      const patch = projectToWizardPatch(project);
      for (const [key, value] of Object.entries(patch)) {
        form.setValue(key as keyof AuditWizardValues, value as never, { shouldDirty: true });
      }
      toast.success(`Imported ${project.project_name}. Everything stays editable.`);
    },
    [form],
  );

  useEffect(() => {
    let cancelled = false;
    fetchMyProjects()
      .then((rows) => {
        if (cancelled) return;
        setProjects(rows);
        setLoadState("ready");
        if (importProjectId && !appliedRef.current) {
          const match = rows.find((row) => row.id === importProjectId);
          if (match) {
            appliedRef.current = true;
            applyImport(match);
          }
        }
      })
      .catch(() => {
        // Import is a convenience; the wizard works without it.
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [importProjectId, applyImport]);

  return (
    <div className="space-y-6">
      {/* Always visible: the import affordance is a first-class entry point,
          so an account without projects still learns it exists. */}
      <div className="space-y-1.5 rounded-lg border border-zinc-200 p-4 dark:border-white/10">
        <p className="text-sm font-medium">Import from your Builder Hub project</p>
        {loadState === "loading" ? (
          <p className="text-sm text-muted-foreground">Loading your projects…</p>
        ) : loadState === "error" ? (
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t load your projects right now · fill in the details manually below.
          </p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Builder Hub projects on this account yet · fill in the details manually below.
          </p>
        ) : (
          <>
            <Select
              value={form.watch("source_project_id") ?? ""}
              onValueChange={(id) => {
                const match = projects.find((row) => row.id === id);
                if (match) applyImport(match);
              }}
            >
              <SelectTrigger className="h-11 md:h-10">
                <SelectValue placeholder="Pick a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.project_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Pre-fills name, description, website and repos from the project record. Everything
              stays editable.
            </p>
          </>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <FormField
          control={form.control}
          name="project_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Project name <span className="text-brand">*</span>
              </FormLabel>
              <FormControl>
                <Input {...field} className="h-11 md:h-10" autoComplete="organization" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="website"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Project website <span className="text-brand">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  inputMode="url"
                  // The scheme is optional to type: normalized on blur so the
                  // field shows exactly what gets saved.
                  placeholder="yourproject.com"
                  onBlur={(event) => {
                    field.onBlur();
                    const normalized = normalizeUrlInput(event.target.value);
                    if (normalized !== event.target.value) field.onChange(normalized);
                  }}
                  className="h-11 md:h-10"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Project description <span className="text-brand">*</span>
            </FormLabel>
            <FormControl>
              <Textarea {...field} rows={4} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="project_types"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Project type{" "}
              <span className="font-normal text-muted-foreground">· select all that apply</span>
            </FormLabel>
            <ChipGroup
              multiple
              collapsible
              options={asChips(AUDIT_PROJECT_TYPES)}
              value={field.value}
              onChange={field.onChange}
              aria-label="Project type"
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid items-start gap-6 md:grid-cols-2">
        <FormField
          control={form.control}
          name="deployment_target"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Deployment target <span className="text-brand">*</span>
              </FormLabel>
              <ChipGroup
                options={DEPLOYMENT_OPTIONS}
                value={field.value ? [field.value] : []}
                onChange={(next) => field.onChange(next[0] ?? "")}
                aria-label="Deployment target"
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="multichain"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-white/10">
              <div>
                <FormLabel>Multi-chain project</FormLabel>
                <FormDescription>Also deployed outside Avalanche</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
