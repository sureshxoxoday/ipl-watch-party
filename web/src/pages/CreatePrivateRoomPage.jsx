import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function CreatePrivateRoomPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(null); // { match_id, inviteCode, inviteUrl }
  const [error, setError] = useState('');
  const [roomName, setRoomName] = useState('');

  useEffect(() => {
    client.get(`/rooms/${matchId}`)
      .then(({ data }) => { setMatch(data); setRoomName(`Private: ${data.match_title}`); })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [matchId]);

  async function startPayment() {
    setError('');
    setPaying(true);
    try {
      const { data: order } = await client.post('/payments/create-order', { linked_match_id: matchId });

      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: 'IPL Watch Party',
          description: `Private Room — ${match?.match_title}`,
          theme: { color: '#FF6B00' },
          handler: async (response) => {
            try {
              const { data } = await client.post('/payments/verify', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                linked_match_id: matchId,
                room_name: roomName,
              });
              setDone(data);
              resolve();
            } catch (err) {
              reject(new Error(err.response?.data?.error || 'Verification failed'));
            }
          },
          modal: { ondismiss: () => reject(new Error('cancelled')) },
        });
        rzp.open();
      });
    } catch (err) {
      if (err.message !== 'cancelled') setError(err.message);
    } finally {
      setPaying(false);
    }
  }

  function copyInvite() {
    navigator.clipboard.writeText(done.inviteUrl);
  }

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a15', color: '#9b9bb8' }}>
      Loading…
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a15', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#13131f', border: '1px solid #1e1e30', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '440px' }}>

        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#6b6b8a', cursor: 'pointer', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          ← Back
        </button>

        {done ? (
          // ── Success state ──────────────────────────────────────────────
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h2 style={{ color: '#fff', marginBottom: '0.5rem' }}>Private Room Created!</h2>
            <p style={{ color: '#9b9bb8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Share the invite link with your friends. Only people with this link can join.
            </p>

            <div style={{ background: '#0a0a15', border: '1px solid #2a2a3e', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', wordBreak: 'break-all', fontSize: '0.8rem', color: '#FF6B00', textAlign: 'left' }}>
              {done.inviteUrl}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={copyInvite} style={{ flex: 1, background: '#1e1e30', border: '1px solid #2a2a3e', color: '#e8e8f0', borderRadius: '8px', padding: '0.7rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                📋 Copy Link
              </button>
              <button onClick={() => navigate(`/match/${done.match_id}?invite=${done.inviteCode}`)} style={{ flex: 1, background: '#FF6B00', border: 'none', color: '#fff', borderRadius: '8px', padding: '0.7rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' }}>
                Enter Room →
              </button>
            </div>
          </div>
        ) : (
          // ── Payment state ──────────────────────────────────────────────
          <>
            <h2 style={{ color: '#fff', marginBottom: '0.25rem' }}>Create Private Room</h2>
            <p style={{ color: '#6b6b8a', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Invite only — your friends, your chat.
            </p>

            {match && (
              <div style={{ background: '#0a0a15', border: '1px solid #1e1e30', borderRadius: '8px', padding: '0.875rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.7rem', color: '#6b6b8a', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Match</div>
                <div style={{ fontWeight: 700, color: '#fff' }}>{match.match_title}</div>
                {match.match_number && <div style={{ fontSize: '0.8rem', color: '#9b9bb8', marginTop: '0.2rem' }}>{match.match_number}</div>}
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.8rem', color: '#9b9bb8', display: 'block', marginBottom: '0.4rem' }}>Room name</label>
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value.slice(0, 60))}
                style={{ width: '100%', background: '#0a0a15', border: '1px solid #1e1e30', borderRadius: '8px', padding: '0.6rem 0.875rem', color: '#e8e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0a15', borderRadius: '8px', padding: '0.875rem', marginBottom: '1.25rem' }}>
              <span style={{ color: '#9b9bb8', fontSize: '0.875rem' }}>Private room (one-time)</span>
              <span style={{ color: '#FF6B00', fontWeight: 800, fontSize: '1.25rem' }}>₹99</span>
            </div>

            {error && <p style={{ color: '#EF4444', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{error}</p>}

            <button
              onClick={startPayment}
              disabled={paying}
              style={{ width: '100%', background: paying ? '#2a2a3e' : '#FF6B00', border: 'none', color: '#fff', borderRadius: '10px', padding: '0.875rem', fontWeight: 700, fontSize: '1rem', cursor: paying ? 'default' : 'pointer' }}
            >
              {paying ? 'Opening payment…' : '🔒 Pay ₹99 & Create Room'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#4a4a6a', marginTop: '0.875rem' }}>
              Powered by Razorpay · Secure payment
            </p>
          </>
        )}
      </div>
    </div>
  );
}
