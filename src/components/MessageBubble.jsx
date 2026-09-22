import React, { useState, useEffect } from 'react';
import { Lock, Flame, FileText, Download, ShieldAlert, Check } from 'lucide-react';

export function MessageBubble({ message, isOwn, onBurn }) {
  const [timeLeft, setTimeLeft] = useState(message.burnAfter || 0);

  // Self-destruct countdown timer
  useEffect(() => {
    if (!message.burnAfter || message.burnAfter <= 0) return;

    // Calculate remaining seconds based on message.timestamp and burnAfter
    const elapsed = Math.floor((Date.now() - message.timestamp) / 1000);
    const initialRemaining = Math.max(0, message.burnAfter - elapsed);
    setTimeLeft(initialRemaining);

    if (initialRemaining <= 0) {
      onBurn(message.id);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onBurn(message.id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [message.id, message.timestamp, message.burnAfter, onBurn]);

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className={`flex flex-col mb-3 group animate-slide-up ${isOwn ? 'items-end' : 'items-start'}`}>
      {/* Sender name & time */}
      <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-slate-400">
        <span className={`font-medium ${isOwn ? 'text-[#00ffcc]' : 'text-slate-300'}`}>
          {isOwn ? 'You' : message.senderName}
        </span>
        <span>•</span>
        <span>{formatTime(message.timestamp)}</span>

        {/* Burn indicator */}
        {message.burnAfter > 0 && (
          <span className="flex items-center gap-1 text-amber-400 font-mono text-[10px] bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
            <Flame className="w-2.5 h-2.5 animate-pulse text-amber-400" />
            <span>{timeLeft}s</span>
          </span>
        )}
      </div>

      {/* Bubble Container */}
      <div
        className={`relative max-w-[85%] sm:max-w-md md:max-w-lg rounded-2xl p-3 shadow-lg transition-all ${
          isOwn
            ? 'bg-[#00ffcc]/15 border border-[#00ffcc]/30 text-slate-100 rounded-br-none'
            : 'bg-ghost-800 border border-slate-700/60 text-slate-200 rounded-bl-none'
        }`}
      >
        {/* If decryption failed */}
        {message.decryptionError ? (
          <div className="flex items-center gap-2 text-rose-400 text-xs py-1">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span className="font-mono italic">
              [Encrypted Payload - Invalid Passphrase]
            </span>
          </div>
        ) : message.type === 'file' ? (
          /* File / Image Attachment */
          <div className="space-y-2">
            {message.fileMeta?.type?.startsWith('image/') && message.fileUrl ? (
              <div className="rounded-lg overflow-hidden border border-slate-700/60 max-h-64 bg-black/40">
                <img
                  src={message.fileUrl}
                  alt={message.fileMeta.name}
                  className="w-full h-auto object-cover max-h-64 hover:scale-[1.02] transition cursor-pointer"
                  onClick={() => window.open(message.fileUrl, '_blank')}
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 bg-ghost-900/80 p-2 rounded-lg border border-slate-700/40">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 text-[#00ffcc] flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">
                    {message.fileMeta?.name || 'Encrypted File'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatFileSize(message.fileMeta?.size)}
                  </p>
                </div>
              </div>

              {message.fileUrl && (
                <a
                  href={message.fileUrl}
                  download={message.fileMeta?.name || 'ghost_file'}
                  className="p-1.5 bg-[#00ffcc]/20 hover:bg-[#00ffcc]/30 text-[#00ffcc] rounded-lg transition flex-shrink-0"
                  title="Download File"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}
            </div>

            {message.text && (
              <p className="text-sm select-text whitespace-pre-wrap break-words mt-2">
                {message.text}
              </p>
            )}
          </div>
        ) : (
          /* Standard Text Message */
          <div className="relative">
            <p className="text-sm select-text whitespace-pre-wrap break-words leading-relaxed font-sans">
              {message.text}
            </p>
          </div>
        )}

        {/* E2EE Lock badge in bottom corner */}
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400">
          <Lock className="w-2.5 h-2.5 text-[#00ffcc]/80" />
          <span className="font-mono text-[9px] text-[#00ffcc]/70">E2EE</span>
        </div>
      </div>

      {/* Manual Burn Button on hover for message owner */}
      {isOwn && (
        <button
          onClick={() => onBurn(message.id)}
          className="opacity-0 group-hover:opacity-100 transition text-slate-500 hover:text-red-400 mt-1 flex items-center gap-1 text-[10px]"
          title="Burn message now for everyone"
        >
          <Flame className="w-3 h-3 text-red-400" />
          <span>Burn Now</span>
        </button>
      )}
    </div>
  );
}
