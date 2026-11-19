'use client';
import React, { useEffect, useId, useRef, useState } from 'react';
import { api } from '@/lib/client/api';
import { toast } from './Toasts.jsx';
import { IconSpark } from './Icons.jsx';
import { buildPanelCard, PANEL_TYPES, THEMES, THEME_NAMES, DEVICES, SCREENS, LAYOUTS } from '@/lib/panelTemplate';

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
      {(messages.length > 0 || busy) && (
        <div className="wz-chat-log" ref={logRef} aria-live="polite">
          {messages.map((m, i) => <div key={i} className={`wz-msg ${m.role}`}>{m.text}</div>)}
          {busy && <div className="wz-msg claude typing" aria-label="Claude is writing"><Dots /></div>}
        </div>
      )}
      <div className="wz-chat-input">
        <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={label}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="wz-send" onClick={send} disabled={!!busy || !text.trim()}><IconSend /> <span>Send</span></button>
      </div>
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

const blankChats = () => ({ angles: [], hooks: [], content: [], assets: [], screens: [], panels: [] });
const blank = () => ({
  angles: [], angle: null, ownAngle: false, hooks: [], hook: '', content: null,
  visual: '', ideas: [], ideaAt: -1, photoUrl: '', screens: [], screenAt: -1, panels: [], panelAt: -1,
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
  const [design, setDesign] = useState('panel');
  const [count, setCount] = useState(1);
  const [source, setSource] = useState(''); // the ad is for business owners or agency owners
  const [aiImages, setAiImages] = useState(false);
  useEffect(() => { api.config().then((c) => setAiImages(!!c.ai_images)); }, []);

  // One independent set of suggestions and choices per creative (A, B, C…).
  const [vs, setVs] = useState([blank()]);
  const vsRef = useRef(vs);
  vsRef.current = vs;
  const [tab, setTab] = useState(0);
  useEffect(() => { setVs((list) => Array.from({ length: count }, (_, i) => list[i] || blank())); setTab((t) => Math.min(t, count - 1)); }, [count]);
  const upd = (i, patch) => setVs((list) => list.map((v, j) => (j === i ? { ...v, ...(typeof patch === 'function' ? patch(v) : patch) } : v)));
  const say = (chats, key, role, text) => (text ? { ...chats, [key]: [...chats[key], { role, text }] } : chats);


  const [step, setStep] = useState('setup');
  const [maxAt, setMaxAt] = useState(0);
  const [busy, setBusy] = useState({}); // "i:kind" -> true
  const [starting, setStarting] = useState('');
  const isBusy = (k) => !!busy[k];

  const brand = brands.find((b) => b.id === brandId);
  const brandImages = (brand?.brand_images || []).filter((im) => /^https?:\/\//.test(im.url || ''));
  const isDevice = design === 'device';
  const isPanel = design === 'panel';
  const steps = mode === 'random' ? ['setup', 'angle', 'hook', 'content', 'assets', 'generate'] : ['setup', 'hook', 'content', 'assets', 'generate'];
  const LABEL = { setup: 'Setup', angle: 'Angle', hook: 'Hook', content: 'Content', assets: isPanel ? 'Diagram' : 'Visual', generate: 'Review' };
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
  // Angles belong to one creative: asking again on B never touches A's list or A's choice.
  const loadAngles = async (i, direction = '', avoidExtra = []) => {
    const x = vsRef.current[i];
    const r = await ask(`${i}:angles`, {
      step: 'angles', direction, notes: notes(), history: history(x.chats.angles, direction),
      avoid: [...x.angles.map((a) => a.title), ...avoidExtra], how_many: 5,
    });
    if (r) {
      upd(i, (y) => {
        let list = merge(y.angles, r, r.angles);
        // A new list keeps this creative's chosen angle at the top, so the choice is not lost.
        if (r.action !== 'add' && y.angle && !y.ownAngle && !list.includes(y.angle)) list = [y.angle, ...list];
        return { angles: list, chats: say(y.chats, 'angles', 'claude', r.reply) };
      });
    }
    return r?.angles || [];
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
  const loadPanels = async (i, direction = '') => {
    const x = vsRef.current[i];
    const r = await ask(`${i}:panels`, {
      step: 'panels', direction, notes: notes(), history: history(x.chats.panels, direction),
      angle: mode === 'random' ? x.angle : null, prompt: mode === 'prompt' ? prompt : '', hook: x.hook,
      copy: x.content ? { headline: x.content.headline, support: x.content.support } : null,
      avoid: x.panels.map((s) => s.idea),
    });
    if (r) upd(i, (y) => ({ panels: merge(y.panels, r, r.panels), panelAt: r.action === 'add' ? y.panelAt : -1, chats: say(y.chats, 'panels', 'claude', r.reply), madeFor: { ...y.madeFor, panels: contentKey(y) } }));
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
  const usesAiOf = (x) => !isDevice && !isPanel && (x.visual === 'ai' || x.visual === 'both');
  const usesPhotoOf = (x) => !isDevice && !isPanel && (x.visual === 'photo' || x.visual === 'both');
  const okFor = {
    setup: () => !!brandId && !!source && (mode === 'random' || !!prompt.trim()),
    angle: (x) => !!x.angle?.title?.trim(),
    hook: (x) => !!x.hook.trim(),
    content: (x) => !!x.content?.headline?.trim(),
    assets: (x) => (isPanel ? !!x.panels[x.panelAt] : isDevice
      ? !!x.screens[x.screenAt]
      : x.visual === 'none' || ((usesPhotoOf(x) ? !!x.photoUrl : true) && (usesAiOf(x) ? !!x.ideas[x.ideaAt]?.prompt?.trim() : true))),
    generate: () => true,
  };
  const stepOk = (s) => (s === 'setup' ? okFor.setup() : vs.every((x) => okFor[s](x)));

  // Entering a step loads what each creative still needs (all in parallel).
  const enter = (n) => {
    const list = vsRef.current;
    if (n === 'angle') {
      const stale = list.map((x, i) => (x.madeFor.angles !== setupKey ? i : -1)).filter((i) => i >= 0);
      stale.forEach((i) => upd(i, (y) => ({ angles: [], angle: y.ownAngle ? y.angle : null, chats: { ...y.chats, angles: [] }, madeFor: { ...y.madeFor, angles: setupKey } })));
      // One after another, so each creative gets different angles from the others.
      (async () => { let seen = []; for (const i of stale) seen = [...seen, ...(await loadAngles(i, '', seen)).map((a) => a.title)]; })();
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
        if (isPanel) {
          if (x.madeFor.panels !== contentKey(x)) { upd(i, (y) => ({ panels: [], panelAt: -1, chats: { ...y.chats, panels: [] } })); loadPanels(i); }
        } else if (isDevice) {
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
  const setPanel = (j, patch) => upd(tab, (y) => ({ panels: y.panels.map((s, k) => (k === j ? { ...s, ...patch } : s)) }));
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
      panel: isPanel ? x.panels[x.panelAt] || null : null,
      visual: isDevice || isPanel ? 'none' : x.visual || 'none', photo_url: usesPhotoOf(x) ? x.photoUrl : '',
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

  const [leaving, setLeaving] = useState(false);
  const [editVisual, setEditVisual] = useState(false);
  useEffect(() => { setEditVisual(false); }, [tab, step]);
  const cancel = () => (maxAt > 0 && !leaving ? setLeaving(true) : onClose());

  const tabs = (s, kind) => (
    <VariantTabs count={count} active={tab} onPick={setTab} done={(i) => okFor[s](vs[i] || blank())} busyAt={(i) => isBusy(`${i}:${kind}`)} />
  );

  // One short line of context for the step, instead of a summary box.
  const context = step === 'hook' && mode === 'random' ? v.angle?.title && `Angle: ${v.angle.title}`
    : step === 'hook' && mode === 'prompt' ? prompt.trim() && `Your idea: ${prompt.trim()}`
    : (step === 'content' || step === 'assets') ? v.hook && `Hook: ${v.hook}` : '';

  const TITLE = {
    setup: "Let's set up your ads",
    angle: count > 1 ? `Pick an angle for Creative ${LETTERS[tab]}` : 'Pick an angle',
    hook: count > 1 ? `Pick a hook for Creative ${LETTERS[tab]}` : 'Pick a hook',
    content: 'Check the words',
    assets: isPanel ? 'Choose the diagram' : 'Choose the visual',
    generate: count > 1 ? `Review ${count} creatives` : 'Review and generate',
  };

  const accent = isHex(brand?.colors?.accent) ? brand.colors.accent : '#0F766E';
  const chatFor = {
    angle: <Chat messages={v.chats.angles} busy={isBusy(`${tab}:angles`)} onSend={chatSend('angles', loadAngles)} label="Ask Claude for different angles"
      placeholder={`Ask for different angles${count > 1 ? ` for Creative ${LETTERS[tab]}` : ''}, e.g. agency owners who just lost their biggest client`} />,
    hook: <Chat messages={v.chats.hooks} busy={isBusy(`${tab}:hooks`)} onSend={chatSend('hooks', loadHooks)} label="Ask Claude for different hooks"
      placeholder={`Ask for different hooks${count > 1 ? ` for Creative ${LETTERS[tab]}` : ''}, e.g. short questions about missed calls at night`} />,
    content: <Chat messages={v.chats.content} busy={isBusy(`${tab}:content`)} onSend={chatSend('content', loadContent)} label="Ask Claude to change the words"
      placeholder="e.g. make the headline shorter and mention the free setup" />,
    assets: isPanel
      ? <Chat messages={v.chats.panels} busy={isBusy(`${tab}:panels`)} onSend={chatSend('panels', loadPanels)} label="Ask for a different diagram"
          placeholder="e.g. show it as a before and after, or use a timeline from Monday to Friday" />
      : isDevice
      ? <Chat messages={v.chats.screens} busy={isBusy(`${tab}:screens`)} onSend={chatSend('screens', loadScreens)} label="Describe a different visual"
          placeholder="Describe a different visual, e.g. a coffee mug with a missed-call note, light background" />
      : usesAiOf(v) ? <Chat messages={v.chats.assets} busy={isBusy(`${tab}:assets`)} onSend={chatSend('assets', loadIdeas)} label="Describe a different image"
          placeholder="e.g. a 3D phone with three missed calls in the brand colours" /> : null,
  };

  const sc = v.screens[v.screenAt];

  return (
    <div className="wz-page" role="dialog" aria-modal="true" aria-label={count > 1 ? `Create ${count} creatives` : 'Create a creative'}>
      <nav className="wz-rail" aria-label="Steps">
        <div className="wz-rail-title">{count > 1 ? `${count} new creatives` : 'New creative'}{brand ? <small>{brand.name}</small> : null}</div>
        <ol className="wz-steplist">
          {steps.map((s, i) => {
            const reachable = i <= maxAt;
            const state = i === at ? 'on' : i < at || (reachable && stepOk(s)) ? 'done' : '';
            return (
              <li key={s}>
                <button className={`wz-step ${state}`} onClick={() => go(s)} disabled={!reachable || i === at} aria-current={i === at ? 'step' : undefined}>
                  <span className="wz-step-num">{state === 'done' ? <IconCheck /> : i + 1}</span>{LABEL[s]}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="wz-rail-foot">
          {leaving ? (
            <div className="wz-leave">
              <span>Discard what you chose?</span>
              <div className="row-gap"><button className="btn sm danger-fill" onClick={onClose}>Discard</button><button className="btn sm" onClick={() => setLeaving(false)}>Keep going</button></div>
            </div>
          ) : <button className="btn wz-cancel" onClick={cancel}>Cancel</button>}
        </div>
      </nav>

      <main className="wz-main">
        <header className="wz-top">
          <div className="wz-top-line">
            <h1>{TITLE[step]}</h1>
            {context && <span className="wz-context" title={context}>{context}</span>}
          </div>
          {step !== 'setup' && tabs(step, { angle: 'angles', hook: 'hooks', content: 'content', assets: isPanel ? 'panels' : isDevice ? 'screens' : 'assets', generate: 'none' }[step])}
        </header>

        <div className="wz-scroll">
          {step === 'setup' && (
            <div className="wz-body wz-narrow">
              <label className="field"><span>Brand</span>
                <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
              </label>
              <div className="field"><span>Who is the ad for?</span>
                <div className="wz-choice" role="radiogroup" aria-label="Who is the ad for">
                  <button role="radio" aria-checked={source === 'owner'} className={source === 'owner' ? 'on' : ''} onClick={() => setSource('owner')}>Business owners</button>
                  <button role="radio" aria-checked={source === 'agency'} className={source === 'agency' ? 'on' : ''} onClick={() => setSource('agency')}>Agency owners</button>
                </div>
              </div>
              <div className="grid-2">
                <div className="field"><span>How many creatives?</span>
                  <div className="wz-stepper">
                    <button onClick={() => setCount((n) => Math.max(1, n - 1))} disabled={count <= 1} aria-label="Fewer">−</button>
                    <output aria-live="polite">{count}</output>
                    <button onClick={() => setCount((n) => Math.min(10, n + 1))} disabled={count >= 10} aria-label="More">+</button>
                  </div>
                </div>
                <div className="field"><span>Start from</span>
                  <div className="wz-seg" role="radiogroup" aria-label="Start from">
                    <button role="radio" aria-checked={mode === 'random'} className={mode === 'random' ? 'on' : ''} onClick={() => setMode('random')}>Claude's ideas</button>
                    <button role="radio" aria-checked={mode === 'prompt'} className={mode === 'prompt' ? 'on' : ''} onClick={() => setMode('prompt')}>My own idea</button>
                  </div>
                </div>
              </div>
              <details className="wz-more">
                <summary><strong>More options</strong> <span>{METHOD_SHORT[method]} · {FORMAT_LABEL[format]} · {{ panel: 'Headline + diagram', device: 'Clean card', free: 'Free design', classic: 'Classic card' }[design]} · {STAGE_SHORT[stage]} stage</span></summary>
                <div className="grid-2">
                  <label className="field"><span>Method</span>
                    <select value={method} onChange={(e) => setMethod(e.target.value)}>
                      <option value="presold">Pre-Sold (Jeff Miller)</option>
                      <option value="100m">$100M Offers (Hormozi)</option>
                      <option value="both">Both methods together</option>
                    </select>
                  </label>
                  <label className="field"><span>Format</span>
                    <select value={format} onChange={(e) => setFormat(e.target.value)}>
                      <option value="4:5">4:5 (Feed)</option><option value="9:16">9:16 (Stories, Reels)</option><option value="both">4:5 + 9:16 (one of each)</option>
                    </select>
                  </label>
                  <label className="field"><span>Design</span>
                    <select value={design} onChange={(e) => setDesign(e.target.value)}>
                      <option value="panel">Headline + diagram (house style)</option><option value="device">Clean card with one visual</option><option value="free">Free design</option><option value="classic">Classic card</option>
                    </select>
                  </label>
                  <label className="field"><span>Awareness stage</span>
                    <select value={stage} onChange={(e) => setStage(e.target.value)}>{STAGES.map(([val, l]) => <option key={val} value={val}>{l}</option>)}</select>
                  </label>
                </div>
              </details>
            </div>
          )}

          {step === 'angle' && (
            <div className="wz-body">
              {isBusy(`${tab}:angles`) && v.angles.length === 0 && <Loading text="Claude is writing angles…" />}
              <div className="wz-options" role="radiogroup" aria-label="Angles">
                {v.angles.map((a, i) => {
                  const on = !v.ownAngle && v.angle === a;
                  return (
                    <button key={i} role="radio" aria-checked={on} className={`wz-option ${on ? 'on' : ''}`} onClick={() => upd(tab, { ownAngle: false, angle: a })}>
                      <span className="wz-radio" aria-hidden="true" />
                      <span className="wz-option-text"><strong>{a.title}</strong><small>{a.insight}</small></span>
                    </button>
                  );
                })}
                {(v.angles.length > 0 || v.ownAngle) && (
                  <button role="radio" aria-checked={v.ownAngle} className={`wz-option own ${v.ownAngle ? 'on' : ''}`}
                    onClick={() => !v.ownAngle && upd(tab, { ownAngle: true, angle: { title: '', audience: '', insight: '', stage: stage === 'auto' ? 'problem' : stage } })}>
                    <span className="wz-radio" aria-hidden="true" />
                    <span className="wz-option-text"><strong>Write my own angle</strong></span>
                  </button>
                )}
              </div>
              {v.ownAngle && v.angle && (
                <div className="wz-own">
                  <label className="field"><span>Angle in a few words</span><input value={v.angle.title} onChange={(e) => upd(tab, (y) => ({ angle: { ...y.angle, title: e.target.value } }))} autoFocus /></label>
                  <label className="field"><span>The insight, in their words (optional)</span><input value={v.angle.insight} onChange={(e) => upd(tab, (y) => ({ angle: { ...y.angle, insight: e.target.value } }))} /></label>
                </div>
              )}
            </div>
          )}

          {step === 'hook' && (
            <div className="wz-body">
              {isBusy(`${tab}:hooks`) && v.hooks.length === 0 && <Loading text="Claude is writing hooks…" />}
              <div className="wz-options" role="radiogroup" aria-label="Hooks">
                {v.hooks.map((h, i) => (
                  <button key={i} role="radio" aria-checked={v.hook === h.text} className={`wz-option ${v.hook === h.text ? 'on' : ''}`} onClick={() => upd(tab, { hook: h.text })}>
                    <span className="wz-radio" aria-hidden="true" /><span className="wz-option-text"><strong>{h.text}</strong></span>
                  </button>
                ))}
              </div>
              {(v.hooks.length > 0 || v.hook) && (
                <label className="field wz-edit"><span>Edit the hook, or write your own</span>
                  <input value={v.hook} onChange={(e) => upd(tab, { hook: e.target.value })} placeholder="Type a hook" />
                </label>
              )}
              {count > 1 && v.hook && <button className="link-btn" onClick={() => copyToAll(['hook'])}>Use this hook for every creative</button>}
            </div>
          )}

          {step === 'content' && (
            <div className="wz-body wz-narrow">
              {isBusy(`${tab}:content`) && !v.content && <Loading text="Claude is writing the words…" />}
              {v.content && (
                <>
                  <label className="field"><span>Headline</span><input value={v.content.headline} onChange={(e) => setC('headline', e.target.value)} /></label>
                  <label className="field"><span>Body text <small>(one or two short sentences under the headline)</small></span><textarea rows={2} value={v.content.support || ''} onChange={(e) => setC('support', e.target.value)} /></label>
                  <label className="field"><span>Button</span><input value={v.content.cta} onChange={(e) => setC('cta', e.target.value)} /></label>
                  <details className="wz-fold">
                    <summary>More text on the creative</summary>
                    <div className="grid-2">
                      <label className="field"><span>Accent words (comma separated)</span><input value={v.content.accentText || ''} onChange={(e) => setC('accentText', e.target.value)} placeholder="e.g. every call" /></label>
                      <label className="field"><span>Offer pill</span><input value={v.content.bonus_pill || ''} onChange={(e) => setC('bonus_pill', e.target.value)} /></label>
                      <label className="field"><span>Proof line</span><input value={v.content.proof_line || ''} onChange={(e) => setC('proof_line', e.target.value)} /></label>
                      <label className="field"><span>Note under the button</span><input value={v.content.cta_note || ''} onChange={(e) => setC('cta_note', e.target.value)} /></label>
                    </div>
                    {!isDevice && !isPanel && (
                      <div className="grid-2">
                        <label className="field"><span>Bullets (one per line)</span><textarea rows={3} value={v.content.bulletsText} onChange={(e) => setC('bulletsText', e.target.value)} /></label>
                        <label className="field"><span>Extra line (offer, stat or guarantee)</span><input value={v.content.extra} onChange={(e) => setC('extra', e.target.value)} /></label>
                      </div>
                    )}
                  </details>
                  <details className="wz-fold">
                    <summary>Facebook ad text (caption, headline, button)</summary>
                    <label className="field"><span>Primary text</span><textarea rows={7} value={v.content.ad_copy?.primary_text || ''} onChange={(e) => setAd('primary_text', e.target.value)} /></label>
                    <div className="grid-2">
                      <label className="field"><span>Headline ({(v.content.ad_copy?.headline || '').length}/27)</span><input value={v.content.ad_copy?.headline || ''} onChange={(e) => setAd('headline', e.target.value)} /></label>
                      <label className="field"><span>Description ({(v.content.ad_copy?.description || '').length}/30)</span><input value={v.content.ad_copy?.description || ''} onChange={(e) => setAd('description', e.target.value)} /></label>
                    </div>
                    <label className="field"><span>Button</span>
                      <select value={v.content.ad_copy?.cta_button || 'LEARN_MORE'} onChange={(e) => setAd('cta_button', e.target.value)}>{CTA_BUTTONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (m) => m.toUpperCase())}</option>)}</select>
                    </label>
                  </details>
                  {[...(v.content.flags || []), ...(v.content.compliance_notes || [])].length > 0 && (
                    <details className="wz-check">
                      <summary>{(() => { const n = new Set([...(v.content.flags || []), ...(v.content.compliance_notes || [])]).size; return n === 1 ? '1 thing to check before running' : `${n} things to check before running`; })()}</summary>
                      <ul>{[...new Set([...(v.content.flags || []), ...(v.content.compliance_notes || [])])].map((n, i) => <li key={i}>{n}</li>)}</ul>
                    </details>
                  )}
                </>
              )}
            </div>
          )}

          {step === 'assets' && isDevice && (
            <div className="wz-body wz-visual">
              <div className="wz-visual-list">
                {isBusy(`${tab}:screens`) && v.screens.length === 0 && <Loading text="Claude is picking visuals for this hook…" />}
                <div className="wz-vgrid" role="radiogroup" aria-label="Visuals">
                  {v.screens.map((x, i) => (
                    <button key={i} role="radio" aria-checked={v.screenAt === i} className={`wz-vcard ${v.screenAt === i ? 'on' : ''}`} onClick={() => upd(tab, { screenAt: i })}>
                      <span className="wz-vthumb" style={{ background: isHex(x.background_hex) ? x.background_hex : (brand?.colors?.deep || '#15201D') }}><VisualIcon screen={x} accent={accent} /></span>
                      <span className="wz-vlabel"><small>{x.kind === 'object' ? 'Object' : `${DEVICE_LABEL[x.device] || 'Phone'} screen`}</small><strong>{x.idea}</strong></span>
                    </button>
                  ))}
                  {v.screens.length > 0 && (
                    <button className="wz-vcard own" onClick={() => { upd(tab, (y) => ({ screens: [...y.screens, { idea: 'My own visual', kind: 'object', object: '', image_prompt: '', device: 'phone', device_side: 'right', background_hex: '', app_title: '', elementsText: '' }], screenAt: y.screens.length })); setEditVisual(true); }}>
                      <span className="wz-vthumb plus" aria-hidden="true">+</span>
                      <span className="wz-vlabel"><strong>My own visual</strong></span>
                    </button>
                  )}
                </div>
              </div>
              <aside className="wz-preview-col" aria-label="Preview">
                <span className="wz-mini-label">Preview</span>
                <CardPreview brand={brand} content={v.content} screen={sc} />
                {sc && <button className="link-btn" onClick={() => setEditVisual((e) => !e)}>{editVisual ? 'Done editing' : 'Edit this visual'}</button>}
                {sc && editVisual && (
                  <div className="wz-screen-edit">
                    <label className="field"><span>Visual</span>
                      <select value={sc.kind === 'object' ? 'object' : sc.device} onChange={(e) => setScreen(v.screenAt, e.target.value === 'object' ? { kind: 'object' } : { kind: 'device', device: e.target.value, device_side: e.target.value === 'laptop' ? 'below' : sc.device_side === 'below' ? 'right' : sc.device_side })}>
                        <option value="object">An object</option>
                        {Object.entries(DEVICE_LABEL).map(([val, l]) => <option key={val} value={val}>{l} screen</option>)}
                      </select>
                    </label>
                    <div className="grid-2">
                      <label className="field"><span>Position</span>
                        <select value={sc.device_side} onChange={(e) => setScreen(v.screenAt, { device_side: e.target.value })}>{Object.entries(SIDE_LABEL).map(([val, l]) => <option key={val} value={val}>{l}</option>)}</select>
                      </label>
                      <label className="field"><span>Background</span>
                        <span className="wz-color">
                          <input type="color" value={isHex(sc.background_hex) ? sc.background_hex : '#111111'} onChange={(e) => setScreen(v.screenAt, { background_hex: e.target.value })} aria-label="Background colour" />
                          <input value={sc.background_hex || ''} onChange={(e) => setScreen(v.screenAt, { background_hex: e.target.value })} placeholder="Auto" aria-label="Background hex" />
                        </span>
                      </label>
                    </div>
                    {sc.kind === 'object' ? (
                      <>
                        <label className="field"><span>The object</span><input value={sc.object || ''} onChange={(e) => setScreen(v.screenAt, { object: e.target.value, idea: e.target.value || sc.idea })} placeholder="e.g. fridge with a sticky note" /></label>
                        <label className="field"><span>How it should look</span><textarea rows={3} value={sc.image_prompt || ''} onChange={(e) => setScreen(v.screenAt, { image_prompt: e.target.value })} placeholder="e.g. glossy 3D fridge, a yellow note on the door, soft light" /></label>
                      </>
                    ) : (
                      <>
                        <label className="field"><span>App title</span><input value={sc.app_title || ''} onChange={(e) => setScreen(v.screenAt, { app_title: e.target.value })} placeholder="e.g. Inbox" /></label>
                        <label className="field"><span>On the screen (one line each)</span><textarea rows={4} value={sc.elementsText || ''} onChange={(e) => setScreen(v.screenAt, { elementsText: e.target.value })} /></label>
                      </>
                    )}
                  </div>
                )}
              </aside>
            </div>
          )}

          {step === 'assets' && isPanel && (
            <PanelStep v={v} tab={tab} upd={upd} setPanel={setPanel} brand={brand} content={v.content} format={format} busy={isBusy(`${tab}:panels`)} editing={editVisual} setEditing={setEditVisual} />
          )}

          {step === 'assets' && !isDevice && !isPanel && (
            <div className="wz-body">
              <div className="wz-seg wide" role="radiogroup" aria-label="Visual">
                <button role="radio" aria-checked={v.visual === 'both'} className={v.visual === 'both' ? 'on' : ''} onClick={() => chooseVisual('both')} disabled={!aiImages}>Photo + AI image</button>
                <button role="radio" aria-checked={v.visual === 'ai'} className={v.visual === 'ai' ? 'on' : ''} onClick={() => chooseVisual('ai')} disabled={!aiImages}>AI image</button>
                <button role="radio" aria-checked={v.visual === 'photo'} className={v.visual === 'photo' ? 'on' : ''} onClick={() => chooseVisual('photo')}>Photo</button>
              </div>
              {!aiImages && <p className="small muted">AI images need an OpenAI key in the server settings.</p>}
              {usesAiOf(v) && (
                <>
                  <h3 className="wz-sub">AI image</h3>
                  {isBusy(`${tab}:assets`) && v.ideas.length === 0 && <Loading text="Claude is suggesting images…" />}
                  <div className="wz-options" role="radiogroup" aria-label="Image ideas">
                    {v.ideas.map((x, i) => (
                      <button key={i} role="radio" aria-checked={v.ideaAt === i} className={`wz-option ${v.ideaAt === i ? 'on' : ''}`} onClick={() => upd(tab, { ideaAt: i })}>
                        <span className="wz-radio" aria-hidden="true" /><span className="wz-option-text"><strong>{x.idea}</strong><small>{x.prompt}</small></span>
                      </button>
                    ))}
                  </div>
                  {v.ideas[v.ideaAt] && (
                    <label className="field wz-edit"><span>Image description</span><textarea rows={3} value={v.ideas[v.ideaAt].prompt} onChange={(e) => setIdea(v.ideaAt, { prompt: e.target.value })} /></label>
                  )}
                </>
              )}
              {usesPhotoOf(v) && (
                <>
                  <h3 className="wz-sub">{v.visual === 'both' ? 'Background photo' : 'Photo'}</h3>
                  <div className="thumbs wz-photos">
                    {brandImages.map((im) => (
                      <button key={im.url} className={`thumb ${v.photoUrl === im.url ? 'on' : ''}`} onClick={() => upd(tab, { photoUrl: im.url })}><img src={im.url} alt={im.label || 'Brand photo'} /></button>
                    ))}
                    {v.photoUrl && !brandImages.some((im) => im.url === v.photoUrl) && <button className="thumb on"><img src={v.photoUrl} alt="Uploaded" /></button>}
                    <label className="thumb add"><input type="file" accept="image/*" onChange={(e) => uploadOwn(e.target.files[0])} aria-label="Upload a photo" /><span>+ Upload</span></label>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'generate' && v.content && (
            <div className="wz-body wz-visual">
              <div className="wz-review-text">
                <dl className="wz-facts">
                  <div><dt>Headline</dt><dd>{v.content.headline}</dd></div>
                  {v.content.support && <div><dt>Body text</dt><dd>{v.content.support}</dd></div>}
                  <div><dt>Button</dt><dd>{v.content.cta}</dd></div>
                  {isDevice && sc && <div><dt>Visual</dt><dd>{sc.kind === 'object' ? (sc.object || sc.idea) : `${DEVICE_LABEL[sc.device]} screen: ${sc.idea}`}</dd></div>}
                  {isPanel && v.panels[v.panelAt] && <div><dt>Diagram</dt><dd>{v.panels[v.panelAt].idea}</dd></div>}
                  {!isDevice && !isPanel && <div><dt>Visual</dt><dd>{usesAiOf(v) ? v.ideas[v.ideaAt]?.idea : usesPhotoOf(v) ? 'Brand photo' : 'No image'}</dd></div>}
                </dl>
                <label className="field"><span>Notes for the design (optional)</span>
                  <textarea rows={2} value={v.designNotes} onChange={(e) => upd(tab, { designNotes: e.target.value })}
                    placeholder={isDevice ? 'e.g. light background, visual on the left' : 'e.g. dark background, hook huge at the top'} />
                </label>
                <p className="small muted">{brand?.name} · {FORMAT_LABEL[format]} · {METHOD_SHORT[method]}{count > 1 ? ` · ${total} images in all` : ''}</p>
              </div>
              <aside className="wz-preview-col" aria-label="Preview">
                <span className="wz-mini-label">{isPanel ? 'Preview' : 'Rough preview (Claude designs the final one)'}</span>
                {isPanel ? <PanelPreview brand={brand} content={v.content} panel={v.panels[v.panelAt]} format={format} /> : <CardPreview brand={brand} content={v.content} screen={isDevice ? sc : null} photo={usesPhotoOf(v) ? v.photoUrl : ''} />}
              </aside>
            </div>
          )}
        </div>

        <footer className="wz-bottom">
          {step === 'setup' ? (
            <div className="wz-chat-input single">
              <input value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label={mode === 'prompt' ? 'Your idea' : 'Anything Claude should know'}
                placeholder={mode === 'prompt' ? 'Your idea, e.g. Fall promo: first month half price for new agencies' : 'Anything Claude should know? (optional)'} />
            </div>
          ) : chatFor[step] || null}
          <div className="wz-nav">
            {at > 0 ? <button className="btn" onClick={back} disabled={!!starting}>Back</button> : <span />}
            <div className="row-gap center">
              {starting && <Loading text={starting} />}
              {step === 'generate'
                ? <button className="btn primary lg" onClick={generate} disabled={!!starting}><IconSpark /> Generate {total > 1 ? `${total} creatives` : 'creative'}</button>
                : <button className="btn primary lg" onClick={next} disabled={!!starting}>Next: {LABEL[steps[at + 1]]}</button>}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function IconCheck() {
  return <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** A small drawing of the chosen visual: a phone, tablet, laptop or a generic object. */
function VisualIcon({ screen, accent }) {
  const kind = screen?.kind === 'object' ? 'object' : screen?.device || 'phone';
  if (kind === 'laptop') return <svg viewBox="0 0 120 80" aria-hidden="true"><rect x="16" y="8" width="88" height="56" rx="5" fill="#1C1C1F" /><rect x="20" y="12" width="80" height="48" rx="2" fill="#F7F7F2" /><rect x="26" y="20" width="22" height="7" rx="2" fill={accent} /><rect x="52" y="20" width="22" height="7" rx="2" fill="#DADDE0" /><rect x="26" y="33" width="68" height="7" rx="2" fill="#DADDE0" /><rect x="6" y="66" width="108" height="6" rx="3" fill="#2A2A2E" /></svg>;
  if (kind === 'tablet') return <svg viewBox="0 0 90 110" aria-hidden="true"><rect x="8" y="4" width="74" height="102" rx="9" fill="#1C1C1F" /><rect x="13" y="10" width="64" height="90" rx="5" fill="#F7F7F2" /><rect x="19" y="20" width="52" height="9" rx="3" fill="#DADDE0" /><rect x="19" y="34" width="44" height="9" rx="3" fill={accent} /><rect x="19" y="48" width="52" height="9" rx="3" fill="#DADDE0" /></svg>;
  if (kind === 'object') return <svg viewBox="0 0 100 100" aria-hidden="true"><rect x="22" y="24" width="56" height="56" rx="12" fill="#F7F7F2" /><rect x="22" y="24" width="56" height="56" rx="12" fill="none" stroke={accent} strokeWidth="3" /><circle cx="50" cy="52" r="12" fill={accent} opacity=".85" /><ellipse cx="50" cy="88" rx="28" ry="4" fill="#000" opacity=".18" /></svg>;
  return <svg viewBox="0 0 70 110" aria-hidden="true"><rect x="10" y="3" width="50" height="104" rx="11" fill="#1C1C1F" /><rect x="14" y="9" width="42" height="92" rx="7" fill="#F7F7F2" /><rect x="19" y="22" width="32" height="9" rx="3" fill="#DADDE0" /><rect x="19" y="36" width="28" height="9" rx="3" fill={accent} /><rect x="19" y="50" width="32" height="9" rx="3" fill="#DADDE0" /></svg>;
}

/** A rough live preview of the creative from the current choices (the real one is designed by Claude). */
function CardPreview({ brand, content, screen, photo }) {
  const c = brand?.colors || {};
  const accent = isHex(c.accent) ? c.accent : '#0F766E';
  const bg = isHex(screen?.background_hex) ? screen.background_hex : isHex(c.deep) ? c.deep : '#15201D';
  const light = lightHex(bg);
  const ink = light ? '#14110F' : '#FFFFFF';
  const soft = light ? 'rgba(20,17,15,.72)' : 'rgba(255,255,255,.78)';
  const label = lightHex(accent) ? '#111111' : '#FFFFFF';
  const headline = content?.headline || 'Your headline';
  const accents = (content?.accentText || '').split(',').map((t) => t.trim()).filter(Boolean);
  const parts = [];
  if (accents.length) {
    const re = new RegExp(`(${accents.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'i');
    headline.split(re).forEach((p, i) => parts.push(re.test(p) && accents.some((a) => a.toLowerCase() === p.toLowerCase()) ? <span key={i} style={{ color: accent }}>{p}</span> : p));
  } else parts.push(headline);
  const below = screen?.device_side === 'below';
  return (
    <div className="wz-card-preview" style={{ background: photo ? `center / cover url(${photo})` : bg, color: ink }}>
      <div className="wz-cp-top">
        {brand?.logo_url ? <img src={brand.logo_url} alt="" /> : <strong>{brand?.name}</strong>}
        {content?.bonus_pill && <span style={{ background: accent, color: label }}>{content.bonus_pill}</span>}
      </div>
      <div className={`wz-cp-mid ${below ? 'below' : ''} ${screen?.device_side === 'left' ? 'left' : ''}`}>
        <div className="wz-cp-text">
          <strong className="wz-cp-head" style={{ fontSize: headline.length > 48 ? 16 : headline.length > 30 ? 19 : 22 }}>{parts}</strong>
          {content?.support && <span className="wz-cp-body" style={{ color: soft }}>{content.support}</span>}
          {content?.cta && <span className="wz-cp-cta" style={{ background: accent, color: label }}>{content.cta}</span>}
        </div>
        {screen && <div className="wz-cp-visual"><VisualIcon screen={screen} accent={accent} /></div>}
      </div>
      <div className="wz-cp-foot" style={{ color: soft }}>{brand?.name}{brand?.website ? ` · ${brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : ''}</div>
    </div>
  );
}

// ---- headline + diagram card: the builder shows the same card the app will draw ----

const PANEL_LABEL = {
  timeline: 'Timeline', checklist: 'Checklist', steps: 'Numbered steps', compare_table: 'Before and after table', compare_cards: 'Today vs with us',
  flow: 'Flow into one result', calendar: 'Two calendars', path: 'Broken vs connected path', tiles: 'Four tiles', columns: 'Three columns',
  clock: 'Clock and reminders', seesaw: 'See-saw', funnel: 'Two funnels', device: 'Device screen',
};
const SCREEN_LABEL = { list: 'List', calendar: 'Calendar', notifications: 'Alerts', board: 'Board', roster: 'Team' };
const LAYOUT_LABEL = { stack: 'Centred', split_right: 'Device right', split_left: 'Device left' };
const themeLabel = (t) => `${t[0].toUpperCase() + t.slice(1)}${THEMES[t]?.solid ? ' (solid)' : ''}`;

function useBrandFonts(brand) {
  useEffect(() => {
    const fams = [...new Set([brand?.fonts?.heading || 'Montserrat', brand?.fonts?.body || 'Nunito Sans', 'Barlow Condensed'])];
    const id = `cs-fonts-${fams.join('-').replace(/\W+/g, '')}`;
    if (document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${encodeURIComponent(f)}:wght@500;600;700;800;900`).join('&')}&display=swap`;
    document.head.appendChild(l);
  }, [brand?.fonts?.heading, brand?.fonts?.body]);
}

/** The card exactly as the app will draw it, scaled to the box. */
function PanelPreview({ brand, content, panel, format = '4:5', small = false }) {
  useBrandFonts(brand);
  // Each preview gets its own scope, so one card's theme never leaks into another's.
  const scopeId = `cs-pp-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const boxRef = useRef(null);
  const [w, setW] = useState(small ? 200 : 320);
  useEffect(() => {
    const fit = () => boxRef.current && setW(boxRef.current.clientWidth);
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  const fmt = format === '9:16' ? '9:16' : '4:5';
  const H = fmt === '9:16' ? 1920 : 1350;
  const a = brand?.audiences?.[content?.source] || {};
  const furniture = {
    cta: content?.cta || brand?.default_cta || 'Learn more', cta_note: content?.cta_note || '', proof_line: content?.proof_line || '', bonus_pill: content?.bonus_pill || '',
    website: String(brand?.website || '').replace(/^https?:\/\//, '').replace(/\/$/, ''), email: brand?.email || '',
  };
  const d = {
    headline_lines: [content?.headline || 'Your headline'], accent_words: (content?.accentText || '').split(',').map((t) => t.trim()).filter(Boolean),
    subhead: content?.support || '', theme: panel?.theme || 'indigo', panel: panel || { type: 'checklist', rows: [] },
  };
  const { html, css } = buildPanelCard({ d, brand: brand || {}, furniture, format: fmt });
  const f = { heading: brand?.fonts?.heading || 'Montserrat', body: brand?.fonts?.body || 'Nunito Sans' };
  const scope = `.${scopeId} .canvas{--font-heading:"${f.heading}",Arial,sans-serif;--font-body:"${f.body}",Arial,sans-serif;position:relative;width:1080px;height:${H}px;overflow:hidden;box-sizing:border-box}
.${scopeId} .canvas *{box-sizing:border-box}.${scopeId} .canvas :where(h1,p){margin:0}`;
  const scoped = css.replace(/\.canvas/g, `.${scopeId} .canvas`);
  const logo = brand?.logo_url || '';
  const k = w / 1080;
  return (
    <div ref={boxRef} className={scopeId} style={{ width: '100%', height: H * k, overflow: 'hidden', borderRadius: 12, position: 'relative' }} aria-label="Preview of the creative">
      <style>{scope + scoped}</style>
      <div style={{ transform: `scale(${k})`, transformOrigin: '0 0', width: 1080, height: H, pointerEvents: 'none' }}
        dangerouslySetInnerHTML={{ __html: `<div class="canvas">${html.replace(/\{\{LOGO\}\}/g, logo)}</div>` }} />
    </div>
  );
}

function PanelStep({ v, tab, setPanel, upd, brand, content, format, busy, editing, setEditing }) {
  const p = v.panels[v.panelAt];
  const rowsText = (rows) => (rows || []).map((r) => (r.b ? `${r.a} | ${r.b}` : r.a)).join('\n');
  const parseRows = (t) => lines(t).map((l) => { const [a, ...b] = l.split('|'); return { a: a.trim(), b: b.join('|').trim() }; });
  return (
    <div className="wz-body wz-visual">
      <div className="wz-visual-list">
        {busy && v.panels.length === 0 && <Loading text="Claude is drawing diagram ideas for this hook…" />}
        <div className="wz-vgrid wz-pgrid" role="radiogroup" aria-label="Diagrams">
          {v.panels.map((x, i) => (
            <button key={i} role="radio" aria-checked={v.panelAt === i} className={`wz-vcard wz-pcard ${v.panelAt === i ? 'on' : ''}`} onClick={() => upd(tab, { panelAt: i })}>
              <span className="wz-pthumb"><PanelPreview brand={brand} content={content} panel={x} format="4:5" small /></span>
              <span className="wz-vlabel"><small>{PANEL_LABEL[x.type] || 'Diagram'}</small><strong>{x.idea}</strong></span>
            </button>
          ))}
        </div>
      </div>
      <aside className="wz-preview-col" aria-label="Preview">
        <span className="wz-mini-label">Preview</span>
        {p ? <PanelPreview brand={brand} content={content} panel={p} format={format} /> : <p className="small muted">Pick a diagram to see the creative.</p>}
        {p && <button className="link-btn" onClick={() => setEditing((e) => !e)}>{editing ? 'Done editing' : 'Edit this diagram'}</button>}
        {p && editing && (
          <div className="wz-screen-edit">
            <div className="grid-2">
              <label className="field"><span>Diagram</span>
                <select value={p.type} onChange={(e) => setPanel(v.panelAt, { type: e.target.value })}>{Object.keys(PANEL_TYPES).map((t) => <option key={t} value={t}>{PANEL_LABEL[t] || t}</option>)}</select>
              </label>
              <label className="field"><span>Background</span>
                <select value={p.theme} onChange={(e) => setPanel(v.panelAt, { theme: e.target.value })}>{THEME_NAMES.map((t) => <option key={t} value={t}>{themeLabel(t)}</option>)}</select>
              </label>
            </div>
            {p.type === 'device' && (
              <div className="grid-2">
                <label className="field"><span>Device</span>
                  <select value={p.device && p.device !== 'none' ? p.device : 'phone'} onChange={(e) => setPanel(v.panelAt, { device: e.target.value, ...(e.target.value === 'laptop' ? { layout: 'stack' } : {}) })}>{DEVICES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}</select>
                </label>
                <label className="field"><span>Screen</span>
                  <select value={p.screen && p.screen !== 'none' ? p.screen : 'list'} onChange={(e) => setPanel(v.panelAt, { screen: e.target.value })}>{Object.keys(SCREENS).map((t) => <option key={t} value={t}>{SCREEN_LABEL[t] || t}</option>)}</select>
                </label>
                <label className="field"><span>Layout</span>
                  <select value={p.layout || 'stack'} onChange={(e) => setPanel(v.panelAt, { layout: e.target.value })}>{LAYOUTS.filter((t) => p.device !== 'laptop' || t === 'stack').map((t) => <option key={t} value={t}>{LAYOUT_LABEL[t] || t}</option>)}</select>
                </label>
              </div>
            )}
            <label className="field"><span>Headline font</span>
              <select value={p.font || 'brand'} onChange={(e) => setPanel(v.panelAt, { font: e.target.value })}><option value="brand">Brand font</option><option value="condensed">Condensed bold</option></select>
            </label>
            <label className="field"><span>Heading</span><input value={p.heading || ''} onChange={(e) => setPanel(v.panelAt, { heading: e.target.value })} /></label>
            <div className="grid-2">
              <label className="field"><span>Left label</span><input value={p.left_label || ''} onChange={(e) => setPanel(v.panelAt, { left_label: e.target.value })} /></label>
              <label className="field"><span>Right label</span><input value={p.right_label || ''} onChange={(e) => setPanel(v.panelAt, { right_label: e.target.value })} /></label>
            </div>
            <label className="field"><span>Lines (one per line; use | to add a detail)</span>
              <textarea rows={4} defaultValue={rowsText(p.rows)} key={`${tab}-${v.panelAt}`} onChange={(e) => setPanel(v.panelAt, { rows: parseRows(e.target.value) })} /></label>
            <div className="grid-2">
              <label className="field"><span>Middle / time</span><input value={p.center || ''} onChange={(e) => setPanel(v.panelAt, { center: e.target.value })} /></label>
              <label className="field"><span>Kicker under it</span><input value={p.footnote || ''} onChange={(e) => setPanel(v.panelAt, { footnote: e.target.value })} /></label>
              <label className="field"><span>Result (or left caption)</span><input value={p.result || ''} onChange={(e) => setPanel(v.panelAt, { result: e.target.value })} /></label>
              <label className="field"><span>Result detail (or right caption)</span><input value={p.result_detail || ''} onChange={(e) => setPanel(v.panelAt, { result_detail: e.target.value })} /></label>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
