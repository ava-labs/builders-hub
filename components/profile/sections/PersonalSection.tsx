"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hsEmploymentRoles } from "@/constants/hs_employment_role";
import type { ProfileFormValues } from "../components/hooks/useProfileForm";
import { COUNTRIES, ROLES, SKILL_SUGGESTIONS } from "../shell/data";
import { rolesFromValues, roleFieldKey } from "../shell/adapter";
import type { ProfileRole } from "../shell/types";
import {
  Button,
  FieldError,
  FOCUS,
  Group,
  Row,
  SectionHeader,
  Select,
  Stack,
  TextArea,
  TextInput,
} from "../ui";

const BIO_MAX = 250; // the server's limit (lib/schemas/extended-profile.ts)

/** the detail fields each role carries, cleared when the role is turned off */
const ROLE_DETAILS: Partial<Record<ProfileRole, Array<keyof ProfileFormValues>>> = {
  university: ["student_institution"],
  founder: ["founder_company_name"],
  employee: ["employee_company_name", "employee_role"],
};

export function PersonalSection({
  form,
}: {
  form: UseFormReturn<ProfileFormValues>;
}) {
  const { register, watch, setValue, formState } = form;
  const errors = formState.errors;
  const values = watch();
  const roles = rolesFromValues(values);
  const bio = values.bio ?? "";

  const toggleRole = (role: ProfileRole) => {
    const key = roleFieldKey(role) as keyof ProfileFormValues;
    const next = !values[key];
    setValue(key, next as never, { shouldDirty: true });
    // a role turned off takes its details with it, so user_type never claims
    // a company for a role the user no longer has
    if (!next) {
      for (const field of ROLE_DETAILS[role] ?? []) setValue(field, "" as never, { shouldDirty: true });
    }
  };

  return (
    <>
      <SectionHeader eyebrow="Account" title="Personal info" id="section-title" />
      <Stack>
        <Group label="Profile">
          <Row label="Full name" htmlFor="pr-name">
            <TextInput
              id="pr-name"
              autoComplete="name"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "pr-name-error" : undefined}
              {...register("name")}
            />
            <FieldError id="pr-name-error">{errors.name?.message}</FieldError>
          </Row>
          <Row
            label="Bio"
            htmlFor="pr-bio"
            align="start"
            hint={
              <span className="flex justify-between gap-4">
                <span>What you build, in a sentence or two.</span>
                <span className="font-mono tabular-nums">
                  {bio.length}/{BIO_MAX}
                </span>
              </span>
            }
          >
            <TextArea
              id="pr-bio"
              maxLength={BIO_MAX}
              aria-invalid={errors.bio ? true : undefined}
              aria-describedby={errors.bio ? "pr-bio-error" : undefined}
              {...register("bio")}
            />
            <FieldError id="pr-bio-error">{errors.bio?.message}</FieldError>
          </Row>
          <Row label="Country" htmlFor="pr-country">
            <Select id="pr-country" autoComplete="country-name" {...register("country")}>
              <option value="">Select a country</option>
              {/* a country stored before the list changed still shows */}
              {values.country && !COUNTRIES.includes(values.country) && (
                <option value={values.country}>{values.country}</option>
              )}
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Row>
        </Group>

        <Group label="Roles">
          {ROLES.map((role) => {
            const on = roles.includes(role.id);
            const id = `pr-role-${role.id}`;
            return (
              <div key={role.id}>
                <label
                  htmlFor={id}
                  className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-zinc-50 sm:px-5 dark:hover:bg-zinc-900/40"
                >
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium text-zinc-900 dark:text-zinc-100">{role.name}</span>
                    <span className="block text-[13px] text-zinc-500 dark:text-zinc-400">{role.description}</span>
                  </span>
                  <input
                    id={id}
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleRole(role.id)}
                    className={cn("h-4 w-4 shrink-0 accent-[#E6212F]", FOCUS)}
                  />
                </label>
                {on && role.id === "university" && (
                  <Row label="University" htmlFor="pr-university">
                    <TextInput id="pr-university" placeholder="University name" {...register("student_institution")} />
                  </Row>
                )}
                {on && role.id === "founder" && (
                  <Row label="Company" htmlFor="pr-founder-company">
                    <TextInput id="pr-founder-company" placeholder="Company name" {...register("founder_company_name")} />
                  </Row>
                )}
                {on && role.id === "employee" && (
                  <>
                    <Row label="Employer" htmlFor="pr-employer">
                      <TextInput id="pr-employer" placeholder="Company name" {...register("employee_company_name")} />
                    </Row>
                    <Row label="Job" htmlFor="pr-job">
                      <Select id="pr-job" {...register("employee_role")}>
                        <option value="">Select a job</option>
                        {hsEmploymentRoles.map((r) => (
                          <option key={r.value} value={r.label}>
                            {r.label}
                          </option>
                        ))}
                      </Select>
                    </Row>
                  </>
                )}
              </div>
            );
          })}
        </Group>

        <SkillsGroup form={form} />
      </Stack>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Skills: the chips you have, a field to add one, and suggestions      */
/* (the skills other builders use most, else a fixed list).             */
function SkillsGroup({ form }: { form: UseFormReturn<ProfileFormValues> }) {
  const skills = (form.watch("skills") ?? []).filter((s) => s?.trim());
  const [draft, setDraft] = React.useState("");
  const [popular, setPopular] = React.useState<string[]>(() => SKILL_SUGGESTIONS.map((s) => s.name));
  const have = React.useMemo(() => new Set(skills.map((s) => s.toLowerCase())), [skills]);
  const listRef = React.useRef<HTMLUListElement>(null);

  // a keyboard add or remove unmounts the focused control (or disables Add);
  // after the commit, put the focus on a control that stays, else the field
  const refocus = (pick?: () => HTMLElement | null | undefined) =>
    requestAnimationFrame(() => (pick?.() ?? document.getElementById("pr-skill"))?.focus());

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/profile/popular-skills")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Array<{ name: string }> | null) => {
        if (cancelled || !Array.isArray(data) || data.length === 0) return;
        const names = data.map((s) => s.name).filter(Boolean);
        const seen = new Set(names.map((n) => n.toLowerCase()));
        setPopular([...names, ...SKILL_SUGGESTIONS.map((s) => s.name).filter((n) => !seen.has(n.toLowerCase()))]);
      })
      .catch(() => {
        /* keep the fixed list */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const add = (raw: string, fromKeyboard = false) => {
    const name = raw.trim();
    if (!name || have.has(name.toLowerCase())) return;
    form.setValue("skills", [...skills, name], { shouldDirty: true });
    setDraft("");
    if (fromKeyboard) refocus();
  };
  const remove = (name: string, index: number, fromKeyboard = false) => {
    form.setValue(
      "skills",
      skills.filter((s) => s !== name),
      { shouldDirty: true },
    );
    // the next chip's Remove, else the one before it
    if (fromKeyboard) {
      refocus(() => {
        const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("button");
        return buttons?.[index] ?? buttons?.[index - 1];
      });
    }
  };

  const suggestions = popular.filter((n) => !have.has(n.toLowerCase())).slice(0, 8);

  return (
    <Group label="Skills">
      <Row label="Your skills" align="start">
        {skills.length > 0 ? (
          <ul ref={listRef} className="flex flex-wrap gap-2" aria-label="Your skills">
            {skills.map((s, i) => (
              <li
                key={s}
                className="inline-flex h-8 items-center gap-1.5 border border-zinc-200 bg-zinc-50 pl-2.5 pr-1 text-[13px] text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {s}
                <button
                  type="button"
                  // a click from Enter or Space has detail 0
                  onClick={(e) => remove(s, i, e.detail === 0)}
                  aria-label={`Remove ${s}`}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                    FOCUS,
                  )}
                >
                  <X aria-hidden className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pt-1.5 text-[14px] text-zinc-500 dark:text-zinc-400">No skills yet.</p>
        )}
      </Row>
      <Row label="Add a skill" htmlFor="pr-skill" align="start">
        <div className="flex gap-2">
          <TextInput
            id="pr-skill"
            value={draft}
            placeholder="For example, Solidity"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              }
            }}
          />
          <Button onClick={(e) => add(draft, e.detail === 0)} disabled={!draft.trim()}>
            Add
          </Button>
        </div>
        {suggestions.length > 0 && (
          <div role="group" className="mt-3 flex flex-wrap gap-2" aria-label="Suggested skills">
            {suggestions.map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Add ${n}`}
                onClick={(e) => add(n, e.detail === 0)}
                className={cn(
                  "inline-flex h-7 items-center border border-dashed border-zinc-300 px-2.5 text-[12px] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-100 dark:hover:text-zinc-100",
                  FOCUS,
                )}
              >
                <span aria-hidden className="mr-1">
                  +
                </span>
                {n}
              </button>
            ))}
          </div>
        )}
      </Row>
    </Group>
  );
}
