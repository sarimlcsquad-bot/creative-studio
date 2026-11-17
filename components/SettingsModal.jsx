'use client';
import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '@/lib/client/api';

export default function SettingsModal({ settings, onClose, onSave }) {
  const [userName, setName] = useState(settings.userName);
  return (
    <Modal title="Settings" onClose={onClose}
      footer={<>
        <button className="btn ghost danger" onClick={() => api.logout().finally(() => { window.location.href = '/login'; })}>Log out</button>
        <span className="spacer" />
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => onSave({ userName: userName.trim() })}>Save</button>
      </>}>
      <label className="field">
        <span>Your name</span>
        <input value={userName} onChange={(e) => setName(e.target.value)} placeholder="Shown on creatives you generate" />
        <small>Saved in this browser only.</small>
      </label>
    </Modal>
  );
}
