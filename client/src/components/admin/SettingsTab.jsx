import { useEffect, useMemo, useState } from 'react';
import { Save, RotateCcw, Bell } from 'lucide-react';
import { Button } from '@/components/common/Button.jsx';
import { Switch } from '@/components/common/Switch.jsx';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { Spinner, ErrorState } from '@/components/common/States.jsx';
import { ChipListEditor } from './adminShared.jsx';
import { SETTINGS_SECTIONS } from './settingsFields.js';
import { useRipple } from '@/hooks/useInteractions.js';
import { adminApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { cn } from '@/utils/cn.js';
import { SETTING_BOUNDS, NOTIFICATION_TEMPLATES, notifTplSettingKey } from '@/utils/constants.js';

// Every 'number' field's setting key, derived once. Used to block a save that would send an
// empty string for a numeric setting (the server coerces '' → 0, silently corrupting unbounded
// keys like the reliability escalation factor, or rejecting the whole patch on a bounded one).
const NUMERIC_KEYS = new Set(
  SETTINGS_SECTIONS.flatMap((s) => s.fields.filter((f) => f.kind === 'number').map((f) => f.key))
);

/**
 * Settings editor. Local draft over the fetched settings; a sticky Save bar appears whenever the
 * draft diverges. Numbers, booleans (Switch), text, and chip-list editors (nudge presets +
 * emergency reasons). Also edits every notification template's title/body via NOTIFICATION_TEMPLATES.
 */
export function SettingsTab({ settings }) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const ripple = useRipple();

  useEffect(() => {
    if (settings.data) setDraft({ ...settings.data });
  }, [settings.data]);

  const dirtyKeys = useMemo(() => {
    if (!draft || !settings.data) return [];
    return Object.keys(draft).filter((k) => !shallowEqual(draft[k], settings.data[k]));
  }, [draft, settings.data]);
  const dirty = dirtyKeys.length > 0;

  if (settings.loading && !settings.data) return <Spinner label="Loading settings…" />;
  if (settings.error) return <ErrorState error={settings.error} onRetry={settings.refetch} title="Could not load settings" />;
  if (!draft) return <Spinner />;

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    // Send only the changed keys — a minimal patch keeps unrelated fields untouched.
    const patch = {};
    for (const k of dirtyKeys) patch[k] = draft[k];

    // Block blank fields that must not be empty before they reach the API:
    //  • numeric keys — the server reads '' as 0, silently zeroing an unbounded key or 400ing the
    //    whole patch on a bounded one;
    //  • notification templates — a blank title/body ships an EMPTY notification (the placeholder
    //    shows the default but blank persists as blank, it does not fall back).
    // Free-text keys (HQ address, signup release time) are legitimately blankable, so they're skipped.
    const isBlank = (v) => v === '' || v == null;
    const blank = dirtyKeys.filter(
      (k) => isBlank(draft[k]) && (NUMERIC_KEYS.has(k) || k.startsWith('notif_tpl_'))
    );
    if (blank.length) {
      toast.warning(`Fill in every required field before saving — ${blank.length} left blank.`);
      return;
    }

    setSaving(true);
    try {
      const updated = await adminApi.updateSettings(patch);
      toast.success('Settings saved');
      settings.setData(updated);
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => setDraft({ ...settings.data });

  return (
    <div className="pb-24">
      <div className="grid gap-5">
        {SETTINGS_SECTIONS.map((section) => (
          <Card key={section.key}>
            <CardHeader title={section.title} subtitle={section.description} />
            <div className="grid gap-4 sm:grid-cols-2">
              {section.fields.map((f) => (
                <div key={f.key} className={cn(f.kind === 'list' && 'sm:col-span-2')}>
                  <SettingField field={f} value={draft[f.key]} onChange={(v) => set(f.key, v)} />
                </div>
              ))}
            </div>
          </Card>
        ))}

        <NotificationTemplatesCard draft={draft} set={set} />
      </div>

      {/* Sticky Save bar — floats up whenever the draft diverges. */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 animate-slide-up px-4 pb-4 sm:px-6">
          <div className="lg-panel mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 shadow-elevation-3">
            <p className="text-sm text-content">
              <span className="font-semibold">{dirtyKeys.length}</span> unsaved change{dirtyKeys.length === 1 ? '' : 's'}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>
                <RotateCcw className="h-4 w-4" /> Discard
              </Button>
              <Button size="sm" className="ripple press hover-sheen" onPointerDown={ripple} loading={saving} onClick={save}>
                <Save className="h-4 w-4" /> Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingField({ field, value, onChange }) {
  if (field.kind === 'bool') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-bg-elevated px-3.5 py-3">
        <span className="text-sm text-content">{field.label}</span>
        <Switch checked={Boolean(value)} onChange={onChange} label={field.label} />
      </div>
    );
  }

  if (field.kind === 'list') {
    return (
      <ChipListEditor
        label={field.label}
        hint={field.hint}
        values={Array.isArray(value) ? value : []}
        onChange={onChange}
      />
    );
  }

  if (field.kind === 'text') {
    return (
      <div>
        <label className="label">{field.label}</label>
        <input className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
        {field.hint && <p className="mt-1 text-xs text-faint">{field.hint}</p>}
      </div>
    );
  }

  // number
  const bounds = SETTING_BOUNDS[field.key] || {};
  const hintParts = [];
  if (bounds.min != null) hintParts.push(`min ${bounds.min}`);
  if (bounds.max != null) hintParts.push(`max ${bounds.max}`);
  const hint = hintParts.join(' · ');
  return (
    <div>
      <label className="label">{field.label}</label>
      <div className="relative">
        <input
          type="number"
          className="input pr-14"
          value={value ?? ''}
          min={bounds.min}
          max={bounds.max}
          step={field.step || 1}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
        {field.unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">{field.unit}</span>}
      </div>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}

/** Editors for every admin-editable notification template's title + body, grouped by domain. */
function NotificationTemplatesCard({ draft, set }) {
  const groups = useMemo(() => {
    const byGroup = {};
    for (const t of NOTIFICATION_TEMPLATES) (byGroup[t.group] ||= []).push(t);
    return byGroup;
  }, []);

  const GROUP_LABEL = { chargers: 'Chargers & Queue', carpool: 'Carpool' };

  return (
    <Card>
      <CardHeader title="Notification copy" subtitle="Customize the title and body of each notification. {{variables}} are filled in at send time." icon={Bell} />
      <div className="grid gap-5">
        {Object.entries(groups).map(([group, templates]) => (
          <div key={group}>
            <p className="mb-2 text-label-lg font-medium text-muted">{GROUP_LABEL[group] || group}</p>
            <div className="grid gap-3">
              {templates.map((t) => {
                const titleKey = notifTplSettingKey(t.key, 'title');
                const bodyKey = notifTplSettingKey(t.key, 'body');
                return (
                  <div key={t.key} className="rounded-2xl bg-bg-elevated p-3.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-content">{t.label}</p>
                      {t.vars.length > 0 && (
                        <span className="text-xs text-faint">
                          {t.vars.map((v) => `{{${v}}}`).join(' ')}
                        </span>
                      )}
                    </div>
                    <input
                      className="input mb-2"
                      value={draft[titleKey] ?? ''}
                      onChange={(e) => set(titleKey, e.target.value)}
                      placeholder={t.defaultTitle}
                      aria-label={`${t.label} title`}
                    />
                    <textarea
                      className="input resize-none"
                      rows={2}
                      value={draft[bodyKey] ?? ''}
                      onChange={(e) => set(bodyKey, e.target.value)}
                      placeholder={t.defaultBody}
                      aria-label={`${t.label} body`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function shallowEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  return false;
}
