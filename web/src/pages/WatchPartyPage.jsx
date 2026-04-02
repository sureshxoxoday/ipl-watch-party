import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import ScoreHeader from '../components/ScoreHeader';
import ChatStream from '../components/ChatStream';
import ReactionOverlay from '../components/ReactionOverlay';
import PollWidget from '../components/PollWidget';
import MessageInput from '../components/MessageInput';
import PollCreateModal from '../components/PollCreateModal';
import AdBanner from '../components/AdBanner';

export default function WatchPartyPage() {
  const { matchId } = useParams();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('invite');
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { user } = useAuth();

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activePoll, setActivePoll] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [reactions, setReactions] = useState([]);
  const [showPollModal, setShowPollModal] = useState(false);
  const [votedPolls, setVotedPolls] = useState(new Set());

  // Add a floating reaction
  const addReaction = useCallback((emoji) => {
    const id = Math.random().toString(36).slice(2, 9);
    // Burst: add multiple slightly offset reactions for big events
    const count = emoji.length > 2 ? 4 : 1; // multi-emoji = burst
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const x = 5 + Math.random() * 88;
        setReactions((prev) => [...prev, { id: id + i, emoji: [...emoji][0], x }]);
        setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id + i)), 3500);
      }, i * 80);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    const inviteParam = inviteCode ? `?invite=${inviteCode}` : '';
    Promise.all([
      client.get(`/rooms/${matchId}${inviteParam}`),
      client.get(`/rooms/${matchId}/messages`),
      client.get(`/rooms/${matchId}/poll`),
    ]).then(([roomRes, msgRes, pollRes]) => {
      setRoom(roomRes.data);
      setMessages(msgRes.data);
      if (pollRes.data) setActivePoll(pollRes.data);
    }).catch(() => navigate('/'));
  }, [matchId]);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    socket.emit('join_room', matchId, inviteCode || undefined);

    // Re-join on reconnect (socket.io loses room membership after disconnect)
    const onReconnect = () => socket.emit('join_room', matchId, inviteCode || undefined);
    socket.on('connect', onReconnect);

    const onMessage = (msg) => setMessages((prev) => [...prev, msg]);

    const onReaction = ({ emoji }) => addReaction(emoji);

    const onScoreUpdate = (data) => setRoom((prev) => prev ? { ...prev, ...data } : null);

    const onMatchEvent = ({ type, emoji }) => {
      // Burst reactions for big events
      const count = type === 'SIX' ? 6 : type === 'WICKET' ? 5 : 3;
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const x = 5 + Math.random() * 88;
          const e = [...(emoji || '')][0] || (type === 'SIX' ? '🔥' : '😱');
          const rid = Math.random().toString(36).slice(2);
          setReactions((prev) => [...prev, { id: rid, emoji: e, x }]);
          setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== rid)), 3500);
        }, i * 120);
      }
    };

    const onOnlineCount = (n) => setOnlineCount(n);
    const onNewPoll = (poll) => setActivePoll(poll);
    const onPollUpdate = (poll) => setActivePoll(poll);
    const onPollClosed = () => setActivePoll(null);

    socket.on('new_message', onMessage);
    socket.on('reaction', onReaction);
    socket.on('score_update', onScoreUpdate);
    socket.on('match_event', onMatchEvent);
    socket.on('online_count', onOnlineCount);
    socket.on('new_poll', onNewPoll);
    socket.on('poll_update', onPollUpdate);
    socket.on('poll_closed', onPollClosed);

    return () => {
      socket.off('connect', onReconnect);
      socket.off('new_message', onMessage);
      socket.off('reaction', onReaction);
      socket.off('score_update', onScoreUpdate);
      socket.off('match_event', onMatchEvent);
      socket.off('online_count', onOnlineCount);
      socket.off('new_poll', onNewPoll);
      socket.off('poll_update', onPollUpdate);
      socket.off('poll_closed', onPollClosed);
    };
  }, [socket, matchId, addReaction]);

  function sendMessage(content) {
    if (!socket) return;
    socket.emit('send_message', { roomId: matchId, content });
  }

  function sendReaction(emoji) {
    if (!socket) return;
    socket.emit('send_reaction', { roomId: matchId, emoji });
    addReaction(emoji);
  }

  function votePoll(pollId, optionIndex) {
    if (!socket || votedPolls.has(pollId)) return;
    socket.emit('vote_poll', { pollId, optionIndex });
    setVotedPolls((prev) => new Set([...prev, pollId]));
  }

  function createPoll(question, options) {
    if (!socket) return;
    socket.emit('create_poll', { roomId: matchId, question, options });
    setShowPollModal(false);
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a15', overflow: 'hidden' }}>
      <ScoreHeader room={room} onlineCount={onlineCount} onBack={() => navigate('/')} />

      {/* Main area: chat + overlays */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <ReactionOverlay reactions={reactions} />

        {activePoll && (
          <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', zIndex: 20, width: 'min(300px, 90vw)' }}>
            <PollWidget
              poll={activePoll}
              onVote={votePoll}
              hasVoted={votedPolls.has(activePoll._id)}
              onClose={() => setActivePoll(null)}
            />
          </div>
        )}

        <ChatStream messages={messages} currentUser={user} />
      </div>

      {room?.status === 'live' && <AdBanner slot={2} />}
      <MessageInput
        onSend={sendMessage}
        onReact={sendReaction}
        onPollCreate={() => setShowPollModal(true)}
        isLive={room?.status === 'live'}
      />

      {showPollModal && (
        <PollCreateModal onCreate={createPoll} onClose={() => setShowPollModal(false)} />
      )}
    </div>
  );
}
