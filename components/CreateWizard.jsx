'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '@/lib/client/api';
import { toast } from './Toasts.jsx';
import { IconSpark } from './Icons.jsx';

const STAGES = [
  ['auto', 'Let Claude choose'],
  ['unaware', 'Unaware: scroll-stopping content'],
  ['problem', 'Problem-aware: name the pain'],
  ['solution', 'Solution-aware: old way vs new way'],
  ['product', 'Product-aware: what they get'],
  ['most', 'Most-aware: the offer'],
];
const STAGE_SHORT = { unaware: 'Unaware', problem: 'Problem-aware', solution: 'Solution-aware', product: 'Product-aware', most: 'Most-aware', auto: 'Auto' };
const METHOD_SHORT = { presold: 'Pre-Sold', '100m': '$100M Offers', both: 'Both methods' };
const CTA_BUTTONS = ['BOOK_NOW', 'LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'CONTACT_US', 'SHOP_NOW', 'SUBSCRIBE', 'GET_OFFER', 'APPLY_NOW'];
const VISUAL_LABEL = { photo: 'Realistic photo', object: '3D icon or object', illustration: 'Illustration' };
const DEVICE_LABEL = { phone: 'Phone', tablet: 'Tablet', laptop: 'Laptop' };
const SIDE_LABEL = { right: 'Right of the headline', left: 'Left of the headline', below: 'Under the headline' };
const SIDE_SHORT = { right: 'right', left: 'left', below: 'below' };
const FORMAT_LABEL = { '4:5': '4:5', '9:16': '9:16', both: '4:5 + 9:16' };
const LETTERS = 'ABCDEFGHIJ';
const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v || '');
const lightHex = (v) => { const n = parseInt(v.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150; };
const lines = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);

/** Three bouncing dots: shown wherever Claude is working. */
function Dots() {
  return <span className="dots" aria-hidden="true"><span /><span /><span /></span>;
}

function Loading({ text }) {
  return <div className="wz-loading" role="status"><Dots /><span>{text}</span></div>;
}

/** A chat with Claude for one step, at the bottom of the step: write what you want, Claude answers and updates the suggestions. */
function Chat({ messages, onSend, busy, placeholder, label = 'Ask Claude for something different' }) {
  const [text, setText] = useState('');
  const logRef = useRef(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [messages, busy]);
  const send = () => { const t = text.trim(); if (!t || busy) return; setText(''); onSend(t); };
  return (
    <div className="wz-chat">
      <div className="wz-chat-label">{label}</div>
      {(messages.length > 0 || busy) && (
        <div className="wz-chat-log" ref={logRef} aria-live="polite">
          {messages.map((m, i) => <div key={i} className={`wz-msg ${m.role}`}>{m.text}</div>)}
          {busy && <div className="wz-msg claude typing" aria-label="Claude is writing"><Dots /></div>}
        </div>
      )}
      <div className="wz-chat-input">
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={label}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="wz-send" onClick={send} disabled={!!busy || !text.trim()} aria-label="Send"><IconSend /> <span>Send</span></button>
      </div>
      <div className="wz-chat-hint">Enter to send · Shift + Enter for a new line</div>
    </div>
  );
}

function IconSend() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>;
}

/** Tabs for creatives A, B, C… on each step. */
function VariantTabs({ count, active, onPick, done, busyAt, title }) {
  if (count < 2) return null;
  return (
    <div className="wz-vtabs" role="tablist" aria-label={title || 'Creatives'}>
      {Array.from({ length: count }, (_, i) => (
        <button key={i} role="tab" aria-selected={active === i} className={`wz-vtab ${active === i ? 'on' : ''} ${done(i) ? 'ok' : ''}`} onClick={() => onPick(i)}>
          Creative {LETTERS[i]}
          {busyAt(i) ? <Dots /> : done(i) ? <span className="wz-vtab-ok" aria-label="done">✓</span> : <span className="wz-vtab-todo" aria-label="to do" />}
        </button>
      ))}
    </div>
  );
}

const blankChats = () => ({ hooks: [], content: [], assets: [], screens: [] });
const blank = () => ({
  angle: null, ownAngle: false, hooks: [], hook: '', content: null,
  visual: '', ideas: [], ideaAt: -1, photoUrl: '', screens: [], screenAt: -1,
  designNotes: '', chats: blankChats(), madeFor: {},
});

export default function CreateWizard({ brands, initialBrandId, settings, onClose, onDone }) {
  // Setup
  const [brandId, setBrandId] = useState(initialBrandId || brands[0]?.id || '');
  const [mode, setMode] = useState('random');
  const [prompt, setPrompt] = useState('');
  const [method, setMethod] = useState('presold');
  const [stage, setStage] = useState('auto');
  const [format, setFormat] = useState('4:5');
  const [design, setDesign] = useState('device');
  const [count, setCount] = useState(1);
  const [source, setSource] = useState(''); // the ad is for business owners or agency owners
  const [aiImages, setAiImages] = useState(false);
  useEffect(() => { api.config().then((c) => setAiImages(!!c.ai_images)); }, []);

  // One set of choices per creative (A, B, C…); angles are one shared list each creative picks from.
  const [vs, setVs] = useState([blank()]);
  const vsRef = useRef(vs);
  vsRef.current = vs;
  const [tab, setTab] = useState(0);
  useEffect(() => { setVs((list) => Array.from({ length: count }, (_, i) => list[i] || blank())); setTab((t) => Math.min(t, count - 1)); }, [count]);
  const upd = (i, patch) => setVs((list) => list.map((v, j) => (j === i ? { ...v, ...(typeof patch === 'function' ? patch(v) : patch) } : v)));
  const say = (chats, key, role, text) => (text ? { ...chats, [key]: [...chats[key], { role, text }] } : chats);

  const [angles, setAngles] = useState([]);
  const [angleChat, setAngleChat] = useState([]);
  const [anglesFor, setAnglesFor] = useState('');

  const [step, setStep] = useState('setup');
  const [maxAt, setMaxAt] = useState(0);
  const [busy, setBusy] = useState({}); // "i:kind" -> true
  const [starting, setStarting] = useState('');
  const isBusy = (k) => !!busy[k];

  const brand = brands.find((b) => b.id === brandId);
  const brandImages = (brand?.brand_images || []).filter((im) => /^https?:\/\//.test(im.url || ''));
  const isDevice = design === 'device';
  const steps = mode === 'random' ? ['setup', 'angle', 'hook', 'content', 'assets', 'generate'] : ['setup', 'hook', 'content', 'assets', 'generate'];
  const LABEL = { setup: 'Setup', angle: 'Angle', hook: 'Hook', content: 'Content', assets: 'Visual', generate: 'Review' };
  const at = steps.indexOf(step);
  const total = count * (format === 'both' ? 2 : 1);
  const v = vs[tab] || blank();

  const ask = async (key, body) => {
    setBusy((b) => ({ ...b, [key]: true }));
    try { return await api.wizard({ brand_id: brandId, method, stage, format, source, design, ...body }); }
    catch (e) { toast(e.message, 'error'); return null; }
    finally { setBusy((b) => { const n = { ...b }; delete n[key]; return n; }); }
  };
  const notes = () => (mode === 'random' ? prompt.trim() : '');
  const history = (msgs, direction) => (direction ? msgs.filter((m) => m.role === 'user').map((m) => m.text) : []);
  const merge = (list, r, items) => (r.action === 'add' ? [...list, ...items] : items);

  // Keys: each step remembers what it was made for, so going back keeps suggestions unless an earlier choice changed.
  const setupKey = `${brandId}|${source}|${mode}|${prompt}|${method}|${stage}|${format}|${design}`;
  const hookKey = (x) => `${setupKey}|${mode === 'random' ? JSON.stringify(x.angle) : ''}`;
  const contentKey = (x) => `${hookKey(x)}|${x.hook}`;

  // ---- loaders -------------------------------------------------------------
  const loadAngles = async (direction = '') => {
    const r = await ask('all:angles', {
      step: 'angles', direction, notes: notes(), history: history(angleChat, direction),
      avoid: angles.map((a) => a.title), how_many: Math.max(5, count + 2),
    });
    if (r) {
      setAngles((list) => merge(list, r, r.angles));
      if (r.action !== 'add') setVs((list) => list.map((x) => (x.ownAngle ? x : { ...x, angle: null })));
      setAngleChat((c) => (r.reply ? [...c, { role: 'claude', text: r.reply }] : c));
    }
  };
  const loadHooks = async (i, direction = '', avoidExtra = []) => {
    const x = vsRef.current[i];
    const r = await ask(`${i}:hooks`, {
      step: 'hooks', direction, notes: notes(), history: history(x.chats.hooks, direction),
      angle: mode === 'random' ? x.angle : null, prompt: mode === 'prompt' ? prompt : '',
      avoid: [...x.hooks.map((h) => h.text), ...avoidExtra],
    });
    if (r) upd(i, (y) => ({ hooks: merge(y.hooks, r, r.hooks), chats: say(y.chats, 'hooks', 'claude', r.reply) }));
    return r?.hooks || [];
  };
  const loadContent = async (i, direction = '') => {
    const x = vsRef.current[i];
    const c = x.content;
    const current = direction && c ? {
      headline: c.headline, support: c.support, bullets: lines(c.bulletsText), extra: c.extra, cta: c.cta,
      accent_words: (c.accentText || '').split(',').map((t) => t.trim()).filter(Boolean), proof_line: c.proof_line, bonus_pill: c.bonus_pill, cta_note: c.cta_note,
    } : null;
    const r = await ask(`${i}:content`, {
      step: 'content', direction, notes: notes(), history: history(x.chats.content, direction), current,
      angle: mode === 'random' ? x.angle : null, prompt: mode === 'prompt' ? prompt : '', hook: x.hook,
    });
    if (r) {
      upd(i, (y) => ({
        // The first draft keeps the hook the person picked as the headline; later messages may change it.
        content: { ...r.content, headline: direction ? (r.content.headline || y.hook) : (y.hook.trim() || r.content.headline), bulletsText: (r.content.bullets || []).join('\n'), accentText: (r.content.accent_words || []).join(', ') },
        chats: say(y.chats, 'content', 'claude', r.reply),
      }));
    }
  };
  const loadScreens = async (i, direction = '') => {
    const x = vsRef.current[i];
    const r = await ask(`${i}:screens`, {
      step: 'screens', direction, notes: notes(), history: history(x.chats.screens, direction),
      angle: mode === 'random' ? x.angle : null, prompt: mode === 'prompt' ? prompt : '', hook: x.hook,
      copy: x.content ? { headline: x.content.headline, support: x.content.support } : null,
      avoid: x.screens.map((s) => s.idea),
    });
    if (r) {
      const items = r.screens.map((s) => ({ ...s, elementsText: (s.elements || []).join('\n') }));
      upd(i, (y) => ({ screens: merge(y.screens, r, items), screenAt: r.action === 'add' ? y.screenAt : -1, chats: say(y.chats, 'screens', 'claude', r.reply), madeFor: { ...y.madeFor, screens: contentKey(y) } }));
    }
  };
  const loadIdeas = async (i, direction = '', forVisual) => {
    const x = vsRef.current[i];
    const r = await ask(`${i}:assets`, {
      step: 'assets', direction, notes: notes(), history: history(x.chats.assets, direction), visual: forVisual || x.visual,
      angle: mode === 'random' ? x.angle : null, prompt: mode === 'prompt' ? prompt : '', hook: x.hook,
      copy: x.content ? { headline: x.content.headline, support: x.content.support, extra: x.content.extra } : null,
      avoid: x.ideas.map((s) => s.idea),
    });
    if (r) upd(i, (y) => ({ ideas: merge(y.ideas, r, r.ideas), ideaAt: r.action === 'add' ? y.ideaAt : -1, chats: say(y.chats, 'assets', 'claude', r.reply), madeFor: { ...y.madeFor, ideas: contentKey(y) } }));
  };

  // ---- step checks ---------------------------------------------------------
  const usesAiOf = (x) => !isDevice && (x.visual === 'ai' || x.visual === 'both');
  const usesPhotoOf = (x) => !isDevice && (x.visual === 'photo' || x.visual === 'both');
  const okFor = {
    setup: () => !!brandId && !!source && (mode === 'random' || !!prompt.trim()),
    angle: (x) => !!x.angle?.title?.trim(),
    hook: (x) => !!x.hook.trim(),
    content: (x) => !!x.content?.headline?.trim(),
    assets: (x) => (isDevice
      ? !!x.screens[x.screenAt]
      : x.visual === 'none' || ((usesPhotoOf(x) ? !!x.photoUrl : true) && (usesAiOf(x) ? !!x.ideas[x.ideaAt]?.prompt?.trim() : true))),
    generate: () => true,
  };
  const stepOk = (s) => (s === 'setup' ? okFor.setup() : vs.every((x) => okFor[s](x)));

  // Entering a step loads what each creative still needs (all in parallel).
  const enter = (n) => {
    const list = vsRef.current;
    if (n === 'angle' && anglesFor !== setupKey) {
      setAnglesFor(setupKey); setAngles([]); setAngleChat([]);
      setVs((l) => l.map((x) => (x.ownAngle ? x : { ...x, angle: null })));
      loadAngles();
    }
    if (n === 'hook') {
      const stale = list.map((x, i) => (x.madeFor.hooks !== hookKey(x) ? i : -1)).filter((i) => i >= 0);
      stale.forEach((i) => upd(i, (y) => ({ hooks: [], hook: '', chats: { ...y.chats, hooks: [] }, madeFor: { ...y.madeFor, hooks: hookKey(y) } })));
      if (mode === 'prompt' && stale.length > 1) {
        // Same direction for every creative: load one after another so each gets different hooks.
        (async () => { let seen = []; for (const i of stale) seen = [...seen, ...(await loadHooks(i, '', seen)).map((h) => h.text)]; })();
      } else stale.forEach((i) => loadHooks(i));
    }
    if (n === 'content') {
      list.forEach((x, i) => {
        if (x.madeFor.content === contentKey(x)) return;
        upd(i, (y) => ({ content: null, chats: { ...y.chats, content: [] }, madeFor: { ...y.madeFor, content: contentKey(y) } }));
        loadContent(i);
      });
    }
    if (n === 'assets') {
      list.forEach((x, i) => {
        if (isDevice) {
          if (x.madeFor.screens !== contentKey(x)) { upd(i, (y) => ({ screens: [], screenAt: -1, chats: { ...y.chats, screens: [] } })); loadScreens(i); }
        } else {
          const vis = x.visual || (aiImages && brandImages.length ? 'both' : aiImages ? 'ai' : brandImages.length ? 'photo' : 'none');
          upd(i, { visual: vis });
          if ((vis === 'ai' || vis === 'both') && x.madeFor.ideas !== contentKey(x)) { upd(i, (y) => ({ ideas: [], ideaAt: -1, chats: { ...y.chats, assets: [] } })); loadIdeas(i, '', vis); }
        }
      });
    }
  };

  const go = (n) => {
    const target = steps.indexOf(n);
    if (target < 0 || target === at) return;
    if (target < at) { setTab(0); setStep(n); return; }
    // Forward: every step before the target must be complete.
    for (let k = 0; k < target; k++) {
      const s = steps[k];
      if (!stepOk(s)) {
        if (s !== 'setup') { const bad = vs.findIndex((x) => !okFor[s](x)); if (bad >= 0) setTab(bad); }
        setStep(s);
        return toast(s === 'setup' ? 'Choose who the ad is for first' : count > 1 ? `Finish ${LABEL[s]} for every creative first` : `Choose or write something in ${LABEL[s]} first`, 'error');
      }
    }
    for (let k = at + 1; k <= target; k++) enter(steps[k]);
    // Open the first creative that still needs this step (A when all are new).
    const todo = okFor[n] ? vsRef.current.findIndex((x) => !okFor[n](x)) : -1;
    setTab(todo >= 0 ? todo : 0);
    setStep(n);
    setMaxAt((m) => Math.max(m, target));
  };
  const next = () => go(steps[at + 1]);
  const back = () => setStep(steps[Math.max(0, at - 1)]);

  // ---- per-creative edits ----------------------------------------------------
  const setC = (k, val) => upd(tab, (y) => ({ content: { ...y.content, [k]: val } }));
  const setAd = (k, val) => upd(tab, (y) => ({ content: { ...y.content, ad_copy: { ...y.content.ad_copy, [k]: val } } }));
  const setScreen = (j, patch) => upd(tab, (y) => ({ screens: y.screens.map((s, k) => (k === j ? { ...s, ...patch } : s)) }));
  const setIdea = (j, patch) => upd(tab, (y) => ({ ideas: y.ideas.map((s, k) => (k === j ? { ...s, ...patch } : s)) }));
  const chooseVisual = (vis) => {
    upd(tab, { visual: vis });
    const x = vsRef.current[tab];
    if ((vis === 'ai' || vis === 'both') && x.madeFor.ideas !== contentKey(x) && !isBusy(`${tab}:assets`)) { upd(tab, (y) => ({ ideas: [], ideaAt: -1, chats: { ...y.chats, assets: [] } })); loadIdeas(tab, '', vis); }
  };
  const chatSend = (key, load) => (text) => { const i = tab; upd(i, (y) => ({ chats: say(y.chats, key, 'user', text) })); load(i, text); };
  const copyToAll = (fields) => {
    const src = vsRef.current[tab];
    setVs((list) => list.map((x, j) => (j === tab ? x : { ...x, ...Object.fromEntries(fields.map((f) => [f, JSON.parse(JSON.stringify(src[f]))])) })));
    toast(`Copied to all ${count} creatives`);
  };

  const uploadOwn = async (file) => {
    if (!file) return;
    setStarting('Uploading…');
    try { const url = await api.upload(file, 'brand-images'); upd(tab, { photoUrl: url }); }
    catch (e) { toast(e.message, 'error'); }
    finally { setStarting(''); }
  };

  const briefOf = (x) => {
    const c = x.content;
    const idea = x.ideas[x.ideaAt];
    const sc = x.screens[x.screenAt];
    return {
      angle: mode === 'random' ? x.angle : null, hook: x.hook, design_notes: x.designNotes.trim(),
      content: {
        headline: c.headline, support: c.support, bullets: lines(c.bulletsText), extra: c.extra, cta: c.cta,
        accent_words: (c.accentText || '').split(',').map((t) => t.trim()).filter(Boolean),
        proof_line: c.proof_line || '', bonus_pill: c.bonus_pill || '', cta_note: c.cta_note || '',
      },
      ad_copy: c.ad_copy, compliance_notes: c.compliance_notes, claims_used: c.claims_used || [], flags: c.flags || [],
      screen: isDevice && sc ? { ...sc, elements: lines(sc.elementsText) } : null,
      visual: isDevice ? 'none' : x.visual || 'none', photo_url: usesPhotoOf(x) ? x.photoUrl : '',
      image_prompt: usesAiOf(x) ? idea?.prompt || '' : '', visual_type: idea?.visual_type || 'object', image_shape: idea?.shape || 'square',
    };
  };

  const generate = async () => {
    setStarting('Starting…');
    try {
      for (const x of vs) {
        await api.generate({
          brand_id: brandId, mode, prompt: prompt.trim(), count: 1, format, design, method,
          stage: x.angle?.stage || stage, source, created_by: settings.userName || '',
          photo_source: usesAiOf(x) ? 'ai' : usesPhotoOf(x) ? 'brand' : 'none', brief: briefOf(x),
        });
      }
      toast(`Designing ${total > 1 ? `${total} creatives` : 'your creative'} for ${brand.name}. ${total > 1 ? 'They appear' : 'It appears'} in Creatives as they finish.`);
      onDone();
    } catch (e) { toast(`Couldn't start: ${e.message}`, 'error'); }
    finally { setStarting(''); }
  };

  const footer = (
    <>
      {at > 0 && <button className="btn ghost" onClick={back} disabled={!!starting}>Back</button>}
      <span className="spacer" />
      {starting && <Loading text={starting} />}
      <button className="btn ghost" onClick={onClose}>Cancel</button>
      {step === 'generate'
        ? <button className="btn primary" onClick={generate} disabled={!!starting}><IconSpark /> Generate {total > 1 ? `${total} creatives` : 'creative'}</button>
        : <button className="btn primary" onClick={next} disabled={!!starting}>Next: {LABEL[steps[at + 1]]}</button>}
    </>
  );

  const summary = useMemo(() => [
    count > 1 ? ['Creative', LETTERS[tab]] : null,
    mode === 'prompt' && prompt.trim() ? ['Prompt', prompt] : null,
    mode === 'random' && v.angle?.title ? ['Angle', v.angle.title] : null,
    v.hook ? ['Hook', v.hook] : null,
  ].filter(Boolean), [mode, prompt, v.angle, v.hook, tab, count]);

  const tabs = (s, kind) => (
    <VariantTabs count={count} active={tab} onPick={setTab} done={(i) => okFor[s](vs[i] || blank())} busyAt={(i) => isBusy(`${i}:${kind}`)} />
  );
  const usedBy = (a) => vs.map((x, i) => (x.angle === a ? LETTERS[i] : null)).filter(Boolean);

  return (
    <Modal wide title={count > 1 ? `Create ${count} creatives` : 'Create a creative'} onClose={onClose} footer={footer}>
      <ol className="wz-steps" aria-label="Steps">
        {steps.map((s, i) => {
          const reachable = i <= maxAt;
          return (
            <li key={s} className={`${i < at ? 'done' : i === at ? 'on' : ''} ${reachable && i !== at ? 'link' : ''}`}>
              <button onClick={() => go(s)} disabled={!reachable || i === at} aria-current={i === at ? 'step' : undefined}
                title={reachable ? `Go to ${LABEL[s]}` : 'Finish the earlier steps first'}>
                <span>{i < at ? '✓' : i + 1}</span>{LABEL[s]}
              </button>
            </li>
          );
        })}
      </ol>

      {step === 'setup' && (
        <div className="wz-body">
          <div className="wz-section">
            <h3>Who is this ad for?</h3>
            <div className="segmented" role="radiogroup" aria-label="Who is this ad for">
              <button role="radio" aria-checked={source === 'owner'} className={source === 'owner' ? 'on' : ''} onClick={() => setSource('owner')}>
                <strong>Business owners</strong><small>Talks about calls, customers, bookings and jobs</small>
              </button>
              <button role="radio" aria-checked={source === 'agency'} className={source === 'agency' ? 'on' : ''} onClick={() => setSource('agency')}>
                <strong>Agency owners</strong><small>Talks about clients, builds, delivery and capacity</small>
              </button>
            </div>
          </div>
          <div className="wz-section">
            <h3>Brand and starting point</h3>
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)} aria-label="Brand">{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            <div className="segmented" role="radiogroup" aria-label="Start from" style={{ marginTop: 10 }}>
              <button role="radio" aria-checked={mode === 'random'} className={mode === 'random' ? 'on' : ''} onClick={() => setMode('random')}>
                <strong>Random</strong><small>Claude suggests angles, then hooks</small>
              </button>
              <button role="radio" aria-checked={mode === 'prompt'} className={mode === 'prompt' ? 'on' : ''} onClick={() => setMode('prompt')}>
                <strong>With a prompt</strong><small>Your direction; Claude goes straight to hooks</small>
              </button>
            </div>
          </div>
          <div className="wz-section">
            <h3>How many creatives?</h3>
            <div className="wz-count">
              <button className="wz-count-btn" onClick={() => setCount((n) => Math.max(1, n - 1))} disabled={count <= 1} aria-label="Fewer">−</button>
              <input type="number" min={1} max={10} value={count} aria-label="Number of creatives"
                onChange={(e) => setCount(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))} />
              <button className="wz-count-btn" onClick={() => setCount((n) => Math.min(10, n + 1))} disabled={count >= 10} aria-label="More">+</button>
              <span className="muted small">
                {count > 1 ? `Each step gets tabs ${LETTERS.slice(0, count).split('').join(', ')} so you choose for every creative.` : 'Up to 10.'}
                {format === 'both' ? ` ${total} images in all (each in 4:5 and 9:16).` : ''}
              </span>
            </div>
          </div>
          <details className="wz-more">
            <summary>Options: {METHOD_SHORT[method]} · {FORMAT_LABEL[format]} · {{ device: 'Clean card', free: 'Free design', classic: 'Classic card' }[design]} · {STAGE_SHORT[stage]}</summary>
            <div className="grid-2">
              <label className="field"><span>Method</span>
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="presold">Pre-Sold (Jeff Miller)</option>
                  <option value="100m">$100M Offers (Hormozi)</option>
                  <option value="both">Both skills together</option>
                </select>
              </label>
              <label className="field"><span>Format</span>
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="4:5">Portrait 4:5 (Feed)</option><option value="9:16">Vertical 9:16 (Stories, Reels)</option>
                  <option value="both">4:5 + 9:16 (one of each)</option>
                </select>
              </label>
              <label className="field"><span>Design</span>
                <select value={design} onChange={(e) => setDesign(e.target.value)}>
                  <option value="device">Clean card with one hero visual (device or object)</option><option value="free">Free design (Claude picks the style)</option><option value="classic">Classic card</option>
                </select>
              </label>
              <label className="field"><span>Awareness stage</span>
                <select value={stage} onChange={(e) => setStage(e.target.value)}>{STAGES.map(([val, l]) => <option key={val} value={val}>{l}</option>)}</select>
              </label>
            </div>
          </details>
          <div className="wz-section">
            <h3>{mode === 'prompt' ? 'Your prompt' : 'Prompt (optional)'}</h3>
            <div className="wz-input-box">
              <textarea className="wz-setup-prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Prompt"
                placeholder={mode === 'prompt'
                  ? 'Type your direction here, e.g. Fall promo: first month half price for new agencies.'
                  : 'Type anything Claude should keep in mind, e.g. Focus on agencies that just signed their first client.'} />
            </div>
          </div>
        </div>
      )}

      {step !== 'setup' && step !== 'angle' && summary.length > 0 && (
        <div className="wz-summary">{summary.map(([k, val]) => <div key={k}><strong>{k}:</strong> {val}</div>)}</div>
      )}

      {step === 'angle' && (
        <div className="wz-body">
          <div className="wz-head"><h3>{count > 1 ? 'Pick an angle for each creative' : 'Pick an angle'}</h3>
            <button className="link-btn" onClick={() => upd(tab, { ownAngle: true, angle: { title: '', audience: '', insight: '', stage: stage === 'auto' ? 'problem' : stage } })}>Write my own</button></div>
          {tabs('angle', 'angles')}
          {count > 1 && <p className="small muted wz-tip">Choosing for <strong>Creative {LETTERS[tab]}</strong>. Pick a different angle on each tab; the letters on a card show which creative uses it.</p>}
          {v.ownAngle && v.angle && (
            <div className="wz-own">
              <input placeholder="Angle in a few words" value={v.angle.title} onChange={(e) => upd(tab, (y) => ({ angle: { ...y.angle, title: e.target.value } }))} />
              <input placeholder="Who it speaks to" value={v.angle.audience} onChange={(e) => upd(tab, (y) => ({ angle: { ...y.angle, audience: e.target.value } }))} />
              <input placeholder="The insight, in their words" value={v.angle.insight} onChange={(e) => upd(tab, (y) => ({ angle: { ...y.angle, insight: e.target.value } }))} />
            </div>
          )}
          {isBusy('all:angles') && angles.length === 0 && <Loading text="Claude is writing angles…" />}
          <div className="wz-cards">
            {angles.map((a, i) => (
              <button key={i} className={`wz-card ${!v.ownAngle && v.angle === a ? 'on' : ''}`} onClick={() => upd(tab, { ownAngle: false, angle: a })}>
                <span className="wz-card-top"><strong>{a.title}</strong><span className="chip">{STAGE_SHORT[a.stage] || a.stage}</span></span>
                <small>{a.audience}</small>
                <span className="wz-card-insight">{a.insight}</span>
                {count > 1 && usedBy(a).length > 0 && <span className="wz-used">{usedBy(a).map((l) => <b key={l}>{l}</b>)}</span>}
              </button>
            ))}
          </div>
          <Chat messages={angleChat} busy={isBusy('all:angles')}
            onSend={(t) => { setAngleChat((c) => [...c, { role: 'user', text: t }]); loadAngles(t); }}
            placeholder="e.g. angles for agency owners who just lost their biggest client" />
        </div>
      )}

      {step === 'hook' && (
        <div className="wz-body">
          <div className="wz-head"><h3>Pick a hook</h3>
            {count > 1 && v.hook && <button className="link-btn" onClick={() => copyToAll(['hook'])}>Use this hook for all</button>}</div>
          {tabs('hook', 'hooks')}
          {isBusy(`${tab}:hooks`) && v.hooks.length === 0 && <Loading text="Claude is writing hooks…" />}
          <div className="wz-hooks">
            {v.hooks.map((h, i) => (
              <button key={i} className={`wz-hook ${v.hook === h.text ? 'on' : ''}`} onClick={() => upd(tab, { hook: h.text })}>
                <span className="wz-hook-text">{h.text}</span><span className="wz-hook-style">{h.style}</span>
              </button>
            ))}
          </div>
          <label className="field wz-edit"><span>Your hook (edit it, or write your own)</span>
            <input value={v.hook} onChange={(e) => upd(tab, { hook: e.target.value })} placeholder="Pick one above or type a hook" />
          </label>
          <Chat messages={v.chats.hooks} onSend={chatSend('hooks', loadHooks)} busy={isBusy(`${tab}:hooks`)}
            placeholder="e.g. 10 short questions about missed calls at night" />
        </div>
      )}

      {step === 'content' && (
        <div className="wz-body">
          <div className="wz-head"><h3>What goes on the creative</h3></div>
          {tabs('content', 'content')}
          {isBusy(`${tab}:content`) && !v.content && <Loading text="Claude is writing the copy…" />}
          {v.content && (
            <>
              {isDevice && <p className="small muted wz-tip">The card stays short: headline, visual, proof line, button and note, offer pill and footer. Benefits and offer details go in the caption below.</p>}
              <label className="field"><span>{isDevice ? 'Headline (2 or 3 short lines, about 9 words at most)' : 'Headline (your hook)'}</span><input value={v.content.headline} onChange={(e) => setC('headline', e.target.value)} /></label>
              {isDevice ? (
                <label className="field"><span>Button text (the brand's CTA)</span><input value={v.content.cta} onChange={(e) => setC('cta', e.target.value)} /></label>
              ) : (
                <>
                  <label className="field"><span>Support line</span><textarea rows={2} value={v.content.support} onChange={(e) => setC('support', e.target.value)} /></label>
                  <div className="grid-2">
                    <label className="field"><span>Bullets (one per line, optional)</span><textarea rows={4} value={v.content.bulletsText} onChange={(e) => setC('bulletsText', e.target.value)} /></label>
                    <div>
                      <label className="field"><span>Extra line (offer, stat or guarantee, optional)</span><input value={v.content.extra} onChange={(e) => setC('extra', e.target.value)} /></label>
                      <label className="field"><span>Button text</span><input value={v.content.cta} onChange={(e) => setC('cta', e.target.value)} /></label>
                    </div>
                  </div>
                </>
              )}
              <div className="grid-2">
                <label className="field"><span>Accent words (comma separated)</span><input value={v.content.accentText || ''} onChange={(e) => setC('accentText', e.target.value)} placeholder="e.g. every call" /></label>
                <label className="field"><span>Offer pill (top right, optional)</span><input value={v.content.bonus_pill || ''} onChange={(e) => setC('bonus_pill', e.target.value)} /></label>
                <label className="field"><span>Proof line (with a shield icon, optional)</span><input value={v.content.proof_line || ''} onChange={(e) => setC('proof_line', e.target.value)} /></label>
                <label className="field"><span>Note under the button (optional)</span><input value={v.content.cta_note || ''} onChange={(e) => setC('cta_note', e.target.value)} /></label>
              </div>
              <details className="wz-adcopy" open>
                <summary>Meta ad copy (caption, headline, description, button)</summary>
                <label className="field"><span>Primary text (caption)</span><textarea rows={8} value={v.content.ad_copy?.primary_text || ''} onChange={(e) => setAd('primary_text', e.target.value)} /></label>
                <div className="grid-2">
                  <label className="field"><span>Headline ({(v.content.ad_copy?.headline || '').length}/27)</span><input value={v.content.ad_copy?.headline || ''} onChange={(e) => setAd('headline', e.target.value)} /></label>
                  <label className="field"><span>Description ({(v.content.ad_copy?.description || '').length}/30)</span><input value={v.content.ad_copy?.description || ''} onChange={(e) => setAd('description', e.target.value)} /></label>
                </div>
                <label className="field"><span>Meta button</span>
                  <select value={v.content.ad_copy?.cta_button || 'LEARN_MORE'} onChange={(e) => setAd('cta_button', e.target.value)}>{CTA_BUTTONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}</select>
                </label>
              </details>
              {[...(v.content.flags || []), ...(v.content.compliance_notes || [])].length > 0 && (
                <div className="notice"><strong>Check before running:</strong><ul>{[...new Set([...(v.content.flags || []), ...(v.content.compliance_notes || [])])].map((n, i) => <li key={i}>{n}</li>)}</ul></div>
              )}
            </>
          )}
          <Chat messages={v.chats.content} onSend={chatSend('content', loadContent)} busy={isBusy(`${tab}:content`)}
            placeholder="e.g. make the headline shorter and mention the free setup" />
        </div>
      )}

      {step === 'assets' && isDevice && (
        <div className="wz-body">
          <div className="wz-head"><h3>Choose the visual</h3>
            <button className="link-btn" onClick={() => upd(tab, (y) => ({ screens: [...y.screens, { idea: 'My own visual', kind: 'object', object: '', image_prompt: '', device: 'phone', device_side: 'right', background_hex: '', app_title: '', elementsText: '' }], screenAt: y.screens.length }))} disabled={isBusy(`${tab}:screens`)}>Write my own</button></div>
          {tabs('assets', 'screens')}
          <p className="small muted wz-tip">One hero visual on a flat background: a device whose screen shows the fix, or any object that fits the hook. {aiImages ? 'Objects are made as images when the creative is generated.' : 'Objects are drawn as clean illustrations (add OPENAI_API_KEY for image-quality objects).'}</p>
          {isBusy(`${tab}:screens`) && v.screens.length === 0 && <Loading text="Claude is picking visuals for this hook…" />}
          <div className="wz-ideas text">
            {v.screens.map((x, i) => {
              const on = v.screenAt === i;
              const obj = x.kind === 'object';
              return (
                <div key={i} className={`wz-idea ${on ? 'on wide' : ''}`} onClick={() => upd(tab, { screenAt: i })} role="radio" aria-checked={on} tabIndex={0}
                  onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) upd(tab, { screenAt: i }); }}>
                  <span className="wz-card-top">
                    <span className="chip">{obj ? 'Object' : `${DEVICE_LABEL[x.device] || x.device} screen`} · {SIDE_SHORT[x.device_side] || x.device_side}</span>
                    {isHex(x.background_hex) && <span className="wz-swatch" style={{ background: x.background_hex }} title={x.background_hex} />}
                  </span>
                  <strong>{x.idea}</strong>
                  {on ? (
                    <div className="wz-screen-edit" onClick={(e) => e.stopPropagation()}>
                      <div className="wz-screen-grid">
                        <label className="field"><span>Visual</span>
                          <select value={obj ? 'object' : x.device} onChange={(e) => setScreen(i, e.target.value === 'object' ? { kind: 'object' } : { kind: 'device', device: e.target.value, device_side: e.target.value === 'laptop' ? 'below' : x.device_side === 'below' ? 'right' : x.device_side })}>
                            <option value="object">An object</option>
                            {Object.entries(DEVICE_LABEL).map(([val, l]) => <option key={val} value={val}>{l} screen</option>)}
                          </select>
                        </label>
                        <label className="field"><span>Position</span>
                          <select value={x.device_side} onChange={(e) => setScreen(i, { device_side: e.target.value })}>
                            {Object.entries(SIDE_LABEL).map(([val, l]) => <option key={val} value={val}>{l}</option>)}
                          </select>
                        </label>
                        <label className="field"><span>Background</span>
                          <span className="wz-color">
                            <input type="color" value={isHex(x.background_hex) ? x.background_hex : '#111111'} onChange={(e) => setScreen(i, { background_hex: e.target.value })} aria-label="Background colour" />
                            <input value={x.background_hex || ''} onChange={(e) => setScreen(i, { background_hex: e.target.value })} placeholder="Claude picks" />
                          </span>
                        </label>
                      </div>
                      {obj ? (
                        <>
                          <label className="field"><span>The object</span><input value={x.object || ''} onChange={(e) => setScreen(i, { object: e.target.value })} placeholder="e.g. stainless steel fridge with one sticky note" /></label>
                          <label className="field"><span>How it should look</span>
                            <textarea rows={3} value={x.image_prompt || ''} onChange={(e) => setScreen(i, { image_prompt: e.target.value })} placeholder="e.g. glossy 3D fridge, door slightly open, a yellow note on the door, soft light" />
                          </label>
                        </>
                      ) : (
                        <>
                          <label className="field"><span>App title on the screen</span><input value={x.app_title || ''} onChange={(e) => setScreen(i, { app_title: e.target.value })} placeholder="e.g. Inbox" /></label>
                          <label className="field"><span>On the screen (one line per item, top to bottom)</span>
                            <textarea rows={4} value={x.elementsText || ''} onChange={(e) => setScreen(i, { elementsText: e.target.value })} placeholder={'Missed call: Sam (555) 014-2290, 7:40pm\nTexted back: Sorry we missed you, want to book?'} />
                          </label>
                        </>
                      )}
                    </div>
                  ) : (
                    <small>{obj ? (x.object || x.image_prompt) : `${x.app_title ? `${x.app_title}: ` : ''}${lines(x.elementsText).join(' · ')}`}</small>
                  )}
                </div>
              );
            })}
          </div>
          <Chat messages={v.chats.screens} onSend={chatSend('screens', loadScreens)} busy={isBusy(`${tab}:screens`)}
            placeholder="e.g. show a fridge with a sticky note instead, light background" />
        </div>
      )}

      {step === 'assets' && !isDevice && (
        <div className="wz-body">
          <div className="wz-head"><h3>Choose the visual</h3>
            {brand?.logo_url
              ? <span className="wz-logo">Logo added automatically <img src={brand.logo_url} alt="" style={{ background: brand.colors?.deep || '#111' }} /></span>
              : <span className="muted small">No logo in the brand kit, so the brand name is used as a wordmark</span>}
          </div>
          {tabs('assets', 'assets')}
          <div className="segmented three" role="radiogroup" aria-label="Visual">
            <button role="radio" aria-checked={v.visual === 'both'} className={v.visual === 'both' ? 'on' : ''} onClick={() => chooseVisual('both')} disabled={!aiImages}>
              <strong>Photo + AI image</strong><small>{aiImages ? 'Brand photo in the background, AI image on top' : 'Needs OPENAI_API_KEY'}</small>
            </button>
            <button role="radio" aria-checked={v.visual === 'ai'} className={v.visual === 'ai' ? 'on' : ''} onClick={() => chooseVisual('ai')} disabled={!aiImages}>
              <strong>AI image only</strong><small>{aiImages ? 'No photo' : 'Needs OPENAI_API_KEY'}</small>
            </button>
            <button role="radio" aria-checked={v.visual === 'photo'} className={v.visual === 'photo' ? 'on' : ''} onClick={() => chooseVisual('photo')}>
              <strong>Photo only</strong><small>No AI image</small>
            </button>
          </div>
          {usesAiOf(v) && (
            <>
              <div className="wz-head"><h4>{v.visual === 'both' ? 'AI image on top' : 'AI image'} <small className="muted">made when the creative is generated</small></h4>
                <button className="link-btn" onClick={() => upd(tab, (y) => ({ ideas: [...y.ideas, { idea: 'My own idea', visual_type: 'object', shape: 'square', prompt: '' }], ideaAt: y.ideas.length }))}>Write my own</button></div>
              {isBusy(`${tab}:assets`) && v.ideas.length === 0 && <Loading text="Claude is suggesting images…" />}
              <div className="wz-ideas text">
                {v.ideas.map((x, i) => (
                  <div key={i} className={`wz-idea ${v.ideaAt === i ? 'on' : ''}`} onClick={() => upd(tab, { ideaAt: i })} role="radio" aria-checked={v.ideaAt === i} tabIndex={0}
                    onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) upd(tab, { ideaAt: i }); }}>
                    <span className="chip">{VISUAL_LABEL[x.visual_type] || x.visual_type} · {x.shape}</span>
                    <strong>{x.idea}</strong>
                    {v.ideaAt === i
                      ? <textarea rows={4} value={x.prompt} onClick={(e) => e.stopPropagation()} onChange={(e) => setIdea(i, { prompt: e.target.value })} aria-label="Image description" placeholder="Describe the image" />
                      : <small>{x.prompt}</small>}
                  </div>
                ))}
              </div>
            </>
          )}
          {usesPhotoOf(v) && (
            <>
              <div className="wz-head"><h4>{v.visual === 'both' ? 'Background photo' : 'Photo'}</h4></div>
              <div className="thumbs wz-photos">
                {brandImages.map((im) => (
                  <button key={im.url} className={`thumb ${v.photoUrl === im.url ? 'on' : ''}`} onClick={() => upd(tab, { photoUrl: im.url })}>
                    <img src={im.url} alt={im.label || 'Brand photo'} />
                  </button>
                ))}
                {v.photoUrl && !brandImages.some((im) => im.url === v.photoUrl) && <button className="thumb on"><img src={v.photoUrl} alt="Uploaded" /></button>}
                <label className="thumb add">
                  <input type="file" accept="image/*" onChange={(e) => uploadOwn(e.target.files[0])} aria-label="Upload a photo" />
                  <span>+ Upload</span>
                </label>
              </div>
            </>
          )}
          {usesAiOf(v) && (
            <Chat messages={v.chats.assets} onSend={chatSend('assets', loadIdeas)} busy={isBusy(`${tab}:assets`)}
              placeholder="e.g. a 3D phone with three missed calls in brand purple" />
          )}
        </div>
      )}

      {step === 'generate' && (
        <div className="wz-body">
          {tabs('generate', 'none')}
          {v.content && (
            <div className="wz-review">
              <div className="wz-review-img">
                {usesPhotoOf(v) && v.photoUrl ? <img src={v.photoUrl} alt="Chosen photo" /> : null}
                {usesAiOf(v) && v.ideas[v.ideaAt] && <div className={`wz-review-idea ${usesPhotoOf(v) ? 'over' : ''}`}><span className="chip">AI {VISUAL_LABEL[v.ideas[v.ideaAt].visual_type] || 'image'}</span><strong>{v.ideas[v.ideaAt].idea}</strong></div>}
                {isDevice && v.screens[v.screenAt] && (() => {
                  const sc = v.screens[v.screenAt];
                  return (
                    <div className="wz-review-device" style={isHex(sc.background_hex) ? { background: sc.background_hex, color: lightHex(sc.background_hex) ? '#111' : '#fff' } : undefined}>
                      <span className="chip">{sc.kind === 'object' ? 'Object' : `${DEVICE_LABEL[sc.device]} screen`} · {SIDE_SHORT[sc.device_side]}</span>
                      <strong>{sc.kind === 'object' ? (sc.object || sc.idea) : (sc.app_title || sc.idea)}</strong>
                      {sc.kind !== 'object' && <ul>{lines(sc.elementsText).map((t, i) => <li key={i}>{t}</li>)}</ul>}
                      {sc.kind === 'object' && sc.image_prompt && <small>{sc.image_prompt}</small>}
                    </div>
                  );
                })()}
                {!isDevice && !usesPhotoOf(v) && !usesAiOf(v) && <span className="muted small">No image</span>}
              </div>
              <div>
                <h3>{v.content.headline}</h3>
                {!isDevice && v.content.support && <p>{v.content.support}</p>}
                {!isDevice && v.content.bulletsText && <ul>{lines(v.content.bulletsText).map((t, i) => <li key={i}>{t}</li>)}</ul>}
                {isDevice && v.content.proof_line && <p className="small">🛡 {v.content.proof_line}</p>}
                {isDevice && v.content.bonus_pill && <p className="small"><span className="chip">{v.content.bonus_pill}</span></p>}
                {v.content.cta && <span className="wz-cta">{v.content.cta}</span>}
                <label className="field wz-design-prompt"><span>Prompt for the design (optional)</span>
                  <textarea rows={2} value={v.designNotes} onChange={(e) => upd(tab, { designNotes: e.target.value })}
                    placeholder={isDevice ? 'e.g. light cream background, visual on the left, accent words underlined' : 'e.g. dark background, the hook huge at the top'} />
                </label>
                <p className="small muted" style={{ marginTop: 8 }}>
                  {FORMAT_LABEL[format]} · {METHOD_SHORT[method]} · {brand?.name} · For {source === 'agency' ? 'agency owners' : 'business owners'}
                  {count > 1 ? ` · Generating all ${count} creatives (${total} images)` : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
