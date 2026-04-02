import React from 'react';

export default function ReactionOverlay({ reactions }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      zIndex: 10, overflow: 'hidden',
    }}>
      {reactions.map(({ id, emoji, x }) => (
        <span
          key={id}
          style={{
            position: 'absolute',
            left: `${x}%`,
            bottom: '60px',
            fontSize: '1.75rem',
            lineHeight: 1,
            animation: 'floatUp 3.2s ease-out forwards',
            userSelect: 'none',
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}
