"use client";

import * as React from "react";
import { toast as sonnerToast } from "sonner";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ValidatorAlertResponse } from "@/types/validator-alerts";
import {
  alertMessageText,
  alertTypeLabel,
  alertTypeTone,
  BALANCE_DAYS_RANGE,
  buildAlertUpdate,
  buildCreateRequest,
  checksSummary,
  deliveryEmails,
  draftFromAlert,
  EXPIRY_DAYS_RANGE,
  formatAlertDate,
  isL1Alert,
  recentAlerts,
  truncateMiddle,
  UPTIME_RANGE,
  type AlertDraft,
  type DraftNumberField,
} from "./alerts-format";
import {
  Button,
  Cell,
  EmptyState,
  ErrorLine,
  FieldError,
  Group,
  LinkButton,
  Row,
  SectionHeader,
  SkeletonRows,
  Stack,
  StatusMark,
  Switch,
  Tag,
  TextInput,
} from "../ui";

const API = "/api/validator-alerts";
const JSON_HEADERS = { "Content-Type": "application/json" };

/** a fetch that throws the server's own error message */
async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : `The request failed (HTTP ${res.status}).`;
    throw new Error(message);
  }
  // every route here answers with JSON; a missing body must not reach state as an alert
  if (body === null) throw new Error("The server sent no data.");
  return body as T;
}

type AlertPatch = Partial<Pick<ValidatorAlertResponse, "active">>;

/* Validator alerts: email alerts for the nodes a person runs. Each change
   saves at once, as on the alert dashboard (/validator-alerts), which uses
   the same API. */
export function AlertsSection({ email }: { email: string }) {
  const [alerts, setAlerts] = React.useState<ValidatorAlertResponse[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const addButtonRef = React.useRef<HTMLButtonElement>(null);
  const formId = React.useId();

  const load = React.useCallback((signal?: AbortSignal) => {
    setFailed(false);
    setAlerts(null);
    call<ValidatorAlertResponse[]>(API, { signal })
      .then((data) => {
        if (!signal?.aborted) setAlerts(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!signal?.aborted) setFailed(true);
      });
  }, []);

  // drop the answer of a load that a newer mount or an unmount made stale
  React.useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const replace = (next: ValidatorAlertResponse) =>
    setAlerts((list) => (list ? list.map((a) => (a.id === next.id ? next : a)) : list));
  // patch by id, so a rollback never writes back a stale copy of the alert
  const patch = (id: string, fields: AlertPatch) =>
    setAlerts((list) => (list ? list.map((a) => (a.id === id ? { ...a, ...fields } : a)) : list));
  const removed = (id: string) => {
    setAlerts((list) => (list ? list.filter((a) => a.id !== id) : list));
    // the removed row held the focus; give it to the group's action
    addButtonRef.current?.focus();
  };
  const added = (alert: ValidatorAlertResponse) => {
    setAlerts((list) => [alert, ...(list ?? []).filter((a) => a.id !== alert.id)]);
    setAdding(false);
    // the form held the focus; give it back to the button that opened it
    addButtonRef.current?.focus();
  };
  const closeForm = () => {
    setAdding(false);
    addButtonRef.current?.focus();
  };

  const recent = alerts ? recentAlerts(alerts) : [];
  const emails = deliveryEmails(alerts ?? [], email);

  return (
    <>
      <SectionHeader
        eyebrow="Activity"
        title="Alerts"
        id="section-title"
        action={<LinkButton href="/validator-alerts">Open Validator Alerts</LinkButton>}
      />
      <Stack>
        <Group
          label="Validators"
          action={
            <Button
              ref={addButtonRef}
              variant="secondary"
              className="h-7 px-2.5"
              aria-expanded={adding}
              aria-controls={adding ? formId : undefined}
              disabled={alerts === null}
              onClick={() => (adding ? document.getElementById(`${formId}-node`)?.focus() : setAdding(true))}
            >
              <Plus aria-hidden className="h-3 w-3" />
              Add validator
            </Button>
          }
        >
          {adding && <AddValidatorForm id={formId} onAdded={added} onCancel={closeForm} />}
          {failed ? (
            <ErrorLine onRetry={() => load()}>Could not load your alerts.</ErrorLine>
          ) : alerts === null ? (
            <SkeletonRows rows={2} />
          ) : alerts.length === 0 ? (
            !adding && <EmptyState>No validators yet. Add a node ID to get email alerts.</EmptyState>
          ) : (
            <ul aria-label="Validators" className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {alerts.map((a) => (
                <AlertItem key={a.id} alert={a} onUpdated={replace} onPatch={patch} onRemoved={removed} />
              ))}
            </ul>
          )}
        </Group>

        <Group label="Delivery">
          <Row label="Email" hint="Alerts go to the email of your account.">
            {emails.length > 0 ? (
              <ul className="space-y-1">
                {emails.map((e) => (
                  <li
                    key={e}
                    className="font-mono text-[13px] text-zinc-900 [overflow-wrap:anywhere] dark:text-zinc-100"
                  >
                    {e}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-[14px] text-zinc-500 dark:text-zinc-400">No email</span>
            )}
          </Row>
          <Row label="Checks">
            <span className="text-[14px] text-zinc-900 dark:text-zinc-100">Every 15 minutes</span>
          </Row>
        </Group>

        {!failed && (
          <Group label="Recent alerts">
            {alerts === null ? (
              <SkeletonRows rows={3} />
            ) : recent.length === 0 ? (
              <EmptyState>No alerts sent yet.</EmptyState>
            ) : (
              <ul aria-label="Recent alerts" className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {recent.map((log) => (
                  <li key={log.id} className="px-4 py-3.5 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <StatusMark tone={alertTypeTone(log.alert_type)} />
                        <span className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100">
                          {alertTypeLabel(log.alert_type)}
                        </span>
                      </span>
                      <time
                        dateTime={log.sent_at}
                        className="font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400"
                      >
                        {formatAlertDate(log.sent_at)}
                      </time>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] text-zinc-600 dark:text-zinc-400">
                      {alertMessageText(log.message)}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{log.nodeName}</p>
                  </li>
                ))}
              </ul>
            )}
          </Group>
        )}
      </Stack>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Add: the node ID, a label, and an L1 when the node validates one.    */
function AddValidatorForm({
  id,
  onAdded,
  onCancel,
}: {
  id: string;
  onAdded: (alert: ValidatorAlertResponse) => void;
  onCancel: () => void;
}) {
  const [nodeId, setNodeId] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [subnetId, setSubnetId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const nodeRef = React.useRef<HTMLInputElement>(null);
  const errorId = `${id}-error`;

  // the busy Add button drops the focus; put it back on the field the error describes
  const fail = (message: string) => {
    setError(message);
    requestAnimationFrame(() => nodeRef.current?.focus());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const built = buildCreateRequest({ nodeId, label, subnetId });
    if ("error" in built) {
      fail(built.error);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const alert = await call<ValidatorAlertResponse>(API, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(built.request),
      });
      sonnerToast.success("Validator added");
      onAdded(alert);
    } catch (err) {
      setBusy(false);
      fail(err instanceof Error ? err.message : "Could not add the validator.");
    }
  };

  return (
    <form
      id={id}
      aria-label="Add validator"
      noValidate
      onSubmit={submit}
      className="divide-y divide-zinc-200 dark:divide-zinc-800"
    >
      <Row label="Node ID" htmlFor={`${id}-node`}>
        <TextInput
          ref={nodeRef}
          id={`${id}-node`}
          value={nodeId}
          onChange={(e) => setNodeId(e.target.value)}
          placeholder="NodeID-..."
          autoFocus
          required
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="font-mono text-[13px]"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </Row>
      <Row label="Label" htmlFor={`${id}-label`} hint="Optional. Only you see it.">
        <TextInput
          id={`${id}-label`}
          value={label}
          maxLength={64}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="For example, Main validator"
          autoComplete="off"
        />
      </Row>
      <Row label="L1 ID" htmlFor={`${id}-l1`} hint="Leave empty for the Primary Network.">
        <TextInput
          id={`${id}-l1`}
          value={subnetId}
          onChange={(e) => setSubnetId(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="font-mono text-[13px]"
        />
      </Row>
      <Cell>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" busy={busy}>
            Add
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          {busy && (
            <p role="status" className="text-[12px] text-zinc-500 dark:text-zinc-400">
              Checking the node. This can take some seconds.
            </p>
          )}
        </div>
        <FieldError id={errorId}>{error}</FieldError>
      </Cell>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* One validator: its name, network and checks, the pause switch, and    */
/* a disclosure with its settings.                                       */
function AlertItem({
  alert,
  onUpdated,
  onPatch,
  onRemoved,
}: {
  alert: ValidatorAlertResponse;
  onUpdated: (alert: ValidatorAlertResponse) => void;
  onPatch: (id: string, fields: AlertPatch) => void;
  onRemoved: (id: string) => void;
}) {
  const l1 = isL1Alert(alert);
  const title = alert.label?.trim() || "Validator";
  // a name for screen readers that tells two rows apart
  const a11yName = alert.label?.trim() || alert.node_id;
  const [expanded, setExpanded] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  // a ref, not a disabled switch: disabling the focused switch drops the keyboard focus
  const toggling = React.useRef(false);
  const removeRef = React.useRef<HTMLButtonElement>(null);
  const baseId = React.useId();
  const panelId = `${baseId}-settings`;
  const switchId = `${baseId}-active`;

  const toggleActive = async (next: boolean) => {
    if (toggling.current) return;
    toggling.current = true;
    onPatch(alert.id, { active: next });
    try {
      const updated = await call<ValidatorAlertResponse>(`${API}/${alert.id}`, {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify({ active: next }),
      });
      onUpdated(updated);
      sonnerToast.success(next ? "Alerts on" : "Alerts paused");
    } catch {
      onPatch(alert.id, { active: !next });
      sonnerToast.error(next ? "Could not turn on the alerts" : "Could not pause the alerts");
    } finally {
      toggling.current = false;
    }
  };

  const cancelRemove = () => {
    setConfirming(false);
    // the Remove button mounts again on the next render
    requestAnimationFrame(() => removeRef.current?.focus());
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await call<unknown>(`${API}/${alert.id}`, { method: "DELETE" });
      sonnerToast.success("Validator removed");
      onRemoved(alert.id);
    } catch {
      sonnerToast.error("Could not remove the validator");
      setRemoving(false);
      cancelRemove();
    }
  };

  return (
    <li>
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 truncate text-[14px] font-medium text-zinc-900 dark:text-zinc-100">{title}</span>
            <Tag>{l1 ? "L1" : "Primary Network"}</Tag>
            {!alert.active && <Tag>Paused</Tag>}
          </div>
          <p className="mt-1 font-mono text-[12px] text-zinc-500 dark:text-zinc-400" title={alert.node_id}>
            <span aria-hidden>{truncateMiddle(alert.node_id)}</span>
            <span className="sr-only">{alert.node_id}</span>
          </p>
          <p className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{checksSummary(alert)}</p>
        </div>

        {confirming ? (
          <div role="group" aria-label={`Remove ${a11yName}`} className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="text-[13px] text-zinc-900 dark:text-zinc-100">Remove this validator?</span>
            <Button variant="danger" busy={removing} onClick={() => void remove()}>
              Yes
            </Button>
            <Button variant="ghost" autoFocus disabled={removing} onClick={cancelRemove}>
              No
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2">
            <label htmlFor={switchId} className="mr-1 flex cursor-pointer items-center gap-2.5">
              <span className="text-[13px] text-zinc-500 dark:text-zinc-400">Alerts on</span>
              <Switch
                id={switchId}
                label={`Alerts on for ${a11yName}`}
                checked={alert.active}
                onChange={(next) => void toggleActive(next)}
              />
            </label>
            <Button
              variant="ghost"
              aria-expanded={expanded}
              aria-controls={panelId}
              aria-label={`Settings for ${a11yName}`}
              onClick={() => setExpanded((v) => !v)}
            >
              Settings
              <ChevronDown aria-hidden className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
            </Button>
            <Button
              ref={removeRef}
              variant="ghost"
              aria-label={`Remove ${a11yName}`}
              onClick={() => setConfirming(true)}
            >
              Remove
            </Button>
          </div>
        )}
      </div>

      <div id={panelId} hidden={!expanded}>
        {expanded && <AlertSettings alert={alert} onUpdated={onUpdated} />}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Settings of one alert. Save sends only the fields that changed.      */
function AlertSettings({
  alert,
  onUpdated,
}: {
  alert: ValidatorAlertResponse;
  onUpdated: (alert: ValidatorAlertResponse) => void;
}) {
  const l1 = isL1Alert(alert);
  const [draft, setDraft] = React.useState<AlertDraft>(() => draftFromAlert(alert));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();
  const errorId = `${id}-error`;

  const { update, error: invalid } = buildAlertUpdate(alert, draft);
  const dirty = invalid !== null || Object.keys(update).length > 0;
  // set() clears the error, so a shown error always matches the current draft
  const isInvalid = (field: DraftNumberField) => error !== null && invalid?.field === field;
  const set = <K extends keyof AlertDraft>(key: K, value: AlertDraft[K]) => {
    setError(null);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const save = async () => {
    if (invalid) {
      setError(invalid.message);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await call<ValidatorAlertResponse>(`${API}/${alert.id}`, {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify(update),
      });
      onUpdated(updated);
      setDraft(draftFromAlert(updated));
      sonnerToast.success("Settings saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="divide-y divide-zinc-200 border-t border-zinc-200 bg-zinc-50/60 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/30">
      {l1 && (
        <Row label="L1 ID">
          <span className="font-mono text-[12px] text-zinc-900 [overflow-wrap:anywhere] dark:text-zinc-100">
            {alert.subnet_id}
          </span>
        </Row>
      )}
      {!l1 && (
        <Row label="Uptime" htmlFor={`${id}-uptime`} hint="Send an alert when the uptime is below this percent.">
          <SwitchWithNumber
            switchId={`${id}-uptime`}
            checked={draft.uptime_alert}
            onCheck={(v) => set("uptime_alert", v)}
            value={draft.uptime_threshold}
            onValue={(v) => set("uptime_threshold", v)}
            range={UPTIME_RANGE}
            step="0.1"
            unit="%"
            inputLabel="Uptime threshold in percent"
            invalid={isInvalid("uptime_threshold")}
            errorId={errorId}
          />
        </Row>
      )}
      <Row label="Version" htmlFor={`${id}-version`} hint="Send an alert when AvalancheGo has a new version.">
        <Switch id={`${id}-version`} checked={draft.version_alert} onChange={(v) => set("version_alert", v)} />
      </Row>
      {!l1 && (
        <Row
          label="Stake end"
          htmlFor={`${id}-expiry`}
          hint="Send an alert this number of days before the stake ends."
        >
          <SwitchWithNumber
            switchId={`${id}-expiry`}
            checked={draft.expiry_alert}
            onCheck={(v) => set("expiry_alert", v)}
            value={draft.expiry_days}
            onValue={(v) => set("expiry_days", v)}
            range={EXPIRY_DAYS_RANGE}
            step="1"
            unit="days"
            inputLabel="Days before the stake ends"
            invalid={isInvalid("expiry_days")}
            errorId={errorId}
          />
        </Row>
      )}
      {l1 && (
        <Row
          label="Balance"
          htmlFor={`${id}-balance`}
          hint="Send an alert when the balance pays fees for fewer days than this."
        >
          <SwitchWithNumber
            switchId={`${id}-balance`}
            checked={draft.balance_alert}
            onCheck={(v) => set("balance_alert", v)}
            value={draft.balance_threshold_days}
            onValue={(v) => set("balance_threshold_days", v)}
            range={BALANCE_DAYS_RANGE}
            step="1"
            unit="days"
            inputLabel="Days of fees the balance pays"
            invalid={isInvalid("balance_threshold_days")}
            errorId={errorId}
          />
        </Row>
      )}
      {!l1 && (
        <Row label="Security" htmlFor={`${id}-security`} hint="Check for an open port 9650 and for a new IP address.">
          <Switch id={`${id}-security`} checked={draft.security_alert} onChange={(v) => set("security_alert", v)} />
        </Row>
      )}
      <Cell>
        {/* aria-disabled, not disabled: a save makes the draft clean, and a
            disabled button would drop the keyboard focus to the page */}
        <Button
          variant="primary"
          busy={saving}
          aria-disabled={!dirty || saving || undefined}
          onClick={() => {
            if (dirty) void save();
          }}
          className={cn(
            !dirty && "cursor-not-allowed bg-zinc-300 opacity-60 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-800",
          )}
        >
          Save
        </Button>
        <FieldError id={errorId}>{error}</FieldError>
      </Cell>
    </div>
  );
}

/** a check's switch and its number, side by side */
function SwitchWithNumber({
  switchId,
  checked,
  onCheck,
  value,
  onValue,
  range,
  step,
  unit,
  inputLabel,
  invalid,
  errorId,
}: {
  switchId: string;
  checked: boolean;
  onCheck: (next: boolean) => void;
  value: string;
  onValue: (next: string) => void;
  range: { min: number; max: number };
  step: string;
  unit: string;
  inputLabel: string;
  invalid: boolean;
  errorId: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Switch id={switchId} checked={checked} onChange={onCheck} />
      <span className="flex items-center gap-2">
        <TextInput
          type="number"
          inputMode="decimal"
          min={range.min}
          max={range.max}
          step={step}
          value={value}
          disabled={!checked}
          aria-label={inputLabel}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(e) => onValue(e.target.value)}
          className="w-24 font-mono text-[13px] tabular-nums"
        />
        <span className="font-mono text-[12px] text-zinc-500 dark:text-zinc-400">{unit}</span>
      </span>
    </div>
  );
}
