'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/client/api';
import CreativeCard from './CreativeCard.jsx';
import CreativeDetail from './CreativeDetail.jsx';
import { toast } from './Toasts.jsx';
import { IconStar } from './Icons.jsx';

const IconPlus = () => <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>;

const SUBTABS = [
  ['all', 'All'],
  ['agency', 'Agency owners'],
  ['owner', 'Business owners'],
];

export default function CreativesPage({ brands, version, onGenerate, onGoBrands }) {
  const [sub, setSub] = useState('all');
  const [brandId, setBrandId] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const timer = useRef(null);

  const brandById = useMemo(() => Object.fromEntries(brands.map((b) => [b.id, b])), [brands]);

  const load = useCallback(async (quiet) => {
    if (!quiet) setLoading(true);
    try {
      const list = await api.listCreatives({ brand_id: brandId || undefined, source: sub === 'all' ? undefined : sub });
      setItems(list);
      setOpen((o) => (o ? list.find((c) => c.id === o.id) || null : o));
    } catch (e) { if (!quiet) toast(`Couldn't load creatives: ${e.message}`, 'error'); }
    finally { setLoading(false); }
  }, [brandId, sub]);

  useEffect(() => { load(); }, [load, version]);

  // Poll while anything is still generating.
  useEffect(() => {
    clearTimeout(timer.current);
    if (items.some((c) => c.status === 'generating')) timer.current = setTimeout(() => load(true), 4000);
    return () => clearTimeout(timer.current);
  }, [items, load]);

  const counts = useMemo(() => ({
    agency: items.filter((c) => c.source === 'agency').length,
    owner: items.filter((c) => c.source === 'owner').length,
  }), [items]);

  const shown = items.filter((c) => !favOnly || c.concept?.favorite);
  const favCount = items.filter((c) => c.concept?.favorite).length;

  const remove = async (c) => {
    setItems((list) => list.filter((x) => x.id !== c.id));
    try { await api.deleteCreative(c.id); setOpen(null); toast('Creative deleted'); }
    catch (e) { toast(e.message, 'error'); load(true); }
  };
  const favorite = async (c, on) => {
    const patch = (x) => (x.id === c.id ? { ...x, concept: { ...(x.concept || {}), favorite: on } } : x);
    setItems((list) => list.map(patch));
    setOpen((o) => (o ? patch(o) : o));
    try { await api.favoriteCreative(c.id, on); toast(on ? 'Added to favorites' : 'Removed from favorites'); }
    catch (e) { toast(e.message, 'error'); load(true); }
  };

  if (!brands.length && !loading) {
    return (
      <div className="page"><div className="empty">
        <h3>Start with a brand</h3>
        <p>Creatives follow a brand kit, so add a brand first.</p>
        <button className="btn primary" onClick={onGoBrands}>Go to Brands</button>
      </div></div>
    );
  }

  return (
    <section className="page">
      <div className="page-head">
        <h1>Creatives</h1>
        <button className="btn primary lg" onClick={onGenerate}><IconPlus /> New creatives</button>
      </div>

      <div className="filters">
        <div className="seg" role="tablist" aria-label="Audience">
          {SUBTABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={sub === k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>
              {label}{sub === 'all' && k !== 'all' && counts[k] ? <span className="count">{counts[k]}</span> : null}
            </button>
          ))}
        </div>
        <select value={brandId} onChange={(e) => setBrandId(e.target.value)} aria-label="Filter by brand">
          <option value="">All brands</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button className={`btn fav-filter ${favOnly ? 'on' : ''}`} onClick={() => setFavOnly((v) => !v)} aria-pressed={favOnly}>
          <IconStar filled={favOnly} /> Favorites{favCount ? <span className="count">{favCount}</span> : null}
        </button>
      </div>

      {loading && !items.length ? <div className="empty">Loading creatives…</div> : null}
      {!loading && !shown.length ? (
        <div className="empty">
          <h3>{favOnly ? 'No favorites here yet' : 'No creatives here yet'}</h3>
          <p>{favOnly ? 'Tap the star on a creative to add it to your favorites.' : 'Make your first ones: pick a brand and Claude suggests angles, hooks and visuals.'}</p>
          <button className="btn primary" onClick={onGenerate}><IconPlus /> New creatives</button>
        </div>
      ) : null}

      <div className="creative-grid">
        {shown.map((c) => (
          <CreativeCard key={c.id} creative={c} brand={brandById[c.brand_id]} onOpen={() => setOpen(c)}
            onFavorite={(on) => favorite(c, on)} onDelete={() => remove(c)} />
        ))}
      </div>

      {open && (
        <CreativeDetail creative={open} brand={brandById[open.brand_id]} onClose={() => setOpen(null)}
          onDelete={() => remove(open)} onFavorite={(on) => favorite(open, on)} onSaved={() => load(true)} />
      )}
    </section>
  );
}
