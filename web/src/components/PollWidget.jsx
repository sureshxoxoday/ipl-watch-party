import React from 'react';

export default function PollWidget({ poll, onVote, hasVoted, onClose }) {
  const total = poll.options.reduce((s, o) => s + o.votes, 0);

  return (
    <div style={{
      background: '#1a1a2e', border: '1px solid #2a2a4e',
      borderRadius: '12px', padding: '1rem',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      animation: 'popIn 0.3s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '0.65rem', color: '#FF6B00', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
            📊 LIVE POLL
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e8e8f0', lineHeight: 1.3 }}>
            {poll.question}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b6b8a', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: '0 0 0 0.5rem' }}>
          ×
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {poll.options.map((opt, i) => {
          const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
          return (
            <button
              key={i}
              onClick={() => !hasVoted && onVote(poll._id, i)}
              disabled={hasVoted}
              style={{
                position: 'relative', width: '100%', padding: '0.5rem 0.75rem',
                background: '#0f0f2a', border: '1px solid #2a2a4e',
                borderRadius: '8px', cursor: hasVoted ? 'default' : 'pointer',
                textAlign: 'left', overflow: 'hidden', color: '#e8e8f0',
              }}
            >
              {/* Progress bar */}
              {hasVoted && (
                <div style={{
                  position: 'absolute', inset: 0, left: 0,
                  width: `${pct}%`, background: 'rgba(255,107,0,0.2)',
                  borderRadius: '8px', transition: 'width 0.5s ease',
                }} />
              )}
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>{opt.text}</span>
                {hasVoted && <span style={{ color: '#FF6B00', fontWeight: 700 }}>{pct}%</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#6b6b8a', textAlign: 'right' }}>
        {total} {total === 1 ? 'vote' : 'votes'}
      </div>
    </div>
  );
}
