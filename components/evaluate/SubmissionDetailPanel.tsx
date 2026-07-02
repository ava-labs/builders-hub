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
  showStages?: boolean;
  projectId?: string;
  onClose: () => void;
  onEvaluationSaved?: (key: string, evaluation: EvaluationData) => void;
  onStageAdvanced?: (formDataId: string, newStage: number) => void;
}

const ALL_TABS = [
  { id: "project" as const, label: "Project & Team" },
  { id: "submission" as const, label: "Stage Submissions" },
  { id: "evaluation" as const, label: "Evaluation" },
];

const FIELD_ROW_CLASS = "grid grid-cols-[9rem_minmax(0,1fr)] gap-3 items-baseline";
const FIELD_LABEL_CLASS = "text-xs text-zinc-500";

type TabId = (typeof ALL_TABS)[number]["id"];

export function SubmissionDetailPanel({
  row,
  evaluations: evalsProp,
  currentUserId,
  isDevrel = false,
  showStages = true,
  projectId,
  onClose,
  onEvaluationSaved: onParentEvalSaved,
  onStageAdvanced,
}: Props) {
  const { project, formData, origin } = row;

  const eventConfig = getEventConfig(origin);
  const formDataKey = eventConfig?.formDataKey;
  const displayData = formDataKey
    ? (formData[formDataKey] as Record<string, unknown>) ?? formData
    : formData;

  // Programs without per-stage submissions (e.g. grants) carry their application in
  // the top-level form data. Render those fields as labeled sections in a dedicated
  // "Application Details" tab instead of the generic, raw-keyed "Stage Submissions" dump.
  const topLevelAppSections =
    eventConfig?.applicationDetailSections && !eventConfig.stageFields
      ? eventConfig.applicationDetailSections
      : null;
  // Populated top-level fields not covered by a configured section, so nothing is lost
  // when the labeled sections replace the generic dump.
  const coveredKeys = new Set(
    topLevelAppSections?.flatMap((s) => s.fields.map((f) => f.key)),
  );
  const extraAppData = topLevelAppSections
    ? Object.fromEntries(
        Object.entries(displayData).filter(
          ([k, v]) => !coveredKeys.has(k) && v != null && String(v).trim() !== "",
        ),
      )
    : {};

  // The submission tab carries stage data for staged programs or, for grant-style
  // programs that have no stages, the application detail fields. It must not be gated on
  // showStages alone: grants pass showStages=false (no stageFields) yet still need this tab.
  const showSubmissionTab = showStages || topLevelAppSections != null;
  const tabs = (showSubmissionTab ? ALL_TABS : ALL_TABS.filter((t) => t.id !== "submission")).map(
    (t) => (t.id === "submission" && topLevelAppSections ? { ...t, label: "Application Details" } : t),
  );
  const [activeTab, setActiveTab] = useState<TabId>("project");
  const evaluations = evalsProp ?? row.evaluations;

  const handleEvaluationSaved = useCallback(
    (key: string, evaluation: EvaluationData) => {
      onParentEvalSaved?.(key, evaluation);
    },
    [onParentEvalSaved]
  );

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

        <div className="flex gap-1 px-6 pt-3 border-b border-zinc-200 dark:border-zinc-800">
          {tabs.map((tab) => (
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

        <div className="overflow-auto max-h-[70vh] p-4 scroll-smooth">
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
                    {project.tags && project.tags.length > 0 && (
                      <div className={FIELD_ROW_CLASS}>
                        <span className={FIELD_LABEL_CLASS}>Tags:</span>
                        <div className="flex flex-wrap gap-1">
                          {project.tags.map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
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
                    {project.website &&
                      Object.entries(project.website).map(([key, url]) => (
                        <LinkField
                          key={`website-${key}`}
                          label={key || "Website"}
                          url={url}
                        />
                      ))}
                    {project.socials &&
                      Object.entries(project.socials).map(([key, url]) => (
                        <LinkField
                          key={`social-${key}`}
                          label={key || "Social"}
                          url={url}
                        />
                      ))}
                  </FieldGroup>

                  {project.deployedAddresses && project.deployedAddresses.length > 0 && (
                    <FieldGroup title="Deployed Addresses">
                      <div className="space-y-1.5">
                        {project.deployedAddresses.map((d, idx) => (
                          <div
                            key={`${d.address}-${idx}`}
                            className="flex flex-wrap items-baseline gap-2 text-sm"
                          >
                            {d.tag && (
                              <Badge variant="outline" className="text-xs">
                                {d.tag}
                              </Badge>
                            )}
                            <code className="font-mono text-xs text-zinc-700 dark:text-zinc-200 break-all">
                              {d.address}
                            </code>
                          </div>
                        ))}
                      </div>
                    </FieldGroup>
                  )}

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
                            <span className="text-zinc-600 dark:text-zinc-300">
                              {m.name?.trim() || "Unnamed member"}
                            </span>
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

          {showSubmissionTab && activeTab === "submission" && (
            <div className="space-y-4">
              {isAnswerEnvelope(displayData) ? (
                <StageAnswerView envelope={displayData} />
              ) : eventConfig?.stageFields ? (
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
              ) : topLevelAppSections ? (
                <>
                  {topLevelAppSections.map((section) => (
                    <FieldGroup key={section.title} title={section.title}>
                      {section.fields.map((f) => (
                        <Field
                          key={f.key}
                          label={f.label}
                          value={displayData[f.key] != null ? String(displayData[f.key]) : null}
                          long={f.long}
                        />
                      ))}
                    </FieldGroup>
                  ))}
                  {Object.keys(extraAppData).length > 0 && (
                    <FieldGroup title="Other Details">
                      <GenericFormDataView data={extraAppData} />
                    </FieldGroup>
                  )}
                </>
              ) : (
                <GenericFormDataView data={displayData} />
              )}
            </div>
          )}

          {activeTab === "evaluation" && (
            <div className="space-y-4">
              {showStages && (
                <AdvanceStageControls
                  formDataId={row.formDataId}
                  currentStage={row.currentStage}
                  isDevrel={isDevrel}
                  onStageAdvanced={(id, stage) => onStageAdvanced?.(id, stage)}
                />
              )}

              <EvaluationPanel
                key={`${projectId ?? row.formDataId}-${row.currentStage}`}
                formDataId={projectId ? undefined : row.formDataId}
                projectId={projectId}
                origin={origin}
                evaluations={evaluations}
                currentUserId={currentUserId}
                stage={row.currentStage}
                currentStage={row.currentStage}
                onEvaluationSaved={handleEvaluationSaved}
              />

              {showStages && (
                <StageHistory
                  evaluations={evaluations}
                  currentStage={row.currentStage}
                />
              )}
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

interface StageAnswerEntry {
  question_id?: string;
  question_label?: string;
  question_type?: string;
  stage_index?: number;
  answer?: unknown;
}

interface StageAnswerEnvelope {
  answers: Record<string, StageAnswerEntry>;
}

function isAnswerEnvelope(
  data: Record<string, unknown>
): data is Record<string, unknown> & StageAnswerEnvelope {
  const answers = (data as { answers?: unknown }).answers;
  return (
    typeof answers === "object" &&
    answers !== null &&
    !Array.isArray(answers)
  );
}

function formatStageAnswer(answer: unknown): string {
  if (answer === null || answer === undefined) return "";
  if (typeof answer === "boolean") return answer ? "Yes" : "No";
  if (Array.isArray(answer)) {
    return answer
      .map((item) =>
        typeof item === "object" && item !== null
          ? JSON.stringify(item)
          : String(item)
      )
      .filter((s) => s.trim().length > 0)
      .join(", ");
  }
  if (typeof answer === "object") return JSON.stringify(answer, null, 2);
  return String(answer);
}

function StageAnswerView({ envelope }: { envelope: StageAnswerEnvelope }) {
  const entries = Object.entries(envelope.answers)
    .map(([fieldId, entry]) => ({
      fieldId,
      label: entry.question_label?.trim() || fieldId,
      value: formatStageAnswer(entry.answer),
    }))
    .filter((e) => e.value.trim().length > 0);

  if (entries.length === 0) {
    return <p className="text-zinc-500 text-sm py-4">No submission data.</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.fieldId} className="space-y-0.5">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            {entry.label}
          </span>
          <p className="text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap break-words">
            {entry.value}
          </p>
        </div>
      ))}
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
        <div key={key} className={FIELD_ROW_CLASS}>
          <span className={FIELD_LABEL_CLASS}>
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
    <div className={FIELD_ROW_CLASS}>
      <span className={FIELD_LABEL_CLASS}>{label}:</span>
      <span
        className={`text-sm text-zinc-700 dark:text-zinc-200 break-words ${
          long ? "whitespace-pre-wrap" : ""
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
    <div className={FIELD_ROW_CLASS}>
      <span className={FIELD_LABEL_CLASS}>{label}:</span>
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
              <div key={f.key} className={FIELD_ROW_CLASS}>
                <span className={FIELD_LABEL_CLASS}>{f.label}:</span>
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
