'use client';
import React, { useEffect, useRef } from 'react';
import { renderCard, renderToBlob } from '@/lib/client/renderCard';
import { api } from '@/lib/client/api';

export const METHOD_LABEL = { presold: 'Pre-Sold', '100m': '$100M Offers', mix: 'Mix' };
const STAGE_LABEL = { unaware: 'Unaware', problem: 'Problem-aware', solution: 'Solution-aware', product: 'Product-aware', most: 'Most-aware', auto: 'Auto' };
export { STAGE_LABEL };

const savingRenders = new Set();

// Saves the rendered PNG back to storage once, so the creative has a real file
// (for downloads elsewhere, Meta uploads, sharing).
async function persistRender(creative, brand) {
  if (creative.rendered_url || savingRenders.has(creative.id)) return;
  savingRenders.add(creative.id);
  try {
    const blob = await renderToBlob(creative, brand);
    if (!blob) return;
    const file = new File([blob], `${creative.id}.png`, { type: 'image/png' });
    const url = await api.upload(file, `renders/${creative.brand_id}`);
    await api.updateCreative({ id: creative.id, rendered_url: url });
  } catch { /* retried next time it is shown */ }
  finally { savingRenders.delete(creative.id); }
}

export default function CreativeCard({ creative, brand, onOpen }) {
  const ref = useRef(null);
  useEffect(() => {
    if (creative.status !== 'ready' || !ref.current) return;
    renderCard(ref.current, creative, brand).then(() => persistRender(creative, brand)).catch(() => {});
  }, [creative, brand]);

  const date = new Date(creative.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const stage = creative.concept?.stage || creative.stage;
  const method = creative.concept?.method || creative.method;

  return (
    <article className={`creative-card ${creative.status}`}>
      <button className="creative-thumb" onClick={onOpen} disabled={creative.status === 'generating'} aria-label="Open creative">
        {creative.status === 'ready' && <canvas ref={ref} />}
        {creative.status === 'generating' && (
          <div className="generating"><span className="spinner" aria-hidden="true" /><span>Generating…</span><small>Claude is writing it. Usually under two minutes.</small></div>
        )}
        {creative.status === 'failed' && (
          <div className="failed-box"><strong>Generation failed</strong><small>{creative.error || 'Unknown error'}</small></div>
        )}
      </button>
      <div className="creative-meta">
        <div className="chips">
          <span className={`chip src-${creative.source}`}>{creative.source === 'agency' ? 'Agency' : 'Owner'}</span>
          {method && <span className="chip method">{METHOD_LABEL[method] || method}</span>}
          {stage && <span className="chip">{STAGE_LABEL[stage] || stage}</span>}
          <span className="chip">{creative.format}</span>
        </div>
        <div className="creative-line">
          <strong>{brand?.name || 'Unknown brand'}</strong>
          <span className="muted small">{creative.created_by ? `${creative.created_by} · ` : ''}{date}</span>
        </div>
        {creative.mode === 'prompt' && creative.prompt && <p className="small muted clamp">“{creative.prompt}”</p>}
      </div>
    </article>
  );
}
