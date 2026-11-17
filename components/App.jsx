'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { getSettings, saveSettings } from '@/lib/client/settings';
import BrandsPage from './BrandsPage.jsx';
import CreativesPage from './CreativesPage.jsx';
import GenerateModal from './GenerateModal.jsx';
import SettingsModal from './SettingsModal.jsx';
import { Toasts, toast } from './Toasts.jsx';
import { IconBrands, IconCreatives, IconSettings } from './Icons.jsx';

export default function App() {
  const [tab, setTab] = useState('creatives');
  const [settings, setSettings] = useState({ role: 'owner', userName: '' });
  useEffect(() => { setSettings(getSettings()); }, []);
  const [brands, setBrands] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(null); // null | {brandId}
  const [showSettings, setShowSettings] = useState(false);
  const [creativesVersion, setCreativesVersion] = useState(0);

  const refreshBrands = useCallback(async () => {
    setBrandsLoading(true);
    try { setBrands(await api.listBrands()); }
    catch (e) { toast(`Couldn't load brands: ${e.message}`, 'error'); }
    finally { setBrandsLoading(false); }
  }, []);

  useEffect(() => { refreshBrands(); }, [refreshBrands]);

  const updateSettings = (patch) => setSettings(saveSettings(patch));
  const initial = (settings.userName || '?').trim().charAt(0).toUpperCase() || '?';

  const roleSwitch = (
    <div className="role-switch" title="Who is creating: tags new creatives as Owner or Agency">
      <button className={settings.role === 'owner' ? 'on' : ''} onClick={() => updateSettings({ role: 'owner' })}>Owner</button>
      <button className={settings.role === 'agency' ? 'on' : ''} onClick={() => updateSettings({ role: 'agency' })}>Agency</button>
    </div>
  );

  return (
    <div className="shell">
      <nav className="rail" aria-label="Main">
        <div className="rail-logo" title="Creative Studio"><span className="logo-mark" aria-hidden="true" /></div>
        <button className={`rail-item ${tab === 'creatives' ? 'active' : ''}`} aria-current={tab === 'creatives' ? 'page' : undefined} onClick={() => setTab('creatives')}>
          <span className="rail-icon"><IconCreatives /></span><span>Creatives</span>
        </button>
        <button className={`rail-item ${tab === 'brands' ? 'active' : ''}`} aria-current={tab === 'brands' ? 'page' : undefined} onClick={() => setTab('brands')}>
          <span className="rail-icon"><IconBrands /></span><span>Brands</span>
        </button>
        <span className="spacer" />
        <button className="rail-item" onClick={() => setShowSettings(true)}>
          <span className="rail-icon"><IconSettings /></span><span>Settings</span>
        </button>
        <button className="avatar" onClick={() => setShowSettings(true)} title={settings.userName || 'Set your name'}>{initial}</button>
      </nav>

      <div className="shell-main">
        {tab === 'brands' ? (
          <BrandsPage brands={brands} loading={brandsLoading} onChanged={refreshBrands}
            onGenerate={(brandId) => setShowGenerate({ brandId })} />
        ) : (
          <CreativesPage brands={brands} version={creativesVersion} roleSwitch={roleSwitch}
            onGenerate={() => setShowGenerate({})} onGoBrands={() => setTab('brands')} />
        )}
      </div>

      {showGenerate && (
        <GenerateModal brands={brands} initialBrandId={showGenerate.brandId} settings={settings}
          onClose={() => setShowGenerate(null)}
          onDone={() => { setShowGenerate(null); setTab('creatives'); setCreativesVersion((v) => v + 1); }} />
      )}
      {showSettings && (
        <SettingsModal settings={settings} onClose={() => setShowSettings(false)}
          onSave={(patch) => { updateSettings(patch); setShowSettings(false); setCreativesVersion((v) => v + 1); }} />
      )}
      <Toasts />
    </div>
  );
}
