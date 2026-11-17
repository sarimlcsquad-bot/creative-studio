'use client';
import React, { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '@/lib/client/api';
import { toast } from './Toasts.jsx';

const STAGES = [
  ['auto', 'Let Claude choose'],
  ['unaware', 'Unaware: scroll-stopping content'],
  ['problem', 'Problem-aware: name the pain'],
  ['solution', 'Solution-aware: old way vs new way'],
  ['product', 'Product-aware: what they get'],
  ['most', 'Most-aware: the offer'],
];

export default function GenerateModal({ brands, initialBrandId, settings, onClose, onDone }) {
  const [brandId, setBrandId] = useState(initialBrandId || brands[0]?.id || '');
  const [mode, setMode] = useState('random');
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(1);
  const [format, setFormat] = useState('1:1');
  const [photoSource, setPhotoSource] = useState('brand');
  const [imageStyle, setImageStyle] = useState('auto');
  const [design, setDesign] = useState('free');
  const [aiImages, setAiImages] = useState(false);
  useEffect(() => { api.config().then((c) => setAiImages(!!c.ai_images)); }, []);
  const [stage, setStage] = useState('auto');
  const [method, setMethod] = useState('presold');
  const [source, setSource] = useState(settings.role || 'owner');
  const [busy, setBusy] = useState(false);

  const brand = brands.find((b) => b.id === brandId);
  const hasBrandImages = (brand?.brand_images || []).length > 0;
  let effSource = photoSource === 'brand' && !hasBrandImages ? (aiImages ? 'ai' : 'none')
    : photoSource === 'ai' && !aiImages ? (hasBrandImages ? 'brand' : 'none') : photoSource;
  if (design !== 'classic' && effSource === 'none' && (aiImages || hasBrandImages)) effSource = aiImages ? 'ai' : 'brand';

  const submit = async () => {
    if (!brandId) return toast('Pick a brand', 'error');
    if (mode === 'prompt' && !prompt.trim()) return toast('Write a prompt, or switch to Random', 'error');
    setBusy(true);
    try {
      await api.generate({
        brand_id: brandId, mode, prompt: mode === 'prompt' ? prompt.trim() : '',
        count, format, photo_source: effSource, image_style: imageStyle, design,
        stage, method, source, created_by: settings.userName || '',
      });
      toast(`Generating ${count} creative${count > 1 ? 's' : ''} for ${brand.name}. They appear as they finish.`);
      onDone();
    } catch (e) { toast(`Couldn't start generation: ${e.message}`, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Generate creatives" onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={submit} disabled={busy}>{busy ? 'Starting…' : `✦ Generate ${count}`}</button>
      </>}>
      <label className="field"><span>Brand</span>
        <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>

      <div className="segmented" role="radiogroup" aria-label="Mode">
        <button role="radio" aria-checked={mode === 'random'} className={mode === 'random' ? 'on' : ''} onClick={() => setMode('random')}>
          <strong>Random</strong><small>Claude picks the angle from the brand kit</small>
        </button>
        <button role="radio" aria-checked={mode === 'prompt'} className={mode === 'prompt' ? 'on' : ''} onClick={() => setMode('prompt')}>
          <strong>With a prompt</strong><small>Add your own direction or extra info</small>
        </button>
      </div>

      {mode === 'prompt' && (
        <label className="field"><span>Prompt</span>
          <textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} autoFocus
            placeholder="e.g. Fall promo: first treatment $49 for new customers. Target homeowners who just found ants in the kitchen. Show a technician at the front door." />
        </label>
      )}

      <label className="field"><span>Method</span>
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="presold">Pre-Sold (Jeff Miller): aim at one person and their awareness stage</option>
          <option value="100m">$100M Offers (Hormozi): value equation and a named offer stack</option>
          <option value="mix">Mix: alternate both methods across the batch</option>
        </select>
      </label>

      <label className="field"><span>Design</span>
        <select value={design} onChange={(e) => setDesign(e.target.value)}>
          <option value="free">Free design: Claude creates its own layout and style for each creative</option>
          <option value="classic">Classic card: headline, checklist and button template</option>
        </select>
        <small>Both use the brand's colours, fonts and logo.</small>
      </label>

      <div className="grid-2">
        <label className="field"><span>How many</span>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select>
        </label>
        <label className="field"><span>Format</span>
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="1:1">Square 1:1 (Feed)</option>
            <option value="4:5">Portrait 4:5 (Feed)</option>
            <option value="9:16">Vertical 9:16 (Stories, Reels)</option>
          </select>
        </label>
        <label className="field"><span>Awareness stage</span>
          <select value={stage} onChange={(e) => setStage(e.target.value)}>{STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        <label className="field"><span>Photo</span>
          <select value={effSource} onChange={(e) => setPhotoSource(e.target.value)}>
            <option value="ai" disabled={!aiImages}>{aiImages ? 'New AI image (GPT)' : 'New AI image (add OPENAI_API_KEY to enable)'}</option>
            <option value="brand" disabled={!hasBrandImages}>{hasBrandImages ? 'Brand photo (Claude picks the best fit)' : 'Brand photo (upload some in the brand kit first)'}</option>
            {design === 'classic' && <option value="none">No photo (text card)</option>}
          </select>
        </label>
      </div>

      {effSource === 'ai' && (
        <label className="field"><span>AI image style</span>
          <select value={imageStyle} onChange={(e) => setImageStyle(e.target.value)}>
            <option value="auto">Let Claude choose</option>
            <option value="object">3D icon or object (calendar, phone, price tag…)</option>
            <option value="illustration">Illustration</option>
            <option value="photo">Realistic photo</option>
          </select>
          <small>Images never contain text; the card draws the words. Adds about 30 to 60 seconds per creative.</small>
        </label>
      )}

      <label className="field"><span>Created as</span>
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="owner">Owner</option>
          <option value="agency">Agency{brand?.agency_name ? ` (${brand.agency_name})` : ''}</option>
        </select>
      </label>
    </Modal>
  );
}
