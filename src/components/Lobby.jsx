import React, { useState, useEffect } from 'react';
import { Shield, Lock, Key, User, ArrowRight, Dices, Eye, EyeOff, Wifi, AlertCircle } from 'lucide-react';

const RANDOM_ADJECTIVES = ['silent', 'stealth', 'phantom', 'shadow', 'cipher', 'cryptic', 'cosmic', 'void'];
const RANDOM_NOUNS = ['vault', 'haven', 'citadel', 'nebula', 'node', 'bunker', 'beacon', 'protocol'];

export function Lobby({ onJoinRoom, lanInfo, initialRoomId, initialKey }) {
  const [roomId, setRoomId] = useState(initialRoomId || '');
  const [passphrase, setPassphrase] = useState(initialKey || '');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDeriving, setIsDeriving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Random Room Generator
  const generateRandomRoom = () => {
    const adj = RANDOM_ADJECTIVES[Math.floor(Math.random() * RANDOM_ADJECTIVES.length)];
    const noun = RANDOM_NOUNS[Math.floor(Math.random() * RANDOM_NOUNS.length)];
    const num = Math.floor(100 + Math.random() * 900);
    setRoomId(`${adj}-${noun}-${num}`);
    setErrorMessage('');
  };

  // Generate random alias
  useEffect(() => {
    if (!username) {
      const num = Math.floor(10 + Math.random() * 90);
      setUsername(`Ghost_${num}`);
    }
  }, [username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!roomId.trim()) {
      setErrorMessage('Please enter or generate a Room Identifier');
      return;
    }
    if (!passphrase.trim()) {
      setErrorMessage('Please enter a Room Passphrase');
      return;
    }

    setIsDeriving(true);
    try {
      await onJoinRoom({
        roomId: roomId.trim().toLowerCase(),
        passphrase: passphrase.trim(),
        username: username.trim() || 'Ghost',
      });
    } catch (err) {
      console.error('Failed to enter room:', err);
      setErrorMessage(err.message || 'Failed to enter room. Please try again.');
    } finally {
      setIsDeriving(false);
    }
  };

  // Password entropy/strength meter
  const getPasswordStrength = () => {
    if (!passphrase) return { score: 0, text: 'Required', color: 'bg-slate-700' };
    if (passphrase.length < 6) return { score: 1, text: 'Weak', color: 'bg-rose-500' };
    if (passphrase.length < 10) return { score: 2, text: 'Medium', color: 'bg-amber-500' };
    return { score: 3, text: 'Strong E2EE Key', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-y-auto">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#00ffcc]/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md ghost-card-glow rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 animate-fade-in border border-[#00ffcc]/20">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-[#00ffcc]/10 border border-[#00ffcc]/30 mb-3 shadow-[0_0_15px_rgba(0,255,204,0.2)]">
            <Shield className="w-8 h-8 text-[#00ffcc]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            <span>Ghost Chat</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Zero-Knowledge • End-to-End Encrypted • Ephemeral LAN Chat
          </p>

          {lanInfo?.lanUrl && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-ghost-900 border border-slate-800 rounded-full text-[11px] text-slate-300">
              <Wifi className="w-3 h-3 text-[#00ffcc]" />
              <span>LAN: <span className="font-mono text-[#00ffcc]">{lanInfo.lanUrl}</span></span>
            </div>
          )}
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Join/Create Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Room Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Room Identifier</span>
              <button
                type="button"
                onClick={generateRandomRoom}
                className="text-[11px] text-[#00ffcc] hover:underline flex items-center gap-1"
              >
                <Dices className="w-3 h-3" />
                <span>Random Room</span>
              </button>
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                required
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  setErrorMessage('');
                }}
                placeholder="e.g. ghost-citadel-42"
                className="w-full ghost-input rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 font-mono"
              />
            </div>
          </div>

          {/* Passphrase */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-[#00ffcc]" />
                <span>Room Passphrase</span>
              </span>
              <span className={`text-[10px] font-mono ${strength.score === 3 ? 'text-emerald-400' : strength.score === 2 ? 'text-amber-400' : 'text-slate-400'}`}>
                {strength.text}
              </span>
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={passphrase}
                onChange={(e) => {
                  setPassphrase(e.target.value);
                  setErrorMessage('');
                }}
                placeholder="Enter secret room key"
                className="w-full ghost-input rounded-xl px-3.5 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-200 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Entropy bar */}
            <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden flex">
              <div
                className={`h-full transition-all duration-300 ${strength.color}`}
                style={{ width: `${(strength.score / 3) * 100}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Passphrase never touches the network. Derives AES-256-GCM key in browser.
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#00ffcc]" />
              <span>Your Ghost Alias</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Ghost_07"
              className="w-full ghost-input rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isDeriving}
            className="w-full mt-6 py-3 px-4 rounded-xl ghost-btn-primary flex items-center justify-center gap-2 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isDeriving ? (
              <span className="text-sm font-semibold flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                Deriving AES-256 Key...
              </span>
            ) : (
              <span className="text-sm font-semibold flex items-center gap-2">
                <span>Enter Ghost Room</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </form>

        {/* Security badge footer */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-[#00ffcc]" />
            <span>AES-256-GCM</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-[#00ffcc]" />
            <span>Zero Logs</span>
          </div>
          <span>•</span>
          <span>RAM Only</span>
        </div>
      </div>
    </div>
  );
}
