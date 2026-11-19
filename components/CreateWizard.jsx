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
const CTA_BUTTONS = ['BOOK_NOW', 'LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'CONTACT_US', 'SHOP_NOW', 'SUBSCRIBE', 'GET_OFFER', 'APPLY_NOW'];
const DEVICE_LABEL = { phone: 'Phone', tablet: 'Tablet', laptop: 'Laptop' };
const SIDE_LABEL = { right: 'right of the headline', left: 'left of the headline', below: 'under the headline' };
const SIDE_SHORT = { right: 'right', left: 'left', below: 'below' };
const FORMAT_LABEL = { '1:1': '1:1', '4:5': '4:5', '9:16': '9:16', both: '4:5 + 9:16' };
const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v || '');
const lightHex = (v) => { const n = parseInt(v.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150; };
const VISUAL_LABEL = { photo: 'Realistic photo', object: '3D icon or object', illustration: 'Illustration' };

function Loading({ text }) {
  return <div className="wz-loading"><span className="spinner dark" aria-hidden="true" /><span>{text}</span></div>;
}

/** A chat with Claude for one step: write what you want, Claude answers and updates the suggestions. */
function Chat({ messages, onSend, busy, placeholder }) {
  const [text, setText] = useState('');
  const logRef = useRef(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [messages, busy]);
  const send = () => { const t = text.trim(); if (!t || busy) return; setText(''); onSend(t); };
  return (
    <div className="wz-chat">
      {(messages.length > 0 || busy) && (
        <div className="wz-chat-log" ref={logRef} aria-live="polite">
          {messages.map((m, i) => <div key={i} className={`wz-msg ${m.role}`}>{m.text}</div>)}
          {busy && <div className="wz-msg claude typing"><span /><span /><span /></div>}
        </div>
      )}
      <div className="wz-chat-input">
        <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="Message Claude"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="wz-send" onClick={send} disabled={!!busy || !text.trim()} aria-label="Send"><IconSend /></button>
      </div>
    </div>
  );
}

function IconSend() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>;
}

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
  const [batch, setBatch] = useState('angles'); // angles: a different angle per creative, made at once; designs: same copy, different layouts
  const [source, setSource] = useState(''); // asked first: the ad is for business owners or agency owners
  const [aiImages, setAiImages] = useState(false);
  useEffect(() => { api.config().then((c) => setAiImages(!!c.ai_images)); }, []);

  // Steps
  const [step, setStep] = useState('setup');
  const [busy, setBusy] = useState('');
  const [angles, setAngles] = useState([]);
  const [angle, setAngle] = useState(null);
  const [ownAngle, setOwnAngle] = useState(false);
  const [hooks, setHooks] = useState([]);
  const [hook, setHook] = useState('');
  const [content, setContent] = useState(null);
  const [visual, setVisual] = useState(''); // both | ai | photo
  const [ideas, setIdeas] = useState([]);
  const [ideasFor, setIdeasFor] = useState('');
  const [ideaAt, setIdeaAt] = useState(-1);
  const [photoUrl, setPhotoUrl] = useState('');
  const [screens, setScreens] = useState([]);
  const [screensFor, setScreensFor] = useState('');
  const [screenAt, setScreenAt] = useState(-1);
  const [designNotes, setDesignNotes] = useState('');
  const [chats, setChats] = useState({ angles: [], hooks: [], content: [], assets: [], screens: [] });
  const say = (key, role, text) => text && setChats((c) => ({ ...c, [key]: [...c[key], { role, text }] }));

  const brand = brands.find((b) => b.id === brandId);
  const brandImages = (brand?.brand_images || []).filter((im) => /^https?:\/\//.test(im.url || ''));
  const steps = mode === 'random' ? ['setup', 'angle', 'hook', 'content', 'assets', 'generate'] : ['setup', 'hook', 'content', 'assets', 'generate'];
  const isDevice = design === 'device';
  const LABEL = { setup: 'Setup', angle: 'Angle', hook: 'Hook', content: 'Content', assets: isDevice ? 'Device' : 'Assets', generate: 'Generate' };
  const at = steps.indexOf(step);

  const ask = async (body, label) => {
    setBusy(label);
    try { return await api.wizard({ brand_id: brandId, method, stage, format, source, design, ...body }); }
    catch (e) { toast(e.message, 'error'); return null; }
    finally { setBusy(''); }
  };

  // Each step is a chat: the person's message is followed fully, earlier messages in the step give context,
  // and in Random mode the optional setup prompt is background for every step.
  const chatBody = (key, direction) => ({
    direction, notes: mode === 'random' ? prompt.trim() : '',
    history: direction ? chats[key].filter((m) => m.role === 'user').map((m) => m.text) : [],
  });
  const merge = (list, r, items) => (r.action === 'add' ? [...list, ...items] : items);

  const loadAngles = async (direction = '') => {
    const r = await ask({ step: 'angles', ...chatBody('angles', direction), avoid: angles.map((a) => a.title) }, 'angles');
    if (r) { setAngles(merge(angles, r, r.angles)); if (r.action !== 'add' && !ownAngle) setAngle(null); say('angles', 'claude', r.reply); }
  };
  const loadHooks = async (direction = '') => {
    const r = await ask({ step: 'hooks', ...chatBody('hooks', direction), angle: mode === 'random' ? angle : null, prompt: mode === 'prompt' ? prompt : '', avoid: hooks.map((h) => h.text) }, 'hooks');
    if (r) { setHooks(merge(hooks, r, r.hooks)); say('hooks', 'claude', r.reply); }
  };
  const loadContent = async (direction = '') => {
    const current = direction && content ? {
      headline: content.headline, support: content.support, bullets: (content.bulletsText || '').split('\n').filter(Boolean), extra: content.extra, cta: content.cta,
      accent_words: (content.accentText || '').split(',').map((t) => t.trim()).filter(Boolean), proof_line: content.proof_line, bonus_pill: content.bonus_pill, cta_note: content.cta_note,
    } : null;
    const r = await ask({ step: 'content', ...chatBody('content', direction), current, angle: mode === 'random' ? angle : null, prompt: mode === 'prompt' ? prompt : '', hook }, 'content');
    if (r) {
      // The first draft keeps the hook the person picked as the headline; later messages may change it.
      const headline = direction ? (r.content.headline || hook) : (hook.trim() || r.content.headline);
      setContent({ ...r.content, headline, bulletsText: (r.content.bullets || []).join('\n'), accentText: (r.content.accent_words || []).join(', ') });
      say('content', 'claude', r.reply);
    }
  };
  const loadIdeas = async (direction = '', forVisual = visual) => {
    const r = await ask({
      step: 'assets', ...chatBody('assets', direction), visual: forVisual, angle: mode === 'random' ? angle : null, prompt: mode === 'prompt' ? prompt : '', hook,
      copy: content ? { headline: content.headline, support: content.support, extra: content.extra } : null,
      avoid: ideas.map((x) => x.idea),
    }, 'assets');
    if (r) { const list = merge(ideas, r, r.ideas); setIdeas(list); if (r.action !== 'add') setIdeaAt(-1); setIdeasFor(contentKey); say('assets', 'claude', r.reply); }
  };
  const loadScreens = async (direction = '') => {
    const r = await ask({
      step: 'screens', ...chatBody('screens', direction), angle: mode === 'random' ? angle : null, prompt: mode === 'prompt' ? prompt : '', hook,
      copy: content ? { headline: content.headline, support: content.support } : null,
      avoid: screens.map((x) => x.idea),
    }, 'screens');
    if (r) { const list = merge(screens, r, r.screens.map((x) => ({ ...x, elementsText: (x.elements || []).join('\n') }))); setScreens(list); if (r.action !== 'add') setScreenAt(-1); setScreensFor(contentKey); say('screens', 'claude', r.reply); }
  };
  const chatSend = (key, load) => (text) => { say(key, 'user', text); load(text); };

  // Each step remembers what it was made for, so going Back and Next again keeps
  // suggestions unless the choice they depend on changed.
  const [madeFor, setMadeFor] = useState({});
  const setupKey = `${brandId}|${source}|${mode}|${prompt}|${method}|${stage}|${format}`;
  const hookKey = `${setupKey}|${mode === 'random' ? JSON.stringify(angle) : ''}`;
  const contentKey = `${hookKey}|${hook}`;
  const canNext = {
    angle: !!angle?.title?.trim(),
    hook: !!hook.trim(),
    content: !!content?.headline?.trim(),
    setup: !!brandId && !!source && (mode === 'random' || prompt.trim()),
    assets: isDevice ? !!screens[screenAt] : visual === 'none' || ((visual === 'photo' || visual === 'both') ? !!photoUrl : true) && ((visual === 'ai' || visual === 'both') ? !!ideas[ideaAt]?.prompt?.trim() : true),
  }[step];

  const next = () => {
    if (!canNext) return toast('Choose or write something first', 'error');
    const n = steps[at + 1];
    if (n === 'angle' && madeFor.angles !== setupKey) { setAngles([]); setAngle(null); setMadeFor((m) => ({ ...m, angles: setupKey })); setChats((c) => ({ ...c, angles: [] })); loadAngles(); }
    if (n === 'hook' && madeFor.hooks !== hookKey) { setHooks([]); setHook(''); setMadeFor((m) => ({ ...m, hooks: hookKey })); setChats((c) => ({ ...c, hooks: [] })); loadHooks(); }
    if (n === 'content' && madeFor.content !== contentKey) { setContent(null); setMadeFor((m) => ({ ...m, content: contentKey })); setChats((c) => ({ ...c, content: [] })); loadContent(); }
    if (n === 'assets' && isDevice) {
      if (screensFor !== contentKey) { setScreens([]); setScreenAt(-1); setChats((c) => ({ ...c, screens: [] })); loadScreens(); }
    } else if (n === 'assets') {
      const v = visual || (aiImages && brandImages.length ? 'both' : aiImages ? 'ai' : brandImages.length ? 'photo' : 'none');
      setVisual(v);
      if ((v === 'ai' || v === 'both') && ideasFor !== contentKey) { setIdeas([]); setChats((c) => ({ ...c, assets: [] })); loadIdeas('', v); }
    }
    setStep(n);
  };
  const back = () => setStep(steps[Math.max(0, at - 1)]);

  const chooseVisual = (v) => {
    setVisual(v);
    if ((v === 'ai' || v === 'both') && ideasFor !== contentKey && !busy) { setIdeas([]); setChats((c) => ({ ...c, assets: [] })); loadIdeas('', v); }
  };
  const setIdea = (i, patch) => setIdeas((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addOwnIdea = () => { setIdeas((list) => [...list, { idea: 'My own idea', visual_type: 'object', shape: 'square', prompt: '' }]); setIdeaAt(ideas.length); };
  const idea = ideas[ideaAt];
  const screen = screens[screenAt];
  const setScreen = (i, patch) => setScreens((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addOwnScreen = () => {
    setScreens((list) => [...list, { idea: 'My own screen', device: 'phone', device_side: 'right', background_hex: '', app_title: '', elementsText: '' }]);
    setScreenAt(screens.length);
  };
  const usesAi = !isDevice && (visual === 'ai' || visual === 'both');
  const usesPhoto = !isDevice && (visual === 'photo' || visual === 'both');
  const total = count * (format === 'both' ? 2 : 1);

  const uploadOwn = async (file) => {
    if (!file) return;
    setBusy('Uploading…');
    try {
      const url = await api.upload(file, 'brand-images');
      setPhotoUrl(url);
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(''); }
  };

  const generate = async () => {
    setBusy('Starting…');
    try {
      const bullets = (content.bulletsText || '').split('\n').map((t) => t.trim()).filter(Boolean);
      await api.generate({
        brand_id: brandId, mode, prompt: prompt.trim(), count, format, design, method,
        stage: angle?.stage || stage, source, created_by: settings.userName || '',
        photo_source: usesAi ? 'ai' : usesPhoto ? 'brand' : 'none',
        brief: {
          angle: mode === 'random' ? angle : null, hook, design_notes: designNotes.trim(),
          content: {
            headline: content.headline, support: content.support, bullets, extra: content.extra, cta: content.cta,
            accent_words: (content.accentText || '').split(',').map((t) => t.trim()).filter(Boolean),
            proof_line: content.proof_line || '', bonus_pill: content.bonus_pill || '', cta_note: content.cta_note || '',
          },
          ad_copy: content.ad_copy, compliance_notes: content.compliance_notes, claims_used: content.claims_used || [], flags: content.flags || [],
          screen: isDevice && screen ? { ...screen, elements: (screen.elementsText || '').split('\n').map((t) => t.trim()).filter(Boolean) } : null,
          visual: isDevice ? 'none' : visual || 'none', photo_url: usesPhoto ? photoUrl : '',
          image_prompt: usesAi ? idea?.prompt || '' : '', visual_type: idea?.visual_type || 'object', image_shape: idea?.shape || 'square',
        },
      });
      toast(`Designing ${total > 1 ? `${total} creatives` : 'your creative'} for ${brand.name}. ${total > 1 ? 'They appear' : 'It appears'} in Creatives when ready.`);
      onDone();
    } catch (e) { toast(`Couldn't start: ${e.message}`, 'error'); }
    finally { setBusy(''); }
  };

  // Many creatives at once, each with its own angle, hook and copy chosen by Claude (no step-by-step).
  const quickBatch = count > 1 && batch === 'angles';
  const generateBatch = async () => {
    if (!canNext) return toast('Choose who the ad is for first', 'error');
    setBusy('Starting…');
    try {
      await api.generate({
        brand_id: brandId, mode, prompt: prompt.trim(), count, format, design, method, stage, source,
        created_by: settings.userName || '', photo_source: design === 'device' ? 'none' : (aiImages ? 'ai' : 'brand'),
      });
      toast(`Writing ${total} creatives for ${brand.name}, each with its own angle. They appear in Creatives as they finish.`);
      onDone();
    } catch (e) { toast(`Couldn't start: ${e.message}`, 'error'); }
    finally { setBusy(''); }
  };

  const setC = (k, v) => setContent((c) => ({ ...c, [k]: v }));
  const setAd = (k, v) => setContent((c) => ({ ...c, ad_copy: { ...c.ad_copy, [k]: v } }));

  const footer = (
    <>
      {at > 0 && <button className="btn ghost" onClick={back} disabled={!!busy}>Back</button>}
      <span className="spacer" />
      <button className="btn ghost" onClick={onClose}>Cancel</button>
      {step === 'generate'
        ? <button className="btn primary" onClick={generate} disabled={!!busy}><IconSpark /> Generate creative{total > 1 ? 's' : ''}</button>
        : step === 'setup' && quickBatch
          ? <button className="btn primary" onClick={generateBatch} disabled={!!busy || !canNext}><IconSpark /> Generate {total} creatives</button>
          : <button className="btn primary" onClick={next} disabled={!!busy || !canNext}>Next</button>}
    </>
  );

  const summary = useMemo(() => [
    prompt.trim() ? ['Prompt', prompt] : null,
    mode === 'random' && angle ? ['Angle', angle.title] : null,
    hook ? ['Hook', hook] : null,
  ].filter(Boolean), [mode, angle, prompt, hook]);

  return (
    <Modal wide title="Create a creative" onClose={onClose} footer={footer}>
      <ol className="wz-steps">
        {steps.map((s, i) => <li key={s} className={i < at ? 'done' : i === at ? 'on' : ''}><span>{i + 1}</span>{LABEL[s]}</li>)}
      </ol>
      {summary.length > 0 && step !== 'setup' && (
        <div className="wz-summary">{summary.map(([k, v]) => <div key={k}><strong>{k}:</strong> {v}</div>)}</div>
      )}

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
            <textarea className="wz-setup-prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Prompt"
              placeholder={mode === 'prompt'
                ? 'Your prompt (required). e.g. Fall promo: first month half price for new agencies.'
                : 'Prompt (optional). e.g. Focus on agencies that just signed their first client.'} />
          </div>
          <div className="wz-section">
            <h3>How many creatives?</h3>
            <div className="wz-count">
              <button className="icon-btn" onClick={() => setCount((n) => Math.max(1, n - 1))} disabled={count <= 1} aria-label="Fewer">−</button>
              <input type="number" min={1} max={10} value={count} aria-label="Number of creatives"
                onChange={(e) => setCount(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))} />
              <button className="icon-btn" onClick={() => setCount((n) => Math.min(10, n + 1))} disabled={count >= 10} aria-label="More">+</button>
              <span className="muted small">{format === 'both' ? `${total} images (each in 4:5 and 9:16)` : 'up to 10'}</span>
            </div>
            {count > 1 && (
              <div className="segmented" role="radiogroup" aria-label="How the creatives differ" style={{ marginTop: 10 }}>
                <button role="radio" aria-checked={batch === 'angles'} className={batch === 'angles' ? 'on' : ''} onClick={() => setBatch('angles')}>
                  <strong>Each with its own angle</strong><small>Claude picks a different angle, hook and copy for each. Made right away</small>
                </button>
                <button role="radio" aria-checked={batch === 'designs'} className={batch === 'designs' ? 'on' : ''} onClick={() => setBatch('designs')}>
                  <strong>Same copy, different designs</strong><small>You go through the steps once; each creative gets its own layout</small>
                </button>
              </div>
            )}
          </div>
          <details className="wz-more">
            <summary>Options: {method === '100m' ? '$100M Offers' : 'Pre-Sold'} · {FORMAT_LABEL[format]} · {{ device: 'Device card', free: 'Free design', classic: 'Classic card' }[design]} · {STAGE_SHORT[stage]}</summary>
            <div className="grid-3">
              <label className="field"><span>Method</span>
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="presold">Pre-Sold (Jeff Miller)</option>
                  <option value="100m">$100M Offers (Hormozi)</option>
                </select>
              </label>
              <label className="field"><span>Format</span>
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="4:5">Portrait 4:5 (Feed)</option><option value="9:16">Vertical 9:16 (Stories, Reels)</option>
                  <option value="both">4:5 + 9:16 (one of each)</option><option value="1:1">Square 1:1 (Feed)</option>
                </select>
              </label>
              <label className="field"><span>Design</span>
                <select value={design} onChange={(e) => setDesign(e.target.value)}>
                  <option value="device">Device card (phone, tablet or laptop)</option><option value="free">Free design (Claude picks the style)</option><option value="classic">Classic card</option>
                </select>
              </label>
              <label className="field"><span>Awareness stage</span>
                <select value={stage} onChange={(e) => setStage(e.target.value)}>{STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </label>
            </div>
          </details>
        </div>
      )}

      {step === 'angle' && (
        <div className="wz-body">
          <div className="wz-head"><h3>Pick an angle</h3>
            <button className="link-btn" onClick={() => { setOwnAngle(true); setAngle({ title: '', audience: '', insight: '', stage: stage === 'auto' ? 'problem' : stage }); }}>Write my own</button></div>
          <Chat messages={chats.angles} onSend={chatSend('angles', loadAngles)} busy={busy === 'angles'}
            placeholder="Tell Claude what angles you want, e.g. angles for agency owners who just lost their biggest client" />
          {ownAngle && angle && (
            <div className="wz-own">
              <input placeholder="Angle in a few words" value={angle.title} onChange={(e) => setAngle({ ...angle, title: e.target.value })} />
              <input placeholder="Who it speaks to" value={angle.audience} onChange={(e) => setAngle({ ...angle, audience: e.target.value })} />
              <input placeholder="The insight, in their words" value={angle.insight} onChange={(e) => setAngle({ ...angle, insight: e.target.value })} />
            </div>
          )}
          <div className="wz-cards">
            {angles.map((a, i) => (
              <button key={i} className={`wz-card ${!ownAngle && angle === a ? 'on' : ''}`} onClick={() => { setOwnAngle(false); setAngle(a); }}>
                <span className="wz-card-top"><strong>{a.title}</strong><span className="chip">{STAGE_SHORT[a.stage] || a.stage}</span></span>
                <small>{a.audience}</small>
                <span className="wz-card-insight">{a.insight}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'hook' && (
        <div className="wz-body">
          <div className="wz-head"><h3>Pick a hook</h3></div>
          <Chat messages={chats.hooks} onSend={chatSend('hooks', loadHooks)} busy={busy === 'hooks'}
            placeholder="Tell Claude what hooks you want, e.g. 10 short questions about missed calls at night" />
          <div className="wz-hooks">
            {hooks.map((h, i) => (
              <button key={i} className={`wz-hook ${hook === h.text ? 'on' : ''}`} onClick={() => setHook(h.text)}>
                <span className="wz-hook-text">{h.text}</span><span className="wz-hook-style">{h.style}</span>
              </button>
            ))}
          </div>
          <label className="field wz-edit"><span>Your hook (edit it, or write your own)</span>
            <input value={hook} onChange={(e) => setHook(e.target.value)} placeholder="Pick one above or type a hook" />
          </label>
        </div>
      )}

      {step === 'content' && (
        <div className="wz-body">
          <div className="wz-head"><h3>What goes on the creative</h3></div>
          <Chat messages={chats.content} onSend={chatSend('content', loadContent)} busy={busy === 'content'}
            placeholder="Tell Claude how to write it, e.g. drop the bullets and mention the 14-day free trial" />
          {content && (
            <>
              {isDevice && <p className="small muted" style={{ margin: 0 }}>A device card keeps the card short: headline, device, proof line, button and note, offer pill and footer. Benefits and the offer details go in the caption below.</p>}
              <label className="field"><span>{isDevice ? 'Headline (2 or 3 short lines, about 9 words at most)' : 'Headline (your hook)'}</span><input value={content.headline} onChange={(e) => setC('headline', e.target.value)} /></label>
              {isDevice ? (
                <label className="field"><span>Button text (the brand's CTA)</span><input value={content.cta} onChange={(e) => setC('cta', e.target.value)} /></label>
              ) : (
                <>
                  <label className="field"><span>Support line</span><textarea rows={2} value={content.support} onChange={(e) => setC('support', e.target.value)} /></label>
                  <div className="grid-2">
                    <label className="field"><span>Bullets (one per line, optional)</span><textarea rows={4} value={content.bulletsText} onChange={(e) => setC('bulletsText', e.target.value)} /></label>
                    <div>
                      <label className="field"><span>Extra line (offer, stat or guarantee, optional)</span><input value={content.extra} onChange={(e) => setC('extra', e.target.value)} /></label>
                      <label className="field"><span>Button text</span><input value={content.cta} onChange={(e) => setC('cta', e.target.value)} /></label>
                    </div>
                  </div>
                </>
              )}
              <div className="grid-2">
                <label className="field"><span>Accent words (comma separated)</span><input value={content.accentText || ''} onChange={(e) => setC('accentText', e.target.value)} placeholder="e.g. every call" /></label>
                <label className="field"><span>Bonus pill (top right, optional)</span><input value={content.bonus_pill || ''} onChange={(e) => setC('bonus_pill', e.target.value)} /></label>
                <label className="field"><span>Proof line (with a shield icon, optional)</span><input value={content.proof_line || ''} onChange={(e) => setC('proof_line', e.target.value)} /></label>
                <label className="field"><span>Note under the button (optional)</span><input value={content.cta_note || ''} onChange={(e) => setC('cta_note', e.target.value)} /></label>
              </div>
              <details className="wz-adcopy">
                <summary>Meta ad copy (primary text, headline, description, button)</summary>
                <label className="field"><span>Primary text</span><textarea rows={6} value={content.ad_copy?.primary_text || ''} onChange={(e) => setAd('primary_text', e.target.value)} /></label>
                <div className="grid-2">
                  <label className="field"><span>Headline</span><input value={content.ad_copy?.headline || ''} onChange={(e) => setAd('headline', e.target.value)} /></label>
                  <label className="field"><span>Description</span><input value={content.ad_copy?.description || ''} onChange={(e) => setAd('description', e.target.value)} /></label>
                </div>
                <label className="field"><span>Meta button</span>
                  <select value={content.ad_copy?.cta_button || 'LEARN_MORE'} onChange={(e) => setAd('cta_button', e.target.value)}>{CTA_BUTTONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}</select>
                </label>
              </details>
              {[...(content.flags || []), ...(content.compliance_notes || [])].length > 0 && (
                <div className="notice"><strong>Check before running:</strong><ul>{[...new Set([...(content.flags || []), ...(content.compliance_notes || [])])].map((n, i) => <li key={i}>{n}</li>)}</ul></div>
              )}
            </>
          )}
        </div>
      )}

      {step === 'assets' && isDevice && (
        <div className="wz-body">
          <div className="wz-head"><h3>Device and screen</h3>
            <button className="link-btn" onClick={addOwnScreen} disabled={!!busy}>Write my own</button></div>
          <p className="small muted" style={{ margin: 0 }}>One device on a flat background. Its screen shows the fix your headline promises. Claude draws it, so there is no photo or AI image.</p>
          <Chat messages={chats.screens} onSend={chatSend('screens', loadScreens)} busy={busy === 'screens'}
            placeholder="Describe the screen you want, e.g. a laptop showing a client onboarding checklist, dark navy background" />
          <div className="wz-ideas text">
            {screens.map((x, i) => (
              <div key={i} className={`wz-idea ${screenAt === i ? 'on wide' : ''}`} onClick={() => setScreenAt(i)} role="radio" aria-checked={screenAt === i} tabIndex={0}
                onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) setScreenAt(i); }}>
                <span className="wz-card-top">
                  <span className="chip">{DEVICE_LABEL[x.device] || x.device} · {SIDE_SHORT[x.device_side] || x.device_side}</span>
                  {x.background_hex && <span className="wz-swatch" style={{ background: x.background_hex }} title={x.background_hex} />}
                </span>
                <strong>{x.idea}</strong>
                {screenAt === i ? (
                  <div className="wz-screen-edit" onClick={(e) => e.stopPropagation()}>
                    <div className="wz-screen-grid">
                      <label className="field"><span>Device</span>
                        <select value={x.device} onChange={(e) => setScreen(i, { device: e.target.value, device_side: e.target.value === 'laptop' ? 'below' : x.device_side === 'below' ? 'right' : x.device_side })}>
                          {Object.entries(DEVICE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </label>
                      <label className="field"><span>Position</span>
                        <select value={x.device_side} onChange={(e) => setScreen(i, { device_side: e.target.value })}>
                          {Object.entries(SIDE_LABEL).map(([v, l]) => <option key={v} value={v}>{l[0].toUpperCase() + l.slice(1)}</option>)}
                        </select>
                      </label>
                      <label className="field"><span>Background</span>
                        <span className="wz-color">
                          <input type="color" value={/^#[0-9a-f]{6}$/i.test(x.background_hex || '') ? x.background_hex : '#111111'} onChange={(e) => setScreen(i, { background_hex: e.target.value })} aria-label="Background colour" />
                          <input value={x.background_hex || ''} onChange={(e) => setScreen(i, { background_hex: e.target.value })} placeholder="Claude picks" />
                        </span>
                      </label>
                    </div>
                    <label className="field"><span>App title on the screen</span><input value={x.app_title} onChange={(e) => setScreen(i, { app_title: e.target.value })} placeholder="e.g. Inbox" /></label>
                    <label className="field"><span>On the screen (one line per item, top to bottom)</span>
                      <textarea rows={5} value={x.elementsText} onChange={(e) => setScreen(i, { elementsText: e.target.value })} placeholder={'Missed call: Sam (555) 014-2290, 7:40pm\nTexted back: Sorry we missed you, want to book?'} />
                    </label>
                  </div>
                ) : (
                  <small>{x.app_title ? `${x.app_title}: ` : ''}{(x.elementsText || '').split('\n').filter(Boolean).join(' · ')}</small>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'assets' && !isDevice && (
        <div className="wz-body">
          <div className="wz-head"><h3>Choose the visual</h3>
            {brand?.logo_url
              ? <span className="wz-logo">Logo added automatically <img src={brand.logo_url} alt="" style={{ background: brand.colors?.deep || '#111' }} /></span>
              : <span className="muted small">No logo in the brand kit, so the brand name is used as a wordmark</span>}
          </div>
          <div className="segmented three" role="radiogroup" aria-label="Visual">
            <button role="radio" aria-checked={visual === 'both'} className={visual === 'both' ? 'on' : ''} onClick={() => chooseVisual('both')} disabled={!aiImages}>
              <strong>Photo + AI image</strong><small>{aiImages ? 'Brand photo in the background, AI image on top' : 'Needs OPENAI_API_KEY'}</small>
            </button>
            <button role="radio" aria-checked={visual === 'ai'} className={visual === 'ai' ? 'on' : ''} onClick={() => chooseVisual('ai')} disabled={!aiImages}>
              <strong>AI image only</strong><small>{aiImages ? 'No photo' : 'Needs OPENAI_API_KEY'}</small>
            </button>
            <button role="radio" aria-checked={visual === 'photo'} className={visual === 'photo' ? 'on' : ''} onClick={() => chooseVisual('photo')}>
              <strong>Photo only</strong><small>No AI image</small>
            </button>
          </div>

          {usesAi && (
            <>
              <div className="wz-head"><h4>{visual === 'both' ? 'AI image on top' : 'AI image'} <small className="muted">made when the creative is generated</small></h4>
                <button className="link-btn" onClick={addOwnIdea} disabled={!!busy}>Write my own</button></div>
              <Chat messages={chats.assets} onSend={chatSend('assets', loadIdeas)} busy={busy === 'assets'}
                placeholder="Describe the image you want, e.g. a 3D phone with three missed calls in brand purple" />
              <div className="wz-ideas text">
                {ideas.map((x, i) => (
                  <div key={i} className={`wz-idea ${ideaAt === i ? 'on' : ''}`} onClick={() => setIdeaAt(i)} role="radio" aria-checked={ideaAt === i} tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIdeaAt(i); }}>
                    <span className="chip">{VISUAL_LABEL[x.visual_type] || x.visual_type} · {x.shape}</span>
                    <strong>{x.idea}</strong>
                    {ideaAt === i
                      ? <textarea rows={4} value={x.prompt} onChange={(e) => setIdea(i, { prompt: e.target.value })} aria-label="Image description" placeholder="Describe the image: e.g. glossy 3D phone showing 3 missed calls, brand purple, plain background" />
                      : <small>{x.prompt}</small>}
                  </div>
                ))}
              </div>
            </>
          )}

          {usesPhoto && (
            <>
              <div className="wz-head"><h4>{visual === 'both' ? 'Background photo' : 'Photo'}</h4></div>
              <div className="thumbs wz-photos">
                {brandImages.map((im) => (
                  <button key={im.url} className={`thumb ${photoUrl === im.url ? 'on' : ''}`} onClick={() => setPhotoUrl(im.url)}>
                    <img src={im.url} alt={im.label || 'Brand photo'} />
                  </button>
                ))}
                {photoUrl && !brandImages.some((im) => im.url === photoUrl) && (
                  <button className="thumb on"><img src={photoUrl} alt="Uploaded" /></button>
                )}
                <label className="thumb add">
                  <input type="file" accept="image/*" onChange={(e) => uploadOwn(e.target.files[0])} aria-label="Upload a photo" />
                  <span>+ Upload</span>
                </label>
              </div>
              {!usesAi && busy && <Loading text={busy} />}
            </>
          )}
        </div>
      )}

      {step === 'generate' && (
        <div className="wz-body wz-review">
          <div className="wz-review-img">
            {usesPhoto && photoUrl ? <img src={photoUrl} alt="Chosen photo" /> : null}
            {usesAi && idea && <div className={`wz-review-idea ${usesPhoto ? 'over' : ''}`}><span className="chip">AI {VISUAL_LABEL[idea.visual_type] || 'image'}</span><strong>{idea.idea}</strong></div>}
            {isDevice && screen && (
              <div className="wz-review-device" style={isHex(screen.background_hex) ? { background: screen.background_hex, color: lightHex(screen.background_hex) ? '#111' : '#fff' } : undefined}>
                <span className="chip">{DEVICE_LABEL[screen.device]} · {SIDE_SHORT[screen.device_side]}</span>
                <strong>{screen.app_title || screen.idea}</strong>
                <ul>{(screen.elementsText || '').split('\n').filter(Boolean).map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}
            {!isDevice && !usesPhoto && !usesAi && <span className="muted small">No image</span>}
          </div>
          <div>
            <h3>{content.headline}</h3>
            {!isDevice && content.support && <p>{content.support}</p>}
            {!isDevice && content.bulletsText && <ul>{content.bulletsText.split('\n').filter(Boolean).map((t, i) => <li key={i}>{t}</li>)}</ul>}
            {!isDevice && content.extra && <p><strong>{content.extra}</strong></p>}
            {isDevice && content.proof_line && <p className="small">🛡 {content.proof_line}</p>}
            {isDevice && content.bonus_pill && <p className="small"><span className="chip">{content.bonus_pill}</span></p>}
            {content.cta && <span className="wz-cta">{content.cta}</span>}
            <label className="field wz-design-prompt"><span>Prompt for the design (optional)</span>
              <textarea rows={2} value={designNotes} onChange={(e) => setDesignNotes(e.target.value)}
                placeholder={isDevice ? 'e.g. light cream background, phone on the left, accent words underlined' : 'e.g. dark background, the hook huge at the top, calendar on the right'} />
            </label>
            <p className="small muted" style={{ marginTop: 8 }}>
              {isDevice ? 'Claude will draw the device and screen on a flat background, with your copy, logo, website and email' : design === 'free' ? 'Claude will design the layout around this copy, image and logo' : 'The classic card will use this copy, image and logo'}
              {count > 1 ? `, in ${count} different versions` : ''}{format === 'both' ? ', each in 4:5 and 9:16.' : '.'} {FORMAT_LABEL[format]} · {brand?.name} · For {source === 'agency' ? 'agency owners' : 'business owners'}
              {visual === 'both' ? ' · Photo in the background, AI image on top' : ''}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
