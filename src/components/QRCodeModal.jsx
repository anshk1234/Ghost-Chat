import React, { useState, useEffect } from 'react';
import { X, Copy, Check, QrCode, ShieldAlert, Wifi } from 'lucide-react';
import QRCode from 'qrcode';

export function QRCodeModal({ isOpen, onClose, roomId, passphrase, lanInfo }) {
  const [copied, setCopied] = useState(false);
  const [includePassphrase, setIncludePassphrase] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const baseUrl = lanInfo?.lanUrl || window.location.origin;

  const joinUrl = includePassphrase && passphrase
    ? `${baseUrl}/#room=${encodeURIComponent(roomId)}&key=${encodeURIComponent(passphrase)}`
    : `${baseUrl}/#room=${encodeURIComponent(roomId)}`;

  useEffect(() => {
    if (!isOpen) return;
    QRCode.toDataURL(joinUrl, {
      width: 260,
      margin: 2,
      color: {
        dark: '#00ffcc',
        light: '#090a0f',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error(err));
  }, [joinUrl, isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md p-6 rounded-2xl ghost-card-glow text-slate-100 flex flex-col items-center relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4 text-[#00ffcc]">
          <QrCode className="w-6 h-6" />
          <h3 className="text-xl font-bold tracking-tight">LAN Invite & QR Code</h3>
        </div>

        <p className="text-xs text-slate-400 text-center mb-5">
          Scan with your phone camera or any device connected to the same Wi-Fi.
        </p>

        {/* QR Code Container */}
        <div className="p-3 bg-[#090a0f] border border-[#00ffcc]/30 rounded-xl shadow-lg mb-5 flex items-center justify-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Ghost Room QR Code" className="w-56 h-56 rounded-lg" />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-slate-500 text-sm">
              Generating QR...
            </div>
          )}
        </div>

        {/* LAN Info Badge */}
        <div className="w-full mb-4 flex items-center justify-between px-3 py-2 bg-ghost-900 rounded-lg border border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Wifi className="w-4 h-4 text-[#00ffcc]" />
            <span>LAN Host:</span>
          </div>
          <span className="font-mono text-[#00ffcc]">{baseUrl}</span>
        </div>

        {/* Toggle include passphrase */}
        <div className="w-full mb-4 flex items-center justify-between px-3 py-2.5 bg-ghost-900/90 rounded-lg border border-slate-800">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-200">Include Passphrase in Link</span>
            <span className="text-[10px] text-slate-400">Convenient, but anyone with the link can decrypt</span>
          </div>
          <input
            type="checkbox"
            checked={includePassphrase}
            onChange={(e) => setIncludePassphrase(e.target.checked)}
            className="w-4 h-4 accent-[#00ffcc] cursor-pointer"
          />
        </div>

        {/* Copy Link Field */}
        <div className="w-full flex items-center gap-2 bg-ghost-900 border border-slate-700/60 rounded-xl p-1.5 pl-3">
          <input
            type="text"
            readOnly
            value={joinUrl}
            className="w-full bg-transparent text-xs font-mono text-slate-300 focus:outline-none truncate"
          />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00ffcc]/20 hover:bg-[#00ffcc]/30 text-[#00ffcc] text-xs font-medium rounded-lg transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
