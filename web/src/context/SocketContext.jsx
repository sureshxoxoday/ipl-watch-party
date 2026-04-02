import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) { setSocket(null); return; }

    const token = localStorage.getItem('token');
    const s = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
      path: '/socket.io',
    });

    s.on('connect', () => console.log('[socket] connected'));
    s.on('connect_error', (err) => console.error('[socket] error:', err.message));

    setSocket(s);
    return () => { s.disconnect(); };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() { return useContext(SocketContext); }
