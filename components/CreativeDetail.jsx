'use client';
import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal.jsx';
import { IconStar, IconTrash } from './Icons.jsx';
import { renderCard, FORMATS } from '@/lib/client/renderCard';
import { editorDoc, toStoredHtml } from '@/lib/client/renderHtml';
import { api } from '@/lib/client/api';
import { toast } from './Toasts.jsx';
import { STAGE_LABEL, METHOD_LABEL } from './CreativeCard.jsx';

function CopyField({ label, value, long }) {
  const [all, setAll] = useState(false);
  if (!value) return null;
  const clamp = long && !all && value.length > 260;
  return (
    <div className="copy-field">
      <div className="copy-head">
        <span>{label}</span>
        <button className="btn xs" onClick={() => navigator.clipboard?.writeText(value).then(() => toast(`${label} copied`))}>Copy</button>
      </div>
      <pre className={clamp ? 'clamped' : ''}>{value}</pre>
      {long && value.length > 260 && <button className="link-btn copy-more" onClick={() => setAll((x) => !x)}>{all ? 'Show less' : 'Show all'}</button>}
    </div>
  );
}

// Free designs are edited in place: click any text on the design and type.
function HtmlEditor({ creative, brand, frameRef }) {
  const fmt = FORMATS[creative.format] || FORMATS['1:1'];
  const boxRef = useRef(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const fit = () => boxRef.current && setScale(boxRef.current.clientWidth / fmt.w);
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fmt.w]);
  const onLoad = () => {
    const doc = frameRef.current?.contentDocument;
    if (doc) doc.designMode = 'on';
  };
  return (
    <div ref={boxRef} className="html-editor" style={{ height: fmt.h * scale }}>
      <iframe ref={frameRef} title="Edit design" sandbox="allow-same-origin" srcDoc={editorDoc(creative, brand)} onLoad={onLoad}
        style={{ width: fmt.w, height: fmt.h, transform: `scale(${scale})` }} />
    </div>
  );
}

export default function CreativeDetail({ creative, brand, onClose, onDelete, onFavorite, onSaved }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const fav = !!creative.concept?.favorite;
  const ref = useRef(null);
  const [editing, setEditing] = useState(false);
  const [spec, setSpec] = useState(creative.spec || { blocks: [] });
  const [saving, setSaving] = useState(false);
  const frameRef = useRef(null);
  const isHtml = creative.spec?.mode === 'html';

  useEffect(() => { setSpec(creative.spec || { blocks: [] }); }, [creative.id]);
  useEffect(() => {
    if (ref.current) renderCard(ref.current, { ...creative, spec }, brand).catch(() => {});
  }, [creative, brand, spec, editing]);

  const download = () => {
    const name = `${(brand?.name || 'creative').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${creative.id.slice(0, 8)}-${creative.format.replace(':', 'x')}.png`;
    try {
      ref.current.toBlob((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }, 'image/png');
    } catch {
      if (creative.rendered_url) window.open(creative.rendered_url, '_blank');
      else toast('The image host blocked the download. Check the storage bucket is public.', 'error');
    }
  };

  const setBlock = (i, patch) => setSpec((s) => ({ ...s, blocks: s.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));

  const save = async () => {
    setSaving(true);
    try {
      let next = spec;
      if (isHtml) {
        const canvas = frameRef.current?.contentDocument?.querySelector('.canvas');
        if (!canvas) throw new Error('The editor is still loading');
        next = { ...spec, html: toStoredHtml(canvas.innerHTML, creative, brand) };
        setSpec(next);
      }
      await api.updateCreative({ id: creative.id, spec: next, rendered_url: null });
      toast('Creative updated');
      setEditing(false);
      onSaved();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const c = creative.concept || {};
  const copy = creative.ad_copy || {};
  const checks = [...new Set([...(c.flags || []), ...(c.compliance_notes || []), ...(c.design_check || []), ...(c.image_error ? [`The AI image failed, so the design has no image: ${c.image_error}`] : [])])];

  return (
    <Modal wide title={brand?.name || 'Creative'} onClose={onClose}
      footer={<>
        {confirmDel
          ? <span className="row-gap center"><span className="small">Delete this creative?</span>
              <button className="btn ghost sm" onClick={() => setConfirmDel(false)}>Keep it</button>
              <button className="btn danger-fill sm" onClick={onDelete}>Delete</button></span>
          : <button className="btn square danger" onClick={() => setConfirmDel(true)} aria-label="Delete creative" title="Delete"><IconTrash /></button>}
        <button className={`btn square fav-btn ${fav ? 'on' : ''}`} onClick={() => onFavorite(!fav)} aria-pressed={fav}
          aria-label={fav ? 'Remove from favorites' : 'Add to favorites'} title={fav ? 'Remove from favorites' : 'Add to favorites'}><IconStar filled={fav} /></button>
        <span className="spacer" />
        {editing
          ? <><button className="btn ghost" onClick={() => { setSpec(creative.spec); setEditing(false); }}>Cancel</button>
              <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save text'}</button></>
          : <><button className="btn ghost" onClick={() => setEditing(true)}>Edit text</button>
              <button className="btn primary" onClick={download}>Download PNG</button></>}
      </>}>
      <div className="detail">
        <div className="detail-canvas">
          {editing && isHtml ? <HtmlEditor creative={{ ...creative, spec }} brand={brand} frameRef={frameRef} /> : <canvas ref={ref} />}
        </div>
        <div className="detail-side">
          {editing && isHtml ? (
            <div className="notice"><strong>Click any text on the design and type to change it.</strong> Save when you are done. To change the layout itself, generate a new creative.</div>
          ) : editing ? (
            <div className="edit-blocks">
              {spec.blocks.map((b, i) => {
                if (b.type === 'headline') return (
                  <label className="field" key={i}><span>Headline lines (start the payoff line with accent:)</span>
                    <textarea rows={3} value={(b.lines || []).join('\n')} onChange={(e) => setBlock(i, { lines: e.target.value.split('\n') })} /></label>);
                if (b.type === 'sub') return (
                  <label className="field" key={i}><span>Sub-line</span>
                    <textarea rows={3} value={b.text || ''} onChange={(e) => setBlock(i, { text: e.target.value })} /></label>);
                if (b.type === 'checklist' || b.type === 'grid') return (
                  <label className="field" key={i}><span>{b.type === 'grid' ? 'Grid tiles' : 'Checklist'} (one per line)</span>
                    <textarea rows={4} value={(b.items || []).join('\n')} onChange={(e) => setBlock(i, { items: e.target.value.split('\n') })} /></label>);
                if (b.type === 'cta') return (
                  <label className="field" key={i}><span>Button</span>
                    <input value={b.label || ''} onChange={(e) => setBlock(i, { label: e.target.value })} /></label>);
                return null;
              })}
              <label className="field"><span>Photo position</span>
                <select value={spec.photo_layout || 'none'} onChange={(e) => setSpec((s) => ({ ...s, photo_layout: e.target.value }))} disabled={!creative.photo_url}>
                  <option value="right">Right</option><option value="bottom">Bottom</option><option value="none">No photo</option>
                </select></label>
              <label className="field"><span>Card ground</span>
                <select value={spec.ground || 'deep'} onChange={(e) => setSpec((s) => ({ ...s, ground: e.target.value }))}>
                  <option value="deep">Dark</option><option value="light">Light</option>
                </select></label>
            </div>
          ) : (
            <>
              <p className="detail-meta">{creative.source === 'agency' ? 'Agency owners' : 'Business owners'} · {METHOD_LABEL[c.method || creative.method] || 'Pre-Sold'} · {creative.format}</p>
              {checks.length > 0 && (
                <details className="wz-check">
                  <summary>{checks.length === 1 ? '1 thing to check before running' : `${checks.length} things to check before running`}</summary>
                  <ul>{checks.map((n, i) => <li key={i}>{n}</li>)}</ul>
                </details>
              )}
              <h3 className="detail-h">Ad copy</h3>
              <CopyField label="Primary text" value={copy.primary_text} long />
              <div className="grid-2 tight">
                <CopyField label="Headline" value={copy.headline} />
                <CopyField label="Description" value={copy.description} />
              </div>
              {copy.cta_button && <p className="small muted">Facebook button: {copy.cta_button.replace(/_/g, ' ').toLowerCase()}</p>}
              <details className="wz-fold">
                <summary>Details: angle, hook and visual</summary>
                {c.angle && <p><strong>Angle:</strong> {c.angle}</p>}
                {c.hook && <p><strong>Hook:</strong> {c.hook}</p>}
                {(c.visual_object || c.device) && <p><strong>Visual:</strong> {c.visual_object || `${c.device} screen${c.screen?.app_title ? `, ${c.screen.app_title}` : ''}`}</p>}
                {c.stage && <p><strong>Stage:</strong> {STAGE_LABEL[c.stage] || c.stage}</p>}
                {c.magic_name && <p><strong>Offer name (needs approval):</strong> {c.magic_name}</p>}
                {c.stack_items?.length > 0 && <p><strong>Stack:</strong> {c.stack_items.join(' · ')}</p>}
                {c.rationale && <p className="muted">{c.rationale}</p>}
                {(c.claims_used || []).length > 0 && <p className="small"><strong>Claims used from the brand kit:</strong> {c.claims_used.join('; ')}</p>}
                {creative.prompt && <p className="small muted">Prompt: “{creative.prompt}”</p>}
                {creative.photo_prompt && <p className="small muted">Image prompt: {creative.photo_prompt}</p>}
              </details>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
