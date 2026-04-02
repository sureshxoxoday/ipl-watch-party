import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import AdBanner from '../components/AdBanner';

const STATUS_LABEL = { live: '🔴 LIVE', upcoming: '🕐 Upcoming', completed: '✅ Done' };
const STATUS_COLOR = { live: '#FF4444', upcoming: '#6b6b8a', completed: '#10B981' };

function MatchCard({ room, onClick, onPrivate }) {
  const isLive = room.status === 'live';
  return (
    <div
      style={{
        background: '#13131f', border: `1px solid ${isLive ? '#FF4444' : '#1e1e30'}`,
        borderRadius: '12px', padding: '1.25rem 1.5rem',
        transition: 'all 0.2s', marginBottom: '0.75rem',
        boxShadow: isLive ? '0 0 20px rgba(255,68,68,0.15)' : 'none',
        animation: isLive ? 'popIn 0.3s ease' : 'none',
        cursor: 'pointer',
      }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: STATUS_COLOR[room.status], letterSpacing: '0.05em' }}>
            {STATUS_LABEL[room.status]}
            {isLive && <span style={{ animation: 'pulse 1s infinite', display: 'inline-block', marginLeft: '4px' }}>●</span>}
          </span>
          {room.match_number && (
            <span style={{ fontSize: '0.7rem', color: '#4a4a6a', background: '#1e1e30', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
              {room.match_number}
            </span>
          )}
        </div>
        <span style={{ fontSize: '0.75rem', color: '#6b6b8a' }}>{room.venue?.split(',')[0]}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Team team={room.team_a} score={isLive && (room.batting_team === room.team_a?.code || room.team_a?.score?.runs > 0 || room.team_a?.score?.wickets > 0) ? room.team_a?.score : null} isBatting={room.batting_team === room.team_a?.code && isLive} />
        <span style={{ color: '#6b6b8a', fontWeight: 700, fontSize: '0.9rem' }}>VS</span>
        <Team team={room.team_b} score={isLive && (room.batting_team === room.team_b?.code || room.team_b?.score?.runs > 0 || room.team_b?.score?.wickets > 0) ? room.team_b?.score : null} isBatting={room.batting_team === room.team_b?.code && isLive} align="right" />
      </div>

      {isLive && (
        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #1e1e30', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#9b9bb8' }}>Over {room.current_over}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onPrivate(); }}
              style={{ background: 'none', border: '1px solid #2a2a3e', color: '#9b9bb8', borderRadius: '6px', padding: '0.3rem 0.7rem', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}
            >
              🔒 Private
            </button>
            <button style={{ background: '#FF6B00', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.35rem 1rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
              Join Party →
            </button>
          </div>
        </div>
      )}

      {room.status === 'upcoming' && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #1e1e30', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onPrivate(); }}
            style={{ background: 'none', border: '1px solid #2a2a3e', color: '#9b9bb8', borderRadius: '6px', padding: '0.3rem 0.7rem', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}
          >
            🔒 Private Room
          </button>
        </div>
      )}

      {room.status === 'upcoming' && (
        <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#6b6b8a' }}>
          {new Date(room.match_date).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {room.status === 'completed' && room.result && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#10B981', fontWeight: 600 }}>{room.result}</div>
      )}
    </div>
  );
}

function Team({ team, score, isBatting, align = 'left' }) {
  if (!team) return null;
  return (
    <div style={{ textAlign: align }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: team.color || '#333', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff',
          border: isBatting ? '2px solid #FF6B00' : '2px solid transparent',
        }}>
          {team.code}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>{team.code}</div>
          {score && (
            <div style={{ fontSize: '0.8rem', color: '#FF6B00', fontWeight: 600 }}>
              {score.runs}/{score.wickets}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => client.get('/rooms').then(({ data }) => setRooms(data)).catch(console.error);
    load().finally(() => setLoading(false));
    // Refresh every 15 s so live scores stay current without a page reload
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, []);

  const live = rooms.filter((r) => r.status === 'live');
  const upcoming = rooms.filter((r) => r.status === 'upcoming');
  const completed = rooms.filter((r) => r.status === 'completed');

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0a0a15' }}>
      {/* Navbar */}
      <nav style={{ flexShrink: 0, background: '#13131f', borderBottom: '1px solid #1e1e30', padding: '0 1.5rem', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#FF6B00' }}>🏏 IPL Watch Party</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: user?.avatar_color || '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <span style={{ fontSize: '0.875rem', color: '#9b9bb8' }}>{user?.username}</span>
          <button onClick={logout} style={{ background: 'none', border: '1px solid #1e1e30', color: '#6b6b8a', padding: '0.3rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
            Logout
          </button>
        </div>
      </nav>

      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: '#6b6b8a', padding: '3rem' }}>Loading matches...</p>
        ) : rooms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#6b6b8a' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏏</div>
            <p style={{ fontWeight: 600, color: '#9b9bb8', marginBottom: '0.5rem' }}>No matches found</p>
            <p style={{ fontSize: '0.85rem' }}>
              Run <code style={{ background: '#1a1a2e', padding: '0.2rem 0.4rem', borderRadius: '4px', color: '#FF6B00' }}>npm run seed</code> in the API folder to load IPL fixtures.
            </p>
          </div>
        ) : (
          <>
            {live.length > 0 && (
              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FF4444', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  🔴 Live Now
                </h2>
                {live.map((r) => (
                  <MatchCard
                    key={r._id} room={r}
                    onClick={() => navigate(`/match/${r.match_id}`)}
                    onPrivate={() => navigate(`/create-private/${r.match_id}`)}
                  />
                ))}
                <AdBanner slot={0} />
              </section>
            )}

            {upcoming.length > 0 && (
              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b6b8a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Upcoming · {upcoming.length} matches
                </h2>
                {upcoming.map((r, i) => (
                  <React.Fragment key={r._id}>
                    <MatchCard
                      room={r}
                      onClick={() => navigate(`/match/${r.match_id}`)}
                      onPrivate={() => navigate(`/create-private/${r.match_id}`)}
                    />
                    {i === 2 && <AdBanner slot={1} />}
                  </React.Fragment>
                ))}
              </section>
            )}

            {completed.length > 0 && (
              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b6b8a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Completed · {completed.length} matches
                </h2>
                {completed.map((r) => (
                  <MatchCard
                    key={r._id} room={r}
                    onClick={() => navigate(`/match/${r.match_id}`)}
                    onPrivate={() => navigate(`/create-private/${r.match_id}`)}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
}
