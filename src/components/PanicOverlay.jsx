import React, { useState } from 'react';
import { RefreshCw, Terminal, ArrowLeft } from 'lucide-react';

export function PanicOverlay({ isTriggered, onReset, onRestore }) {
  const [fakeMode, setFakeMode] = useState('terminal'); // 'terminal' | 'blank'

  if (!isTriggered) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-[#090a0f] text-slate-200 flex flex-col items-center justify-center p-6 select-none animate-fade-in font-mono">
      {fakeMode === 'terminal' ? (
        <div className="w-full max-w-2xl bg-black border border-slate-800 rounded-lg p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
            <span className="text-xs text-slate-500 ml-2">powershell - system diagnostic</span>
          </div>

          <div className="text-xs text-emerald-500 space-y-1">
            <p>Windows PowerShell</p>
            <p>Copyright (C) Microsoft Corporation. All rights reserved.</p>
            <br />
            <p className="text-slate-400">PS C:\Users\Admin&gt; Get-Service | Where-Object Status -eq "Running"</p>
            <p className="text-slate-500">Status      Name               DisplayName</p>
            <p className="text-slate-500">------      ----               -----------</p>
            <p className="text-slate-400">Running     AudioSrv           Windows Audio</p>
            <p className="text-slate-400">Running     Dhcp               DHCP Client</p>
            <p className="text-slate-400">Running     Dnscache           DNS Client</p>
            <p className="text-slate-400">Running     EventLog           Windows Event Log</p>
            <p className="text-slate-400">Running     LanmanWorkstation  Workstation</p>
            <br />
            <p className="text-emerald-400 flex items-center gap-2">
              <span>PS C:\Users\Admin&gt;</span>
              <span className="w-2 h-4 bg-emerald-400 inline-block animate-pulse"></span>
            </p>
          </div>
        </div>
      ) : (
        <div className="text-slate-700 text-xs">Nothing to see here.</div>
      )}

      {/* Camouflage controls at bottom */}
      <div className="fixed bottom-6 flex items-center gap-4 text-xs text-slate-600 bg-slate-900/60 px-4 py-2 rounded-full border border-slate-800 backdrop-blur">
        <span>Panic Mode Active (RAM Cleared)</span>
        <button
          onClick={onReset}
          className="text-red-400 hover:text-red-300 underline flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Full Exit
        </button>
        <span className="text-slate-700">|</span>
        <button
          onClick={onRestore}
          className="text-[#00ffcc] hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" /> Reconnect
        </button>
      </div>
    </div>
  );
}
