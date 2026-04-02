import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function JoinPrivatePage() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    client.get(`/rooms/join/${inviteCode}`)
      .then(({ data }) => {
        navigate(`/match/${data.match_id}?invite=${inviteCode}`, { replace: true });
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Invalid invite link');
      });
  }, [inviteCode]);

  if (error) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a15', gap: '1rem' }}>
      <div style={{ fontSize: '2.5rem' }}>😕</div>
      <p style={{ color: '#EF4444', fontWeight: 600 }}>{error}</p>
      <button onClick={() => navigate('/')} style={{ background: '#FF6B00', border: 'none', color: '#fff', borderRadius: '8px', padding: '0.6rem 1.5rem', fontWeight: 700, cursor: 'pointer' }}>
        Go to Lobby
      </button>
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a15', color: '#9b9bb8' }}>
      Joining private room…
    </div>
  );
}
