"use client";

import { useState, useCallback } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EvaluationPanel } from "./EvaluationPanel";
import { StageHistory } from "./StageHistory";
import { AdvanceStageControls } from "./AdvanceStageControls";
import { getEventConfig } from "./event-configs";
import type { SubmissionRow, EvaluationData, MemberApplication } from "./types";
import type { EventConfig } from "./event-configs";

interface Props {
  row: SubmissionRow;
  evaluations?: EvaluationData[];
  currentUserId: string;
  isDevrel?: boolean;
  onClose: () => void;
  onEvaluationSaved?: (formDataId: string, evaluation: EvaluationData) => void;
  onStageAdvanced?: (formDataId: string, newStage: number) => void;
}

const TABS = [
  { id: "project" as const, label: "Project & Team" },
  { id: "submission" as const, label: "Stage Submissions" },
  { id: "evaluation" as const, label: "Evaluation" },
];

type TabId = (typeof TABS)[number]["id"];

export function SubmissionDetailPanel({
  row,
  evaluations: evalsProp,
  currentUserId,
  isDevrel = false,
  onClose,
  onEvaluationSaved: onParentEvalSaved,
  onStageAdvanced,
}: Props) {
  const { project, formData, origin } = row;
  const [activeTab, setActiveTab] = useState<TabId>("project");
  const evaluations = evalsProp ?? row.evaluations;

  const handleEvaluationSaved = useCallback(
    (formDataId: string, evaluation: EvaluationData) => {
      onParentEvalSaved?.(formDataId, evaluation);
    },
    [onParentEvalSaved]
  );

  const eventConfig = getEventConfig(origin);
  const formDataKey = eventConfig?.formDataKey;
  const displayData = formDataKey
    ? (formData[formDataKey] as Record<string, unknown>) ?? formData
    : formData;

  const headerTitle = project?.projectName || row.applicantName;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-5xl mx-4 max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100 truncate" title={row.projectName}>
              {headerTitle}
            </h2>
            {project?.projectName && (
              <span className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                {row.applicantName}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 border-b border-zinc-200 dark:border-zinc-800">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-sm rounded-t-md cursor-pointer transition-colors ${
                activeTab === tab.id
                  ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white border-b-2 border-blue-500"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="overflow-auto max-h-[70vh] p-4 scroll-smooth">
          {/* Tab: Project & Team */}
          {activeTab === "project" && (
            <div className="space-y-4">
              {!project ? (
                <p className="text-zinc-500 text-sm py-4">
                  No project data available.
                </p>
              ) : (
                <>
                  <FieldGroup title="Project Details">
                    <Field
                      label="Project Name"
                      value={project.projectName}
                    />
                    <Field
                      label="Short Description"
                      value={project.shortDescription}
                      long
                    />
                    <Field
                      label="Full Description"
                      value={project.fullDescription}
                      long
                    />
                    <Field label="Tech Stack" value={project.techStack} />
                    <Field
                      label="Tracks"
                      value={project.tracks.join(", ")}
                    />
                    <Field
                      label="Categories"
                      value={project.categories.join(", ")}
                    />
                    <Field
                      label="Pre-existing Idea"
                      value={project.isPreexistingIdea ? "Yes" : "No"}
                    />
                  </FieldGroup>

                  <FieldGroup title="Links">
                    <LinkField
                      label="GitHub"
                      url={project.githubRepository}
                    />
                    <LinkField label="Demo" url={project.demoLink} />
                    <LinkField label="Video" url={project.demoVideoLink} />
                  </FieldGroup>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800 pb-1">
                      Team Members ({project.members.length})
                    </h3>
                    <div className="space-y-2">
                      {row.memberApplications.length > 0 ? (
                        row.memberApplications.map((member) => (
                          <MemberApplicationSection
                            key={member.email}
                            member={member}
                            eventConfig={eventConfig}
                          />
                        ))
                      ) : (
                        project.members.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span className="text-zinc-600 dark:text-zinc-300">{m.email}</span>
                            <Badge variant="outline" className="text-xs">
                              {m.role}
                            </Badge>
                            <Badge
                              variant={m.status === "Confirmed" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {m.status}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab: Stage Submissions */}
          {activeTab === "submission" && (
            <div className="space-y-4">
              {eventConfig?.stageFields ? (
                Object.entries(eventConfig.stageFields).map(
                  ([stageKey, stage]) => {
                    const hasData = stage.fields.some(
                      (f) =>
                        displayData[f.key] &&
                        String(displayData[f.key]).trim().length > 0
                    );
                    return (
                      <StageSection
                        key={stageKey}
                        title={stage.label}
                        hasData={hasData}
                        fields={stage.fields}
                        data={displayData}
                      />
                    );
                  }
                )
              ) : (
                <GenericFormDataView data={displayData} />
              )}
            </div>
          )}

          {/* Tab: Evaluation */}
          {activeTab === "evaluation" && (
            <div className="space-y-4">
              <AdvanceStageControls
                formDataId={row.formDataId}
                currentStage={row.currentStage}
                isDevrel={isDevrel}
                onStageAdvanced={(id, stage) => onStageAdvanced?.(id, stage)}
              />

              <EvaluationPanel
                key={`${row.formDataId}-${row.currentStage}`}
                formDataId={row.formDataId}
                origin={origin}
                evaluations={evaluations}
                currentUserId={currentUserId}
                stage={row.currentStage}
                currentStage={row.currentStage}
                onEvaluationSaved={handleEvaluationSaved}
              />

              <StageHistory
                evaluations={evaluations}
                currentStage={row.currentStage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemberApplicationSection({
  member,
  eventConfig,
}: {
  member: MemberApplication;
  eventConfig: EventConfig | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hasApplication = member.data !== null;
  const displayName = member.data
    ? `${member.data.first_name ?? ""} ${member.data.last_name ?? ""}`.trim() || member.name
    : member.name;

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
      >
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 dark:text-zinc-600 text-xs">{isOpen ? "\u25BC" : "\u25B6"}</span>
          <span className="text-zinc-700 dark:text-zinc-200 font-medium">{displayName}</span>
          <span className="text-zinc-500 text-xs">{member.email}</span>
          <Badge variant="outline" className="text-xs">
            {member.role}
          </Badge>
          <Badge
            variant={member.status === "Confirmed" ? "default" : "secondary"}
            className="text-xs"
          >
            {member.status}
          </Badge>
        </div>
        {hasApplication ? (
          <Badge variant="outline" className="text-xs bg-green-900/50 text-green-300 border-green-700">
            Applied
          </Badge>
        ) : (
          <span className="text-xs text-zinc-400 dark:text-zinc-600">No application</span>
        )}
      </button>
      {isOpen && hasApplication && member.data && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3">
          {eventConfig?.applicationDetailSections ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eventConfig.applicationDetailSections.map((section) => (
                <FieldGroup key={section.title} title={section.title}>
                  {section.fields.map((f) => (
                    <Field
                      key={f.key}
                      label={f.label}
                      value={member.data?.[f.key] != null ? String(member.data[f.key]) : null}
                      long={f.long}
                    />
                  ))}
                </FieldGroup>
              ))}
            </div>
          ) : (
            <GenericFormDataView data={member.data} />
          )}
        </div>
      )}
      {isOpen && !hasApplication && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3">
          <p className="text-zinc-500 text-sm">This member did not submit an individual application.</p>
        </div>
      )}
    </div>
  );
}

function GenericFormDataView({
  data,
}: {
  data: Record<string, unknown>;
}) {
  const entries = Object.entries(data).filter(
    ([, val]) => val !== null && val !== undefined && String(val).trim() !== ""
  );

  if (entries.length === 0) {
    return (
      <p className="text-zinc-500 text-sm py-4">No submission data.</p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, val]) => (
        <div key={key} className="space-y-0.5">
          <span className="text-xs text-zinc-500">
            {key.replace(/_/g, " ")}:
          </span>
          <p className="text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap">
            {typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)}
          </p>
        </div>
      ))}
    </div>
  );
}

function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800 pb-1">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  long = false,
}: {
  label: string;
  value: string | null | undefined;
  long?: boolean;
}) {
  if (!value || !value.trim()) return null;
  return (
    <div className={long ? "space-y-0.5" : "flex gap-2 items-baseline"}>
      <span className="text-xs text-zinc-500 shrink-0">{label}:</span>
      <span
        className={`text-sm text-zinc-700 dark:text-zinc-200 break-words ${
          long ? "block whitespace-pre-wrap" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function LinkField({ label, url }: { label: string; url: string }) {
  if (!url || !url.trim()) return null;

  const isSafeUrl = (() => {
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  })();

  return (
    <div className="flex gap-2 items-baseline">
      <span className="text-xs text-zinc-500 shrink-0">{label}:</span>
      {isSafeUrl ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-400 hover:text-blue-300 underline truncate"
        >
          {url}
        </a>
      ) : (
        <span className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{url}</span>
      )}
    </div>
  );
}

function StageSection({
  title,
  hasData,
  fields,
  data,
}: {
  title: string;
  hasData: boolean;
  fields: { key: string; label: string }[];
  data: Record<string, unknown>;
}) {
  const [isOpen, setIsOpen] = useState(hasData);

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-md">
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
      >
        <div className="flex items-center gap-2">
          <span className="text-zinc-700 dark:text-zinc-200 font-medium">{title}</span>
          <Badge
            variant={hasData ? "default" : "secondary"}
            className={`text-xs ${
              hasData
                ? "bg-green-900/50 text-green-300 border-green-700"
                : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
            }`}
          >
            {hasData ? "Submitted" : "Not started"}
          </Badge>
        </div>
        <span className="text-zinc-500">
          {isOpen ? "\u25B2" : "\u25BC"}
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 py-2 space-y-1.5">
          {fields.map((f) => {
            const val = data[f.key];
            if (!val || !String(val).trim()) return null;
            return (
              <div key={f.key} className="space-y-0.5">
                <span className="text-xs text-zinc-500">{f.label}:</span>
                <p className="text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap">
                  {String(val)}
                </p>
              </div>
            );
          })}
          {!hasData && (
            <p className="text-xs text-zinc-500 py-1">
              No data submitted for this stage.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
