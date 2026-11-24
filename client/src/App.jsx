import React, { useState, useEffect } from 'react';
import CitizenPortal from './CitizenPortal.jsx';
import RescuerPortal from './RescuerPortal.jsx';
import { ShieldCheck, Lock, User, ArrowRight } from 'lucide-react';

export default function App() {
  // Check URL query parameters for mode (?mode=citizen auto-opens citizen portal)
  const urlParams = new URLSearchParams(window.location.search);
  const initialMode = urlParams.get('mode') === 'citizen' ? 'citizen' : 'entry';

  const [currentView, setCurrentView] = useState(initialMode); // 'entry' | 'citizen' | 'rescuer_login' | 'rescuer'
  const [password, setPassword] = useState('RESCUE2026');
  const [callsign, setCallsign] = useState('RESCUER-ALPHA');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Authenticate Rescuer
  const handleRescuerLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/rescuer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, callsign })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentView('rescuer');
      } else {
        setLoginError(data.details || 'Invalid password');
      }
    } catch (err) {
      setLoginError(`Login failed: ${err.message}`);
    } finally {
      setLoginLoading(false);
    }
  };

  // Quick switch role shortcut from header
  const handleSwitchToCitizen = () => {
    setCurrentView('citizen');
  };

  const handleSwitchToRescuer = () => {
    setCurrentView('rescuer_login');
  };

  if (currentView === 'citizen') {
    return <CitizenPortal onSwitchToRescuer={handleSwitchToRescuer} />;
  }

  if (currentView === 'rescuer') {
    return <RescuerPortal onLogout={() => setCurrentView('entry')} />;
  }

  if (currentView === 'rescuer_login') {
    return (
      <div className="min-h-screen bg-[#07111E] text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#112240] border border-[#1E3A5F] rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-cyan-950 border border-cyan-500/40 text-cyan-400 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Rescuer Command Login</h2>
            <p className="text-xs text-slate-400 mt-1">Authorized Field Responder & Hub Coordinator Access</p>
          </div>

          {loginError && (
            <div className="p-3 bg-rose-950/80 border border-rose-700 text-rose-300 text-xs rounded-xl text-center">
              {loginError}
            </div>
          )}

          <form onSubmit={handleRescuerLogin} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Rescuer Callsign:</label>
              <input
                type="text"
                value={callsign}
                onChange={e => setCallsign(e.target.value)}
                className="w-full bg-[#0A192F] border border-slate-700 rounded-xl px-3 py-2.5 text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-400">Command Access Password:</label>
                <span className="text-[10px] text-cyan-400 font-mono-code">Demo Pass: RESCUE2026</span>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-[#0A192F] border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono-code"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg transition disabled:opacity-50"
            >
              {loginLoading ? 'Verifying Credentials...' : 'Unlock Command Center'}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-slate-800">
            <button
              onClick={handleSwitchToCitizen}
              className="text-xs text-slate-400 hover:text-cyan-400 transition"
            >
              ← Back to Zero-Password Citizen Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // DEFAULT ENTRY / ROLE SWITCHER SCREEN
  return (
    <div className="min-h-screen bg-[#07111E] text-slate-100 flex flex-col justify-between p-6 md:p-12">
      {/* Brand Header */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between pb-6 border-b border-[#1E3A5F]">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-500 flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-cyan-500/20">
            LM
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center">
              LifeMesh <span className="ml-2 text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono-code">OS</span>
            </h1>
            <p className="text-xs text-slate-400">Offline P2P Crisis Relief & Medical Triage Engine</p>
          </div>
        </div>

        <div className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-600/50 text-emerald-300 text-xs font-mono-code flex items-center">
          <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
          AIRPLANE_MODE_READY
        </div>
      </header>

      {/* Main Choice Screen */}
      <main className="max-w-5xl mx-auto w-full my-auto py-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Select Your Role to Access LifeMesh
          </h2>
          <p className="text-slate-400 text-sm mt-2">
            Built for extreme climate crises and disaster blackouts (UN SDG 2 & UN SDG 13). Operates 100% offline with zero cloud APIs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: Citizen / Victim Portal (Zero Password) */}
          <div
            onClick={handleSwitchToCitizen}
            className="group cursor-pointer bg-[#112240] hover:bg-[#13284c] border border-[#1E3A5F] hover:border-cyan-500/80 rounded-3xl p-8 transition-all hover:scale-[1.02] shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 bg-emerald-500 text-slate-900 font-bold text-[10px] px-3 py-1 rounded-bl-xl uppercase font-mono-code">
              ZERO PASSWORD • 1-TAP ACCESS
            </div>

            <div className="w-14 h-14 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 flex items-center justify-center mb-6 group-hover:scale-110 transition">
              <User className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Citizen / Victim Portal</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Instant offline emergency SOS for stranded civilians. Features 1-tap pictograms, multilingual translation (Tamil / Tanglish / English), voice input, high-contrast visual alerts, and real-time rescuer tracking with signed ration tokens.
            </p>

            <div className="flex items-center text-xs font-bold text-cyan-400 group-hover:text-cyan-300">
              <span>Open Citizen Portal Immediately</span>
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition" />
            </div>
          </div>

          {/* Card 2: Rescuer / Command Center (Password Protected) */}
          <div
            onClick={handleSwitchToRescuer}
            className="group cursor-pointer bg-[#112240] hover:bg-[#13284c] border border-[#1E3A5F] hover:border-emerald-500/80 rounded-3xl p-8 transition-all hover:scale-[1.02] shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 bg-cyan-500 text-slate-900 font-bold text-[10px] px-3 py-1 rounded-bl-xl uppercase font-mono-code">
              VERIFIED RESPONDER
            </div>

            <div className="w-14 h-14 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Rescuer Command Center</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Full control console for disaster response teams. View START protocol casualty boards, zero-knowledge AES-256 decrypted records, interactive Chennai flood route maps with bridge detour simulation, two-way broadcast messaging, and QR pairing for offline mobile devices.
            </p>

            <div className="flex items-center text-xs font-bold text-emerald-400 group-hover:text-emerald-300">
              <span>Enter Rescuer Portal (Pass: RESCUE2026)</span>
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </div>
      </main>

      {/* Footer Compliance Banner */}
      <footer className="max-w-5xl mx-auto w-full pt-6 border-t border-[#1E3A5F] flex flex-col md:flex-row items-center justify-between text-xs text-slate-400">
        <div>
          <span className="text-emerald-400 font-semibold">100% Free & Open-Source:</span> Pure-NPM on-device Qwen2.5-0.5B (q4), Ed25519 signing, AES-256-GCM zero-knowledge privacy.
        </div>
        <div className="text-[11px] font-mono-code text-cyan-400 mt-2 md:mt-0">
          TRANSPORT: SIMULATED_BLE_WIFI_DIRECT • LIVE OFFLINE WI-FI RELAY
        </div>
      </footer>
    </div>
  );
}
