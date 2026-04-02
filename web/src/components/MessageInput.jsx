import React, { useState, useRef } from 'react';

const QUICK_REACTIONS = ['🔥', '😱', '💯', '😂', '🏏', '💪'];

export default function MessageInput({ onSend, onReact, onPollCreate, isLive }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={{
      background: '#13131f', borderTop: '1px solid #1e1e30',
      padding: '0.75rem 0.75rem 0.75rem',
      flexShrink: 0,
    }}>
      {/* Quick reactions row */}
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem', alignItems: 'center' }}>
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onReact(emoji)}
            style={{
              background: '#1a1a2e', border: '1px solid #2a2a3e',
              borderRadius: '8px', padding: '0.35rem 0.5rem',
              fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1,
              transition: 'transform 0.1s', flexShrink: 0,
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.85)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {emoji}
          </button>
        ))}
        {isLive && (
          <button
            onClick={onPollCreate}
            title="Create poll"
            style={{
              background: '#1a1a2e', border: '1px solid #2a2a3e',
              borderRadius: '8px', padding: '0.35rem 0.6rem',
              fontSize: '0.75rem', fontWeight: 700, color: '#FF6B00',
              cursor: 'pointer', marginLeft: 'auto', flexShrink: 0,
            }}
          >
            📊 Poll
          </button>
        )}
      </div>

      {/* Text input row */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          onKeyDown={handleKeyDown}
          placeholder="Type something..."
          style={{
            flex: 1, padding: '0.6rem 0.875rem',
            background: '#0a0a15', border: '1px solid #1e1e30',
            borderRadius: '8px', color: '#e8e8f0', fontSize: '0.9rem',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          style={{
            padding: '0.6rem 1rem', background: text.trim() ? '#FF6B00' : '#1e1e30',
            border: 'none', borderRadius: '8px', color: '#fff',
            cursor: text.trim() ? 'pointer' : 'default',
            fontWeight: 700, fontSize: '0.875rem', transition: 'background 0.2s',
            flexShrink: 0,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
