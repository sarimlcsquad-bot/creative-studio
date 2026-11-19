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

// The parts of a house-style card that move as one piece; other designs fall back to the nearest sizeable block.
const PARTS = '.logo,.logo-s,.offer,.hd,.sub,.slot,.sp-vis,.sp-text,.cta-wrap,.foot-l,.foot-r,.pn,.dvwrap';
const LAYOUT_ATTRS = ['data-cs-moved', 'data-cs-del', 'data-cs-pos'];

function pickPart(el, canvas) {
  if (!el || !canvas.contains(el) || el === canvas) return null;
  const sharp = el.closest(PARTS.split(',').map((s) => `.canvas ${s}`).join(','));
  if (sharp && canvas.contains(sharp)) {
    // Inside the split text column, pick the headline, line or button rather than the whole column.
    if (sharp.matches('.sp-text') && el !== sharp) { const inner = el.closest('.hd,.sub,.cta-wrap'); if (inner) return inner; }
    return sharp;
  }
  const area = canvas.offsetWidth * canvas.offsetHeight;
  for (let n = el; n && n !== canvas; n = n.parentElement) {
    const r = n.getBoundingClientRect();
    if (r.width * r.height >= area * 0.02) return r.width * r.height < area * 0.8 ? n : el;
  }
  return el;
}

const readMove = (el) => {
  const [x = '0', y = '0'] = (el.style.translate || '').split(/\s+/);
  return { x: parseFloat(x) || 0, y: parseFloat(y) || 0, s: parseFloat(el.style.scale) || 1 };
};
const writeMove = (el, { x, y, s }) => {
  el.style.translate = x || y ? `${Math.round(x)}px ${Math.round(y)}px` : '';
  el.style.scale = Math.abs(s - 1) > 0.001 ? String(Math.round(s * 1000) / 1000) : '';
  if (el.style.translate || el.style.scale) {
    el.setAttribute('data-cs-moved', '1');
    // A moved part sits on top of the others.
    if (!el.style.zIndex) { el.style.zIndex = '5'; if (el.ownerDocument.defaultView.getComputedStyle(el).position === 'static') { el.style.position = 'relative'; el.setAttribute('data-cs-pos', '1'); } }
  } else clearMove(el);
};
const clearMove = (el) => {
  el.style.translate = ''; el.style.scale = '';
  if (el.hasAttribute('data-cs-moved')) el.style.zIndex = '';
  if (el.hasAttribute('data-cs-pos')) el.style.position = '';
  el.removeAttribute('data-cs-moved'); el.removeAttribute('data-cs-pos');
};

// Free designs are edited in place: click any text on the design and type, or switch to Layout to move, resize or remove parts.
function HtmlEditor({ creative, brand, frameRef, mode }) {
  const fmt = FORMATS[creative.format] || FORMATS['1:1'];
  const boxRef = useRef(null);
  const [scale, setScale] = useState(0.4);
  const [sel, setSel] = useState(null);
  const [box, setBox] = useState(null);
  const [, bump] = useState(0);
  const drag = useRef(null);
  const undo = useRef([]);
  useEffect(() => {
    const fit = () => boxRef.current && setScale(boxRef.current.clientWidth / fmt.w);
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fmt.w]);
  const doc = () => frameRef.current?.contentDocument;
  const canvasEl = () => doc()?.querySelector('.canvas');
  const onLoad = () => { const d = doc(); if (d) d.designMode = mode === 'text' ? 'on' : 'off'; setLayoutStyle(); };
  // In Layout mode every part can be hit (images and empty shapes too), and text can't be typed into.
  const setLayoutStyle = () => {
    const d = doc(); if (!d) return;
    d.designMode = mode === 'text' ? 'on' : 'off';
    let st = d.getElementById('cs-layout');
    if (mode === 'layout' && !st) { st = d.createElement('style'); st.id = 'cs-layout'; st.textContent = '.canvas *{pointer-events:auto !important;cursor:move}'; d.head.appendChild(st); }
    if (mode !== 'layout' && st) st.remove();
  };
  useEffect(() => { setLayoutStyle(); if (mode !== 'layout') { setSel(null); setBox(null); } }, [mode]);

  const measure = (el) => {
    const c = canvasEl(); if (!el || !c) return setBox(null);
    const r = el.getBoundingClientRect(), b = c.getBoundingClientRect();
    setBox({ x: (r.left - b.left) * scale, y: (r.top - b.top) * scale, w: r.width * scale, h: r.height * scale });
  };
  useEffect(() => { measure(sel); }, [sel, scale]);

  const remember = (el) => { undo.current.push({ el, style: el.getAttribute('style'), attrs: LAYOUT_ATTRS.map((a) => el.getAttribute(a)) }); if (undo.current.length > 50) undo.current.shift(); };
  const at = (e) => { const r = boxRef.current.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; };

  const down = (e) => {
    const c = canvasEl(); if (!c) return;
    const p = at(e);
    const el = pickPart(doc().elementFromPoint(p.x, p.y), c);
    setSel(el);
    if (!el) return;
    remember(el);
    drag.current = { kind: 'move', start: p, from: readMove(el), el };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const downHandle = (e) => {
    if (!sel) return;
    e.stopPropagation(); e.preventDefault();
    remember(sel);
    const r = sel.getBoundingClientRect(), b = canvasEl().getBoundingClientRect();
    const center = { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 };
    const p = at(e);
    drag.current = { kind: 'size', center, d0: Math.hypot(p.x - center.x, p.y - center.y) || 1, from: readMove(sel), el: sel };
    e.currentTarget.closest('.layout-layer')?.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    const g = drag.current; if (!g) return;
    const p = at(e);
    if (g.kind === 'move') writeMove(g.el, { ...g.from, x: g.from.x + p.x - g.start.x, y: g.from.y + p.y - g.start.y });
    else writeMove(g.el, { ...g.from, s: Math.min(4, Math.max(0.2, g.from.s * Math.hypot(p.x - g.center.x, p.y - g.center.y) / g.d0)) });
    measure(g.el);
  };
  const up = () => { if (drag.current) { const { el, from } = drag.current; const now = readMove(el); if (now.x === from.x && now.y === from.y && now.s === from.s) undo.current.pop(); } drag.current = null; bump((n) => n + 1); };

  const act = (fn) => { if (!sel) return; remember(sel); fn(sel); measure(sel); bump((n) => n + 1); };
  const resize = (k) => act((el) => { const m = readMove(el); writeMove(el, { ...m, s: Math.min(4, Math.max(0.2, m.s * k)) }); });
  const nudge = (dx, dy) => act((el) => { const m = readMove(el); writeMove(el, { ...m, x: m.x + dx, y: m.y + dy }); });
  const remove = () => { act((el) => { el.style.visibility = 'hidden'; el.setAttribute('data-cs-del', '1'); }); setSel(null); };
  const resetOne = () => act((el) => { clearMove(el); el.style.visibility = ''; el.removeAttribute('data-cs-del'); });
  const resetAll = () => {
    const c = canvasEl(); if (!c) return;
    c.querySelectorAll('[data-cs-moved],[data-cs-del]').forEach((el) => { remember(el); clearMove(el); el.style.visibility = ''; el.removeAttribute('data-cs-del'); });
    measure(sel); bump((n) => n + 1);
  };
  const doUndo = () => {
    const u = undo.current.pop(); if (!u) return;
    if (u.style == null) u.el.removeAttribute('style'); else u.el.setAttribute('style', u.style);
    LAYOUT_ATTRS.forEach((a, i) => (u.attrs[i] == null ? u.el.removeAttribute(a) : u.el.setAttribute(a, u.attrs[i])));
    measure(sel); bump((n) => n + 1);
  };
  const key = (e) => {
    if (mode !== 'layout') return;
    const k = e.shiftKey ? 10 : 2;
    const map = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, -k], ArrowDown: [0, k] };
    if (map[e.key] && sel) { e.preventDefault(); nudge(...map[e.key]); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); remove(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); }
    else if (e.key === 'Escape') setSel(null);
  };
  const changed = mode === 'layout' && !!canvasEl()?.querySelector('[data-cs-moved],[data-cs-del]');
  const pct = sel ? Math.round(readMove(sel).s * 100) : 100;

  return (
    <>
      <div ref={boxRef} className="html-editor" style={{ height: fmt.h * scale }} tabIndex={mode === 'layout' ? 0 : -1} onKeyDown={key}>
        <iframe ref={frameRef} title="Edit design" sandbox="allow-same-origin" srcDoc={editorDoc(creative, brand)} onLoad={onLoad}
          style={{ width: fmt.w, height: fmt.h, transform: `scale(${scale})` }} />
        {mode === 'layout' && (
          <div className="layout-layer" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Drag a part of the design to move it">
            {box && <div className="layout-sel" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
              <span className="layout-handle" onPointerDown={downHandle} aria-label="Drag to resize" title="Drag to resize" />
            </div>}
          </div>
        )}
      </div>
      {mode === 'layout' && (
        <div className="layout-bar" role="toolbar" aria-label="Layout tools">
          <span className="small muted">{sel ? `Selected · ${pct}%` : 'Click a part to select it'}</span>
          <button className="btn xs" disabled={!sel} onClick={() => resize(1 / 1.08)} aria-label="Smaller">−</button>
          <button className="btn xs" disabled={!sel} onClick={() => resize(1.08)} aria-label="Larger">+</button>
          <button className="btn xs" disabled={!sel} onClick={() => sel?.parentElement && sel.parentElement !== canvasEl() && setSel(sel.parentElement)}>Select group</button>
          <button className="btn xs" disabled={!sel} onClick={resetOne}>Reset part</button>
          <button className="btn xs danger" disabled={!sel} onClick={remove}>Delete</button>
          <span className="spacer" />
          <button className="btn xs" disabled={!undo.current.length} onClick={doUndo}>Undo</button>
          <button className="btn xs" disabled={!changed} onClick={resetAll}>Reset layout</button>
        </div>
      )}
    </>
  );
}

export default function CreativeDetail({ creative, brand, onClose, onDelete, onFavorite, onSaved }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const fav = !!creative.concept?.favorite;
  const ref = useRef(null);
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState('text');
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
              <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>
          : <><button className="btn ghost" onClick={() => { setMode('text'); setEditing(true); }}>{isHtml ? 'Edit' : 'Edit text'}</button>
              <button className="btn primary" onClick={download}>Download PNG</button></>}
      </>}>
      <div className="detail">
        <div className="detail-canvas">
          {editing && isHtml ? <HtmlEditor creative={{ ...creative, spec }} brand={brand} frameRef={frameRef} mode={mode} /> : <canvas ref={ref} />}
        </div>
        <div className="detail-side">
          {editing && isHtml ? (
            <>
              <div className="seg" role="tablist" aria-label="What to edit">
                <button role="tab" aria-selected={mode === 'text'} className={mode === 'text' ? 'on' : ''} onClick={() => setMode('text')}>Text</button>
                <button role="tab" aria-selected={mode === 'layout'} className={mode === 'layout' ? 'on' : ''} onClick={() => setMode('layout')}>Move and resize</button>
              </div>
              {mode === 'text'
                ? <div className="notice"><strong>Click any text on the design and type to change it.</strong> Switch to Move and resize to move, resize or delete parts. Save when you are done.</div>
                : <div className="notice"><strong>Drag a part to move it.</strong> Drag the corner handle to resize, or use − and +. Delete hides the part. Arrow keys nudge it (Shift for bigger steps). Reset layout puts everything back. Save when you are done; the downloaded PNG matches.</div>}
            </>
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
