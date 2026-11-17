'use client';
import React, { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import BrandForm from './BrandForm.jsx';
import { toast } from './Toasts.jsx';
import { IconPlus } from './Icons.jsx';

export default function BrandsPage({ brands, loading, onChanged, onGenerate }) {
  const [selected, setSelected] = useState(null); // brand id | 'new' | null

  useEffect(() => {
    if (selected === 'new') return;
    if (!selected || !brands.some((b) => b.id === selected)) setSelected(brands[0]?.id || null);
  }, [brands, selected]);

  const remove = async (b) => {
    if (!window.confirm(`Delete ${b.name} and all of its creatives? This can't be undone.`)) return;
    try { await api.deleteBrand(b.id); toast(`${b.name} deleted`); setSelected(null); onChanged(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const current = selected === 'new' ? {} : brands.find((b) => b.id === selected);

  return (
    <div className="split">
      <aside className="subnav" aria-label="Brands">
        <div className="subnav-head">
          <span>Brands</span>
          <span className="muted small">{brands.length}</span>
        </div>
        <button className={`subnav-item new ${selected === 'new' ? 'active' : ''}`} onClick={() => setSelected('new')}>
          <span className="subnav-plus"><IconPlus /></span> New brand
        </button>
        <div className="subnav-list">
          {loading && !brands.length && <p className="muted small pad">Loading…</p>}
          {brands.map((b) => (
            <button key={b.id} className={`subnav-item ${selected === b.id ? 'active' : ''}`} onClick={() => setSelected(b.id)}>
              <span className="brand-dot" style={{ background: b.colors?.deep || '#111', boxShadow: `inset -6px -6px 0 ${b.colors?.accent || '#888'}` }} />
              <span className="subnav-text"><strong>{b.name}</strong><small>{b.industry}</small></span>
            </button>
          ))}
        </div>
      </aside>

      <section className="page">
        {current ? (
          <BrandForm key={selected} brand={current}
            onCancel={() => setSelected(brands[0]?.id || null)}
            onDelete={current.id ? () => remove(current) : null}
            onGenerate={current.id ? () => onGenerate(current.id) : null}
            onSaved={(saved) => { onChanged(); if (saved?.id) setSelected(saved.id); }} />
        ) : !loading ? (
          <div className="empty">
            <h3>No brands yet</h3>
            <p>Add your first brand kit to start generating creatives.</p>
            <button className="btn primary" onClick={() => setSelected('new')}><IconPlus /> New brand</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
