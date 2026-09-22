import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Flame, X, Image as ImageIcon, Smile } from 'lucide-react';

const BURN_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '10s', value: 10 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '5m', value: 300 },
  { label: '1h', value: 3600 },
];

const EMOJI_LIST = ['👻', '🔒', '🔥', '⚡', '👀', '👍', '🚀', '🤐', '🛡️', '❤️'];

export function MessageInput({ onSendMessage, onTyping }) {
  const [text, setText] = useState('');
  const [burnAfter, setBurnAfter] = useState(0);
  const [showBurnMenu, setShowBurnMenu] = useState(false);
  const [showEmojiMenu, setShowEmojiMenu] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Notify typing
  const handleTextChange = (e) => {
    setText(e.target.value);
    if (onTyping) {
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 1500);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: max 25MB for client-side encryption in browser
    if (file.size > 25 * 1024 * 1024) {
      alert('File exceeds 25MB limit for browser encryption.');
      return;
    }

    setAttachedFile(file);
    e.target.value = '';
  };

  const handleSend = () => {
    if (!text.trim() && !attachedFile) return;

    onSendMessage({
      text: text.trim(),
      file: attachedFile,
      burnAfter,
    });

    setText('');
    setAttachedFile(null);
    setShowEmojiMenu(false);
    if (onTyping) onTyping(false);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const insertEmoji = (emoji) => {
    setText((prev) => prev + emoji);
    setShowEmojiMenu(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="p-3 bg-ghost-900 border-t border-slate-800/80 relative">
      {/* File Attachment Preview Bar */}
      {attachedFile && (
        <div className="mb-2 p-2 bg-ghost-800/90 border border-slate-700/80 rounded-xl flex items-center justify-between animate-fade-in text-xs">
          <div className="flex items-center gap-2 truncate">
            <Paperclip className="w-4 h-4 text-[#00ffcc] flex-shrink-0" />
            <span className="text-slate-200 font-medium truncate">{attachedFile.name}</span>
            <span className="text-slate-400 text-[10px]">
              ({(attachedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <button
            onClick={() => setAttachedFile(null)}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Burn After Read Menu Popup */}
      {showBurnMenu && (
        <div className="absolute bottom-16 left-3 bg-ghost-850 border border-slate-700 rounded-xl p-2 shadow-2xl z-30 animate-fade-in w-44">
          <div className="text-[11px] font-mono text-slate-400 mb-1.5 px-2">
            Burn After Read (TTL):
          </div>
          <div className="space-y-1">
            {BURN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setBurnAfter(opt.value);
                  setShowBurnMenu(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                  burnAfter === opt.value
                    ? 'bg-[#00ffcc]/20 text-[#00ffcc] font-semibold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>{opt.label}</span>
                {opt.value > 0 && <Flame className="w-3 h-3 text-amber-400" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Emoji Picker Popup */}
      {showEmojiMenu && (
        <div className="absolute bottom-16 left-12 bg-ghost-850 border border-slate-700 rounded-xl p-2.5 shadow-2xl z-30 animate-fade-in">
          <div className="grid grid-cols-5 gap-1.5">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                onClick={() => insertEmoji(emoji)}
                className="p-2 text-xl hover:bg-slate-800 rounded-lg transition transform hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Input Row */}
      <div className="flex items-end gap-2 bg-ghost-850 rounded-2xl border border-slate-700/60 p-1.5 pl-2 focus-within:border-[#00ffcc]/50 transition shadow-inner">
        {/* Burn Timer Button */}
        <button
          type="button"
          onClick={() => setShowBurnMenu(!showBurnMenu)}
          className={`p-2 rounded-xl transition flex items-center gap-1 ${
            burnAfter > 0
              ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Set self-destruct timer"
        >
          <Flame className="w-4 h-4" />
          {burnAfter > 0 && (
            <span className="text-[10px] font-mono font-bold">
              {BURN_OPTIONS.find((b) => b.value === burnAfter)?.label}
            </span>
          )}
        </button>

        {/* File Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          title="Attach encrypted file or image"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Emoji Button */}
        <button
          type="button"
          onClick={() => setShowEmojiMenu(!showEmojiMenu)}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition hidden sm:flex"
          title="Quick emojis"
        >
          <Smile className="w-4 h-4" />
        </button>

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Send an encrypted message..."
          className="flex-1 bg-transparent text-slate-100 text-sm placeholder-slate-500 resize-none max-h-32 py-2 px-1 focus:outline-none"
        />

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() && !attachedFile}
          className={`p-2.5 rounded-xl transition flex items-center justify-center ${
            text.trim() || attachedFile
              ? 'ghost-btn-primary shadow-lg'
              : 'text-slate-600 bg-slate-800/50 cursor-not-allowed'
          }`}
          title="Send Encrypted Message (Enter)"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
