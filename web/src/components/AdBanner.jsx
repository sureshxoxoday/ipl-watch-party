import React, { useState } from 'react';

const ADS = [
  { label: 'Dream11', text: 'Play fantasy cricket on Dream11 — win big this IPL!', cta: 'Play Now', color: '#F84F33' },
  { label: 'Swiggy', text: 'Order match-day snacks in 10 minutes. IPL offer: Free delivery!', cta: 'Order Now', color: '#FC8019' },
  { label: 'Jio Cinema', text: 'Watch every match LIVE in 4K — free on JioCinema', cta: 'Watch Free', color: '#0066CC' },
];

export default function AdBanner({ slot = 0 }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const ad = ADS[slot % ADS.length];

  return (
    <div style={{
      background: '#13131f',
      borderTop: '1px solid #1e1e30',
      borderBottom: '1px solid #1e1e30',
      padding: '0.5rem 1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      flexShrink: 0,
    }}>
      <span style={{
        fontSize: '0.6rem', fontWeight: 700, color: '#4a4a6a',
        letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0,
      }}>
        AD
      </span>
      <span style={{ fontSize: '0.78rem', color: '#9b9bb8', flex: 1, minWidth: 0 }}>
        <span style={{ color: ad.color, fontWeight: 700 }}>{ad.label}</span>
        {' · '}
        {ad.text}
      </span>
      <button style={{
        background: ad.color, color: '#fff', border: 'none',
        borderRadius: '5px', padding: '0.25rem 0.6rem',
        fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0,
        whiteSpace: 'nowrap',
      }}>
        {ad.cta}
      </button>
      <button onClick={() => setDismissed(true)} style={{
        background: 'none', border: 'none', color: '#4a4a6a',
        cursor: 'pointer', fontSize: '0.85rem', flexShrink: 0, lineHeight: 1,
        padding: '0 0.2rem',
      }}>
        ✕
      </button>
    </div>
  );
}
