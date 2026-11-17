'use client';
import React, { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client/api';
import { FONT_CHOICES, renderCard } from '@/lib/client/renderCard';
import { toast } from './Toasts.jsx';
import { IconSpark } from './Icons.jsx';

const EMPTY = {
  name: '', website: '', industry: '', description: '', service_area: '', target_audience: '',
  services: [], offer: '', differentiators: [], proof_points: [], guarantees: [],
  default_cta: 'Book a free strategy call', tone_of_voice: '', banned_phrases: [], compliance_notes: '',
  colors: { deep: '#0B0B0C', light: '#F7F7F2', accent: '#7C5CFF', primary: '#0B0B0C', secondary: '#F7F7F2' },
  fonts: { heading: 'Montserrat', body: 'Nunito Sans' },
  logo_url: '', logo_mono: false, brand_images: [], social: { facebook: '', instagram: '' },
  agency_name: '', website_summary: '',
};

const COLOR_FIELDS = [
  ['deep', 'Background (dark)', 'Card ground, and text on light cards'],
  ['light', 'Text (light)', 'Text on dark cards, grid tiles'],
  ['accent', 'Accent', 'Payoff headline line, ticks, CTA button'],
  ['primary', 'Primary', 'Main brand colour'],
  ['secondary', 'Secondary', 'Supporting brand colour'],
];

const REQUIRED = ['name', 'website', 'industry', 'description', 'target_audience', 'default_cta'];
const FIELD_TAB = { name: 'details', website: 'details', industry: 'details', description: 'details', target_audience: 'offer', default_cta: 'offer' };
const TABS = [['kit', 'Brand kit'], ['details', 'Details'], ['offer', 'Audience & offer'], ['voice', 'Voice & rules'], ['photos', 'Photos']];

const toLines = (arr) => (arr || []).join('\n');
const fromLines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);

const PREVIEW = {
  format: '1:1',
  spec: { ground: 'deep', photo_layout: 'none', blocks: [
    { type: 'headline', lines: ['Your headline here.', 'accent:Payoff line.'] },
    { type: 'sub', text: 'A short sub-line in the body font shows how the brand reads.' },
    { type: 'space', px: 10 },
    { type: 'checklist', items: ['First benefit', 'Second benefit', 'Third benefit'] },
    { type: 'space', px: 14 },
    { type: 'cta', label: 'Book a free strategy call' },
  ] },
};

export default function BrandForm({ brand, onCancel, onSaved, onDelete, onGenerate }) {
  const [tab, setTab] = useState('kit');
  const [b, setB] = useState(() => ({ ...EMPTY, ...brand, colors: { ...EMPTY.colors, ...(brand.colors || {}) }, fonts: { ...EMPTY.fonts, ...(brand.fonts || {}) }, social: { ...EMPTY.social, ...(brand.social || {}) } }));
  const [lists, setLists] = useState(() => ({
    services: toLines(brand.services), differentiators: toLines(brand.differentiators), proof_points: toLines(brand.proof_points),
    guarantees: toLines(brand.guarantees), banned_phrases: toLines(brand.banned_phrases),
  }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [errors, setErrors] = useState({});
  const canvasRefs = [useRef(null), useRef(null), useRef(null)];

  const set = (k, v) => { setB((x) => ({ ...x, [k]: v })); setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e)); };
  const setColor = (k, v) => setB((x) => ({ ...x, colors: { ...x.colors, [k]: v } }));

  const photoUrl = (b.brand_images || [])[0]?.url || '';
  useEffect(() => {
    if (tab !== 'kit') return;
    const cta = (bl) => (bl.type === 'cta' ? { ...bl, label: b.default_cta || bl.label } : bl);
    const blocks = PREVIEW.spec.blocks.map(cta);
    const variants = [
      { format: '1:1', spec: { ...PREVIEW.spec, blocks } },
      { format: '1:1', spec: { ...PREVIEW.spec, ground: 'light', blocks } },
      { format: '1:1', photo_url: photoUrl, spec: { ...PREVIEW.spec, photo_layout: photoUrl ? 'right' : 'none', blocks: blocks.filter((x) => x.type !== 'checklist') } },
    ];
    canvasRefs.forEach((r, i) => r.current && renderCard(r.current, variants[i], b).catch(() => {}));
  }, [tab, b.colors, b.fonts, b.logo_url, b.logo_mono, b.name, b.default_cta, photoUrl]);

  const uploadLogo = async (file) => {
    if (!file) return;
    setUploading(true);
    try { set('logo_url', await api.upload(file, 'logos')); }
    catch (e) { toast(`Logo upload failed: ${e.message}`, 'error'); }
    finally { setUploading(false); }
  };
  const uploadImages = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const added = [];
      for (const f of files) added.push({ url: await api.upload(f, 'brand-images'), label: f.name.replace(/\.[^.]+$/, '') });
      setB((x) => ({ ...x, brand_images: [...(x.brand_images || []), ...added] }));
    } catch (e) { toast(`Image upload failed: ${e.message}`, 'error'); }
    finally { setUploading(false); }
  };

  const autofill = async () => {
    if (!b.website) { setErrors({ website: 'Enter the website first' }); return; }
    setAnalyzing(true);
    try {
      const s = await api.analyzeWebsite(b.website);
      setB((x) => ({
        ...x,
        name: x.name || s.name || '',
        industry: x.industry || s.industry || '',
        description: x.description || s.description || '',
        service_area: x.service_area || s.service_area || '',
        target_audience: x.target_audience || s.target_audience || '',
        offer: x.offer || s.offer || '',
        tone_of_voice: x.tone_of_voice || s.tone_of_voice || '',
        default_cta: x.default_cta || s.default_cta || '',
        website_summary: s.website_summary || x.website_summary,
      }));
      setLists((l) => ({
        ...l,
        services: l.services || toLines(s.services),
        differentiators: l.differentiators || toLines(s.differentiators),
        proof_points: l.proof_points || toLines(s.proof_points),
        guarantees: l.guarantees || toLines(s.guarantees),
      }));
      toast('Filled empty fields from the website. Check them before saving.');
    } catch (e) { toast(`Couldn't read the website: ${e.message}`, 'error'); }
    finally { setAnalyzing(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    REQUIRED.forEach((k) => { if (!String(b[k] || '').trim()) errs[k] = 'Required'; });
    if (b.website && !/^https?:\/\//i.test(b.website)) errs.website = 'Start with https://';
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0];
      setTab(FIELD_TAB[first] || 'details');
      toast('Fill in the required fields', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...b };
      Object.keys(lists).forEach((k) => { payload[k] = fromLines(lists[k]); });
      ['created_at', 'updated_at'].forEach((k) => delete payload[k]);
      const saved = await api.saveBrand(payload);
      toast(`${b.name} saved`);
      onSaved(saved);
    } catch (err) { toast(`Save failed: ${err.message}`, 'error'); }
    finally { setSaving(false); }
  };

  const F = ({ k, label, hint, textarea, placeholder, rows = 3 }) => (
    <label className={`field ${errors[k] ? 'invalid' : ''}`}>
      <span>{label}{REQUIRED.includes(k) && <em className="req">*</em>}</span>
      {textarea
        ? <textarea rows={rows} value={b[k] || ''} placeholder={placeholder} onChange={(e) => set(k, e.target.value)} />
        : <input value={b[k] || ''} placeholder={placeholder} onChange={(e) => set(k, e.target.value)} />}
      {errors[k] ? <small className="err">{errors[k]}</small> : hint && <small>{hint}</small>}
    </label>
  );
  const L = ({ k, label, hint, placeholder }) => (
    <label className="field">
      <span>{label}</span>
      <textarea rows={4} value={lists[k]} placeholder={placeholder} onChange={(e) => setLists((l) => ({ ...l, [k]: e.target.value }))} />
      <small>{hint || 'One per line'}</small>
    </label>
  );

  const tabErr = (t) => Object.keys(errors).some((k) => errors[k] && FIELD_TAB[k] === t);
  const initial = (b.name || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <form className="brand-form" onSubmit={submit} noValidate>
      <div className="brand-head">
        <div className="brand-tile" style={{ background: b.colors.deep }}>
          {b.logo_url ? <img src={b.logo_url} alt="" /> : <span style={{ color: b.colors.accent }}>{initial}</span>}
        </div>
        <div className="brand-title">
          <h1>{brand.id ? b.name || brand.name : (b.name || 'New brand')}</h1>
          <p className="muted">Define the brand here: colours, logo, fonts, photos, offer and voice. Claude only says what this kit allows.</p>
        </div>
        <div className="row-gap center brand-actions">
          {onDelete && <button type="button" className="btn ghost danger" onClick={onDelete}>Delete</button>}
          {!brand.id && <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>}
          {onGenerate && <button type="button" className="btn outline" onClick={onGenerate}><IconSpark /> Generate</button>}
          <button type="submit" className="btn primary" disabled={saving || uploading}>{saving ? 'Saving…' : 'Save brand'}</button>
        </div>
      </div>

      <div className="tabs-line" role="tablist">
        {TABS.map(([k, label]) => (
          <button type="button" key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {label}{tabErr(k) && <span className="dot-err" aria-label="has errors" />}
          </button>
        ))}
      </div>

      {tab === 'kit' && (
        <div className="kit">
          <div className="kit-panel">
            <h4 className="panel-label">Colours</h4>
            <div className="swatch-list">
              {COLOR_FIELDS.map(([k, label, hint]) => (
                <label key={k} className="swatch-row" title={hint}>
                  <span className="swatch-pick" style={{ background: b.colors[k] }}>
                    <input type="color" value={b.colors[k]} onChange={(e) => setColor(k, e.target.value)} aria-label={`${label} colour`} />
                  </span>
                  <span className="swatch-text">
                    <strong>{label}</strong>
                    <input className="hex" value={b.colors[k]} onChange={(e) => setColor(k, e.target.value)} aria-label={`${label} hex`} />
                  </span>
                </label>
              ))}
            </div>

            <h4 className="panel-label">Fonts</h4>
            <label className="field"><span>Heading</span>
              <select value={b.fonts.heading} onChange={(e) => set('fonts', { ...b.fonts, heading: e.target.value })}>{FONT_CHOICES.map((f) => <option key={f}>{f}</option>)}</select>
            </label>
            <label className="field"><span>Body</span>
              <select value={b.fonts.body} onChange={(e) => set('fonts', { ...b.fonts, body: e.target.value })}>{FONT_CHOICES.map((f) => <option key={f}>{f}</option>)}</select>
            </label>

            <h4 className="panel-label">Logo</h4>
            <div className="logo-drop">
              {b.logo_url ? <img src={b.logo_url} alt="Logo" style={{ background: b.colors.deep }} /> : <span className="muted small">PNG with a transparent background works best</span>}
              <input type="file" accept="image/*" onChange={(e) => uploadLogo(e.target.files[0])} aria-label="Upload logo" />
            </div>
            <label className="check"><input type="checkbox" checked={!!b.logo_mono} onChange={(e) => set('logo_mono', e.target.checked)} /> Recolour logo to the text colour on cards</label>
          </div>

          <div className="kit-stage">
            <div className="stage-head">
              <h3>Brand look</h3>
              <span className="muted small">Classic card examples. With Free design, Claude creates a new layout for every creative in these colours and fonts.</span>
            </div>
            <div className="stage-grid">
              <figure><canvas ref={canvasRefs[0]} aria-label="Dark card preview" /><figcaption>Dark card <span>text only</span></figcaption></figure>
              <figure><canvas ref={canvasRefs[1]} aria-label="Light card preview" /><figcaption>Light card <span>text only</span></figcaption></figure>
              <figure><canvas ref={canvasRefs[2]} aria-label="Photo card preview" /><figcaption>Photo card <span>{photoUrl ? 'first brand photo' : 'add photos to see this'}</span></figcaption></figure>
            </div>
          </div>
        </div>
      )}

      {tab === 'details' && (
        <div className="tab-body">
          <fieldset>
            <legend>Basics</legend>
            <div className="grid-2">
              {F({ k: 'name', label: 'Brand name', placeholder: 'PestScale' })}
              <div className="field-with-action">
                {F({ k: 'website', label: 'Website', placeholder: 'https://example.com' })}
                <button type="button" className="btn outline sm" onClick={autofill} disabled={analyzing}>{analyzing ? 'Reading website…' : 'Auto-fill from website'}</button>
              </div>
              {F({ k: 'industry', label: 'Industry', placeholder: 'Pest control' })}
              {F({ k: 'service_area', label: 'Location / service area', placeholder: 'Phoenix metro, AZ' })}
            </div>
            {F({ k: 'description', label: 'What the business does', textarea: true, placeholder: 'One or two sentences in plain words' })}
            {F({ k: 'agency_name', label: 'Managing agency', hint: 'Optional: the agency that runs this brand\'s ads' })}
          </fieldset>
          <fieldset>
            <legend>Social</legend>
            <div className="grid-2">
              <label className="field"><span>Facebook page</span><input value={b.social.facebook || ''} onChange={(e) => set('social', { ...b.social, facebook: e.target.value })} placeholder="https://facebook.com/…" /></label>
              <label className="field"><span>Instagram</span><input value={b.social.instagram || ''} onChange={(e) => set('social', { ...b.social, instagram: e.target.value })} placeholder="@handle" /></label>
            </div>
          </fieldset>
        </div>
      )}

      {tab === 'offer' && (
        <div className="tab-body">
          <fieldset>
            <legend>Audience and offer</legend>
            {F({ k: 'target_audience', label: 'Ideal customer', textarea: true, placeholder: 'Who buys, what they worry about, what they want back' })}
            <div className="grid-2">
              {L({ k: 'services', label: 'Services / products', placeholder: 'Website\nCRM\nMissed-call text-back' })}
              {L({ k: 'differentiators', label: 'What makes them different', placeholder: 'Built only for pest control' })}
            </div>
            {F({ k: 'offer', label: 'Main offer / pricing', placeholder: 'Complete system from $497/month' })}
            <div className="grid-2">
              {L({ k: 'proof_points', label: 'Proof points (verified only)', hint: 'Real numbers, reviews or results the business can back. One per line.' })}
              {L({ k: 'guarantees', label: 'Guarantees / risk reversals', placeholder: 'No long-term contracts\nYou own your data, content & domain' })}
            </div>
            {F({ k: 'default_cta', label: 'Default CTA button', placeholder: 'Book a free strategy call' })}
          </fieldset>
        </div>
      )}

      {tab === 'voice' && (
        <div className="tab-body">
          <fieldset>
            <legend>Voice and rules</legend>
            {F({ k: 'tone_of_voice', label: 'Tone of voice', textarea: true, rows: 2, placeholder: 'Plain-spoken, confident, no hype' })}
            <div className="grid-2">
              {L({ k: 'banned_phrases', label: 'Words or claims never to use' })}
              {F({ k: 'compliance_notes', label: 'Compliance notes', textarea: true, rows: 4, placeholder: 'e.g. no before/after claims, licence number must appear' })}
            </div>
            {b.website_summary && F({ k: 'website_summary', label: 'Website summary (from auto-fill)', textarea: true, rows: 4 })}
          </fieldset>
        </div>
      )}

      {tab === 'photos' && (
        <div className="tab-body">
          <fieldset>
            <legend>Brand photos</legend>
            <p className="muted small" style={{ marginTop: 0 }}>Real photos of the team, the work, vans or premises. Claude picks the best one for each creative, so upload a good spread (5 to 10).</p>
            <div className="thumbs">
              {(b.brand_images || []).map((im, i) => (
                <div key={im.url + i} className="thumb">
                  <img src={im.url} alt={im.label || 'Brand image'} />
                  <button type="button" className="icon-btn" aria-label="Remove image" onClick={() => set('brand_images', b.brand_images.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <label className="thumb add">
                <input type="file" accept="image/*" multiple onChange={(e) => uploadImages([...e.target.files])} aria-label="Upload brand images" />
                <span>{uploading ? 'Uploading…' : '+ Add photos'}</span>
              </label>
            </div>
          </fieldset>
        </div>
      )}
    </form>
  );
}
