import React, { useRef, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  QrCode, 
  Volume2, 
  VolumeX, 
  AlertOctagon, 
  LogOut, 
  Lock 
} from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';

export function ChatRoom({
  roomId,
  messages,
  userId,
  peerCount,
  typingPeers,
  fingerprint,
  soundEnabled,
  onToggleSound,
  onOpenQR,
  onOpenSecurityInfo,
  onPanic,
  onLeave,
  onSendMessage,
  onTyping,
  onBurnMessage,
}) {
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingPeers]);

  return (
    <div className="flex-1 flex flex-col h-full bg-ghost-950 overflow-hidden relative">
      {/* Top Navigation Bar */}
      <header className="h-16 px-4 border-b border-slate-800/80 bg-ghost-900/90 backdrop-blur-md flex items-center justify-between z-20">
        {/* Left: Room & Security info */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenSecurityInfo}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-ghost-850 hover:bg-ghost-800 border border-slate-700/60 transition group text-left"
            title="View Security & Safety Emojis"
          >
            <div className="p-1 rounded-lg bg-[#00ffcc]/10 border border-[#00ffcc]/30 text-[#00ffcc]">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold text-slate-100 truncate max-w-[120px] sm:max-w-[200px]">
                  {roomId}
                </span>
                <span className="text-[11px] select-none opacity-80 group-hover:opacity-100">
                  {fingerprint?.emojiCode ? fingerprint.emojiCode.split(' ')[0] : '🔒'}
                </span>
              </div>
              <div className="text-[10px] text-[#00ffcc]/80 font-mono flex items-center gap-1">
                <span>AES-256-GCM</span>
              </div>
            </div>
          </button>

          {/* Active Peers Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ghost-850 border border-slate-800 text-xs text-slate-300">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-emerald-400 font-medium">{peerCount}</span>
            <span className="text-[11px] text-slate-400">online</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* QR Code / Invite */}
          <button
            onClick={onOpenQR}
            className="p-2 text-slate-400 hover:text-[#00ffcc] hover:bg-slate-800 rounded-xl transition"
            title="LAN Invite & QR Code"
          >
            <QrCode className="w-4 h-4" />
          </button>

          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Panic Button */}
          <button
            onClick={onPanic}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold transition"
            title="Emergency Panic Mode (Esc x2)"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Panic</span>
          </button>

          {/* Leave Room */}
          <button
            onClick={onLeave}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition"
            title="Leave & Wipe Session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {/* Security Banner / Intro */}
        <div className="max-w-md mx-auto my-4 p-4 rounded-2xl bg-ghost-900/60 border border-slate-800/80 text-center text-xs text-slate-400 animate-fade-in">
          <div className="inline-flex p-2 rounded-xl bg-[#00ffcc]/10 text-[#00ffcc] mb-2 border border-[#00ffcc]/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <p className="font-semibold text-slate-200 mb-1">
            Zero-Knowledge Room Initialized
          </p>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Messages and files are encrypted with AES-256-GCM directly in your browser before broadcast. The server stores zero logs.
          </p>
          {fingerprint && (
            <button
              onClick={onOpenSecurityInfo}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-ghost-850 hover:bg-ghost-800 border border-slate-700/60 rounded-full font-mono text-[11px] text-[#00ffcc] transition"
            >
              <span>Verify: {fingerprint.emojiCode}</span>
            </button>
          )}
        </div>

        {/* Message Stream */}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.senderId === userId}
            onBurn={onBurnMessage}
          />
        ))}

        {/* Typing indicator */}
        {typingPeers && typingPeers.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-slate-400 italic py-1 px-2 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#00ffcc] animate-ping"></span>
            <span>
              {typingPeers.join(', ')} {typingPeers.length > 1 ? 'are' : 'is'} typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Message Input */}
      <MessageInput
        onSendMessage={onSendMessage}
        onTyping={onTyping}
      />
    </div>
  );
}
