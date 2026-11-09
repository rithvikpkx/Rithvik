"use client";
import { useEffect, useState } from "react";
import Window from "../windows/Window";
import { Icon } from "../Glyph";
import {
  checkProfile, checkNow, checkPlaces, checkStack, checkFaq, checkNumbers, checkLinks, checkWorkAuth, checkProject, checkExperience, checkEducation,
  ICON_NAMES, type Checked, type Errs,
} from "@/lib/content/validate";
import type { EditData, EditProject, EditRole, Result, Section } from "@/app/admin/content-actions";
import "./edit.css";

/** The server actions the window needs; injected so the lab harness can stub them. */
export type EditApi = {
  load: () => Promise<Result<EditData>>;
  saveSection: (s: Section, v: unknown) => Promise<Result>;
  saveProject: (id: string | null, v: unknown) => Promise<Result<string>>;
  saveExperience: (id: string | null, v: unknown) => Promise<Result<string>>;
  saveEducation: (id: string | null, v: unknown) => Promise<Result>;
  reorder: (t: "projects" | "experience", ids: string[]) => Promise<Result>;
  removeRow: (t: "projects" | "experience", id: string) => Promise<Result>;
};

type Status = { kind: "idle" | "saving" | "saved" | "error"; msg?: string };

/** Draft state for one form: dirty tracking, client validation then server save, inline "Saved"/error. */
function useForm<T>(initial: T, check: (d: T) => Checked<unknown>, save: (d: T) => Promise<Result<unknown>>, report: (dirty: boolean) => void, onSaved?: (data: unknown) => void) {
  const [draft, setDraft] = useState(initial);
  const [base, setBase] = useState(() => JSON.stringify(initial)); // last saved snapshot
  const [errors, setErrors] = useState<Errs>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const dirty = JSON.stringify(draft) !== base;
  useEffect(() => report(dirty), [dirty, report]);
  useEffect(() => { if (status.kind !== "saved") return; const t = setTimeout(() => setStatus({ kind: "idle" }), 2500); return () => clearTimeout(t); }, [status]);
  const submit = async () => {
    const c = check(draft);
    if (!c.ok) { setErrors(c.errors); setStatus({ kind: "error", msg: "Fix the highlighted fields." }); return; }
    setErrors({}); setStatus({ kind: "saving" });
    const snapshot = JSON.stringify(draft);
    const r = await save(draft).catch((): Result<unknown> => ({ ok: false, error: "Network error — nothing was saved." }));
    if (r.ok) { setBase(snapshot); setStatus({ kind: "saved" }); onSaved?.(r.data); report(JSON.stringify(draft) !== snapshot); }
    else { setErrors(r.errors ?? {}); setStatus({ kind: "error", msg: r.error }); } // draft is kept so nothing typed is lost
  };
  return { draft, setDraft, errors, status, dirty, submit };
}

/** Labelled control with an inline error under it. `path` keys into the errors map. */
function Field({ label, id, errors, path, children, hint }: { label: string; id: string; errors: Errs; path: string; children: (p: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode; hint?: string }) {
  const e = errors[path] ?? Object.entries(errors).find(([k]) => k.startsWith(`${path}.`))?.[1]; // nested errors (tags.2) surface under the parent control
  return (
    <div className="ew-field">
      <label htmlFor={id}>{label}</label>
      {children({ id, "aria-invalid": !!e, "aria-describedby": e ? `${id}-err` : undefined })}
      {hint && !e && <p className="ew-hint">{hint}</p>}
      {e && <p className="field-err" id={`${id}-err`}>{e}</p>}
    </div>
  );
}

/** Single-line or multiline text control bound to a draft string. */
function Text({ value, onChange, rows, ...p }: { value: string; onChange: (v: string) => void; rows?: number } & Record<string, unknown>) {
  return rows
    ? <textarea className="field" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} {...p} />
    : <input className="field" type="text" value={value} onChange={(e) => onChange(e.target.value)} {...p} />;
}

/** Comma-separated tags/items; keeps the raw text locally so typing a trailing comma isn't eaten. */
function Csv({ value, onChange, ...p }: { value: string[]; onChange: (v: string[]) => void } & Record<string, unknown>) {
  const [text, setText] = useState(value.join(", "));
  return <input className="field" type="text" value={text} onChange={(e) => { setText(e.target.value); onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean)); }} {...p} />;
}

/** Reorderable list of strings (bullets, paragraphs, thesis lines), with per-row errors. */
function StrList({ label, id, items, onChange, errors, path, rows, add = "Add" }: { label: string; id: string; items: string[]; onChange: (v: string[]) => void; errors: Errs; path: string; rows?: number; add?: string }) {
  const move = (i: number, d: number) => { const a = [...items]; [a[i], a[i + d]] = [a[i + d], a[i]]; onChange(a); };
  return (
    <fieldset className="ew-list">
      <legend>{label}</legend>
      {errors[path] && <p className="field-err">{errors[path]}</p>}
      {items.map((it, i) => (
        <div className="ew-row" key={i}>
          <Field label={`${label} ${i + 1}`} id={`${id}-${i}`} errors={errors} path={`${path}.${i}`}>
            {(a) => <Text value={it} rows={rows} onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} {...a} />}
          </Field>
          <RowTools i={i} n={items.length} move={move} remove={() => onChange(items.filter((_, j) => j !== i))} what={`${label} ${i + 1}`} />
        </div>
      ))}
      <button type="button" className="ui-btn" onClick={() => onChange([...items, ""])}><Icon name="plus" /> {add}</button>
    </fieldset>
  );
}

/** Up / down / delete buttons for one list row. */
function RowTools({ i, n, move, remove, what }: { i: number; n: number; move: (i: number, d: number) => void; remove: () => void; what: string }) {
  return (
    <span className="ew-tools">
      <button type="button" className="ui-ic" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${what} up`}><Icon name="arrow-up" /></button>
      <button type="button" className="ui-ic" disabled={i === n - 1} onClick={() => move(i, 1)} aria-label={`Move ${what} down`}><Icon name="arrow-up" className="ew-flip" /></button>
      <button type="button" className="ui-ic" onClick={remove} aria-label={`Delete ${what}`}><Icon name="x" /></button>
    </span>
  );
}

/** Save button + live status line shared by every form. */
function SaveBar({ f, label = "Save" }: { f: { status: Status; dirty: boolean; submit: () => void }; label?: string }) {
  return (
    <div className="ew-save">
      <button type="button" className="ui-btn primary" disabled={f.status.kind === "saving" || !f.dirty} onClick={f.submit}>{f.status.kind === "saving" ? "Saving…" : label}</button>
      <span role="status" className={f.status.kind === "error" ? "ew-err" : "ew-ok"}>
        {f.status.kind === "saved" ? "Saved" : f.status.kind === "error" ? f.status.msg : f.dirty ? "Unsaved changes" : ""}
      </span>
    </div>
  );
}

type Rep = (dirty: boolean) => void;
type Ctx = { data: EditData; api: EditApi; rep: (key: string) => Rep };

/** A form wrapper that stops Enter in a text input from submitting the page. */
const Form = ({ children, title, note }: { children: React.ReactNode; title: string; note?: string }) => (
  <form className="ew-form" onSubmit={(e) => e.preventDefault()} noValidate aria-label={title}>
    <h3>{title}</h3>{note && <p className="ew-hint">{note}</p>}{children}
  </form>
);

function ProfileTab({ data, api, rep }: Ctx) {
  const c = data.content;
  const f = useForm({ role: c.role, status: c.status, line: c.line, thesis: c.thesis, about: c.about }, checkProfile, (d) => api.saveSection("profile", d), rep("profile"));
  const set = (k: string) => (v: unknown) => f.setDraft({ ...f.draft, [k]: v });
  return (
    <Form title="Profile">
      <Field label="Role" id="pf-role" errors={f.errors} path="role">{(a) => <Text value={f.draft.role} onChange={set("role")} {...a} />}</Field>
      <Field label="Status" id="pf-status" errors={f.errors} path="status">{(a) => <Text value={f.draft.status} onChange={set("status")} {...a} />}</Field>
      <Field label="Line" id="pf-line" errors={f.errors} path="line">{(a) => <Text rows={2} value={f.draft.line} onChange={set("line")} {...a} />}</Field>
      <StrList label="Thesis" id="pf-th" items={f.draft.thesis} onChange={set("thesis")} errors={f.errors} path="thesis" />
      <StrList label="About paragraph" id="pf-ab" items={f.draft.about} onChange={set("about")} errors={f.errors} path="about" rows={4} />
      <SaveBar f={f} />
    </Form>
  );
}

type PlaceDraft = { key: string; city: string; tz: string; lat: string; lng: string };
function NowTab({ data, api, rep }: Ctx) {
  const n = useForm(data.content.now, checkNow, (d) => api.saveSection("now", d), rep("now"));
  const toIn = (ps: PlaceDraft[]) => ps.map((p) => ({ ...p, lat: p.lat.trim() === "" ? NaN : Number(p.lat), lng: p.lng.trim() === "" ? NaN : Number(p.lng) }));
  const places = useForm(data.content.places.map((p) => ({ ...p, lat: String(p.lat), lng: String(p.lng) })), (d) => checkPlaces(toIn(d)), (d) => api.saveSection("places", toIn(d)), rep("places"));
  const setN = (k: string) => (v: string) => n.setDraft({ ...n.draft, [k]: v });
  const setP = (i: number, k: string, v: string) => places.setDraft(places.draft.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const move = (i: number, d: number) => { const a = [...places.draft]; [a[i], a[i + d]] = [a[i + d], a[i]]; places.setDraft(a); };
  return (
    <>
      <Form title="Now">
        <Field label="City" id="now-city" errors={n.errors} path="city">{(a) => <Text value={n.draft.city} onChange={setN("city")} {...a} />}</Field>
        <Field label="Timezone" id="now-tz" errors={n.errors} path="tz" hint="IANA name, e.g. America/Los_Angeles">{(a) => <Text value={n.draft.tz} onChange={setN("tz")} {...a} />}</Field>
        <Field label="Building" id="now-b" errors={n.errors} path="building">{(a) => <Text value={n.draft.building} onChange={setN("building")} {...a} />}</Field>
        <Field label="Researching" id="now-r" errors={n.errors} path="researching">{(a) => <Text value={n.draft.researching} onChange={setN("researching")} {...a} />}</Field>
        <Field label="Learning" id="now-l" errors={n.errors} path="learning">{(a) => <Text value={n.draft.learning} onChange={setN("learning")} {...a} />}</Field>
        <SaveBar f={n} />
      </Form>
      <Form title="Places">
        {places.errors.places && <p className="field-err">{places.errors.places}</p>}
        {places.draft.map((p, i) => (
          <fieldset className="ew-card" key={i}>
            <legend>Place {i + 1}</legend>
            <div className="ew-grid">
              <Field label="Kind" id={`pl-${i}-k`} errors={places.errors} path={`places.${i}.key`}>
                {(a) => <select className="field" value={p.key} onChange={(e) => setP(i, "key", e.target.value)} {...a}><option>home</option><option>school</option><option>now</option></select>}
              </Field>
              <Field label="City" id={`pl-${i}-c`} errors={places.errors} path={`places.${i}.city`}>{(a) => <Text value={p.city} onChange={(v) => setP(i, "city", v)} {...a} />}</Field>
              <Field label="Timezone" id={`pl-${i}-t`} errors={places.errors} path={`places.${i}.tz`}>{(a) => <Text value={p.tz} onChange={(v) => setP(i, "tz", v)} {...a} />}</Field>
              <Field label="Latitude" id={`pl-${i}-la`} errors={places.errors} path={`places.${i}.lat`}>{(a) => <Text value={p.lat} onChange={(v) => setP(i, "lat", v)} inputMode="decimal" {...a} />}</Field>
              <Field label="Longitude" id={`pl-${i}-ln`} errors={places.errors} path={`places.${i}.lng`}>{(a) => <Text value={p.lng} onChange={(v) => setP(i, "lng", v)} inputMode="decimal" {...a} />}</Field>
            </div>
            <RowTools i={i} n={places.draft.length} move={move} remove={() => places.setDraft(places.draft.filter((_, j) => j !== i))} what={`place ${i + 1}`} />
          </fieldset>
        ))}
        <button type="button" className="ui-btn" onClick={() => places.setDraft([...places.draft, { key: "now", city: "", tz: "", lat: "", lng: "" }])}><Icon name="plus" /> Add place</button>
        <SaveBar f={places} />
      </Form>
    </>
  );
}

function StackTab({ data, api, rep }: Ctx) {
  const f = useForm(Object.entries(data.content.stack).map(([name, items]) => ({ name, items })), checkStack, (d) => api.saveSection("stack", d), rep("stack"));
  const set = (i: number, k: string, v: unknown) => f.setDraft(f.draft.map((g, j) => (j === i ? { ...g, [k]: v } : g)));
  const move = (i: number, d: number) => { const a = [...f.draft]; [a[i], a[i + d]] = [a[i + d], a[i]]; f.setDraft(a); };
  return (
    <Form title="Stack" note="Groups of tools. Items are comma-separated.">
      {f.errors.stack && <p className="field-err">{f.errors.stack}</p>}
      {f.draft.map((g, i) => (
        <fieldset className="ew-card" key={i}>
          <legend>Group {i + 1}</legend>
          <Field label="Group name" id={`st-${i}-n`} errors={f.errors} path={`stack.${i}.name`}>{(a) => <Text value={g.name} onChange={(v) => set(i, "name", v)} {...a} />}</Field>
          <Field label="Items" id={`st-${i}-i`} errors={f.errors} path={`stack.${i}.items`}>{(a) => <Csv value={g.items} onChange={(v) => set(i, "items", v)} {...a} />}</Field>
          <RowTools i={i} n={f.draft.length} move={move} remove={() => f.setDraft(f.draft.filter((_, j) => j !== i))} what={`group ${i + 1}`} />
        </fieldset>
      ))}
      <button type="button" className="ui-btn" onClick={() => f.setDraft([...f.draft, { name: "", items: [] }])}><Icon name="plus" /> Add group</button>
      <SaveBar f={f} />
    </Form>
  );
}

/** Shared editor for [a, b] pair lists (FAQ, numbers). */
function PairTab({ title, section, initial, check, labels, rows, errPath, ids, api, rep }: { title: string; section: Section; initial: [string, string][]; check: (v: unknown) => Checked<unknown>; labels: [string, string]; rows: number; errPath: string; ids: string } & Pick<Ctx, "api" | "rep">) {
  const f = useForm(initial, check, (d) => api.saveSection(section, d), rep(section));
  const set = (i: number, k: 0 | 1, v: string) => f.setDraft(f.draft.map((p, j) => (j === i ? (k ? [p[0], v] : [v, p[1]]) : p) as [string, string]));
  const move = (i: number, d: number) => { const a = [...f.draft]; [a[i], a[i + d]] = [a[i + d], a[i]]; f.setDraft(a); };
  return (
    <Form title={title}>
      {f.errors[errPath] && <p className="field-err">{f.errors[errPath]}</p>}
      {f.draft.map((p, i) => (
        <fieldset className="ew-card" key={i}>
          <legend>{title} {i + 1}</legend>
          <Field label={labels[0]} id={`${ids}-${i}-0`} errors={f.errors} path={`${errPath}.${i}.0`}>{(a) => <Text value={p[0]} onChange={(v) => set(i, 0, v)} {...a} />}</Field>
          <Field label={labels[1]} id={`${ids}-${i}-1`} errors={f.errors} path={`${errPath}.${i}.1`}>{(a) => <Text rows={rows} value={p[1]} onChange={(v) => set(i, 1, v)} {...a} />}</Field>
          <RowTools i={i} n={f.draft.length} move={move} remove={() => f.setDraft(f.draft.filter((_, j) => j !== i))} what={`${title} ${i + 1}`} />
        </fieldset>
      ))}
      <button type="button" className="ui-btn" onClick={() => f.setDraft([...f.draft, ["", ""]])}><Icon name="plus" /> Add</button>
      <SaveBar f={f} />
    </Form>
  );
}

function LinksTab({ data, api, rep }: Ctx) {
  const f = useForm(data.content.links, checkLinks, (d) => api.saveSection("links", d), rep("links"));
  const set = (k: string) => (v: string) => f.setDraft({ ...f.draft, [k]: v });
  return (
    <Form title="Links">
      <Field label="Email" id="ln-e" errors={f.errors} path="email">{(a) => <Text value={f.draft.email} onChange={set("email")} type="email" {...a} />}</Field>
      <Field label="GitHub URL" id="ln-g" errors={f.errors} path="github">{(a) => <Text value={f.draft.github} onChange={set("github")} {...a} />}</Field>
      <Field label="LinkedIn URL" id="ln-l" errors={f.errors} path="linkedin">{(a) => <Text value={f.draft.linkedin} onChange={set("linkedin")} {...a} />}</Field>
      <SaveBar f={f} />
    </Form>
  );
}

function AuthTab({ data, api, rep }: Ctx) {
  const f = useForm({ workAuth: data.content.workAuth }, checkWorkAuth, (d) => api.saveSection("workAuth", d), rep("workAuth"));
  return (
    <Form title="Work authorization" note="Shows only in the resume fine print and in the agent's answers. Never on the page itself.">
      <Field label="Work authorization" id="wa" errors={f.errors} path="workAuth">{(a) => <Text value={f.draft.workAuth} onChange={(v) => f.setDraft({ workAuth: v })} {...a} />}</Field>
      <SaveBar f={f} />
    </Form>
  );
}

function EducationTab({ data, api, rep }: Ctx) {
  const e = data.education, id = e.id;
  const f = useForm({ school: e.school, degree: e.degree, focus: e.focus, grad: e.grad }, checkEducation, (d) => api.saveEducation(id, d), rep("education"));
  const set = (k: string) => (v: string) => f.setDraft({ ...f.draft, [k]: v });
  return (
    <Form title="Education" note="Graduation date may stay empty: it is then hidden.">
      <Field label="School" id="ed-s" errors={f.errors} path="school">{(a) => <Text value={f.draft.school} onChange={set("school")} {...a} />}</Field>
      <Field label="Degree" id="ed-d" errors={f.errors} path="degree">{(a) => <Text value={f.draft.degree} onChange={set("degree")} {...a} />}</Field>
      <Field label="Focus" id="ed-f" errors={f.errors} path="focus">{(a) => <Text value={f.draft.focus} onChange={set("focus")} {...a} />}</Field>
      <Field label="Graduation" id="ed-g" errors={f.errors} path="grad">{(a) => <Text value={f.draft.grad} onChange={set("grad")} {...a} />}</Field>
      <SaveBar f={f} />
    </Form>
  );
}

let keySeq = 0; // client-side row keys (new rows have no id yet)
type Item = (EditProject | EditRole) & { _key: string };
const BLANK_PROJECT: EditProject = { id: "", slug: "", title: "", headline: "", kind: "", icon: "cpu", ctx: "", desc: [""], tags: [], links: [], published: false };
const BLANK_ROLE: EditRole = { id: "", slug: "", role: "", org: "", when: "", where: "", desc: [""], tags: [], published: false };

/** One expandable project/experience editor with its own Save, delete and published toggle. */
function ItemEditor({ kind, item, open, onToggle, move, i, n, api, rep, onSaved, onRemove }: {
  kind: "projects" | "experience"; item: Item; open: boolean; onToggle: () => void; move: (i: number, d: number) => void; i: number; n: number;
  api: EditApi; rep: (key: string) => Rep; onSaved: (id: string) => void; onRemove: () => void;
}) {
  const isP = kind === "projects";
  const id = item.id || null;
  const { _key, id: _id, ...init } = item; void _id;
  const f = useForm<Record<string, unknown>>(init, isP ? checkProject : checkExperience, (d) => (isP ? api.saveProject(id, d) : api.saveExperience(id, d)), rep(_key), (newId) => onSaved(newId as string));
  const d = f.draft as Record<string, never> & { desc: string[]; tags: string[]; links: { label: string; url: string }[]; published: boolean };
  const set = (k: string) => (v: unknown) => f.setDraft({ ...f.draft, [k]: v });
  const text = (k: string, label: string, extra?: { rows?: number; hint?: string }) => (
    <Field label={label} id={`${_key}-${k}`} errors={f.errors} path={k} hint={extra?.hint}>{(a) => <Text value={String(d[k] ?? "")} rows={extra?.rows} onChange={set(k)} {...a} />}</Field>
  );
  const title = isP ? (d.title as string) : [d.role, d.org].filter(Boolean).join(" · ");
  const setLink = (j: number, k: "label" | "url", v: string) => set("links")(d.links.map((l, x) => (x === j ? { ...l, [k]: v } : l)));
  return (
    <li className="ew-item">
      <div className="ew-item-head">
        <button type="button" className="ew-toggle" aria-expanded={open} aria-controls={`${_key}-body`} onClick={onToggle}>
          <Icon name={open ? "chevron-down" : "chevron-right"} />
          <span>{title || (id ? "Untitled" : "New item")}</span>
          {!d.published && <span className="ew-badge">Draft</span>}
          {f.dirty && <span className="ew-dot" aria-label="Unsaved changes" />}
        </button>
        <RowTools i={i} n={n} move={move} remove={onRemove} what={title || "item"} />
      </div>
      {open && (
        <form className="ew-body" id={`${_key}-body`} onSubmit={(e) => e.preventDefault()} noValidate aria-label={title || "Item"}>
          {text("slug", "Slug", { hint: "Used in the URL and as a stable id" })}
          {isP ? <>{text("title", "Title")}{text("headline", "Headline")}{text("kind", "Kind")}
            <Field label="Icon" id={`${_key}-icon`} errors={f.errors} path="icon">
              {(a) => <select className="field" value={d.icon as string} onChange={(e) => set("icon")(e.target.value)} {...a}>{ICON_NAMES.map((n) => <option key={n}>{n}</option>)}</select>}
            </Field>{text("ctx", "Context")}</>
            : <>{text("role", "Role")}{text("org", "Organization")}{text("when", "When", { hint: "Short, e.g. 2026 – now" })}{text("where", "Where")}</>}
          <StrList label="Bullet" id={`${_key}-d`} items={d.desc} onChange={set("desc")} errors={f.errors} path="desc" rows={2} add="Add bullet" />
          <Field label="Tags" id={`${_key}-tags`} errors={f.errors} path="tags" hint="Comma-separated">{(a) => <Csv value={d.tags} onChange={set("tags")} {...a} />}</Field>
          {isP && (
            <fieldset className="ew-list">
              <legend>Links</legend>
              {f.errors.links && <p className="field-err">{f.errors.links}</p>}
              {d.links.map((l, j) => (
                <div className="ew-row" key={j}>
                  <div className="ew-grid">
                    <Field label={`Link ${j + 1} label`} id={`${_key}-ll-${j}`} errors={f.errors} path={`links.${j}.label`}>{(a) => <Text value={l.label} onChange={(v) => setLink(j, "label", v)} {...a} />}</Field>
                    <Field label={`Link ${j + 1} URL`} id={`${_key}-lu-${j}`} errors={f.errors} path={`links.${j}.url`}>{(a) => <Text value={l.url} onChange={(v) => setLink(j, "url", v)} {...a} />}</Field>
                  </div>
                  <button type="button" className="ui-ic" onClick={() => set("links")(d.links.filter((_, x) => x !== j))} aria-label={`Delete link ${j + 1}`}><Icon name="x" /></button>
                </div>
              ))}
              <button type="button" className="ui-btn" onClick={() => set("links")([...d.links, { label: "", url: "" }])}><Icon name="plus" /> Add link</button>
            </fieldset>
          )}
          <label className="ew-check"><input type="checkbox" checked={d.published} onChange={(e) => set("published")(e.target.checked)} /> Published <span className="ew-hint">(unchecked = draft, hidden from visitors)</span></label>
          <SaveBar f={f} />
        </form>
      )}
    </li>
  );
}

/** Project / experience list: optimistic reorder + delete with rollback, drafts shown with a badge. */
function ListTab({ kind, data, api, rep }: Ctx & { kind: "projects" | "experience" }) {
  const wrap = (r: EditProject | EditRole): Item => ({ ...r, _key: `${kind}-${keySeq++}` });
  const [items, setItems] = useState<Item[]>(() => (kind === "projects" ? data.projects : data.experience).map(wrap));
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const noun = kind === "projects" ? "project" : "role";

  /** Applies a list change at once, runs the server call, restores the old list if it fails. */
  const optimistic = async (next: Item[], call: () => Promise<Result<unknown>>) => {
    const prev = items; setItems(next); setMsg("");
    const r = await call().catch((): Result<unknown> => ({ ok: false, error: "Network error" }));
    if (!r.ok) { setItems(prev); setMsg(`Couldn't update: ${r.error}. Reverted.`); }
  };
  const move = (i: number, d: number) => {
    const a = [...items]; [a[i], a[i + d]] = [a[i + d], a[i]];
    if (a.some((x) => !x.id)) { setItems(a); return; } // an unsaved new item has no id yet; order is persisted once it is saved
    void optimistic(a, () => api.reorder(kind, a.map((x) => x.id)));
  };
  const remove = (it: Item) => {
    if (it.id && !confirm(`Delete this ${noun}? This can't be undone.`)) return;
    const next = items.filter((x) => x._key !== it._key);
    if (!it.id) setItems(next); else void optimistic(next, () => api.removeRow(kind, it.id));
  };
  return (
    <div className="ew-form">
      <h3>{kind === "projects" ? "Projects" : "Experience"}</h3>
      <p className="ew-hint">Reorder with the arrows. Drafts are hidden from visitors until published.</p>
      {msg && <p className="field-err" role="alert">{msg}</p>}
      <ul className="ew-items">
        {items.map((it, i) => (
          <ItemEditor key={it._key} kind={kind} item={it} i={i} n={items.length} open={open === it._key} api={api} rep={rep}
            onToggle={() => setOpen(open === it._key ? null : it._key)} move={move} onRemove={() => remove(it)}
            onSaved={(id) => setItems((cur) => cur.map((x) => (x._key === it._key ? { ...x, id } : x)))} />
        ))}
      </ul>
      <button type="button" className="ui-btn" onClick={() => { const n = wrap(kind === "projects" ? BLANK_PROJECT : BLANK_ROLE); setItems([...items, n]); setOpen(n._key); }}><Icon name="plus" /> Add {noun}</button>
    </div>
  );
}

const TABS = ["Profile", "Now & places", "Projects", "Experience", "Education", "Stack", "FAQ", "Numbers", "Links", "Work auth"] as const;

/** The "Edit content" window: one tabbed admin form for every v7 field, independent of the active design. */
export default function EditContentUI({ api, onClose }: { api: EditApi; onClose: () => void }) {
  const [data, setData] = useState<EditData | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Profile");
  // One registry per window: dirty keys, plus a stable reporter per key (useForm re-runs its effect when the callback changes).
  const [{ dirty, rep }] = useState(() => {
    const dirty = new Set<string>(), reps = new Map<string, Rep>();
    const rep = (key: string): Rep => {
      if (!reps.has(key)) reps.set(key, (d) => { if (d) dirty.add(key); else dirty.delete(key); });
      return reps.get(key)!;
    };
    return { dirty, rep };
  });

  useEffect(() => {
    let live = true;
    api.load().then((r) => { if (!live) return; if (r.ok) setData(r.data); else setLoadErr(r.error); }).catch(() => live && setLoadErr("Couldn't load content."));
    return () => { live = false; };
  }, [api]);

  const close = () => { if (!dirty.size || confirm("Discard unsaved changes?")) onClose(); };
  const ctx = data && { data, api, rep };
  const panels: Record<(typeof TABS)[number], React.ReactNode> = ctx ? {
    Profile: <ProfileTab {...ctx} />, "Now & places": <NowTab {...ctx} />,
    Projects: <ListTab {...ctx} kind="projects" />, Experience: <ListTab {...ctx} kind="experience" />, Education: <EducationTab {...ctx} />,
    Stack: <StackTab {...ctx} />,
    FAQ: <PairTab title="FAQ" section="faq" initial={data.content.faq} check={checkFaq} labels={["Question", "Answer"]} rows={4} errPath="faq" ids="faq" api={api} rep={rep} />,
    Numbers: <PairTab title="Numbers" section="numbers" initial={data.content.numbers} check={checkNumbers} labels={["Value", "Label"]} rows={0} errPath="numbers" ids="num" api={api} rep={rep} />,
    Links: <LinksTab {...ctx} />, "Work auth": <AuthTab {...ctx} />,
  } : ({} as never);

  return (
    <Window title="Edit content" icon="file-text" label="Edit content" className="edit-win" onClose={close} initialFocus='[role="tab"][aria-selected="true"]'>
      <div className="ew-tabs" role="tablist" aria-label="Sections" onKeyDown={(e) => {
        const i = TABS.indexOf(tab), d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (d) { const t = TABS[(i + d + TABS.length) % TABS.length]; setTab(t); document.getElementById(`ew-tab-${TABS.indexOf(t)}`)?.focus(); }
      }}>
        {TABS.map((t, i) => (
          <button key={t} id={`ew-tab-${i}`} role="tab" type="button" aria-selected={tab === t} aria-controls={`ew-panel-${i}`} tabIndex={tab === t ? 0 : -1} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <div className="ew-scroll">
        {loadErr && <p className="field-err" role="alert">{loadErr}</p>}
        {!data && !loadErr && <p className="ew-hint" role="status">Loading…</p>}
        {data && TABS.map((t, i) => (
          // All panels stay mounted (hidden) so drafts survive tab switches.
          <div key={t} id={`ew-panel-${i}`} role="tabpanel" aria-labelledby={`ew-tab-${i}`} hidden={tab !== t}>{panels[t]}</div>
        ))}
      </div>
    </Window>
  );
}
