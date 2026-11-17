'use client';
import React, { useEffect, useMemo, useState } from 'react';
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
const VISUAL_LABEL = { photo: 'Realistic photo', object: '3D icon or object', illustration: 'Illustration' };

function Loading({ text }) {
  return <div className="wz-loading"><span className="spinner dark" aria-hidden="true" /><span>{text}</span></div>;
}

/** The prompt field at the top of each step: tell Claude what you want, then generate. */
function PromptBar({ value, onChange, onGo, onMore, busy, placeholder, label = 'Generate', moreLabel = 'Add more' }) {
  return (
    <div className="wz-prompt">
      <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !busy) { e.preventDefault(); onGo(); } }} aria-label="Prompt for this step" />
      <div className="wz-prompt-actions">
        <button className="btn primary sm" onClick={onGo} disabled={!!busy}><IconSpark /> {label}</button>
        {onMore && <button className="btn ghost sm" onClick={onMore} disabled={!!busy}>{moreLabel}</button>}
      </div>
    </div>
  );
}

export default function CreateWizard({ brands, initialBrandId, settings, onClose, onDone }) {
  // Setup
  const [brandId, setBrandId] = useState(initialBrandId || brands[0]?.id || '');
  const [mode, setMode] = useState('random');
  const [prompt, setPrompt] = useState('');
  const [method, setMethod] = useState('presold');
  const [stage, setStage] = useState('auto');
  const [format, setFormat] = useState('1:1');
  const [design, setDesign] = useState('free');
  const [count, setCount] = useState(1);
  const [source, setSource] = useState(''); // asked first: owner or agency
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
  const [dir, setDir] = useState({ angles: '', hooks: '', content: '', assets: '', design: '' });
  const setDirFor = (k, v) => setDir((d) => ({ ...d, [k]: v }));

  const brand = brands.find((b) => b.id === brandId);
  const brandImages = (brand?.brand_images || []).filter((im) => /^https?:\/\//.test(im.url || ''));
  const steps = mode === 'random' ? ['setup', 'angle', 'hook', 'content', 'assets', 'generate'] : ['setup', 'hook', 'content', 'assets', 'generate'];
  const LABEL = { setup: 'Setup', angle: 'Angle', hook: 'Hook', content: 'Content', assets: 'Assets', generate: 'Generate' };
  const at = steps.indexOf(step);

  const ask = async (body, label) => {
    setBusy(label);
    try { return await api.wizard({ brand_id: brandId, method, stage, format, ...body }); }
    catch (e) { toast(e.message, 'error'); return null; }
    finally { setBusy(''); }
  };

  // In Random mode the optional setup prompt steers every step, together with the step's own prompt.
  const withSetup = (d) => [mode === 'random' ? prompt.trim() : '', String(d || '').trim()].filter(Boolean).join('\nAlso: ');
  // more: add to the list; otherwise replace it. The step's prompt is always sent.
  const loadAngles = async (more, direction = '') => {
    const r = await ask({ step: 'angles', direction: withSetup(direction), avoid: angles.map((a) => a.title) }, direction ? 'Finding new angles with your direction…' : 'Finding angles for this brand…');
    if (r) { setAngles(more ? [...angles, ...r.angles] : r.angles); if (!more && !ownAngle) setAngle(null); }
  };
  const loadHooks = async (more, direction = '') => {
    const r = await ask({ step: 'hooks', direction: withSetup(direction), angle: mode === 'random' ? angle : null, prompt: mode === 'prompt' ? prompt : '', avoid: hooks.map((h) => h.text) }, 'Writing 15 hooks…');
    if (r) setHooks(more ? [...hooks, ...r.hooks] : r.hooks);
  };
  const loadContent = async (direction = '') => {
    const r = await ask({ step: 'content', direction: withSetup(direction), angle: mode === 'random' ? angle : null, prompt: mode === 'prompt' ? prompt : '', hook }, 'Writing the creative copy…');
    if (r) {
      // The headline starts as the hook the person picked; they can still edit it here.
      setContent({ ...r.content, headline: hook.trim() || r.content.headline, bulletsText: (r.content.bullets || []).join('\n') });
    }
  };
  const loadIdeas = async (direction = '', forVisual = visual) => {
    const r = await ask({
      step: 'assets', direction: withSetup(direction), visual: forVisual, angle: mode === 'random' ? angle : null, prompt: mode === 'prompt' ? prompt : '', hook,
      copy: content ? { headline: content.headline, support: content.support, extra: content.extra } : null,
      avoid: direction ? [] : ideas.map((x) => x.idea),
    }, 'Suggesting visual assets…');
    if (r) { setIdeas(r.ideas); setIdeaAt(-1); setIdeasFor(contentKey); }
  };

  // Each step remembers what it was made for, so going Back and Next again keeps
  // suggestions unless the choice they depend on changed.
  const [madeFor, setMadeFor] = useState({});
  const setupKey = `${brandId}|${mode}|${prompt}|${method}|${stage}|${format}`;
  const hookKey = `${setupKey}|${mode === 'random' ? JSON.stringify(angle) : ''}`;
  const contentKey = `${hookKey}|${hook}`;
  const canNext = {
    angle: !!angle?.title?.trim(),
    hook: !!hook.trim(),
    content: !!content?.headline?.trim(),
    setup: !!brandId && !!source && (mode === 'random' || prompt.trim()),
    assets: visual === 'none' || ((visual === 'photo' || visual === 'both') ? !!photoUrl : true) && ((visual === 'ai' || visual === 'both') ? !!ideas[ideaAt]?.prompt?.trim() : true),
  }[step];

  const next = () => {
    if (!canNext) return toast('Choose or write something first', 'error');
    const n = steps[at + 1];
    if (n === 'angle' && madeFor.angles !== setupKey) { setAngles([]); setAngle(null); setMadeFor((m) => ({ ...m, angles: setupKey })); loadAngles(false); }
    if (n === 'hook' && madeFor.hooks !== hookKey) { setHooks([]); setHook(''); setMadeFor((m) => ({ ...m, hooks: hookKey })); loadHooks(false); }
    if (n === 'content' && madeFor.content !== contentKey) { setContent(null); setMadeFor((m) => ({ ...m, content: contentKey })); loadContent(); }
    if (n === 'assets') {
      const v = visual || (aiImages && brandImages.length ? 'both' : aiImages ? 'ai' : brandImages.length ? 'photo' : 'none');
      setVisual(v);
      if ((v === 'ai' || v === 'both') && ideasFor !== contentKey) { setIdeas([]); loadIdeas('', v); }
    }
    setStep(n);
  };
  const back = () => setStep(steps[Math.max(0, at - 1)]);

  const chooseVisual = (v) => {
    setVisual(v);
    if ((v === 'ai' || v === 'both') && ideasFor !== contentKey && !busy) { setIdeas([]); loadIdeas('', v); }
  };
  const setIdea = (i, patch) => setIdeas((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addOwnIdea = () => { setIdeas((list) => [...list, { idea: 'My own idea', visual_type: 'object', shape: 'square', prompt: '' }]); setIdeaAt(ideas.length); };
  const idea = ideas[ideaAt];
  const usesAi = visual === 'ai' || visual === 'both';
  const usesPhoto = visual === 'photo' || visual === 'both';

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
          angle: mode === 'random' ? angle : null, hook, design_notes: dir.design.trim(),
          content: { headline: content.headline, support: content.support, bullets, extra: content.extra, cta: content.cta },
          ad_copy: content.ad_copy, compliance_notes: content.compliance_notes,
          visual: visual || 'none', photo_url: usesPhoto ? photoUrl : '',
          image_prompt: usesAi ? idea?.prompt || '' : '', visual_type: idea?.visual_type || 'object', image_shape: idea?.shape || 'square',
        },
      });
      toast(`Designing ${count > 1 ? `${count} versions` : 'your creative'} for ${brand.name}. It appears in Creatives when ready.`);
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
        ? <button className="btn primary" onClick={generate} disabled={!!busy}><IconSpark /> Generate creative{count > 1 ? 's' : ''}</button>
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
            <h3>Who is this creative for?</h3>
            <div className="segmented" role="radiogroup" aria-label="Who is this creative for">
              <button role="radio" aria-checked={source === 'owner'} className={source === 'owner' ? 'on' : ''} onClick={() => setSource('owner')}>
                <strong>Owner</strong><small>Made by or for the business owner</small>
              </button>
              <button role="radio" aria-checked={source === 'agency'} className={source === 'agency' ? 'on' : ''} onClick={() => setSource('agency')}>
                <strong>Agency</strong><small>Made by the agency{brand?.agency_name ? ` (${brand.agency_name})` : ''}</small>
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
          <details className="wz-more">
            <summary>Options: {method === '100m' ? '$100M Offers' : 'Pre-Sold'} · {format} · {design === 'free' ? 'Free design' : 'Classic card'} · {STAGE_SHORT[stage]} · {count} {count > 1 ? 'layouts' : 'design'}</summary>
            <div className="grid-3">
              <label className="field"><span>Method</span>
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="presold">Pre-Sold (Jeff Miller)</option>
                  <option value="100m">$100M Offers (Hormozi)</option>
                </select>
              </label>
              <label className="field"><span>Format</span>
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="1:1">Square 1:1 (Feed)</option><option value="4:5">Portrait 4:5 (Feed)</option><option value="9:16">Vertical 9:16 (Stories, Reels)</option>
                </select>
              </label>
              <label className="field"><span>Design</span>
                <select value={design} onChange={(e) => setDesign(e.target.value)}>
                  <option value="free">Free design</option><option value="classic">Classic card</option>
                </select>
              </label>
              <label className="field"><span>Awareness stage</span>
                <select value={stage} onChange={(e) => setStage(e.target.value)}>{STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </label>
              <label className="field"><span>Versions</span>
                <select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 1 ? '1 design' : `${n} different layouts`}</option>)}</select>
              </label>
            </div>
          </details>
        </div>
      )}

      {step === 'angle' && (
        <div className="wz-body">
          <div className="wz-head"><h3>Pick an angle</h3>
            <button className="link-btn" onClick={() => { setOwnAngle(true); setAngle({ title: '', audience: '', insight: '', stage: stage === 'auto' ? 'problem' : stage }); }}>Write my own</button></div>
          <PromptBar value={dir.angles} onChange={(v) => setDirFor('angles', v)} busy={busy}
            onGo={() => loadAngles(false, dir.angles)} onMore={() => loadAngles(true, dir.angles)} label="New angles" moreLabel="Add 5 more"
            placeholder="Prompt for angles, e.g. aim at agency owners who just lost a client" />
          {busy && <Loading text={busy} />}
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
          <PromptBar value={dir.hooks} onChange={(v) => setDirFor('hooks', v)} busy={busy}
            onGo={() => loadHooks(false, dir.hooks)} onMore={() => loadHooks(true, dir.hooks)} label="New hooks" moreLabel="Add more"
            placeholder="Prompt for hooks, e.g. shorter, questions only, lead with the price" />
          {busy && <Loading text={busy} />}
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
          <PromptBar value={dir.content} onChange={(v) => setDirFor('content', v)} busy={busy}
            onGo={() => loadContent(dir.content)} label="Rewrite"
            placeholder="Prompt for the copy, e.g. no bullets, mention the 14-day trial, softer tone" />
          {busy && <Loading text={busy} />}
          {content && (
            <>
              <label className="field"><span>Headline (your hook)</span><input value={content.headline} onChange={(e) => setC('headline', e.target.value)} /></label>
              <label className="field"><span>Support line</span><textarea rows={2} value={content.support} onChange={(e) => setC('support', e.target.value)} /></label>
              <div className="grid-2">
                <label className="field"><span>Bullets (one per line, optional)</span><textarea rows={4} value={content.bulletsText} onChange={(e) => setC('bulletsText', e.target.value)} /></label>
                <div>
                  <label className="field"><span>Extra line (offer, stat or guarantee, optional)</span><input value={content.extra} onChange={(e) => setC('extra', e.target.value)} /></label>
                  <label className="field"><span>Button text</span><input value={content.cta} onChange={(e) => setC('cta', e.target.value)} /></label>
                </div>
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
              {(content.compliance_notes || []).length > 0 && (
                <div className="notice"><strong>Check before running:</strong><ul>{content.compliance_notes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>
              )}
            </>
          )}
        </div>
      )}

      {step === 'assets' && (
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
              <PromptBar value={dir.assets} onChange={(v) => setDirFor('assets', v)} busy={busy}
                onGo={() => loadIdeas(dir.assets)} label="New ideas"
                placeholder="Prompt for the image, e.g. a 3D calendar, or a laptop showing a dashboard" />
              {busy && <Loading text={busy} />}
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
            {!usesPhoto && !usesAi && <span className="muted small">No image</span>}
          </div>
          <div>
            <h3>{content.headline}</h3>
            {content.support && <p>{content.support}</p>}
            {content.bulletsText && <ul>{content.bulletsText.split('\n').filter(Boolean).map((t, i) => <li key={i}>{t}</li>)}</ul>}
            {content.extra && <p><strong>{content.extra}</strong></p>}
            {content.cta && <span className="wz-cta">{content.cta}</span>}
            <label className="field wz-design-prompt"><span>Prompt for the design (optional)</span>
              <textarea rows={2} value={dir.design} onChange={(e) => setDirFor('design', e.target.value)}
                placeholder="e.g. dark background, the hook huge at the top, calendar on the right" />
            </label>
            <p className="small muted" style={{ marginTop: 8 }}>
              {design === 'free' ? 'Claude will design the layout around this copy, image and logo' : 'The classic card will use this copy, image and logo'}
              {count > 1 ? `, in ${count} different layouts.` : '.'} {format} · {brand?.name} · {source === 'agency' ? 'Agency' : 'Owner'}
              {visual === 'both' ? ' · Photo in the background, AI image on top' : ''}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
