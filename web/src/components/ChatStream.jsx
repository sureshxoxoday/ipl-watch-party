import React, { useEffect, useRef } from 'react';

const EVENT_STYLES = {
  SIX:          { bg: 'linear-gradient(90deg, rgba(255,107,0,0.2), transparent)', border: '#FF6B00', icon: '🔥' },
  FOUR:         { bg: 'linear-gradient(90deg, rgba(59,130,246,0.2), transparent)', border: '#3B82F6', icon: '🏏' },
  WICKET:       { bg: 'linear-gradient(90deg, rgba(239,68,68,0.2), transparent)', border: '#EF4444', icon: '💀' },
  INNINGS_BREAK:{ bg: 'linear-gradient(90deg, rgba(16,185,129,0.2), transparent)', border: '#10B981', icon: '⚡' },
  OVER_COMPLETE:{ bg: 'linear-gradient(90deg, rgba(107,107,138,0.15), transparent)', border: '#4a4a6a', icon: '📊' },
  MATCH_RESULT: { bg: 'linear-gradient(90deg, rgba(250,204,21,0.2), transparent)', border: '#FACC15', icon: '🏆' },
};

function MessageRow({ msg, currentUser }) {
  const isMe = currentUser && msg.user_id === currentUser.id;

  if (msg.type === 'event') {
    const style = EVENT_STYLES[msg.match_event] || EVENT_STYLES.FOUR;
    return (
      <div style={{
        padding: '0.6rem 0.75rem', margin: '0.35rem 0',
        background: style.bg, borderLeft: `3px solid ${style.border}`,
        borderRadius: '4px', animation: 'slideUp 0.3s ease',
      }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e8e8f0' }}>
          {msg.content}
        </span>
        {msg.over && msg.match_event !== 'OVER_COMPLETE' && (
          <span style={{ fontSize: '0.7rem', color: '#6b6b8a', marginLeft: '0.5rem' }}>
            Ov {msg.over}
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', gap: '0.5rem', padding: '0.3rem 0.75rem',
      alignItems: 'flex-start', animation: 'slideUp 0.2s ease',
    }}>
      {/* Avatar */}
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: msg.avatar_color || '#6366F1', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.6rem', fontWeight: 700, color: '#fff', marginTop: '2px',
      }}>
        {msg.username?.[0]?.toUpperCase()}
      </div>

      <div style={{ minWidth: 0 }}>
        <span style={{
          fontSize: '0.75rem', fontWeight: 700, marginRight: '0.4rem',
          color: isMe ? '#FF6B00' : msg.avatar_color || '#9b9bb8',
        }}>
          {msg.username}
        </span>
        <span style={{ fontSize: '0.875rem', color: '#e8e8f0', wordBreak: 'break-word' }}>
          {msg.content}
        </span>
      </div>
    </div>
  );
}

export default function ChatStream({ messages, currentUser }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{
      height: '100%', overflowY: 'auto', overflowX: 'hidden',
      display: 'flex', flexDirection: 'column',
      paddingTop: '0.5rem', paddingBottom: '0.5rem',
    }}>
      <div style={{ marginTop: 'auto' }}>
        {messages.map((msg) => (
          <MessageRow key={msg._id || Math.random()} msg={msg} currentUser={currentUser} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
