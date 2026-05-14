"use client";

import { useState } from "react";
import type { GlobeMarker, GlobeMarkerKind } from "@/lib/types";

interface Props {
  markers: GlobeMarker[];
  onSave: (next: GlobeMarker[]) => Promise<void>;
}

const COMMON_TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Indiana/Indianapolis", "America/Phoenix", "America/Anchorage",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid",
  "Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata", "Asia/Singapore", "Asia/Dubai",
  "Australia/Sydney", "America/Sao_Paulo", "America/Mexico_City",
];

const emptyForm = (): GlobeMarker => ({
  id: crypto.randomUUID(),
  city: "", region: "", country: "",
  lat: 0, lng: 0,
  timezone: "America/New_York",
  kind: "default",
});

export default function MarkerEditorPanel({ markers, onSave }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<GlobeMarker | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const openAdd = () => { setForm(emptyForm()); setErr(null); };
  const openEdit = (m: GlobeMarker) => { setForm({ ...m }); setErr(null); };

  const submitForm = async () => {
    if (!form) return;
    setSaving(true); setErr(null);
    try {
      const exists = markers.some((m) => m.id === form.id);
      const next = exists
        ? markers.map((m) => (m.id === form.id ? form : m))
        : [...markers, form];
      await onSave(next);
      setForm(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteMarker = async (id: string) => {
    setSaving(true); setErr(null);
    try {
      await onSave(markers.filter((m) => m.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  // Parse "lat, lng" pasted into the lat field → autofill both.
  const onLatPaste = (raw: string): { lat: number; lng?: number } | null => {
    const m = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!m) return null;
    return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  };

  return (
    <div className={`globe-editor${expanded ? " globe-editor-open" : ""}`}>
      <button
        type="button"
        className="globe-editor-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? "▾ Markers" : `▸ Markers (${markers.length})`}
      </button>

      {expanded && (
        <div className="globe-editor-body">
          <ul className="globe-marker-list">
            {markers.map((m) => (
              <li key={m.id}>
                <span className="globe-marker-list-city">{m.city}</span>
                <span className={`globe-marker-kind globe-marker-kind-${m.kind}`}>{m.kind}</span>
                <button type="button" onClick={() => openEdit(m)} aria-label={`Edit ${m.city}`}>✎</button>
                <button type="button" onClick={() => deleteMarker(m.id)} aria-label={`Delete ${m.city}`} disabled={saving}>⌫</button>
              </li>
            ))}
          </ul>
          {!form && (
            <button type="button" className="globe-editor-add" onClick={openAdd}>+ Add marker</button>
          )}
          {form && (
            <form
              className="globe-editor-form"
              onSubmit={(e) => { e.preventDefault(); void submitForm(); }}
            >
              <label>City<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required /></label>
              <label>Region<input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="optional" /></label>
              <label>Country<input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} required /></label>
              <label>Latitude
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.lat}
                  onChange={(e) => {
                    const parsed = onLatPaste(e.target.value);
                    if (parsed) setForm({ ...form, lat: parsed.lat, lng: parsed.lng ?? form.lng });
                    else setForm({ ...form, lat: parseFloat(e.target.value) || 0 });
                  }}
                  required
                />
              </label>
              <label>Longitude<input type="number" step="0.0001" value={form.lng} onChange={(e) => setForm({ ...form, lng: parseFloat(e.target.value) || 0 })} required /></label>
              <label>Timezone (IANA)
                <input list="globe-tz-list" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} required />
                <datalist id="globe-tz-list">
                  {COMMON_TIMEZONES.map((tz) => <option key={tz} value={tz} />)}
                </datalist>
              </label>
              <fieldset className="globe-kind-picker">
                <legend>Kind</legend>
                {(["home", "current", "default"] as GlobeMarkerKind[]).map((k) => (
                  <label key={k}>
                    <input type="radio" name="kind" value={k} checked={form.kind === k} onChange={() => setForm({ ...form, kind: k })} />
                    {k}
                  </label>
                ))}
              </fieldset>
              <div className="globe-editor-actions">
                <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                <button type="button" onClick={() => setForm(null)} disabled={saving}>Cancel</button>
              </div>
              {err && <p className="globe-editor-err">{err}</p>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
