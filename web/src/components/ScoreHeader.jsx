import React from 'react';

function BallDot({ ball }) {
  let label, bg, border, color;

  if (ball.isWicket) {
    label = 'W'; bg = 'rgba(239,68,68,0.2)'; border = '#EF4444'; color = '#EF4444';
  } else if (ball.isSix) {
    label = '6'; bg = 'rgba(255,107,0,0.2)'; border = '#FF6B00'; color = '#FF6B00';
  } else if (ball.isFour) {
    label = '4'; bg = 'rgba(59,130,246,0.2)'; border = '#3B82F6'; color = '#3B82F6';
  } else if (ball.isWide) {
    label = 'Wd'; bg = 'transparent'; border = '#4a4a6a'; color = '#6b6b8a';
  } else if (ball.isNoBall) {
    label = 'NB'; bg = 'rgba(245,158,11,0.15)'; border = '#F59E0B'; color = '#F59E0B';
  } else if (ball.runs === 0) {
    label = '·'; bg = 'transparent'; border = '#2a2a40'; color = '#6b6b8a';
  } else {
    label = String(ball.runs); bg = 'transparent'; border = '#2a2a40'; color = '#e8e8f0';
  }

  return (
    <div style={{
      minWidth: 22, height: 22, borderRadius: '50%', background: bg,
      border: `1px solid ${border}`, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color,
    }}>
      {label}
    </div>
  );
}

export default function ScoreHeader({ room, onlineCount, onBack }) {
  const isLive = room?.status === 'live';

  return (
    <header style={{
      background: '#13131f', borderBottom: '1px solid #1e1e30',
      padding: '0.75rem 1rem', flexShrink: 0,
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#6b6b8a', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.25rem' }}>
          ←
        </button>

        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: isLive ? '#FF4444' : '#6b6b8a',
          }}>
            {isLive ? (
              <><span style={{ animation: 'pulse 1s infinite', display: 'inline-block' }}>●</span> LIVE</>
            ) : (room?.status === 'upcoming' ? 'Upcoming' : 'Completed')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b6b8a', marginTop: '2px' }}>
            {room?.venue?.split(',')[0]}
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#6b6b8a', minWidth: '60px', textAlign: 'right' }}>
          👁 {onlineCount > 0 ? onlineCount.toLocaleString() : '—'}
        </div>
      </div>

      {/* Score row */}
      {room ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <TeamScore team={room.team_a} isBatting={room.batting_team === room.team_a?.code} innings={room.innings} />

          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            {isLive && (
              <div style={{ fontSize: '0.8rem', color: '#FF6B00', fontWeight: 700 }}>
                Ov {room.current_over}
              </div>
            )}
            {room.target && room.innings === 2 && (() => {
              const battingScore = room.batting_team === room.team_a?.code
                ? room.team_a?.score : room.team_b?.score;
              const runsNeeded = room.target - (battingScore?.runs ?? 0);
              if (runsNeeded <= 0) return null;
              const ballsLeft = 120 - (room.balls_bowled ?? 0);
              return (
                <div style={{ fontSize: '0.7rem', color: runsNeeded <= 6 ? '#FF4444' : '#9b9bb8', marginTop: '2px', fontWeight: runsNeeded <= 6 ? 700 : 400 }}>
                  Need {runsNeeded} off {ballsLeft}b
                </div>
              );
            })()}
            {room.result && (
              <div style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600, maxWidth: '100px', textAlign: 'center' }}>
                {room.result}
              </div>
            )}
          </div>

          <TeamScore team={room.team_b} isBatting={room.batting_team === room.team_b?.code} innings={room.innings} align="right" />
        </div>
      ) : null}

      {/* Current over ball-by-ball */}
      {isLive && room?.current_over_balls?.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px solid #1e1e30' }}>
          <span style={{ fontSize: '0.6rem', color: '#4a4a6a', marginRight: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>This over</span>
          {room.current_over_balls.map((ball, i) => (
            <BallDot key={i} ball={ball} />
          ))}
        </div>
      )}

      {!room && (
        <div style={{ textAlign: 'center', color: '#6b6b8a', fontSize: '0.9rem', padding: '0.5rem' }}>
          Loading...
        </div>
      )}
    </header>
  );
}

function TeamScore({ team, isBatting, innings, align = 'left' }) {
  if (!team) return null;
  const s = team.score;
  const hasScore = s && (s.runs > 0 || s.wickets > 0);

  return (
    <div style={{ textAlign: align, flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: team.color || '#333',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.6rem', fontWeight: 800, color: '#fff', flexShrink: 0,
          border: isBatting ? '2px solid #FF6B00' : '2px solid transparent',
          boxShadow: isBatting ? '0 0 8px rgba(255,107,0,0.4)' : 'none',
        }}>
          {team.code}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isBatting ? '#fff' : '#9b9bb8' }}>
            {team.code}
          </div>
          {hasScore && (
            <div style={{ fontSize: '1rem', fontWeight: 800, color: isBatting ? '#FF6B00' : '#6b6b8a', lineHeight: 1 }}>
              {s.runs}/{s.wickets}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
