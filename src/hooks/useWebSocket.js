import { useState, useEffect, useRef, useCallback } from 'react';

export function useWebSocket({ onMessage, onPeerJoined, onPeerLeft, onPeerTyping, onMessageBurned }) {
  const [isConnected, setIsConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(1);
  const [connectionError, setConnectionError] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const currentRoomRef = useRef(null); // { roomId, userId, username }

  // Keep latest callbacks in ref to avoid reconnects on state changes
  const callbacksRef = useRef({
    onMessage,
    onPeerJoined,
    onPeerLeft,
    onPeerTyping,
    onMessageBurned,
  });

  useEffect(() => {
    callbacksRef.current = {
      onMessage,
      onPeerJoined,
      onPeerLeft,
      onPeerTyping,
      onMessageBurned,
    };
  });

  const getWsUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (window.location.port === '5173') {
      return `ws://${window.location.hostname}:3000/ws`;
    }
    return `${protocol}//${window.location.host}/ws`;
  }, []);

  const sendRaw = useCallback((obj) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(obj));
    } else {
      console.warn('[WS] Socket is not open. ReadyState:', wsRef.current?.readyState);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const url = getWsUrl();
      console.log('[WS] Connecting to:', url);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected successfully!');
        setIsConnected(true);
        setConnectionError(null);

        // Auto-rejoin room if we had previously joined
        if (currentRoomRef.current) {
          console.log('[WS] Auto-rejoining room:', currentRoomRef.current);
          sendRaw({
            type: 'join',
            payload: currentRoomRef.current,
          });
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const { type, payload } = msg;

          switch (type) {
            case 'room_joined':
              setPeerCount(payload.peerCount || 1);
              if (callbacksRef.current.onMessage && Array.isArray(payload.messages)) {
                payload.messages.forEach((m) => callbacksRef.current.onMessage(m, true));
              }
              break;

            case 'new_message':
              if (callbacksRef.current.onMessage) {
                callbacksRef.current.onMessage(payload, false);
              }
              break;

            case 'peer_joined':
              setPeerCount(payload.peerCount || 1);
              if (callbacksRef.current.onPeerJoined) {
                callbacksRef.current.onPeerJoined(payload);
              }
              break;

            case 'peer_left':
              setPeerCount(payload.peerCount || 1);
              if (callbacksRef.current.onPeerLeft) {
                callbacksRef.current.onPeerLeft(payload);
              }
              break;

            case 'peer_typing':
              if (callbacksRef.current.onPeerTyping) {
                callbacksRef.current.onPeerTyping(payload);
              }
              break;

            case 'message_burned':
              if (callbacksRef.current.onMessageBurned) {
                callbacksRef.current.onMessageBurned(payload.messageId);
              }
              break;

            default:
              break;
          }
        } catch (e) {
          console.error('[WS] Failed to parse message:', e);
        }
      };

      ws.onclose = () => {
        console.warn('[WS] Disconnected. Will attempt reconnect in 2s...');
        setIsConnected(false);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 2000);
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
        setConnectionError('WebSocket error');
        ws.close();
      };
    } catch (e) {
      console.error('[WS] Connection exception:', e);
      setConnectionError('Failed to initialize WebSocket');
    }
  }, [getWsUrl, sendRaw]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const joinRoom = useCallback((roomId, userId, username) => {
    currentRoomRef.current = { roomId, userId, username };
    sendRaw({
      type: 'join',
      payload: { roomId, userId, username },
    });
  }, [sendRaw]);

  const sendEncryptedMessage = useCallback((payload) => {
    sendRaw({
      type: 'message',
      payload,
    });
  }, [sendRaw]);

  const sendTypingStatus = useCallback((isTyping) => {
    sendRaw({
      type: 'typing',
      payload: { isTyping },
    });
  }, [sendRaw]);

  const burnMessage = useCallback((messageId) => {
    sendRaw({
      type: 'burn_message',
      payload: { messageId },
    });
  }, [sendRaw]);

  const leaveRoom = useCallback(() => {
    currentRoomRef.current = null;
    sendRaw({
      type: 'leave',
      payload: {},
    });
  }, [sendRaw]);

  return {
    isConnected,
    peerCount,
    connectionError,
    joinRoom,
    sendEncryptedMessage,
    sendTypingStatus,
    burnMessage,
    leaveRoom,
  };
}
