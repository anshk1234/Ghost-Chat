import React from 'react';
import { X, ShieldCheck, Key, Lock, Users, Server } from 'lucide-react';

export function RoomInfoModal({ isOpen, onClose, roomId, fingerprint, peerCount }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md p-6 rounded-2xl ghost-card-glow text-slate-100 flex flex-col relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2 text-[#00ffcc]">
          <ShieldCheck className="w-6 h-6" />
          <h3 className="text-xl font-bold tracking-tight">Security & Verification</h3>
        </div>

        <p className="text-xs text-slate-400 mb-6">
          Room: <span className="font-mono text-slate-200">{roomId}</span>
        </p>

        {/* Safety Number / Fingerprint */}
        <div className="w-full bg-[#090a0f] border border-[#00ffcc]/30 rounded-xl p-4 mb-5 text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-mono">
            Safety Emoji Verification
          </div>
          <div className="text-3xl my-2 tracking-widest select-all">
            {fingerprint?.emojiCode || '👻 🔒 🛡️ ⚡'}
          </div>
          <div className="text-xs font-mono text-[#00ffcc] tracking-widest mt-1">
            KEY ID: {fingerprint?.hexCode || '----'}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Compare these emojis with the other participants. If they match, your connection is guaranteed secure and tamper-proof.
          </p>
        </div>

        {/* Technical Specs */}
        <div className="space-y-2.5 text-xs text-slate-300">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-ghost-900 border border-slate-800">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#00ffcc]" />
              <span>Cipher:</span>
            </div>
            <span className="font-mono text-[#00ffcc]">AES-256-GCM (128-bit tag)</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-ghost-900 border border-slate-800">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-[#00ffcc]" />
              <span>Key Derivation:</span>
            </div>
            <span className="font-mono text-slate-300">PBKDF2-SHA256 (100k rounds)</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-ghost-900 border border-slate-800">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#00ffcc]" />
              <span>Active Peers:</span>
            </div>
            <span className="font-mono text-emerald-400">{peerCount} connected</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-ghost-900 border border-slate-800">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-[#00ffcc]" />
              <span>Server Knowledge:</span>
            </div>
            <span className="font-mono text-amber-400">Zero (Encrypted Relay)</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-2.5 ghost-btn-primary rounded-xl text-sm"
        >
          Close & Return to Chat
        </button>
      </div>
    </div>
  );
}
