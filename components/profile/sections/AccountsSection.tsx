"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileFormValues } from "../components/hooks/useProfileForm";
import { WalletConnectButton } from "../components/WalletConnectButton";
import {
  ensureUrl,
  extractGithubUsername,
  extractLinkedInSlug,
  extractXUsername,
  siteLinksFromValues,
  walletsFromValues,
} from "../shell/adapter";
import { GitHubIcon, LinkedInIcon, TelegramIcon, XIcon } from "../shell/icons";
import {
  Button,
  Cell,
  EmptyState,
  FieldError,
  FOCUS,
  Group,
  PrefixInput,
  Row,
  SectionHeader,
  Stack,
  Tag,
  TextInput,
} from "../ui";

function RowLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="text-zinc-400 dark:text-zinc-500">
        {icon}
      </span>
      {children}
    </span>
  );
}

/** an account linked through its own sign-in: the handle, or a Connect button */
function LinkedAccount({
  label,
  icon,
  handle,
  href,
  onConnect,
  onDisconnect,
}: {
  label: string;
  icon: React.ReactNode;
  handle: string;
  href: string;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <Row label={<RowLabel icon={icon}>{label}</RowLabel>}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {handle ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "min-w-0 truncate font-mono text-[13px] text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100",
              FOCUS,
            )}
          >
            {handle}
          </a>
        ) : (
          <span className="text-[14px] text-zinc-500 dark:text-zinc-400">Not connected</span>
        )}
        {handle ? (
          <Button variant="secondary" onClick={onDisconnect} aria-label={`Disconnect ${label}`}>
            Disconnect
          </Button>
        ) : (
          <Button variant="secondary" onClick={onConnect} aria-label={`Connect ${label}`}>
            Connect
          </Button>
        )}
      </div>
    </Row>
  );
}

export function AccountsSection({
  form,
  githubConnected,
  onGithubConnect,
  onGithubDisconnect,
  onXConnect,
  onXDisconnect,
}: {
  form: UseFormReturn<ProfileFormValues>;
  githubConnected: boolean;
  onGithubConnect: () => void;
  onGithubDisconnect: () => void;
  onXConnect: () => void;
  onXDisconnect: () => void;
}) {
  const { register, watch, setValue, formState } = form;
  const errors = formState.errors;
  const values = watch();
  const github = githubConnected ? extractGithubUsername(values.github_account ?? "") : "";
  const xHandle = extractXUsername(values.x_account ?? "");
  const linkedin = extractLinkedInSlug(values.linkedin_account ?? "");
  const wallets = walletsFromValues(values);
  const addWalletRef = React.useRef<HTMLButtonElement>(null);

  const removeWallet = (address: string, fromKeyboard = false) => {
    setValue(
      "wallet",
      (values.wallet ?? []).filter((w) => w.toLowerCase() !== address.toLowerCase()),
      { shouldDirty: true },
    );
    // the focused Remove unmounts; after the commit, focus the control that stays
    if (fromKeyboard) requestAnimationFrame(() => addWalletRef.current?.focus());
  };
  const addWallet = (address: string) => {
    const a = address?.trim() ?? "";
    if (!/^0x[a-fA-F0-9]{40}$/.test(a)) return;
    const current = values.wallet ?? [];
    if (current.some((w) => w.toLowerCase() === a.toLowerCase())) return;
    setValue("wallet", [...current, a], { shouldDirty: true });
  };

  return (
    <>
      <SectionHeader eyebrow="Account" title="Connected accounts" id="section-title" />
      <Stack>
        <Group label="Accounts">
          <LinkedAccount
            label="GitHub"
            icon={<GitHubIcon size={15} />}
            handle={github}
            href={`https://github.com/${github}`}
            onConnect={onGithubConnect}
            onDisconnect={onGithubDisconnect}
          />
          <LinkedAccount
            label="X"
            icon={<XIcon size={13} />}
            handle={xHandle ? `@${xHandle}` : ""}
            href={`https://x.com/${xHandle}`}
            onConnect={onXConnect}
            onDisconnect={onXDisconnect}
          />
          <Row label={<RowLabel icon={<TelegramIcon size={15} />}>Telegram</RowLabel>} htmlFor="pr-telegram">
            <PrefixInput
              id="pr-telegram"
              prefix="@"
              placeholder="username"
              autoComplete="off"
              aria-invalid={errors.telegram_account ? true : undefined}
              aria-describedby={errors.telegram_account ? "pr-telegram-error" : undefined}
              {...register("telegram_account", { setValueAs: (v: string) => v.trim().replace(/^@/, "") })}
            />
            <FieldError id="pr-telegram-error">{errors.telegram_account?.message}</FieldError>
          </Row>
          <Row label={<RowLabel icon={<LinkedInIcon size={15} />}>LinkedIn</RowLabel>} htmlFor="pr-linkedin">
            <PrefixInput
              id="pr-linkedin"
              prefix="linkedin.com/in/"
              placeholder="username"
              autoComplete="off"
              value={linkedin}
              aria-invalid={errors.linkedin_account ? true : undefined}
              aria-describedby={errors.linkedin_account ? "pr-linkedin-error" : undefined}
              onChange={(e) => {
                // a pasted profile URL keeps only its username
                const slug = extractLinkedInSlug(e.target.value).replace(/^\/+|\/+$/g, "");
                setValue("linkedin_account", slug ? `https://linkedin.com/in/${slug}` : "", {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            />
            <FieldError id="pr-linkedin-error">{errors.linkedin_account?.message}</FieldError>
          </Row>
        </Group>

        <WebsitesGroup form={form} />

        <Group
          label="Wallets"
          action={
            <WalletConnectButton
              onWalletConnected={addWallet}
              currentAddress={wallets[wallets.length - 1]?.address}
              trigger={
                <Button ref={addWalletRef} variant="secondary" className="h-7 px-2.5">
                  <Plus aria-hidden className="h-3 w-3" />
                  Add wallet
                </Button>
              }
            />
          }
        >
          {wallets.length === 0 ? (
            <EmptyState>No wallet yet. Add the C-Chain address that gets your rewards.</EmptyState>
          ) : (
            wallets.map((w, i) => (
              <Cell key={w.address} className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="min-w-0 truncate font-mono text-[13px] text-zinc-900 dark:text-zinc-100" title={w.address}>
                    {w.address}
                  </span>
                  {i === 0 && <Tag tone="red">Primary</Tag>}
                  <Tag>C-Chain</Tag>
                </div>
                <Button
                  variant="ghost"
                  // a click from Enter or Space has detail 0
                  onClick={(e) => removeWallet(w.address, e.detail === 0)}
                  aria-label={`Remove wallet ${w.address}`}
                >
                  Remove
                </Button>
              </Cell>
            ))
          )}
          {errors.wallet?.message && (
            <Cell>
              <FieldError id="pr-wallet-error">{errors.wallet.message}</FieldError>
            </Cell>
          )}
        </Group>
      </Stack>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Websites: personal sites, one per row. A blank row stays local until  */
/* it has a URL, so the form only ever holds real links.                */
function WebsitesGroup({ form }: { form: UseFormReturn<ProfileFormValues> }) {
  const saved = siteLinksFromValues(form.watch()).map((l) => l.url);
  const [drafts, setDrafts] = React.useState<string[]>(saved);
  const savedKey = saved.join("\n");
  const inputs = React.useRef<Array<HTMLInputElement | null>>([]);
  const addRef = React.useRef<HTMLButtonElement>(null);

  // adopt the saved list when it changes from outside (the first load, a
  // discard, a save), but keep a blank row the user just added
  React.useEffect(() => {
    setDrafts((prev) => {
      const filled = prev.filter((u) => u.trim());
      if (filled.join("\n") === savedKey) return prev;
      return savedKey ? savedKey.split("\n") : [];
    });
  }, [savedKey]);

  const commit = (next: string[]) => {
    setDrafts(next);
    form.setValue(
      "additional_social_accounts",
      next.map((u) => u.trim()).filter(Boolean).map(ensureUrl),
      { shouldDirty: true, shouldValidate: true },
    );
  };
  // after the commit: the new row's field, so the user can type at once
  const addRow = () => {
    const index = drafts.length;
    setDrafts((d) => [...d, ""]);
    requestAnimationFrame(() => inputs.current[index]?.focus());
  };
  // the rows have index keys, so the field at the same index is the next row
  const removeRow = (index: number, fromKeyboard: boolean) => {
    commit(drafts.filter((_, j) => j !== index));
    if (fromKeyboard) requestAnimationFrame(() => (inputs.current[index] ?? addRef.current)?.focus());
  };
  const error = form.formState.errors.additional_social_accounts;
  const message = error?.message ?? (Array.isArray(error) ? error.find(Boolean)?.message : undefined);

  return (
    <Group
      label="Websites"
      action={
        <Button ref={addRef} variant="secondary" className="h-7 px-2.5" onClick={addRow}>
          <Plus aria-hidden className="h-3 w-3" />
          Add website
        </Button>
      }
    >
      {drafts.length === 0 ? (
        <EmptyState>No websites yet.</EmptyState>
      ) : (
        drafts.map((url, i) => (
          <Cell key={i} className="flex items-center gap-2">
            <TextInput
              ref={(el) => {
                inputs.current[i] = el;
              }}
              aria-label={`Website ${i + 1}`}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={url}
              onChange={(e) => commit(drafts.map((u, j) => (j === i ? e.target.value : u)))}
            />
            <button
              type="button"
              // a click from Enter or Space has detail 0
              onClick={(e) => removeRow(i, e.detail === 0)}
              aria-label={`Remove website ${i + 1}`}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                FOCUS,
              )}
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </Cell>
        ))
      )}
      {message && (
        <Cell>
          <FieldError id="pr-websites-error">{message}</FieldError>
        </Cell>
      )}
    </Group>
  );
}
