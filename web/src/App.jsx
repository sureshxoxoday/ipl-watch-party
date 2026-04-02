import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import WatchPartyPage from './pages/WatchPartyPage';
import CreatePrivateRoomPage from './pages/CreatePrivateRoomPage';
import JoinPrivatePage from './pages/JoinPrivatePage';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '2rem', animation: 'pulse 1s infinite' }}>🏏</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PrivateRoute><LobbyPage /></PrivateRoute>} />
      <Route path="/match/:matchId" element={<PrivateRoute><WatchPartyPage /></PrivateRoute>} />
      <Route path="/create-private/:matchId" element={<PrivateRoute><CreatePrivateRoomPage /></PrivateRoute>} />
      <Route path="/join/:inviteCode" element={<PrivateRoute><JoinPrivatePage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
