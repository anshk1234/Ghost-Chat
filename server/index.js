import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { getLocalIpAddress } from './utils/network.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;
const localIp = getLocalIpAddress();

app.use(express.json());

// In-memory ephemeral room store
// Map<roomId, { clients: Set<WebSocket>, messages: Array<EncryptedMessage>, createdAt: number }>
const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      clients: new Set(),
      messages: [],
      createdAt: Date.now(),
    });
  }
  return rooms.get(roomId);
}

// Clean up empty rooms after 15 minutes of inactivity
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (room.clients.size === 0 && now - room.createdAt > 15 * 60 * 1000) {
      console.log(`[Server] Purging inactive room: ${roomId}`);
      rooms.delete(roomId);
    }
  }
}, 60 * 1000);

// API Endpoints
app.get('/api/network-info', (req, res) => {
  res.json({
    ip: localIp,
    port: PORT,
    localUrl: `http://localhost:${PORT}`,
    lanUrl: `http://${localIp}:${PORT}`,
    activeRooms: rooms.size,
  });
});

app.get('/api/qr', async (req, res) => {
  try {
    const text = req.query.url || `http://${localIp}:${PORT}`;
    const qrDataUrl = await QRCode.toDataURL(text, {
      margin: 2,
      width: 320,
      color: {
        dark: '#00ffcc',
        light: '#090a0f',
      },
    });
    res.json({ qr: qrDataUrl, url: text });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Serve frontend in production (dist directory)
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback for SPA routing in production
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Ghost Chat Backend Running. Start Vite dev server for frontend.');
    }
  });
});

// WebSocket Handler
wss.on('connection', (ws, req) => {
  let currentRoomId = null;
  let currentUserId = null;
  let currentUsername = 'Anonymous';
  let isAlive = true;

  console.log(`[WS] New socket connected from ${req.socket.remoteAddress}`);

  ws.on('pong', () => {
    isAlive = true;
  });

  ws.on('message', (rawData) => {
    try {
      const message = JSON.parse(rawData.toString());
      const { type, payload } = message;

      switch (type) {
        case 'join': {
          const { roomId, userId, username } = payload;
          if (!roomId || !userId) return;

          currentRoomId = roomId;
          currentUserId = userId;
          currentUsername = username || 'Anonymous';

          const room = getRoom(roomId);
          room.clients.add(ws);
          ws.userId = userId;
          ws.username = currentUsername;

          console.log(`[WS] ${currentUsername} (${userId}) joined room: "${roomId}". Total peers: ${room.clients.size}`);

          // Send back confirmation and existing encrypted messages
          ws.send(JSON.stringify({
            type: 'room_joined',
            payload: {
              roomId,
              peerCount: room.clients.size,
              messages: room.messages,
            }
          }));

          // Notify other peers
          broadcastToRoom(roomId, ws, {
            type: 'peer_joined',
            payload: {
              userId,
              username: currentUsername,
              peerCount: room.clients.size,
              timestamp: Date.now(),
            }
          });
          break;
        }

        case 'message': {
          if (!currentRoomId) {
            console.warn(`[WS] Ignored message from unjoined socket (${currentUserId})`);
            return;
          }
          const room = getRoom(currentRoomId);

          const encryptedMessage = {
            id: payload.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            senderId: currentUserId,
            senderName: currentUsername,
            ciphertext: payload.ciphertext,
            iv: payload.iv,
            timestamp: payload.timestamp || Date.now(),
            burnAfter: payload.burnAfter || 0,
            type: payload.type || 'text',
            fileMeta: payload.fileMeta || null,
          };

          console.log(`[WS] Message from ${currentUsername} in "${currentRoomId}" (Type: ${encryptedMessage.type}). Relaying to ${room.clients.size} clients.`);

          // Store in in-memory buffer (limit 50)
          room.messages.push(encryptedMessage);
          if (room.messages.length > 50) {
            room.messages.shift();
          }

          // Broadcast to all clients in room including sender
          broadcastToRoom(currentRoomId, null, {
            type: 'new_message',
            payload: encryptedMessage,
          });
          break;
        }

        case 'typing': {
          if (!currentRoomId) return;
          broadcastToRoom(currentRoomId, ws, {
            type: 'peer_typing',
            payload: {
              userId: currentUserId,
              username: currentUsername,
              isTyping: !!payload.isTyping,
            }
          });
          break;
        }

        case 'burn_message': {
          if (!currentRoomId) return;
          const { messageId } = payload;
          const room = getRoom(currentRoomId);
          room.messages = room.messages.filter(m => m.id !== messageId);

          console.log(`[WS] Message ${messageId} burned in room "${currentRoomId}"`);

          broadcastToRoom(currentRoomId, null, {
            type: 'message_burned',
            payload: { messageId },
          });
          break;
        }

        case 'leave': {
          handleLeave();
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('[WS] Error handling message:', err);
    }
  });

  const handleLeave = () => {
    if (currentRoomId && rooms.has(currentRoomId)) {
      const room = rooms.get(currentRoomId);
      room.clients.delete(ws);

      console.log(`[WS] ${currentUsername} left room: "${currentRoomId}". Remaining peers: ${room.clients.size}`);

      broadcastToRoom(currentRoomId, null, {
        type: 'peer_left',
        payload: {
          userId: currentUserId,
          username: currentUsername,
          peerCount: room.clients.size,
          timestamp: Date.now(),
        }
      });

      if (room.clients.size === 0) {
        room.messages = [];
      }
    }
    currentRoomId = null;
  };

  ws.on('close', handleLeave);
  ws.on('error', handleLeave);
});

// Broadcast helper
function broadcastToRoom(roomId, excludeWs, messageObj) {
  if (!rooms.has(roomId)) return;
  const room = rooms.get(roomId);
  const data = JSON.stringify(messageObj);

  for (const client of room.clients) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Ping/Pong connection health check
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n==================================================`);
  console.log(`  👻 Ghost Chat Server is Running!`);
  console.log(`  - Local:   http://localhost:${PORT}`);
  console.log(`  - LAN:     http://${localIp}:${PORT}`);
  console.log(`  - WebSockets on /ws`);
  console.log(`==================================================\n`);
});
