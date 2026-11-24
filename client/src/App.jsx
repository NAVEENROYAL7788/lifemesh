import React, { useState } from 'react';
import CitizenPortal from './CitizenPortal.jsx';
import RescuerPortal from './RescuerPortal.jsx';
import { ShieldCheck, Lock, User, ArrowRight, Radio, HeartHandshake, CheckCircle } from 'lucide-react';

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialMode = urlParams.get('mode') === 'citizen' ? 'citizen' : 'entry';

  const [currentView, setCurrentView] = useState(initialMode); // 'entry' | 'citizen' | 'rescuer_login' | 'rescuer'
  const [password, setPassword] = useState('RESCUE2026');
  const [callsign, setCallsign] = useState('RESCUER-ALPHA');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

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

  if (currentView === 'citizen') {
    return <CitizenPortal onSwitchToRescuer={() => setCurrentView('rescuer_login')} />;
  }

  if (currentView === 'rescuer') {
    return <RescuerPortal onLogout={() => setCurrentView('entry')} />;
  }

  if (currentView === 'rescuer_login') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-xl space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Rescuer Command Login</h2>
            <p className="text-sm text-slate-600 mt-1">Authorized Field Responder & Hub Coordinator Access</p>
          </div>

          {loginError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-900 text-xs font-semibold rounded-xl text-center">
              {loginError}
            </div>
          )}

          <form onSubmit={handleRescuerLogin} className="space-y-4 text-sm">
            <div>
              <label className="text-slate-700 font-semibold block mb-1">Rescuer Callsign:</label>
              <input
                type="text"
                value={callsign}
                onChange={e => setCallsign(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600 outline-none font-medium"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-700 font-semibold">Command Access Password:</label>
                <span className="text-xs text-blue-700 font-mono-code bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
                  Demo Pass: RESCUE2026
                </span>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-mono-code focus-visible:ring-2 focus-visible:ring-blue-600 outline-none font-bold"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full min-h-[52px] bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50 text-base"
            >
              {loginLoading ? 'Verifying Credentials...' : 'Unlock Command Center'}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-slate-200">
            <button
              onClick={() => setCurrentView('citizen')}
              className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition"
            >
              ← Back to Zero-Password Citizen Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACCESSIBLE WHITE-BASED ROLE SELECTION SCREEN
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-6 md:p-12">
      {/* Brand Header */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center font-bold text-white text-xl shadow-md shadow-blue-500/20">
            LM
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center">
              LifeMesh <span className="ml-2 text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-300 font-mono-code font-bold">OS</span>
            </h1>
            <p className="text-xs text-slate-600 font-medium">Offline P2P Crisis Relief & Medical Triage Engine</p>
          </div>
        </div>

        <div className="px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-mono-code font-bold flex items-center shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 mr-2 animate-pulse"></span>
          AIRPLANE_MODE_READY (OFFLINE)
        </div>
      </header>

      {/* Main Choice Screen */}
      <main className="max-w-5xl mx-auto w-full my-auto py-10">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Select Your Role to Access LifeMesh
          </h2>
          <p className="text-slate-600 text-sm md:text-base mt-2 font-medium">
            Engineered for severe floods, blackouts, and grid collapse (UN SDG 2: Zero Hunger & UN SDG 13: Climate Action). 100% free, on-device AI with zero paid APIs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: Citizen / Victim Portal (Zero Password) */}
          <div
            onClick={() => setCurrentView('citizen')}
            className="group cursor-pointer bg-white hover:bg-slate-50/80 border-2 border-slate-200 hover:border-blue-600 rounded-3xl p-8 transition-all hover:shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 bg-emerald-600 text-white font-extrabold text-xs px-4 py-1.5 rounded-bl-2xl uppercase tracking-wider font-mono-code shadow-sm">
              ZERO PASSWORD • 1-TAP ACCESS
            </div>

            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mb-6 group-hover:scale-105 transition shadow-sm">
              <User className="w-8 h-8" />
            </div>

            <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Citizen / Victim Portal</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-6 font-medium">
              Instant offline emergency SOS for stranded civilians. Features 1-tap pictograms, multilingual translation (Tamil / Tanglish / English), offline Sign-Language Camera SOS, voice input, high-contrast visual alerts, and real-time rescuer tracking with signed ration tokens.
            </p>

            <div className="flex items-center text-sm font-bold text-blue-600 group-hover:text-blue-800">
              <span>Open Citizen Portal Immediately</span>
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1.5 transition" />
            </div>
          </div>

          {/* Card 2: Rescuer / Command Center (Password Protected) */}
          <div
            onClick={() => setCurrentView('rescuer_login')}
            className="group cursor-pointer bg-white hover:bg-slate-50/80 border-2 border-slate-200 hover:border-emerald-600 rounded-3xl p-8 transition-all hover:shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 bg-blue-600 text-white font-extrabold text-xs px-4 py-1.5 rounded-bl-2xl uppercase tracking-wider font-mono-code shadow-sm">
              VERIFIED RESPONDER
            </div>

            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-6 group-hover:scale-105 transition shadow-sm">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Rescuer Command Center</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-6 font-medium">
              Full control console for disaster response teams. View START protocol casualty boards, zero-knowledge AES-256 decrypted records, interactive Chennai flood route maps with bridge detour simulation, two-way broadcast messaging, and QR pairing for offline mobile devices.
            </p>

            <div className="flex items-center text-sm font-bold text-emerald-600 group-hover:text-emerald-800">
              <span>Enter Rescuer Portal (Pass: RESCUE2026)</span>
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1.5 transition" />
            </div>
          </div>
        </div>
      </main>

      {/* Footer Compliance Banner */}
      <footer className="max-w-5xl mx-auto w-full pt-6 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between text-xs text-slate-600 font-medium">
        <div>
          <span className="text-slate-900 font-bold">100% Free & Open-Source:</span> Pure-NPM on-device Qwen2.5-0.5B (q4), Ed25519 signing, AES-256-GCM zero-knowledge privacy, MediaPipe offline sign detection.
        </div>
        <div className="text-xs font-mono-code text-blue-700 mt-2 md:mt-0 font-bold">
          TRANSPORT: SIMULATED_BLE_WIFI_DIRECT • LIVE OFFLINE WI-FI RELAY
        </div>
      </footer>
    </div>
  );
}
