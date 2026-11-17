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
  const [source, setSource] = useState(settings.role || 'owner');
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
  const [assetTab, setAssetTab] = useState('ai');
  const [ideas, setIdeas] = useState([]);
  const [asset, setAsset] = useState(null); // {url, source:'ai'|'brand', visual_type, prompt}
  const [previews, setPreviews] = useState({}); // idea index -> url

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

  const loadAngles = async (more) => {
    const r = await ask({ step: 'angles', avoid: more ? angles.map((a) => a.title) : [] }, 'Finding angles for this brand…');
    if (r) setAngles(more ? [...angles, ...r.angles] : r.angles);
  };
  const loadHooks = async (more) => {
    const r = await ask({ step: 'hooks', angle: mode === 'random' ? angle : null, prompt: mode === 'prompt' ? prompt : '', avoid: more ? hooks.map((h) => h.text) : [] }, 'Writing 15 hooks…');
    if (r) setHooks(more ? [...hooks, ...r.hooks] : r.hooks);
  };
  const loadContent = async () => {
    const r = await ask({ step: 'content', angle: mode === 'random' ? angle : null, prompt: mode === 'prompt' ? prompt : '', hook }, 'Writing the creative copy…');
    if (r) {
      // The headline starts as the hook the person picked; they can still edit it here.
      setContent({ ...r.content, headline: hook.trim() || r.content.headline, bulletsText: (r.content.bullets || []).join('\n') });
      setIdeas(r.content.image_ideas || []);
      setPreviews({});
      setAsset(null);
    }
  };

  // Each step remembers what it was made for, so going Back and Next again keeps
  // suggestions unless the choice they depend on changed.
  const [madeFor, setMadeFor] = useState({});
  const setupKey = `${brandId}|${mode}|${prompt}|${method}|${stage}|${format}`;
  const hookKey = `${setupKey}|${mode === 'random' ? JSON.stringify(angle) : ''}`;
  const contentKey = `${hookKey}|${hook}`;
  const canNext = {
    setup: !!brandId && (mode === 'random' || prompt.trim()),
    angle: !!angle?.title?.trim(),
    hook: !!hook.trim(),
    content: !!content?.headline?.trim(),
    assets: !!asset || (!aiImages && !brandImages.length),
  }[step];

  const next = () => {
    if (!canNext) return toast('Choose or write something first', 'error');
    const n = steps[at + 1];
    if (n === 'angle' && madeFor.angles !== setupKey) { setAngles([]); setAngle(null); setMadeFor((m) => ({ ...m, angles: setupKey })); loadAngles(false); }
    if (n === 'hook' && madeFor.hooks !== hookKey) { setHooks([]); setHook(''); setMadeFor((m) => ({ ...m, hooks: hookKey })); loadHooks(false); }
    if (n === 'content' && madeFor.content !== contentKey) { setContent(null); setMadeFor((m) => ({ ...m, content: contentKey })); loadContent(); }
    if (n === 'assets' && !asset) setAssetTab(aiImages ? 'ai' : 'brand');
    setStep(n);
  };
  const back = () => setStep(steps[Math.max(0, at - 1)]);

  const makePreview = async (i) => {
    const idea = ideas[i];
    setBusy(`Generating the image… about 30 to 60 seconds`);
    try {
      const { url } = await api.wizard({ step: 'image', prompt: idea.prompt, shape: idea.shape });
      setPreviews((p) => ({ ...p, [i]: url }));
      setAsset({ url, source: 'ai', visual_type: idea.visual_type, prompt: idea.prompt });
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(''); }
  };

  const uploadOwn = async (file) => {
    if (!file) return;
    setBusy('Uploading…');
    try {
      const url = await api.upload(file, 'brand-images');
      setAsset({ url, source: 'brand', visual_type: 'photo', prompt: '' });
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(''); }
  };

  const generate = async () => {
    setBusy('Starting…');
    try {
      const bullets = (content.bulletsText || '').split('\n').map((t) => t.trim()).filter(Boolean);
      await api.generate({
        brand_id: brandId, mode, prompt: mode === 'prompt' ? prompt.trim() : '', count, format, design, method,
        stage: angle?.stage || stage, source, created_by: settings.userName || '',
        photo_source: asset ? asset.source : 'none',
        brief: {
          angle: mode === 'random' ? angle : null, hook,
          content: { headline: content.headline, support: content.support, bullets, extra: content.extra, cta: content.cta },
          ad_copy: content.ad_copy, compliance_notes: content.compliance_notes,
          photo_url: asset?.url || '', asset_source: asset?.source, image_prompt: asset?.prompt || '', visual_type: asset?.visual_type,
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
    mode === 'random' && angle ? ['Angle', angle.title] : mode === 'prompt' ? ['Prompt', prompt] : null,
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
          <label className="field"><span>Brand</span>
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          </label>
          <div className="segmented" role="radiogroup" aria-label="Start from">
            <button role="radio" aria-checked={mode === 'random'} className={mode === 'random' ? 'on' : ''} onClick={() => setMode('random')}>
              <strong>Random</strong><small>Claude suggests angles, then hooks, from the brand kit</small>
            </button>
            <button role="radio" aria-checked={mode === 'prompt'} className={mode === 'prompt' ? 'on' : ''} onClick={() => setMode('prompt')}>
              <strong>With a prompt</strong><small>Your direction; Claude suggests hooks for it</small>
            </button>
          </div>
          {mode === 'prompt' && (
            <label className="field"><span>Prompt</span>
              <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} autoFocus
                placeholder="e.g. Fall promo: first treatment $49 for new customers. Homeowners who just found ants in the kitchen." />
            </label>
          )}
          <div className="grid-2">
            <label className="field"><span>Method</span>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="presold">Pre-Sold (Jeff Miller)</option>
                <option value="100m">$100M Offers (Hormozi)</option>
              </select>
            </label>
            <label className="field"><span>Awareness stage</span>
              <select value={stage} onChange={(e) => setStage(e.target.value)}>{STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <label className="field"><span>Format</span>
              <select value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="1:1">Square 1:1 (Feed)</option><option value="4:5">Portrait 4:5 (Feed)</option><option value="9:16">Vertical 9:16 (Stories, Reels)</option>
              </select>
            </label>
            <label className="field"><span>Design</span>
              <select value={design} onChange={(e) => setDesign(e.target.value)}>
                <option value="free">Free design (Claude creates the layout)</option><option value="classic">Classic card template</option>
              </select>
            </label>
            <label className="field"><span>Versions</span>
              <select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 1 ? '1 design' : `${n} different layouts`}</option>)}</select>
            </label>
            <label className="field"><span>Created as</span>
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="owner">Owner</option><option value="agency">Agency{brand?.agency_name ? ` (${brand.agency_name})` : ''}</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {step === 'angle' && (
        <div className="wz-body">
          <div className="wz-head"><h3>Pick an angle</h3>
            <div className="row-gap"><button className="btn ghost sm" onClick={() => { setOwnAngle(true); setAngle({ title: '', audience: '', insight: '', stage: stage === 'auto' ? 'problem' : stage }); }}>Write my own</button>
              <button className="btn outline sm" onClick={() => loadAngles(true)} disabled={!!busy}>More angles</button></div></div>
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
                <span className="chip">{STAGE_SHORT[a.stage] || a.stage}</span>
                <strong>{a.title}</strong>
                <small><b>For:</b> {a.audience}</small>
                <small>{a.insight}</small>
              </button>
            ))}
          </div>
          {busy && <Loading text={busy} />}
        </div>
      )}

      {step === 'hook' && (
        <div className="wz-body">
          <div className="wz-head"><h3>Pick a hook</h3><button className="btn outline sm" onClick={() => loadHooks(true)} disabled={!!busy}>More hooks</button></div>
          <div className="wz-hooks">
            {hooks.map((h, i) => (
              <button key={i} className={`wz-hook ${hook === h.text ? 'on' : ''}`} onClick={() => setHook(h.text)}>
                <span className="wz-num">{i + 1}</span><span className="wz-hook-text">{h.text}</span><span className="chip">{h.style}</span>
              </button>
            ))}
          </div>
          {busy && <Loading text={busy} />}
          <label className="field wz-edit"><span>Your hook (edit it, or write your own)</span>
            <input value={hook} onChange={(e) => setHook(e.target.value)} placeholder="Pick one above or type a hook" />
          </label>
        </div>
      )}

      {step === 'content' && (
        <div className="wz-body">
          <div className="wz-head"><h3>What goes on the creative</h3><button className="btn outline sm" onClick={loadContent} disabled={!!busy}>Rewrite</button></div>
          {busy && <Loading text={busy} />}
          {content && (
            <>
              <label className="field"><span>Hook / headline</span><input value={content.headline} onChange={(e) => setC('headline', e.target.value)} /></label>
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
          <div className="wz-head"><h3>Choose the visual asset</h3>
            {brand?.logo_url
              ? <span className="wz-logo">Logo added automatically <img src={brand.logo_url} alt="" style={{ background: brand.colors?.deep || '#111' }} /></span>
              : <span className="muted small">No logo in the brand kit, so the brand name is used as a wordmark</span>}
          </div>
          <div className="subtabs">
            <button className={assetTab === 'ai' ? 'active' : ''} onClick={() => setAssetTab('ai')} disabled={!aiImages}>AI image{aiImages ? '' : ' (add OPENAI_API_KEY)'}</button>
            <button className={assetTab === 'brand' ? 'active' : ''} onClick={() => setAssetTab('brand')}>Brand photos</button>
          </div>
          {assetTab === 'ai' && (
            <div className="wz-ideas">
              {ideas.map((idea, i) => (
                <div key={i} className={`wz-idea ${asset?.url && asset.url === previews[i] ? 'on' : ''}`}>
                  <div className="wz-idea-img">
                    {previews[i]
                      ? <button onClick={() => setAsset({ url: previews[i], source: 'ai', visual_type: idea.visual_type, prompt: idea.prompt })}><img src={previews[i]} alt={idea.idea} /></button>
                      : <span className="muted small">{VISUAL_LABEL[idea.visual_type]} · {idea.shape}</span>}
                  </div>
                  <strong>{idea.idea}</strong>
                  <textarea rows={3} value={idea.prompt} onChange={(e) => setIdeas((list) => list.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))} aria-label="Image prompt" />
                  <button className="btn outline sm" onClick={() => makePreview(i)} disabled={!!busy}>{previews[i] ? 'Regenerate' : 'Generate image'}</button>
                </div>
              ))}
            </div>
          )}
          {assetTab === 'brand' && (
            <div className="thumbs wz-photos">
              {brandImages.map((im) => (
                <button key={im.url} className={`thumb ${asset?.url === im.url ? 'on' : ''}`} onClick={() => setAsset({ url: im.url, source: 'brand', visual_type: 'photo', prompt: '' })}>
                  <img src={im.url} alt={im.label || 'Brand photo'} />
                </button>
              ))}
              {asset?.source === 'brand' && !brandImages.some((im) => im.url === asset.url) && (
                <button className="thumb on"><img src={asset.url} alt="Uploaded" /></button>
              )}
              <label className="thumb add">
                <input type="file" accept="image/*" onChange={(e) => uploadOwn(e.target.files[0])} aria-label="Upload an image" />
                <span>+ Upload</span>
              </label>
            </div>
          )}
          {busy && <Loading text={busy} />}
          {asset && <p className="small muted">Selected: {asset.source === 'ai' ? 'AI image' : 'brand photo'}.</p>}
        </div>
      )}

      {step === 'generate' && (
        <div className="wz-body wz-review">
          <div className="wz-review-img">{asset ? <img src={asset.url} alt="Chosen asset" /> : <span className="muted small">No image</span>}</div>
          <div>
            <h3>{content.headline}</h3>
            {content.support && <p>{content.support}</p>}
            {content.bulletsText && <ul>{content.bulletsText.split('\n').filter(Boolean).map((t, i) => <li key={i}>{t}</li>)}</ul>}
            {content.extra && <p><strong>{content.extra}</strong></p>}
            {content.cta && <span className="wz-cta">{content.cta}</span>}
            <p className="small muted" style={{ marginTop: 16 }}>
              {design === 'free' ? 'Claude will design the layout around this copy, image and logo' : 'The classic card will use this copy, image and logo'}
              {count > 1 ? `, in ${count} different layouts.` : '.'} {format} · {brand?.name}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
