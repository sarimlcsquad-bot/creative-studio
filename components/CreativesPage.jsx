'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/client/api';
import CreativeCard from './CreativeCard.jsx';
import CreativeDetail from './CreativeDetail.jsx';
import { toast } from './Toasts.jsx';
import { IconSpark } from './Icons.jsx';

const SUBTABS = [
  ['all', 'All creatives'],
  ['agency', 'Agency creatives'],
  ['owner', 'Owner creatives'],
];

export default function CreativesPage({ brands, version, onGenerate, onGoBrands }) {
  const [sub, setSub] = useState('all');
  const [brandId, setBrandId] = useState('');
  const [status, setStatus] = useState('');
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

  const shown = items.filter((c) => !status || c.status === status);

  const remove = async (c) => {
    if (!window.confirm('Delete this creative?')) return;
    try { await api.deleteCreative(c.id); setOpen(null); load(true); toast('Creative deleted'); }
    catch (e) { toast(e.message, 'error'); }
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
        <div>
          <h1>Creatives</h1>
          <p className="muted">Every creative made for every brand, by agencies and owners.</p>
        </div>
        <div className="row-gap center">
          <button className="btn primary" onClick={onGenerate}><IconSpark /> Generate</button>
        </div>
      </div>

      <div className="subtabs" role="tablist">
        {SUBTABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={sub === k} className={sub === k ? 'active' : ''} onClick={() => setSub(k)}>
            {label}{sub === 'all' && k !== 'all' ? <span className="count">{counts[k]}</span> : null}
          </button>
        ))}
      </div>

      <div className="filters">
        <select value={brandId} onChange={(e) => setBrandId(e.target.value)} aria-label="Filter by brand">
          <option value="">All brands</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">Any status</option>
          <option value="ready">Ready</option>
          <option value="generating">Generating</option>
          <option value="failed">Failed</option>
        </select>
        <button className="btn ghost sm" onClick={() => load()}>Refresh</button>
      </div>

      {loading && !items.length ? <div className="empty">Loading creatives…</div> : null}
      {!loading && !shown.length ? (
        <div className="empty">
          <h3>No creatives here yet</h3>
          <p>Generate a random creative for a brand, or describe what you want in a prompt.</p>
          <button className="btn primary" onClick={onGenerate}><IconSpark /> Generate</button>
        </div>
      ) : null}

      <div className="creative-grid">
        {shown.map((c) => (
          <CreativeCard key={c.id} creative={c} brand={brandById[c.brand_id]} onOpen={() => setOpen(c)} />
        ))}
      </div>

      {open && (
        <CreativeDetail creative={open} brand={brandById[open.brand_id]} onClose={() => setOpen(null)}
          onDelete={() => remove(open)} onSaved={() => load(true)} />
      )}
    </section>
  );
}
