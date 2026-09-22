import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lobby } from './components/Lobby';
import { ChatRoom } from './components/ChatRoom';
import { QRCodeModal } from './components/QRCodeModal';
import { RoomInfoModal } from './components/RoomInfoModal';
import { PanicOverlay } from './components/PanicOverlay';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudio } from './hooks/useAudio';
import {
  deriveKey,
  encryptText,
  decryptText,
  encryptFile,
  decryptFile,
  generateSafetyFingerprint,
} from './crypto/e2ee';

export function App() {
  const [inRoom, setInRoom] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [username, setUsername] = useState('');
  const [userId] = useState(() => `user_${Math.random().toString(36).substr(2, 9)}`);

  const [cryptoKey, setCryptoKey] = useState(null);
  const cryptoKeyRef = useRef(null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const [fingerprint, setFingerprint] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingPeers, setTypingPeers] = useState([]);
  const [lanInfo, setLanInfo] = useState(null);

  // Modals
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isPanicTriggered, setIsPanicTriggered] = useState(false);

  // Audio synthesis
  const {
    soundEnabled,
    setSoundEnabled,
    playSendSound,
    playReceiveSound,
    playBurnSound,
    playPanicSound,
  } = useAudio();

  // Escape key double-press detector
  const lastEscPressRef = useRef(0);

  // Fetch LAN network info
  useEffect(() => {
    fetch('/api/network-info')
      .then((res) => res.json())
      .then((data) => setLanInfo(data))
      .catch(() => {
        setLanInfo({
          ip: window.location.hostname,
          port: window.location.port || '5173',
          lanUrl: `${window.location.protocol}//${window.location.hostname}:${window.location.port || '5173'}`,
        });
      });
  }, []);

  // Parse initial URL hash if scanned from QR code
  const [initialRoomId, setInitialRoomId] = useState('');
  const [initialKey, setInitialKey] = useState('');

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (hash) {
      const params = new URLSearchParams(hash);
      const r = params.get('room');
      const k = params.get('key');
      if (r) setInitialRoomId(r);
      if (k) setInitialKey(k);
    }
  }, []);

  // Decrypt incoming message
  const handleIncomingEncryptedMessage = useCallback(
    async (encryptedMsg, isHistory = false) => {
      const key = cryptoKeyRef.current;
      console.log('[E2EE] Incoming message payload:', encryptedMsg.id, 'Key ready:', !!key);

      setMessages((prev) => {
        if (prev.some((m) => m.id === encryptedMsg.id)) return prev;

        // Perform async decryption
        (async () => {
          try {
            if (!key) {
              console.warn('[E2EE] No cryptoKey found when decrypting message');
              return;
            }

            let decryptedText = '';
            let fileUrl = null;
            let fileMeta = encryptedMsg.fileMeta;

            if (encryptedMsg.type === 'file' && encryptedMsg.ciphertext) {
              const decrypted = await decryptFile(
                encryptedMsg.ciphertext,
                encryptedMsg.iv,
                encryptedMsg.fileMeta,
                key
              );
              fileUrl = decrypted.url;
              fileMeta = decrypted.meta;
            } else if (encryptedMsg.ciphertext) {
              decryptedText = await decryptText(
                encryptedMsg.ciphertext,
                encryptedMsg.iv,
                key
              );
            }

            const readyMsg = {
              ...encryptedMsg,
              text: decryptedText,
              fileUrl,
              fileMeta,
              decryptionError: false,
            };

            setMessages((cur) =>
              cur.map((m) => (m.id === encryptedMsg.id ? readyMsg : m))
            );

            if (!isHistory && encryptedMsg.senderId !== userIdRef.current) {
              playReceiveSound();
            }
          } catch (err) {
            console.error('[E2EE] Decryption failed:', err);
            const errorMsg = {
              ...encryptedMsg,
              text: '',
              decryptionError: true,
            };
            setMessages((cur) =>
              cur.map((m) => (m.id === encryptedMsg.id ? errorMsg : m))
            );
          }
        })();

        return [
          ...prev,
          {
            ...encryptedMsg,
            text: 'Decrypting...',
            decryptionError: false,
          },
        ];
      });
    },
    [playReceiveSound]
  );

  const handlePeerTyping = useCallback(
    ({ username: peerName, isTyping }) => {
      setTypingPeers((prev) => {
        if (isTyping) {
          if (!prev.includes(peerName)) return [...prev, peerName];
          return prev;
        } else {
          return prev.filter((name) => name !== peerName);
        }
      });
    },
    []
  );

  const handleMessageBurned = useCallback(
    (messageId) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      playBurnSound();
    },
    [playBurnSound]
  );

  // WebSocket hook
  const {
    peerCount,
    joinRoom: wsJoinRoom,
    sendEncryptedMessage: wsSendMessage,
    sendTypingStatus: wsSendTyping,
    burnMessage: wsBurnMessage,
    leaveRoom: wsLeaveRoom,
  } = useWebSocket({
    onMessage: handleIncomingEncryptedMessage,
    onPeerTyping: handlePeerTyping,
    onMessageBurned: handleMessageBurned,
  });

  // Join Room Handler
  const handleJoinRoom = async ({ roomId: rId, passphrase: pass, username: user }) => {
    setRoomId(rId);
    setPassphrase(pass);
    setUsername(user);

    // Derive AES-256-GCM key
    const key = await deriveKey(pass, rId);
    setCryptoKey(key);
    cryptoKeyRef.current = key;

    // Generate safety fingerprint
    const fp = await generateSafetyFingerprint(key);
    setFingerprint(fp);

    // Join room over WebSocket
    wsJoinRoom(rId, userId, user);
    setInRoom(true);
  };

  // Send Message Handler
  const handleSendMessage = async ({ text, file, burnAfter }) => {
    const key = cryptoKeyRef.current;
    if (!key) {
      alert('Encryption key not initialized.');
      return;
    }

    try {
      let payload = {
        burnAfter,
        timestamp: Date.now(),
      };

      if (file) {
        const encFile = await encryptFile(file, key);
        payload.type = 'file';
        payload.ciphertext = encFile.ciphertext;
        payload.iv = encFile.iv;
        payload.fileMeta = encFile.meta;
      } else {
        const enc = await encryptText(text, key);
        payload.type = 'text';
        payload.ciphertext = enc.ciphertext;
        payload.iv = enc.iv;
      }

      wsSendMessage(payload);
      playSendSound();
    } catch (err) {
      console.error('Failed to encrypt message:', err);
      alert('Encryption failed.');
    }
  };

  // Leave room & wipe memory
  const handleLeaveRoom = () => {
    wsLeaveRoom();
    setInRoom(false);
    setMessages([]);
    setCryptoKey(null);
    cryptoKeyRef.current = null;
    setFingerprint(null);
    setRoomId('');
    setPassphrase('');
    window.location.hash = '';
  };

  // Panic trigger
  const handleTriggerPanic = useCallback(() => {
    playPanicSound();
    setIsPanicTriggered(true);
    setMessages([]);
    setCryptoKey(null);
    cryptoKeyRef.current = null;
    setFingerprint(null);
    wsLeaveRoom();
  }, [playPanicSound, wsLeaveRoom]);

  // Double ESC key listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        const now = Date.now();
        if (now - lastEscPressRef.current < 400) {
          handleTriggerPanic();
        }
        lastEscPressRef.current = now;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTriggerPanic]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#090a0f] text-slate-100 font-sans select-none overflow-hidden">
      {!inRoom ? (
        <Lobby
          onJoinRoom={handleJoinRoom}
          lanInfo={lanInfo}
          initialRoomId={initialRoomId}
          initialKey={initialKey}
        />
      ) : (
        <ChatRoom
          roomId={roomId}
          messages={messages}
          userId={userId}
          peerCount={peerCount}
          typingPeers={typingPeers}
          fingerprint={fingerprint}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
          onOpenQR={() => setIsQRModalOpen(true)}
          onOpenSecurityInfo={() => setIsSecurityModalOpen(true)}
          onPanic={handleTriggerPanic}
          onLeave={handleLeaveRoom}
          onSendMessage={handleSendMessage}
          onTyping={wsSendTyping}
          onBurnMessage={wsBurnMessage}
        />
      )}

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        roomId={roomId}
        passphrase={passphrase}
        lanInfo={lanInfo}
      />

      {/* Security Verification Modal */}
      <RoomInfoModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        roomId={roomId}
        fingerprint={fingerprint}
        peerCount={peerCount}
      />

      {/* Emergency Panic Overlay */}
      <PanicOverlay
        isTriggered={isPanicTriggered}
        onReset={() => {
          setIsPanicTriggered(false);
          handleLeaveRoom();
        }}
        onRestore={() => setIsPanicTriggered(false)}
      />
    </div>
  );
}
