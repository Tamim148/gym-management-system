'use client';

import { io, type Socket } from 'socket.io-client';
import { getApiBaseUrl } from './api';

let sharedSocket: Socket | null = null;

export function getRealtimeSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = io(getApiBaseUrl(), {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });
  } else if (!sharedSocket.connected) {
    sharedSocket.connect();
  }

  return sharedSocket;
}

export function disconnectRealtimeSocket(): void {
  if (sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
  }
}
