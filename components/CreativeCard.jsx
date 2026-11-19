'use client';
import React, { useEffect, useRef, useState } from 'react';
import { renderCard, renderToBlob } from '@/lib/client/renderCard';
import { api } from '@/lib/client/api';
import { IconStar, IconTrash } from './Icons.jsx';

export const METHOD_LABEL = { presold: 'Pre-Sold', '100m': '$100M Offers', mix: 'Both methods', both: 'Both methods' };
const STAGE_LABEL = { unaware: 'Unaware', problem: 'Problem-aware', solution: 'Solution-aware', product: 'Product-aware', most: 'Most-aware', auto: 'Auto' };
export { STAGE_LABEL };

const savingRenders = new Set();

// Saves the rendered PNG back to storage once, so the creative has a real file
// (for downloads elsewhere, Meta uploads, sharing).
// Bump RENDER_FOLDER when rendering changes, so saved PNGs made before the change are redone.
const RENDER_FOLDER = 'renders/r2';
async function persistRender(creative, brand) {
  if (creative.rendered_url?.includes(`/${RENDER_FOLDER}/`) || savingRenders.has(creative.id)) return;
  savingRenders.add(creative.id);
  try {
    const blob = await renderToBlob(creative, brand);
    if (!blob) return;
    const file = new File([blob], `${creative.id}.png`, { type: 'image/png' });
    const url = await api.upload(file, `${RENDER_FOLDER}/${creative.brand_id}`);
    await api.updateCreative({ id: creative.id, rendered_url: url });
  } catch { /* retried next time it is shown */ }
  finally { savingRenders.delete(creative.id); }
}

export default function CreativeCard({ creative, brand, onOpen, onFavorite, onDelete }) {
  const ref = useRef(null);
  const [confirming, setConfirming] = useState(false);
  const fav = !!creative.concept?.favorite;
  useEffect(() => {
    if (creative.status !== 'ready' || !ref.current) return;
    renderCard(ref.current, creative, brand).then(() => persistRender(creative, brand)).catch(() => {});
  }, [creative, brand]);

  const date = new Date(creative.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <article className={`creative-card ${creative.status} ${fav ? 'fav' : ''}`}>
      <div className="card-actions">
        {creative.status !== 'generating' && (
          <button className={`icon-btn star ${fav ? 'on' : ''}`} onClick={() => onFavorite(!fav)} aria-pressed={fav}
            aria-label={fav ? 'Remove from favorites' : 'Add to favorites'} title={fav ? 'Remove from favorites' : 'Add to favorites'}><IconStar filled={fav} /></button>
        )}
        <button className="icon-btn" onClick={() => setConfirming(true)} aria-label="Delete creative" title="Delete"><IconTrash /></button>
      </div>
      {confirming && (
        <div className="card-confirm" role="alertdialog" aria-label="Delete this creative?">
          <strong>Delete this creative?</strong>
          <span>This can't be undone.</span>
          <div className="row-gap">
            <button className="btn ghost sm" onClick={() => setConfirming(false)} autoFocus>Keep it</button>
            <button className="btn danger-fill sm" onClick={() => { setConfirming(false); onDelete(); }}>Delete</button>
          </div>
        </div>
      )}
      <button className="creative-thumb" onClick={onOpen} disabled={creative.status === 'generating'} aria-label={`Open creative for ${brand?.name || "brand"}`}>
        {creative.status === 'ready' && <canvas ref={ref} />}
        {creative.status === 'generating' && (
          <div className="generating"><span className="dots" aria-hidden="true"><span /><span /><span /></span><span>Making it…</span><small>Usually under two minutes</small></div>
        )}
        {creative.status === 'failed' && (
          <div className="failed-box"><strong>Generation failed</strong><small>{creative.error || 'Unknown error'}</small></div>
        )}
      </button>
      <div className="creative-meta">
        <strong>{brand?.name || 'Unknown brand'}</strong>
        <span className="muted small">{creative.format} · {date}</span>
      </div>
    </article>
  );
}
