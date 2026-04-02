import React, { useState } from 'react';

const QUICK_QUESTIONS = [
  { q: 'Who will win this match?', opts: ['Team A', 'Team B'] },
  { q: 'Runs in this over?', opts: ['0–5', '6–9', '10–12', '13+'] },
  { q: 'Next ball outcome?', opts: ['Dot/1 run', 'Boundary', 'Wicket'] },
  { q: 'Will there be a six this over?', opts: ['Yes 🔥', 'No 😔'] },
];

export default function PollCreateModal({ onCreate, onClose }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  function setOption(i, val) {
    const next = [...options];
    next[i] = val;
    setOptions(next);
  }

  function addOption() {
    if (options.length < 4) setOptions([...options, '']);
  }

  function removeOption(i) {
    if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i));
  }

  function handleCreate() {
    const validOpts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || validOpts.length < 2) return;
    onCreate(question.trim(), validOpts);
  }

  function useQuick({ q, opts }) {
    setQuestion(q);
    setOptions(opts);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#13131f', border: '1px solid #1e1e30', borderRadius: '16px 16px 0 0',
          padding: '1.5rem', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto',
          animation: 'slideUp 0.25s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>📊 Create a Poll</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b6b8a', fontSize: '1.25rem', cursor: 'pointer' }}>×</button>
        </div>

        {/* Quick picks */}
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.7rem', color: '#6b6b8a', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick picks</p>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {QUICK_QUESTIONS.map((q, i) => (
              <button key={i} onClick={() => useQuick(q)}
                style={{ background: '#1a1a2e', border: '1px solid #2a2a4e', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#9b9bb8', cursor: 'pointer' }}>
                {q.q.split('?')[0].slice(0, 20)}?
              </button>
            ))}
          </div>
        </div>

        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
          placeholder="Your question..."
          style={{ display: 'block', width: '100%', padding: '0.6rem 0.875rem', background: '#0a0a15', border: '1px solid #1e1e30', borderRadius: '8px', color: '#e8e8f0', fontSize: '0.9rem', marginBottom: '0.75rem', outline: 'none' }}
        />

        <div style={{ marginBottom: '0.75rem' }}>
          {options.map((opt, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
              <input
                value={opt}
                onChange={(e) => setOption(i, e.target.value.slice(0, 80))}
                placeholder={`Option ${i + 1}`}
                style={{ flex: 1, padding: '0.5rem 0.75rem', background: '#0a0a15', border: '1px solid #1e1e30', borderRadius: '8px', color: '#e8e8f0', fontSize: '0.875rem', outline: 'none' }}
              />
              {options.length > 2 && (
                <button onClick={() => removeOption(i)}
                  style={{ background: 'none', border: '1px solid #2a2a3e', borderRadius: '8px', color: '#6b6b8a', padding: '0 0.5rem', cursor: 'pointer' }}>
                  ×
                </button>
              )}
            </div>
          ))}
          {options.length < 4 && (
            <button onClick={addOption}
              style={{ background: 'none', border: '1px dashed #2a2a4e', borderRadius: '8px', color: '#6b6b8a', padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', width: '100%' }}>
              + Add option
            </button>
          )}
        </div>

        <button
          onClick={handleCreate}
          disabled={!question.trim() || options.filter(Boolean).length < 2}
          style={{
            width: '100%', padding: '0.75rem', background: '#FF6B00', border: 'none',
            borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '0.95rem',
            cursor: 'pointer', opacity: (!question.trim() || options.filter(Boolean).length < 2) ? 0.5 : 1,
          }}
        >
          Launch Poll 🚀
        </button>
      </div>
    </div>
  );
}
