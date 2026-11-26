/**
 * RouteHQ Settings — presentation layer only.
 *
 * HANDOFF FOR BACKEND WIRING
 * - Everything is driven by the `data` and `actions` props. Nothing here talks to Supabase and nothing is mocked.
 * - If an action is omitted, its control renders disabled with a "Not connected yet" hint, so no control pretends to work.
 * - If a data slice is omitted, the section shows a truthful "not available" state.
 * - Seat limits, role checks and permissions MUST still be enforced by RLS/RPCs. The UI only reflects them.
 * - Needs no new dependencies (React + Tailwind only). Dark mode uses Tailwind's `dark:` variant.
 * - Missing backend pieces are surfaced in the UI via `data.unsupported` (e.g. ["2fa","sessions","invoices"]).
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type ReactElement } from "react";

/* ───────────── Types (map your Supabase rows onto these) ───────────── */
export type SaveResult = void | { error?: string };
export type Member = { id: string; name: string; email: string; role: string; status: "active" | "pending" | "expired"; date: string; isOwner?: boolean; avatarUrl?: string };
export type Role = { id: string; label: string; description: string; permissions: string[]; editable?: boolean };
export type PermissionGroup = { label: string; items: { id: string; label: string; description: string }[] };
export type Plan = { id: "basic" | "growth" | "pro"; name: string; price: string; seatLimit: number; features: string[] };
export type NotifItem = { id: string; label: string; description: string; personal?: boolean; agency?: boolean };
export type Option = { value: string; label: string };

export interface SettingsData {
  loading?: boolean;
  viewer: { isOwner: boolean; canManageTeam: boolean; canManageAgency: boolean; canManageBilling: boolean };
  profile?: { name: string; email: string; emailVerified: boolean; phone: string; jobTitle: string; bio: string; avatarUrl?: string };
  preferences?: { theme: "light" | "dark" | "system"; timezone: string; dateFormat: string; language?: string };
  timezones?: Option[]; dateFormats?: Option[]; languages?: Option[];
  notifications?: { items: NotifItem[]; values: Record<string, { personal?: boolean; agency?: boolean }> };
  security?: { sessions?: { id: string; device: string; lastActive: string; current?: boolean }[]; twoFactorEnabled?: boolean };
  agency?: { name: string; email: string; phone: string; address: string; country: string; state: string; website: string; description: string; registration?: string; logoUrl?: string };
  website?: { displayName: string; domain: string; customDomain: string; status: "live" | "draft" | "connecting" | "error"; publicEmail: string; publicPhone: string };
  operations?: { currency: string; timezone: string; dateFormat: string; customerEmailFooter: string; sendBookingConfirmations: boolean };
  currencies?: Option[];
  team?: { members: Member[]; roles: Role[]; groups: PermissionGroup[]; seatsUsed: number; seatLimit: number };
  billing?: { plan: Plan["id"]; status: string; period: string; startedAt?: string; renewsAt?: string; plans: Plan[]; invoices?: { id: string; date: string; amount: string; url?: string }[]; paymentMethod?: string };
  unsupported?: string[];
}
export interface SettingsActions {
  saveProfile(v: NonNullable<SettingsData["profile"]>): Promise<SaveResult>;
  uploadAvatar(f: File): Promise<SaveResult>;
  changePassword(): Promise<SaveResult>;
  signOutSession(id: string): Promise<SaveResult>;
  signOut(): Promise<SaveResult>;
  savePreferences(v: NonNullable<SettingsData["preferences"]>): Promise<SaveResult>;
  setNotification(id: string, scope: "personal" | "agency", on: boolean): Promise<SaveResult>;
  saveAgency(v: NonNullable<SettingsData["agency"]>): Promise<SaveResult>;
  uploadLogo(f: File): Promise<SaveResult>;
  saveWebsite(v: NonNullable<SettingsData["website"]>): Promise<SaveResult>;
  saveOperations(v: NonNullable<SettingsData["operations"]>): Promise<SaveResult>;
  invite(email: string, role: string): Promise<SaveResult>;
  resendInvite(id: string): Promise<SaveResult>;
  cancelInvite(id: string): Promise<SaveResult>;
  changeRole(id: string, role: string): Promise<SaveResult>;
  removeMember(id: string): Promise<SaveResult>;
  setRolePermission(role: string, perm: string, on: boolean): Promise<SaveResult>;
  startCheckout(plan: Plan["id"]): Promise<SaveResult>;
  openBillingPortal(): Promise<SaveResult>;
  leaveAgency(): Promise<SaveResult>;
  deleteAgency(): Promise<SaveResult>;
}
export interface RouteHQSettingsProps { data: SettingsData; actions: Partial<SettingsActions>; initialTab?: Tab; initialSection?: string; onNavigate?(tab: Tab, section: string): void }

/* ───────────── Navigation model ───────────── */
export type Tab = "personal" | "agency" | "team" | "integrations";
const NAV: Record<Tab, { label: string; sections: { id: string; label: string }[] }> = {
  personal: { label: "Personal", sections: [{ id: "profile", label: "Profile" }, { id: "security", label: "Security" }, { id: "preferences", label: "Preferences" }, { id: "notifications", label: "Notifications" }, { id: "account", label: "Account" }] },
  agency: { label: "Agency", sections: [{ id: "profile", label: "Agency profile" }, { id: "website", label: "Website" }, { id: "operations", label: "Operations" }, { id: "subscription", label: "Billing" }, { id: "danger", label: "Danger zone" }] },
  team: { label: "Team", sections: [{ id: "members", label: "Members" }, { id: "roles", label: "Roles & permissions" }] },
  integrations: { label: "Integrations", sections: [{ id: "connections", label: "Connections" }] },
};

/* ───────────── Tiny utilities ───────────── */
const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");
const EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950";
const inputCls = cx("w-full rounded-lg bg-neutral-100 px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-[background,box-shadow] duration-200 hover:bg-neutral-200/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800/80 dark:focus:bg-neutral-900");
const initials = (n: string) => n.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
const NC = "Not connected yet";

function Icon({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d={d} /></svg>;
}
const I = { chevron: "M5 8l5 5 5-5", check: "M4 10.5l4 4 8-9", x: "M5 5l10 10M15 5L5 15", search: "M9 15a6 6 0 100-12 6 6 0 000 12zM17 17l-3.5-3.5" };

function useAction() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string>();
  const run = useCallback(async (fn?: () => Promise<SaveResult>) => {
    if (!fn) return false;
    setState("busy"); setError(undefined);
    try {
      const r = await fn();
      if (r && typeof r === "object" && r.error) { setError(r.error); setState("error"); return false; }
      setState("done"); setTimeout(() => setState((s) => (s === "done" ? "idle" : s)), 2200); return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); setState("error"); return false; }
  }, []);
  return { state, error, run, busy: state === "busy" };
}

function useForm<T extends object>(initial: T | undefined) {
  const [base, setBase] = useState(initial);
  const [v, setV] = useState(initial);
  useEffect(() => { setBase(initial); setV(initial); }, [JSON.stringify(initial)]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(v) !== JSON.stringify(base);
  return { v, set: <K extends keyof T>(k: K, val: T[K]) => setV((p) => (p ? { ...p, [k]: val } : p)), dirty, reset: () => setV(base) };
}

/* ───────────── Primitives ───────────── */
function Button({ variant = "secondary", loading, className, disabled, title, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean }) {
  const v = {
    primary: "bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200",
    secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700",
    ghost: "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800/70",
    danger: "bg-red-600 text-white hover:bg-red-500",
  }[variant];
  return (
    <button {...p} title={title} disabled={disabled || loading}
      className={cx("relative inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100", v, focusRing, className)}>
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {p.children}
    </button>
  );
}

function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange(v: boolean): void; disabled?: boolean; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cx("group relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-300", EASE, checked ? "bg-orange-500" : "bg-neutral-300 dark:bg-neutral-700", "disabled:cursor-not-allowed disabled:opacity-40", focusRing)}>
      <span className={cx("absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.3)] transition-all duration-300 group-active:w-6", EASE, checked ? "translate-x-[18px] group-active:translate-x-[14px]" : "translate-x-0")} />
    </button>
  );
}

function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return <div className={cx("grid transition-[grid-template-rows,opacity] duration-300", EASE, open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}><div className="overflow-hidden" inert={!open ? ("" as unknown as boolean) : undefined}>{children}</div></div>;
}

function Select({ value, options, onChange, disabled, label }: { value: string; options: Option[]; onChange(v: string): void; disabled?: boolean; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const d = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", d); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", d); document.removeEventListener("keydown", k); };
  }, [open]);
  const cur = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)} className={cx(inputCls, "flex items-center justify-between text-left", focusRing)}>
        <span className="truncate">{cur?.label ?? value ?? "Select"}</span>
        <Icon d={I.chevron} className={cx("h-4 w-4 text-neutral-400 transition-transform duration-300", EASE, open && "rotate-180")} />
      </button>
      <ul role="listbox" className={cx("absolute z-30 mt-1.5 max-h-60 w-full min-w-[10rem] origin-top overflow-auto rounded-xl bg-white p-1 shadow-[0_12px_40px_-8px_rgba(0,0,0,.25)] ring-1 ring-black/5 transition-all duration-200 dark:bg-neutral-900 dark:ring-white/10", open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0")}>
        {options.map((o) => (
          <li key={o.value} role="option" aria-selected={o.value === value} tabIndex={open ? 0 : -1}
            onClick={() => { onChange(o.value); setOpen(false); }} onKeyDown={(e) => e.key === "Enter" && (onChange(o.value), setOpen(false))}
            className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm text-neutral-800 outline-none hover:bg-neutral-100 focus:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800">
            {o.label}{o.value === value && <Icon d={I.check} className="h-3.5 w-3.5 text-orange-500" />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Dialog({ open, onClose, title, children, footer }: { open: boolean; onClose(): void; title: string; children: ReactNode; footer: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (open) { setMounted(true); const r = requestAnimationFrame(() => setShow(true)); return () => cancelAnimationFrame(r); }
    setShow(false); const t = setTimeout(() => setMounted(false), 220); return () => clearTimeout(t);
  }, [open]);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [open, onClose]);
  if (!mounted) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div onClick={onClose} className={cx("absolute inset-0 bg-neutral-950/50 backdrop-blur-sm transition-opacity duration-200", show ? "opacity-100" : "opacity-0")} />
      <div className={cx("relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all duration-300 dark:bg-neutral-900", EASE, show ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-95 opacity-0")}>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-white">{title}</h3>
        <div className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">{children}</div>
        <div className="mt-6 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

/** Confirmation prompt. Pass `typeToConfirm` for irreversible actions. */
function useConfirm() {
  const [cfg, setCfg] = useState<{ title: string; body: ReactNode; confirm: string; typeToConfirm?: string; onConfirm?: () => Promise<boolean> } | null>(null);
  const [typed, setTyped] = useState("");
  const a = useAction();
  const close = () => { setCfg(null); setTyped(""); };
  const node = (
    <Dialog open={!!cfg} onClose={close} title={cfg?.title ?? ""}
      footer={<><Button variant="ghost" onClick={close}>Cancel</Button>
        <Button variant="danger" loading={a.busy} disabled={!!cfg?.typeToConfirm && typed !== cfg.typeToConfirm}
          onClick={async () => { if (cfg?.onConfirm && (await cfg.onConfirm())) close(); }}>{cfg?.confirm}</Button></>}>
      {cfg?.body}
      {cfg?.typeToConfirm && <div className="mt-4"><label className="mb-1.5 block text-xs">Type <b className="text-neutral-900 dark:text-white">{cfg.typeToConfirm}</b> to continue</label><input className={inputCls} value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus /></div>}
      {a.error && <p role="alert" className="mt-3 text-red-500">{a.error}</p>}
    </Dialog>
  );
  return { node, ask: (c: Omit<NonNullable<typeof cfg>, "onConfirm"> & { run?: () => Promise<SaveResult> }) => setCfg({ ...c, onConfirm: () => a.run(c.run) }) };
}

/* ───────────── Layout pieces ───────────── */
function Header({ title, desc, right }: { title: string; desc?: string; right?: ReactNode }) {
  return (
    <div className="mb-10 flex items-start justify-between gap-4">
      <div><h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">{title}</h2>{desc && <p className="mt-1.5 max-w-prose text-sm text-neutral-500 dark:text-neutral-400">{desc}</p>}</div>{right}
    </div>
  );
}
function Row({ label, desc, children }: { label: string; desc?: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 py-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-12">
      <div><div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{label}</div>{desc && <p className="mt-1 text-[13px] leading-snug text-neutral-500 dark:text-neutral-400">{desc}</p>}</div>
      <div className="max-w-lg">{children}</div>
    </div>
  );
}
function Group({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-neutral-200/60 dark:divide-white/[0.06]">{children}</div>;
}
function Field({ label, value, onChange, disabled, type = "text", multiline, error, hint }: { label: string; value: string; onChange?(v: string): void; disabled?: boolean; type?: string; multiline?: boolean; error?: string; hint?: string }) {
  const id = useId();
  const P = { id, value, disabled, "aria-invalid": !!error, onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => onChange?.(e.target.value), className: cx(inputCls, error && "ring-2 ring-red-500/60") };
  return (
    <div><label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-neutral-600 dark:text-neutral-400">{label}</label>
      {multiline ? <textarea rows={4} {...P} className={cx(P.className, "resize-none")} /> : <input type={type} {...P} />}
      {(error || hint) && <p className={cx("mt-1.5 text-xs", error ? "text-red-500" : "text-neutral-500")}>{error ?? hint}</p>}</div>
  );
}
function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return <div className={cx("rounded-xl px-4 py-3 text-[13px] leading-snug", tone === "warn" ? "bg-orange-500/10 text-orange-700 dark:text-orange-300" : "bg-blue-500/10 text-blue-700 dark:text-blue-300")}>{children}</div>;
}
function Unavailable({ what }: { what: string }) {
  return <Notice>{what} isn’t available for your account yet. This needs backend support before it can be used.</Notice>;
}
function Skeleton() {
  return <div className="space-y-8 animate-pulse">{[0, 1, 2].map((i) => <div key={i} className="grid gap-12 md:grid-cols-[15rem_1fr]"><div className="h-4 w-32 rounded bg-neutral-200 dark:bg-neutral-800" /><div className="h-10 max-w-lg rounded-lg bg-neutral-200 dark:bg-neutral-800" /></div>)}</div>;
}
function Avatar({ name, src, size = 40 }: { name: string; src?: string; size?: number }) {
  return src
    ? <img src={src} alt="" style={{ width: size, height: size }} className="rounded-full object-cover" />
    : <span style={{ width: size, height: size, fontSize: size / 2.8 }} className="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 font-medium text-white dark:from-neutral-600 dark:to-neutral-800">{initials(name)}</span>;
}

/** Sticky save indicator: slides in only while there are unsaved changes. */
function SaveBar({ dirty, a, onSave, onReset, disabled }: { dirty: boolean; a: ReturnType<typeof useAction>; onSave(): void; onReset(): void; disabled?: boolean }) {
  const visible = dirty || a.state === "done" || a.state === "error";
  return (
    <div className={cx("sticky bottom-4 z-20 mt-10 flex justify-center transition-all duration-300", EASE, visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0")}>
      <div className="flex items-center gap-3 rounded-2xl bg-neutral-900 py-2 pl-5 pr-2 text-sm text-white shadow-[0_16px_48px_-12px_rgba(0,0,0,.5)] dark:bg-neutral-100 dark:text-neutral-900" role="status" aria-live="polite">
        <span className="min-w-[8.5rem]">{a.state === "done" ? <span className="inline-flex items-center gap-1.5"><Icon d={I.check} className="h-4 w-4 text-emerald-400 dark:text-emerald-600" />Saved</span> : a.state === "error" ? <span className="text-red-300 dark:text-red-600">{a.error ?? "Couldn’t save"}</span> : "Unsaved changes"}</span>
        {dirty && <button onClick={onReset} className="rounded-lg px-3 py-1.5 text-neutral-300 transition hover:bg-white/10 dark:text-neutral-600 dark:hover:bg-black/5">Discard</button>}
        <button onClick={onSave} disabled={a.busy || disabled || !dirty} title={disabled ? NC : undefined} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-1.5 font-medium text-white transition hover:bg-orange-400 active:scale-[0.97] disabled:opacity-50">
          {a.busy && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}Save changes
        </button>
      </div>
    </div>
  );
}

/** Generic form section: handles dirty state, validation, save. */
function FormSection<T extends object>({ initial, onSave, validate, children }: { initial?: T; onSave?: (v: T) => Promise<SaveResult>; validate?: (v: T) => Record<string, string>; children: (f: { v: T; set: <K extends keyof T>(k: K, val: T[K]) => void; errors: Record<string, string>; locked: boolean }) => ReactNode }) {
  const f = useForm<T>(initial); const a = useAction(); const [tried, setTried] = useState(false);
  if (!f.v) return <Unavailable what="This section" />;
  const errors = tried && validate ? validate(f.v) : {};
  const save = async () => { setTried(true); if (validate && Object.keys(validate(f.v!)).length) return; await a.run(() => onSave!(f.v!)); };
  return <>{children({ v: f.v, set: f.set, errors, locked: !onSave })}<SaveBar dirty={f.dirty} a={a} onSave={save} onReset={() => { f.reset(); setTried(false); }} disabled={!onSave} /></>;
}
const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const phoneOk = (s: string) => !s || /^[+\d][\d\s().-]{6,}$/.test(s);

function Upload({ label, onFile, disabled, src, name }: { label: string; onFile?: (f: File) => Promise<SaveResult>; disabled?: boolean; src?: string; name: string }) {
  const a = useAction(); const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-5">
      <Avatar name={name} src={src} size={64} />
      <div>
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 2_000_000) return a.run(async () => ({ error: "Image must be under 2 MB" })); a.run(() => onFile!(f)); }} />
        <Button loading={a.busy} disabled={!onFile || disabled} title={!onFile ? NC : undefined} onClick={() => ref.current?.click()}>{label}</Button>
        <p className={cx("mt-1.5 text-xs", a.error ? "text-red-500" : "text-neutral-500")}>{a.error ?? (a.state === "done" ? "Uploaded" : "PNG, JPG or WebP, up to 2 MB")}</p>
      </div>
    </div>
  );
}

/* ───────────── Sections ───────────── */
type Ctx = { d: SettingsData; act: Partial<SettingsActions>; confirm: ReturnType<typeof useConfirm>["ask"] };

function PersonalProfile({ d, act }: Ctx) {
  return (<><Header title="Profile" desc="How you appear to your team across RouteHQ." />
    <FormSection initial={d.profile} onSave={act.saveProfile} validate={(v) => ({ ...(v.name.trim().length < 2 && { name: "Enter your full name" }), ...(!phoneOk(v.phone) && { phone: "Enter a valid phone number" }) })}>
      {({ v, set, errors, locked }) => (<Group>
        <Row label="Photo" desc="Shown next to your activity."><Upload label="Change photo" name={v.name} src={v.avatarUrl} onFile={act.uploadAvatar} /></Row>
        <Row label="Name"><div className="space-y-4"><Field label="Full name" value={v.name} onChange={(x) => set("name", x)} error={errors.name} disabled={locked} /><Field label="Job title" value={v.jobTitle} onChange={(x) => set("jobTitle", x)} disabled={locked} /></div></Row>
        <Row label="Contact" desc="Email changes go through account security."><div className="space-y-4"><Field label="Email" value={v.email} disabled hint={v.emailVerified ? "Verified" : "Not verified"} /><Field label="Phone" type="tel" value={v.phone} onChange={(x) => set("phone", x)} error={errors.phone} disabled={locked} /></div></Row>
        <Row label="About you"><Field label="Bio" multiline value={v.bio} onChange={(x) => set("bio", x)} disabled={locked} /></Row></Group>)}
    </FormSection></>);
}

function Security({ d, act, confirm }: Ctx) {
  const pw = useAction(); const s = d.security; const un = d.unsupported ?? [];
  return (<><Header title="Security" desc="Keep your account protected." /><Group>
    <Row label="Email" desc="Used to sign in."><div className="flex items-center gap-3 text-sm"><span className="text-neutral-900 dark:text-neutral-100">{d.profile?.email ?? "—"}</span>{d.profile && <span className={cx("rounded-full px-2 py-0.5 text-xs", d.profile.emailVerified ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-orange-500/10 text-orange-600")}>{d.profile.emailVerified ? "Verified" : "Unverified"}</span>}</div></Row>
    <Row label="Password" desc="We’ll email you a secure link to set a new one."><Button loading={pw.busy} disabled={!act.changePassword} title={!act.changePassword ? NC : undefined} onClick={() => pw.run(act.changePassword)}>Send reset link</Button>{pw.state === "done" && <p className="mt-2 text-xs text-emerald-600">Check your inbox.</p>}{pw.error && <p className="mt-2 text-xs text-red-500">{pw.error}</p>}</Row>
    <Row label="Two-factor authentication">{un.includes("2fa") || s?.twoFactorEnabled === undefined ? <Unavailable what="Two-factor authentication" /> : <span className="text-sm">{s.twoFactorEnabled ? "Enabled" : "Not enabled"}</span>}</Row>
    <Row label="Active sessions">{un.includes("sessions") || !s?.sessions ? <Unavailable what="Session management" /> : <ul className="space-y-4">{s.sessions.map((x) => (<li key={x.id} className="flex items-center justify-between gap-4 text-sm"><div><div className="text-neutral-900 dark:text-neutral-100">{x.device}{x.current && <span className="ml-2 text-xs text-blue-500">This device</span>}</div><div className="text-xs text-neutral-500">{x.lastActive}</div></div>{!x.current && <Button variant="ghost" disabled={!act.signOutSession} onClick={() => confirm({ title: "Sign out this device?", body: "That device will need to sign in again.", confirm: "Sign out device", run: () => act.signOutSession!(x.id) })}>Sign out</Button>}</li>))}</ul>}</Row></Group></>);
}

function Preferences({ d, act }: Ctx) {
  return (<><Header title="Preferences" desc="Personal display and regional settings." />
    <FormSection initial={d.preferences} onSave={act.savePreferences}>
      {({ v, set, locked }) => (<Group>
        <Row label="Appearance" desc="Choose how RouteHQ looks on this device.">
          <div className="inline-flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900" role="radiogroup" aria-label="Theme">{(["light", "dark", "system"] as const).map((t) => <button key={t} role="radio" aria-checked={v.theme === t} disabled={locked} onClick={() => set("theme", t)} className={cx("rounded-lg px-4 py-1.5 text-sm capitalize transition-all duration-200 disabled:opacity-50", focusRing, v.theme === t ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200")}>{t}</button>)}</div></Row>
        <Row label="Time zone"><Select label="Time zone" value={v.timezone} options={d.timezones ?? [{ value: v.timezone, label: v.timezone }]} onChange={(x) => set("timezone", x)} disabled={locked} /></Row>
        <Row label="Date format"><Select label="Date format" value={v.dateFormat} options={d.dateFormats ?? [{ value: v.dateFormat, label: v.dateFormat }]} onChange={(x) => set("dateFormat", x)} disabled={locked} /></Row>
        {d.languages && <Row label="Language"><Select label="Language" value={v.language ?? ""} options={d.languages} onChange={(x) => set("language", x)} disabled={locked} /></Row>}</Group>)}
    </FormSection></>);
}

function Notifications({ d, act }: Ctx) {
  const n = d.notifications; const [err, setErr] = useState<string>();
  if (!n) return (<><Header title="Notifications" /><Unavailable what="Notification preferences" /></>);
  const scopes = (["personal", "agency"] as const).filter((s) => n.items.some((i) => i[s]));
  const flip = async (id: string, s: "personal" | "agency", on: boolean) => { setErr(undefined); const r = await act.setNotification?.(id, s, on); if (r && r.error) setErr(r.error); };
  return (<><Header title="Notifications" desc="Choose what you hear about, and what your whole agency is notified of." />
    {err && <div className="mb-6"><Notice tone="warn">{err}</Notice></div>}
    {scopes.map((s) => (<div key={s} className="mb-10"><h3 className="text-sm font-semibold text-neutral-900 dark:text-white">{s === "personal" ? "For you" : "Agency-wide"}</h3>
      {s === "agency" && !d.viewer.canManageAgency && <p className="mt-1 text-xs text-neutral-500">Only agency admins can change these.</p>}
      <Group>{n.items.filter((i) => i[s]).map((i) => (<div key={i.id} className="flex items-center justify-between gap-6 py-4"><div><div className="text-sm text-neutral-900 dark:text-neutral-100">{i.label}</div><div className="text-[13px] text-neutral-500">{i.description}</div></div>
        <Toggle label={i.label} checked={!!n.values[i.id]?.[s]} disabled={!act.setNotification || (s === "agency" && !d.viewer.canManageAgency)} onChange={(on) => flip(i.id, s, on)} /></div>))}</Group></div>))}</>);
}

function Account({ d, act, confirm }: Ctx) {
  return (<><Header title="Account" desc="Manage your RouteHQ session and agency access." /><Group>
    <Row label="Sign out" desc="End your session on this device."><Button disabled={!act.signOut} title={!act.signOut ? NC : undefined} onClick={() => confirm({ title: "Sign out of RouteHQ?", body: "You’ll need to sign in again to continue.", confirm: "Sign out", run: act.signOut })}>Sign out</Button></Row>
    <Row label="Leave agency" desc={d.viewer.isOwner ? "Owners can’t leave. Transfer ownership first." : "You’ll lose access to this agency’s data."}><Button variant="danger" disabled={d.viewer.isOwner || !act.leaveAgency} title={!act.leaveAgency ? NC : undefined} onClick={() => confirm({ title: "Leave this agency?", body: "Your access to all leads, bookings and files in this agency ends immediately. An admin would need to invite you again.", confirm: "Leave agency", run: act.leaveAgency })}>Leave agency</Button></Row></Group></>);
}

function AgencyProfile({ d, act }: Ctx) {
  const ro = !d.viewer.canManageAgency;
  return (<><Header title="Agency profile" desc="Your agency’s identity and registered business details." />
    {ro && <div className="mb-6"><Notice>You can view these details. Only admins can edit them.</Notice></div>}
    <FormSection initial={d.agency} onSave={ro ? undefined : act.saveAgency} validate={(v) => ({ ...(!v.name.trim() && { name: "Agency name is required" }), ...(v.email && !emailOk(v.email) && { email: "Enter a valid email" }), ...(!phoneOk(v.phone) && { phone: "Enter a valid phone number" }), ...(v.website && !/^https?:\/\/.+\..+/.test(v.website) && { website: "Start with https://" }) })}>
      {({ v, set, errors, locked }) => (<Group>
        <Row label="Logo" desc="Appears on documents and your website."><Upload label="Upload logo" name={v.name} src={v.logoUrl} onFile={ro ? undefined : act.uploadLogo} /></Row>
        <Row label="Business"><div className="space-y-4"><Field label="Agency name" value={v.name} onChange={(x) => set("name", x)} error={errors.name} disabled={locked} /><Field label="Registered business name" value={v.description} onChange={(x) => set("description", x)} disabled={locked} />{v.registration !== undefined && <Field label="Registration number" value={v.registration} disabled hint="Contact support to change this." />}</div></Row>
        <Row label="Contact"><div className="space-y-4"><Field label="Business email" type="email" value={v.email} onChange={(x) => set("email", x)} error={errors.email} disabled={locked} /><Field label="Business phone" type="tel" value={v.phone} onChange={(x) => set("phone", x)} error={errors.phone} disabled={locked} /><Field label="Website" value={v.website} onChange={(x) => set("website", x)} error={errors.website} disabled={locked} /></div></Row>
        </Group>)}
    </FormSection></>);
}

const STATUS = { live: ["Live", "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"], draft: ["Not published", "bg-neutral-500/10 text-neutral-500"], connecting: ["Connecting", "bg-blue-500/10 text-blue-500"], error: ["Needs attention", "bg-red-500/10 text-red-500"] } as const;
function Website({ d, act }: Ctx) {
  const ro = !d.viewer.canManageAgency; const w = d.website;
  return (<><Header title="Website" desc="Settings for your RouteHQ-connected website."
    right={w && <span className={cx("rounded-full px-3 py-1 text-xs font-medium", STATUS[w.status][1])}>{STATUS[w.status][0]}</span>} />
    {!w ? <Unavailable what="Website settings" /> : <FormSection initial={w} onSave={ro ? undefined : act.saveWebsite} validate={(v) => ({ ...(!v.displayName.trim() && { displayName: "Display name is required" }), ...(v.publicEmail && !emailOk(v.publicEmail) && { publicEmail: "Enter a valid email" }) })}>
      {({ v, set, errors, locked }) => (<Group>
        <Row label="Domain" desc="Your connected address."><div className="space-y-4"><Field label="RouteHQ domain" value={v.domain} disabled /><Field label="Custom domain" value={v.customDomain} onChange={(x) => set("customDomain", x)} disabled={locked} hint="DNS changes can take time to propagate." /></div></Row>
        <Row label="Public details" desc="Visible to visitors on your site."><div className="space-y-4"><Field label="Display name" value={v.displayName} onChange={(x) => set("displayName", x)} error={errors.displayName} disabled={locked} /><Field label="Public email" value={v.publicEmail} onChange={(x) => set("publicEmail", x)} error={errors.publicEmail} disabled={locked} /><Field label="Public phone" value={v.publicPhone} onChange={(x) => set("publicPhone", x)} disabled={locked} /></div></Row></Group>)}
    </FormSection>}</>);
}

function Operations({ d, act }: Ctx) {
  const ro = !d.viewer.canManageAgency;
  return (<><Header title="Operations" desc="Defaults applied across your agency." />
    <FormSection initial={d.operations} onSave={ro ? undefined : act.saveOperations}>
      {({ v, set, locked }) => (<Group>
        <Row label="Currency" desc="Default for quotes and invoices."><Select label="Currency" value={v.currency} options={d.currencies ?? [{ value: v.currency, label: v.currency }]} onChange={(x) => set("currency", x)} disabled={locked} /></Row>
        <Row label="Time zone"><Select label="Time zone" value={v.timezone} options={d.timezones ?? [{ value: v.timezone, label: v.timezone }]} onChange={(x) => set("timezone", x)} disabled={locked} /></Row>
        <Row label="Date format"><Select label="Date format" value={v.dateFormat} options={d.dateFormats ?? [{ value: v.dateFormat, label: v.dateFormat }]} onChange={(x) => set("dateFormat", x)} disabled={locked} /></Row>
        <Row label="Customer emails"><div className="space-y-5"><div className="flex items-center justify-between gap-6"><div><div className="text-sm text-neutral-900 dark:text-neutral-100">Booking confirmations</div><div className="text-[13px] text-neutral-500">Email customers when a booking is confirmed.</div></div><Toggle label="Booking confirmations" checked={v.sendBookingConfirmations} onChange={(x) => set("sendBookingConfirmations", x)} disabled={locked} /></div><Field label="Email footer" multiline value={v.customerEmailFooter} onChange={(x) => set("customerEmailFooter", x)} disabled={locked} /></div></Row></Group>)}
    </FormSection></>);
}

function Seats({ used, limit }: { used: number; limit: number }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  return (<div><div className="flex items-baseline justify-between text-sm"><span className="font-medium text-neutral-900 dark:text-white">{used} of {limit} seats used</span><span className="text-neutral-500">{Math.max(0, limit - used)} available</span></div>
    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"><div className={cx("h-full rounded-full transition-[width] duration-700", EASE, pct >= 100 ? "bg-orange-500" : "bg-blue-500")} style={{ width: `${pct}%` }} /></div>
    <p className="mt-2 text-xs text-neutral-500">The agency owner doesn’t count toward your seat limit.</p></div>);
}

function Subscription({ d }: Ctx) {
  const b = d.billing;
  if (!b) return (<><Header title="Billing" desc="Your RouteHQ account and plan." /><Unavailable what="Billing details" /></>);
  const currentPlan = b.plans.find((p) => p.id === b.plan);
  const status = b.status.replace(/[_-]/g, " ");
  return (<>
    <Header title="Billing" desc="Your RouteHQ account, current plan and billing status." />
    <Group>
      <Row label="Account" desc={d.agency?.name || "Your RouteHQ agency workspace"}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-lg font-semibold capitalize text-neutral-900 dark:text-white">{currentPlan?.name ?? b.plan}</div>
            <div className="mt-1 text-sm capitalize text-neutral-500">{status}{b.period ? ` · ${b.period}` : ""}</div>
            {b.renewsAt && <div className="mt-1 text-xs text-neutral-500">Next billing date: {b.renewsAt}</div>}
          </div>
          <Button disabled variant="primary" title="Plan upgrades are not available yet">Upgrade plan</Button>
        </div>
      </Row>
      <Row label="Contact RouteHQ" desc="Need to upgrade, discuss your account or get help with billing? The RouteHQ team can assist.">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-md text-sm text-neutral-500">Contact the RouteHQ team for help with your subscription and account.</p>
          <span className="inline-flex items-center rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-500 dark:bg-neutral-900">RouteHQ team</span>
        </div>
      </Row>
    </Group>
  </>);
}

function Danger({ d, act, confirm }: Ctx) {
  return (<><Header title="Danger zone" desc="Irreversible actions for this agency." /><Group>
    <Row label="Request agency removal" desc="Submit a request to remove this agency workspace. RouteHQ reviews the request before any data is removed."><Button variant="danger" disabled={!d.viewer.isOwner || !act.deleteAgency} title={!d.viewer.isOwner ? "Only the owner can delete the agency" : !act.deleteAgency ? NC : undefined} onClick={() => confirm({ title: "Request agency removal?", body: "This submits a removal request for review. Your agency workspace will not be deleted immediately.", confirm: "Submit request", typeToConfirm: d.agency?.name ?? "DELETE", run: act.deleteAgency })}>Request agency removal</Button></Row></Group></>);
}

/* Team */
const ST = { active: ["Active", "text-emerald-600 dark:text-emerald-400"], pending: ["Pending", "text-orange-500"], expired: ["Expired", "text-neutral-400"] } as const;
function Members({ d, act, confirm }: Ctx) {
  const t = d.team; const [q, setQ] = useState(""); const [f, setF] = useState("all"); const [email, setEmail] = useState(""); const [role, setRole] = useState(""); const inv = useAction(); const [rerr, setRerr] = useState<string>();
  if (!t) return (<><Header title="Members" /><Unavailable what="Team management" /></>);
  const full = t.seatsUsed >= t.seatLimit; const manage = d.viewer.canManageTeam;
  const invitable = t.roles.filter((r) => r.id !== "owner"); const r0 = role || invitable[0]?.id || "";
  const list = t.members.filter((m) => (f === "all" || m.status === f) && (m.name + m.email).toLowerCase().includes(q.toLowerCase()));
  const sendInvite = async () => { if (!emailOk(email)) return inv.run(async () => ({ error: "Enter a valid email address" })); if (await inv.run(() => act.invite!(email, r0))) setEmail(""); };
  return (<><Header title="Members" desc="People with access to your agency." />
    <div className="mb-10"><Seats used={t.seatsUsed} limit={t.seatLimit} />
      {full && <div className="mt-4"><Notice tone="warn">You’ve reached your seat limit. Upgrade your plan to invite more people.</Notice></div>}</div>
    {manage && <div className="mb-10"><div className="text-sm font-medium text-neutral-900 dark:text-white">Invite someone</div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row"><div className="flex-1"><input aria-label="Email address" type="email" placeholder="name@company.com" className={inputCls} value={email} onChange={(e) => { setEmail(e.target.value); }} onKeyDown={(e) => e.key === "Enter" && !full && act.invite && sendInvite()} disabled={full} /></div>
        <div className="sm:w-40"><Select label="Role" value={r0} options={invitable.map((r) => ({ value: r.id, label: r.label }))} onChange={setRole} disabled={full} /></div>
        <Button variant="primary" className="h-[42px]" loading={inv.busy} disabled={full || !email || !act.invite} title={!act.invite ? NC : undefined} onClick={sendInvite}>Send invite</Button></div>
      <p className={cx("mt-2 text-xs", inv.error ? "text-red-500" : "text-emerald-600")} role="status">{inv.error ?? (inv.state === "done" ? "Invitation sent" : "")}</p></div>}
    <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative sm:w-64"><Icon d={I.search} className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input aria-label="Search members" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className={cx(inputCls, "pl-9")} /></div>
      <div className="flex gap-1 text-sm">{["all", "active", "pending", "expired"].map((s) => <button key={s} onClick={() => setF(s)} className={cx("rounded-lg px-3 py-1.5 capitalize transition-colors", focusRing, f === s ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200")}>{s}</button>)}</div></div>
    {rerr && <Notice tone="warn">{rerr}</Notice>}
    {list.length === 0 ? <p className="py-16 text-center text-sm text-neutral-500">{t.members.length ? "No one matches your search." : "No team members yet. Invite someone to get started."}</p> :
      <ul className="divide-y divide-neutral-200/60 dark:divide-white/[0.06]">{list.map((m) => (
        <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
          <Avatar name={m.name} src={m.avatarUrl} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-neutral-900 dark:text-white">{m.name}{m.isOwner && <span className="ml-2 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-normal text-orange-600 dark:text-orange-400">Owner</span>}</div><div className="truncate text-[13px] text-neutral-500">{m.email}</div></div>
          <div className="w-32">{m.isOwner || !manage || m.status !== "active" ? <span className="text-sm text-neutral-600 dark:text-neutral-400">{t.roles.find((r) => r.id === m.role)?.label ?? m.role}</span> : <Select label={`Role for ${m.name}`} value={m.role} options={invitable.map((r) => ({ value: r.id, label: r.label }))} disabled={!act.changeRole} onChange={async (x) => { setRerr(undefined); const r = await act.changeRole!(m.id, x); if (r && r.error) setRerr(r.error); }} />}</div>
          <div className="w-28 text-xs"><span className={ST[m.status][1]}>{ST[m.status][0]}</span><div className="text-neutral-400">{m.date}</div></div>
          <div className="flex w-36 justify-end gap-1">{manage && !m.isOwner && (m.status === "active" ? <Button variant="ghost" disabled={!act.removeMember} onClick={() => confirm({ title: `Remove ${m.name}?`, body: "This member will lose access to the agency workspace. Their past activity remains on record.", confirm: "Remove member", run: () => act.removeMember!(m.id) })}>Remove</Button> : <><Button variant="ghost" disabled={!act.resendInvite} onClick={async () => { const r = await act.resendInvite!(m.id); if (r && r.error) setRerr(r.error); }}>Resend</Button><Button variant="ghost" disabled={!act.cancelInvite} onClick={() => confirm({ title: "Cancel this invitation?", body: `${m.email} will no longer be able to join with this invite.`, confirm: "Cancel invitation", run: () => act.cancelInvite!(m.id) })}>Cancel</Button></>)}</div></li>))}</ul>}</>);
}

function Roles({ d, act }: Ctx) {
  const t = d.team; const [sel, setSel] = useState(t?.roles[0]?.id); const [open, setOpen] = useState<string>(); const [err, setErr] = useState<string>();
  if (!t) return (<><Header title="Roles & permissions" /><Unavailable what="Roles and permissions" /></>);
  const r = t.roles.find((x) => x.id === sel) ?? t.roles[0]; const edit = d.viewer.canManageTeam && r?.editable && !!act.setRolePermission;
  return (<><Header title="Roles & permissions" desc="See what each role can do, grouped by area." />
    <div className="mb-8 flex flex-wrap gap-2">{t.roles.map((x) => <button key={x.id} onClick={() => setSel(x.id)} className={cx("rounded-full px-4 py-1.5 text-sm transition-all duration-200", focusRing, x.id === r?.id ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800")}>{x.label}</button>)}</div>
    {r && <p className="mb-6 max-w-prose text-sm text-neutral-500">{r.description}{!edit && " This role’s permissions can’t be changed."}</p>}
    {err && <div className="mb-4"><Notice tone="warn">{err}</Notice></div>}
    <div className="divide-y divide-neutral-200/60 dark:divide-white/[0.06]">{t.groups.map((g) => { const on = g.items.filter((i) => r?.permissions.includes(i.id)).length; const o = open === g.label; return (
      <div key={g.label}><button aria-expanded={o} onClick={() => setOpen(o ? undefined : g.label)} className={cx("flex w-full items-center justify-between py-4 text-left", focusRing)}><span className="text-sm font-medium text-neutral-900 dark:text-white">{g.label}</span><span className="flex items-center gap-3 text-xs text-neutral-500">{on} of {g.items.length}<Icon d={I.chevron} className={cx("transition-transform duration-300", EASE, o && "rotate-180")} /></span></button>
        <Collapse open={o}><ul className="space-y-4 pb-5">{g.items.map((i) => <li key={i.id} className="flex items-center justify-between gap-6"><div><div className="text-sm text-neutral-800 dark:text-neutral-200">{i.label}</div><div className="text-[13px] text-neutral-500">{i.description}</div></div><Toggle label={i.label} checked={!!r?.permissions.includes(i.id)} disabled={!edit} onChange={async (v) => { setErr(undefined); const x = await act.setRolePermission!(r!.id, i.id, v); if (x && x.error) setErr(x.error); }} /></li>)}</ul></Collapse></div>); })}</div></>);
}

function Integrations() {
  const integrations = [
    { name: "Agency website", description: "Connect your RouteHQ website or request integration with an existing agency website.", details: ["Website connection", "Lead form synchronisation", "Agency domain and publishing"], icon: "W" },
    { name: "Meta Ads", description: "Connect your Meta Business account and advertising assets.", details: ["Meta Pixel", "Conversions API (CAPI)", "Lead event and conversion tracking"], icon: "M" },
    { name: "Other services", description: "Additional connections can be configured as RouteHQ expands.", details: ["Google Analytics", "WhatsApp and messaging", "Booking and supplier APIs"], icon: "+" },
  ];
  return (<><Header title="Integrations" desc="Connect the tools and services your agency uses. Integration setup is currently handled by the RouteHQ team." />
    <div className="space-y-4">{integrations.map((item) => <section key={item.name} className="rounded-2xl border border-neutral-200/80 p-5 dark:border-white/[0.08] sm:p-6">
      <div className="flex items-start gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-sm font-semibold text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">{item.icon}</div>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-neutral-900 dark:text-white">{item.name}</h3><span className="rounded-full bg-neutral-500/10 px-2.5 py-1 text-[11px] font-medium text-neutral-500">Not connected</span></div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">{item.description}</p>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">{item.details.map((detail) => <li key={detail} className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400"><span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />{detail}</li>)}</ul>
          <div className="mt-5 flex flex-wrap items-center gap-3"><Button disabled title="Integration requests will be enabled when backend support is ready">Request integration</Button><span className="text-xs text-neutral-500">Not connected yet. Contact the RouteHQ / Web4 team for setup.</span></div>
        </div>
      </div></section>)}</div>
  </>);
}

const VIEWS: Record<Tab, Record<string, (c: Ctx) => ReactElement>> = {
  personal: { profile: PersonalProfile, security: Security, preferences: Preferences, notifications: Notifications, account: Account },
  agency: { profile: AgencyProfile, website: Website, operations: Operations, subscription: Subscription, danger: Danger },
  team: { members: Members, roles: Roles },
  integrations: { connections: Integrations },
};

/* ───────────── Shell ───────────── */
export default function RouteHQSettings({ data, actions, initialTab = "personal", initialSection, onNavigate }: RouteHQSettingsProps) {
  const tabs = Object.keys(NAV) as Tab[];
  const [tab, setTab] = useState<Tab>(initialTab);
  const [sec, setSec] = useState(initialSection ?? NAV[initialTab].sections[0].id);
  const confirm = useConfirm();
  const go = (t: Tab, s?: string) => { const id = s ?? NAV[t].sections[0].id; setTab(t); setSec(id); onNavigate?.(t, id); };

  const btns = useRef<Record<string, HTMLButtonElement | null>>({}); const [ind, setInd] = useState({ x: 0, w: 0 });
  useLayoutEffect(() => { const el = btns.current[tab]; if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth }); }, [tab]);

  const View = VIEWS[tab][sec] ?? VIEWS[tab][NAV[tab].sections[0].id];
  const ctx: Ctx = { d: data, act: actions, confirm: confirm.ask };

  return (
    <div className="min-h-full bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
      <style>{`@keyframes rhq-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.rhq-in{animation:rhq-in .35s cubic-bezier(.32,.72,0,1)}@media(prefers-reduced-motion:reduce){.rhq-in{animation:none}*{transition-duration:.01ms!important}}`}</style>
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">Settings</h1>

        <div className="relative mt-6 inline-flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900" role="tablist" aria-label="Settings categories">
          <span aria-hidden className={cx("absolute top-1 h-[calc(100%-0.5rem)] rounded-lg bg-white shadow-sm transition-all duration-300 dark:bg-neutral-700/80", EASE)} style={{ left: ind.x, width: ind.w }} />
          {tabs.map((t) => <button key={t} ref={(el) => { btns.current[t] = el; }} role="tab" aria-selected={tab === t} onClick={() => go(t)}
            className={cx("relative z-10 rounded-lg px-5 py-1.5 text-sm font-medium transition-colors duration-200", focusRing, tab === t ? "text-neutral-900 dark:text-white" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300")}>{NAV[t].label}</button>)}
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-16">
          <nav aria-label={`${NAV[tab].label} sections`} className="-mx-5 flex gap-1 overflow-x-auto px-5 md:mx-0 md:flex-col md:overflow-visible md:px-0 [scrollbar-width:none]">
            {NAV[tab].sections.map((s) => { const on = s.id === sec; return (
              <button key={tab + s.id} aria-current={on ? "page" : undefined} onClick={() => go(tab, s.id)}
                className={cx("relative shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-all duration-200", focusRing, on ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-900 dark:text-white" : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 dark:hover:bg-neutral-900/60 dark:hover:text-neutral-200", s.id === "danger" && !on && "hover:text-red-500")}>
                {on && <span className="absolute left-0 top-1/2 hidden h-4 w-0.5 -translate-y-1/2 rounded-full bg-orange-500 md:block" />}{s.label}</button>); })}
          </nav>
          <main key={tab + sec} className="rhq-in min-w-0" aria-live="polite">{data.loading ? <Skeleton /> : <View {...ctx} />}</main>
        </div>
      </div>
      {confirm.node}
    </div>
  );
}