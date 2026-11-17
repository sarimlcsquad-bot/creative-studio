'use client';
import React, { useEffect, useState } from 'react';

let push = () => {};
export function toast(message, kind = 'info') { push({ id: Math.random(), message, kind }); }

export function Toasts() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    push = (t) => {
      setItems((xs) => [...xs, t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), t.kind === 'error' ? 7000 : 3500);
    };
    return () => { push = () => {}; };
  }, []);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.message}</div>)}
    </div>
  );
}
