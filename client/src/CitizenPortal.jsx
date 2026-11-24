import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { TRANSLATIONS } from './translations.js';
import {
  Heart,
  Baby,
  Activity,
  Waves,
  Utensils,
  Mic,
  Volume2,
  Bell,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Send,
  Radio,
  ShieldCheck,
  QrCode,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

export default function CitizenPortal({ onSwitchToRescuer }) {
  const [lang, setLang] = useState('en');
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  // Accessibility modes
  const [accessMode, setAccessMode] = useState('STANDARD'); // STANDARD | ELDERLY | BLIND | DEAF | MUTE
  const [visualFlash, setVisualFlash] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);

  // Form inputs
  const [sourceNode, setSourceNode] = useState('ward-1');
  const [message, setMessage] = useState('');
  const [medicalMode, setMedicalMode] = useState('general');
  const [conditionNotes, setConditionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Live incoming rescue state & active case
  const [activeCase, setActiveCase] = useState(null);
  const [replies, setReplies] = useState([]);
  const [tokenQrUrl, setTokenQrUrl] = useState('');
  const [claimStatus, setClaimStatus] = useState(null); // null | SUCCESS | DOUBLE_CLAIM_BLOCKED

  // Speak helper for Blind Mode
  const speak = (text) => {
    if (accessMode === 'BLIND' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Trigger deaf visual flash & device vibration
  const triggerAlertFeedback = () => {
    setVisualFlash(true);
    setTimeout(() => setVisualFlash(false), 2000);
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
  };

  // Voice recognition helper
  const handleToggleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice speech recognition not supported in this browser. Please type or use pictograms.');
      return;
    }
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRec();
    recognition.lang = lang === 'ta' ? 'ta-IN' : 'en-US';
    recognition.continuous = false;

    if (!voiceListening) {
      setVoiceListening(true);
      speak('Listening for your emergency message. Speak now.');
      recognition.start();
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setMessage(prev => prev ? `${prev} ${transcript}` : transcript);
        setVoiceListening(false);
        speak(`Captured: ${transcript}`);
      };
      recognition.onerror = () => {
        setVoiceListening(false);
      };
      recognition.onend = () => {
        setVoiceListening(false);
      };
    }
  };

  // Generate QR code for Ration Token
  const generateQr = async (token) => {
    if (!token) return;
    try {
      const dataStr = JSON.stringify({
        tokenId: token.tokenId,
        supplies: token.allocated_supplies,
        sig: token.ed25519_signature?.slice(0, 16) + '...'
      });
      const url = await QRCode.toDataURL(dataStr, { margin: 1, width: 180, color: { dark: '#07111E', light: '#06B6D4' } });
      setTokenQrUrl(url);
    } catch (e) {
      console.error(e);
    }
  };

  // Listen to SSE stream for live two-way updates from Rescuer
  useEffect(() => {
    const eventSource = new EventSource('/api/stream');

    eventSource.addEventListener('rescuer_reply', (e) => {
      try {
        const reply = JSON.parse(e.data);
        if (!activeCase || reply.case_id === activeCase.case_id || reply.source_node_id === sourceNode) {
          setReplies(prev => [reply, ...prev]);
          triggerAlertFeedback();
          speak(`New message from rescuer: ${reply.text}. Estimated arrival in ${reply.eta_minutes} minutes.`);
        }
      } catch (err) {
        console.error(err);
      }
    });

    eventSource.addEventListener('ration_updated', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (activeCase && activeCase.ration_token?.tokenId === data.tokenId) {
          setActiveCase(prev => ({
            ...prev,
            ration_token: data.token
          }));
          triggerAlertFeedback();
          speak('Your ration token was successfully verified and redeemed at the distribution hub.');
        }
      } catch (err) {
        console.error(err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [activeCase, sourceNode, accessMode]);

  // Submit SOS
  const handleSendSOS = async (customPayload = null) => {
    setSubmitting(true);
    setClaimStatus(null);
    try {
      const body = customPayload || {
        source_node_id: sourceNode,
        message: message || 'Emergency rescue assistance required.',
        medical_mode: medicalMode,
        condition_notes: conditionNotes,
        accessibility_mode: accessMode
      };

      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.status === 'DELIVERED_AND_TRIAGED') {
        setActiveCase(data.case_record);
        if (data.ration_token) {
          generateQr(data.ration_token);
        }
        triggerAlertFeedback();
        speak(`Emergency SOS successfully signed and delivered. Triage priority tag is ${data.case_record.triage_tag}. Rescuer team alerted.`);
      } else if (data.status === 'BUFFERED_OFFLINE') {
        alert('Mesh is currently partitioned! Packet safely stored in node queue and will be synced via Rescue Boat Data Mule.');
        speak('Network partition detected. Your message is safely buffered for rescue boat sync.');
      }
    } catch (err) {
      alert(`SOS dispatch error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 1-Tap Pictogram Preset SOS
  const handlePictogramTap = (mode, msg, defaultNotes) => {
    setMedicalMode(mode);
    setMessage(msg);
    setConditionNotes(defaultNotes);
    handleSendSOS({
      source_node_id: sourceNode,
      message: msg,
      medical_mode: mode,
      condition_notes: defaultNotes,
      accessibility_mode: accessMode
    });
  };

  // Claim Ration Token
  const handleClaimRation = async () => {
    if (!activeCase?.ration_token?.tokenId) return;
    try {
      const res = await fetch(`/api/rations/${activeCase.ration_token.tokenId}/redeem`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.status === 409 || data.double_claim_blocked) {
        setClaimStatus('DOUBLE_CLAIM_BLOCKED');
        triggerAlertFeedback();
        speak('Security alert: Double claim prevented. This ration token was already redeemed.');
      } else if (data.success) {
        setClaimStatus('SUCCESS');
        setActiveCase(prev => ({
          ...prev,
          ration_token: data.token
        }));
        triggerAlertFeedback();
        speak('Ration successfully claimed and verified with cryptographic signature.');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const isElderly = accessMode === 'ELDERLY';

  return (
    <div className={`min-h-screen bg-[#07111E] text-slate-100 p-4 md:p-8 transition-all ${visualFlash ? 'ring-8 ring-rose-500 bg-rose-950/40' : ''}`}>
      {/* Top Header & Role Switcher */}
      <header className="max-w-4xl mx-auto flex items-center justify-between pb-6 border-b border-[#1E3A5F]">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] font-mono-code text-emerald-400 uppercase tracking-wider font-semibold">
              OFFLINE LAN CITIZEN PORTAL • ZERO-PASSWORD ACCESS
            </span>
          </div>
          <h1 className={`${isElderly ? 'text-3xl' : 'text-2xl'} font-bold text-white tracking-tight mt-1`}>
            {t.app_title}
          </h1>
          <p className="text-xs text-slate-400">{t.zero_pass_subtitle}</p>
        </div>

        {/* Language & Switch Role */}
        <div className="flex items-center space-x-3">
          {/* Language Selector */}
          <div className="flex bg-[#0A192F] border border-[#1E3A5F] rounded-lg p-1 text-xs">
            {[
              { id: 'en', label: 'English' },
              { id: 'ta', label: 'தமிழ்' },
              { id: 'tanglish', label: 'Tanglish' }
            ].map(l => (
              <button
                key={l.id}
                onClick={() => {
                  setLang(l.id);
                  speak(`Language switched to ${l.label}`);
                }}
                className={`px-2.5 py-1 rounded font-medium transition ${lang === l.id ? 'bg-cyan-500 text-slate-900 font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Switch Role Button */}
          <button
            onClick={onSwitchToRescuer}
            className="px-3.5 py-2 bg-[#112240] hover:bg-cyan-950 text-cyan-300 border border-cyan-600/60 rounded-lg text-xs font-semibold flex items-center transition shadow-sm"
          >
            <span>{t.switch_role}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto mt-6 space-y-6">
        {/* Accessibility Control Bar */}
        <div className="bg-[#112240] border border-[#1E3A5F] rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
            <span className="font-semibold text-slate-300 flex items-center">
              <Eye className="w-4 h-4 mr-1.5 text-cyan-400" /> {t.accessibility_title}
            </span>
            <span className="text-[11px] font-mono-code text-cyan-300">ACTIVE: {accessMode}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {[
              { id: 'ELDERLY', label: t.mode_elderly, icon: Heart, color: 'text-amber-400' },
              { id: 'BLIND', label: t.mode_blind, icon: Volume2, color: 'text-emerald-400' },
              { id: 'DEAF', label: t.mode_deaf, icon: Bell, color: 'text-rose-400' },
              { id: 'MUTE', label: t.mode_mute, icon: Activity, color: 'text-cyan-400' }
            ].map(m => {
              const Icon = m.icon;
              const isActive = accessMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    const nextMode = isActive ? 'STANDARD' : m.id;
                    setAccessMode(nextMode);
                    if (nextMode === 'BLIND') speak('Blind mode enabled. Instructions and rescuer messages will be spoken automatically.');
                  }}
                  className={`p-3 rounded-xl border flex items-center space-x-2.5 transition text-left ${
                    isActive
                      ? 'bg-cyan-950/80 border-cyan-400 text-white pulse-glow'
                      : 'bg-[#0A192F] border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${m.color}`} />
                  <span className={`${isElderly ? 'text-sm font-bold' : 'text-xs font-medium'}`}>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 1-Tap Pictogram Emergency Grid */}
        <div className="bg-[#112240] border border-[#1E3A5F] rounded-2xl p-5 shadow-lg">
          <div className="mb-4">
            <h2 className={`${isElderly ? 'text-xl' : 'text-sm'} font-bold text-white uppercase tracking-wider flex items-center`}>
              <Radio className="w-4 h-4 mr-2 text-rose-500 animate-pulse" />
              {t.emergency_title}
            </h2>
            <p className="text-xs text-slate-400">{t.emergency_subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              {
                id: 'cardiac',
                mode: 'cardiac',
                title: t.cardiac,
                msg: 'Emergency! Severe chest pain and breathing difficulty (Nenju vali). Patient breathless.',
                notes: 'Suspected acute coronary syndrome, immediate oxygen and ECG needed',
                icon: Heart,
                btnColor: 'from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600',
                border: 'border-rose-500/50'
              },
              {
                id: 'pregnancy',
                mode: 'pregnancy',
                title: t.pregnancy,
                msg: 'Full-term pregnant mother in severe labour pain (Prasavam vali). Water broke, trapped in flood.',
                notes: 'G2P1, 39 weeks, contractions 3 mins apart, stretcher/boat required',
                icon: Baby,
                btnColor: 'from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500',
                border: 'border-pink-500/50'
              },
              {
                id: 'diabetic',
                mode: 'diabetic',
                title: t.diabetic,
                msg: 'Diabetic patient unconscious/severe hypoglycemia (Sugar low mayakkam). Need insulin.',
                notes: 'Type 1 diabetic, blood glucose low, glucagon / insulin needed',
                icon: Activity,
                btnColor: 'from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500',
                border: 'border-amber-500/50'
              },
              {
                id: 'trapped',
                mode: 'trapped',
                title: t.trapped,
                msg: 'Water level rising to 1st floor! Family with baby trapped on rooftop. Rescue boat needed urgently.',
                notes: '4 people stranded, water current rapid, no roof shelter',
                icon: Waves,
                btnColor: 'from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600',
                border: 'border-cyan-500/50'
              },
              {
                id: 'supplies',
                mode: 'general',
                title: t.supplies,
                msg: 'Drinking water and food supplies completely exhausted. 5 elderly people dehydrated.',
                notes: 'Clean drinking water and emergency nutrition ration pack needed',
                icon: Utensils,
                btnColor: 'from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600',
                border: 'border-emerald-500/50'
              }
            ].map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  disabled={submitting}
                  onClick={() => handlePictogramTap(item.mode, item.msg, item.notes)}
                  className={`p-4 rounded-xl bg-gradient-to-b ${item.btnColor} text-white border ${item.border} flex flex-col items-center justify-center text-center shadow-md transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50`}
                >
                  <Icon className={`${isElderly ? 'w-10 h-10' : 'w-7 h-7'} mb-2`} />
                  <span className={`${isElderly ? 'text-sm font-extrabold' : 'text-xs font-bold'} leading-tight`}>
                    {item.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Input & Voice Option */}
        <div className="bg-[#112240] border border-[#1E3A5F] rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className={`${isElderly ? 'text-base' : 'text-xs'} font-bold uppercase tracking-wider text-slate-300`}>
              {t.or_type}
            </h3>
            <button
              onClick={handleToggleVoiceInput}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                voiceListening ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{voiceListening ? 'Listening...' : 'Voice Input (Mic)'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Your Shelter / Ward Location:</label>
              <select
                value={sourceNode}
                onChange={e => setSourceNode(e.target.value)}
                className="w-full bg-[#0A192F] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="ward-1">Ward-1 Velachery Shelter</option>
                <option value="ward-2">Ward-2 Pallikaranai High School</option>
                <option value="ward-3">Ward-3 Madipakkam Community Hall</option>
                <option value="ward-4">Ward-4 Adyar Bridge Post</option>
                <option value="ward-5">Ward-5 Saidapet Metro Elevated</option>
                <option value="ward-6">Ward-6 Thoraipakkam IT Park Roof</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">{t.sensitive_notes}</label>
              <input
                type="text"
                placeholder="e.g. Bedridden senior, needs oxygen (Decrypted only at Hub)"
                value={conditionNotes}
                onChange={e => setConditionNotes(e.target.value)}
                className="w-full bg-[#0A192F] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <textarea
              rows="2"
              placeholder={t.custom_placeholder}
              value={message}
              onChange={e => setMessage(e.target.value)}
              className={`w-full bg-[#0A192F] border border-slate-700 rounded-xl p-3 text-white ${isElderly ? 'text-base' : 'text-xs'}`}
            ></textarea>
          </div>

          <button
            onClick={() => handleSendSOS()}
            disabled={submitting || !message}
            className={`w-full py-3 bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-50 ${
              isElderly ? 'text-lg' : 'text-sm'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? t.sending : t.send_sos}</span>
          </button>
        </div>

        {/* Live Two-Way Rescue Tracker & Incoming Rescuer Messages */}
        <div className="bg-[#112240] border border-[#1E3A5F] rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E3A5F]">
            <div>
              <h2 className={`${isElderly ? 'text-lg' : 'text-sm'} font-bold text-white uppercase tracking-wider flex items-center`}>
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 mr-2 animate-pulse"></span>
                {t.rescue_status_title}
              </h2>
              <p className="text-[11px] text-slate-400">Real-time two-way sync with Central Relief Hub via SSE</p>
            </div>
            {activeCase && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono-code ${
                activeCase.triage_tag === 'RED' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-black'
              }`}>
                TAG: {activeCase.triage_tag} (Priority: {activeCase.triage_score})
              </span>
            )}
          </div>

          {!activeCase ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              {t.no_active_sos}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mission Dispatch Summary */}
              <div className="p-4 bg-[#0A192F] border border-cyan-900/50 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{t.route_eta}</span>
                  <span className="font-mono-code text-cyan-400 font-bold text-base">
                    {activeCase.mission_route?.eta_minutes || 12} MINS
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Assigned Transit Mode:</span>
                  <span className="text-emerald-400 font-medium">
                    {activeCase.mission_route?.transport_mode || 'Amphibious Rescue Boat'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{t.supplies_on_way}</span>
                  <span className="text-white font-mono-code">
                    {Object.entries(activeCase.allocated_supplies || {}).map(([k, v]) => `${k}:${v}`).join(', ') || 'Standard Food/Water Pack'}
                  </span>
                </div>
              </div>

              {/* Digital Signed Ration Token Card */}
              {activeCase.ration_token && (
                <div className="p-4 bg-gradient-to-r from-[#0A192F] to-[#0E2A47] border border-cyan-500/40 rounded-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono-code text-cyan-400 uppercase tracking-wider block">
                        UN SDG 2: ZERO HUNGER
                      </span>
                      <h4 className="font-bold text-white text-sm mt-0.5">{t.token_title}</h4>
                      <p className="text-[11px] font-mono-code text-slate-300 mt-1">
                        Token ID: <span className="text-cyan-300 font-bold">{activeCase.ration_token.tokenId}</span>
                      </p>
                      <p className="text-[10px] text-emerald-400 mt-0.5">
                        Ed25519 Sig: {activeCase.ration_token.ed25519_signature?.slice(0, 24)}...
                      </p>

                      <div className="mt-3">
                        <button
                          onClick={handleClaimRation}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                            activeCase.ration_token.status === 'REDEEMED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md'
                          }`}
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>
                            {activeCase.ration_token.status === 'REDEEMED' ? t.redeemed : t.redeem_btn}
                          </span>
                        </button>
                        {claimStatus === 'DOUBLE_CLAIM_BLOCKED' && (
                          <div className="mt-2 text-rose-400 text-xs font-semibold flex items-center">
                            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> DOUBLE_CLAIM_BLOCKED — Fraud Prevented!
                          </div>
                        )}
                      </div>
                    </div>

                    {/* QR Code */}
                    {tokenQrUrl && (
                      <div className="bg-white p-1.5 rounded-lg shadow-md shrink-0">
                        <img src={tokenQrUrl} alt="Ration QR" className="w-24 h-24" />
                        <span className="block text-center text-[8px] font-bold text-slate-800">SCAN TO VERIFY</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Incoming Messages from Laptop Rescuer */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {t.rescuer_msg_incoming}
                </h4>
                {replies.length === 0 ? (
                  <div className="p-3 bg-[#0A192F] rounded-lg text-slate-500 text-xs text-center border border-slate-800">
                    Awaiting dispatch transmission from field coordinator...
                  </div>
                ) : (
                  replies.map(r => (
                    <div key={r.id} className="p-3 bg-cyan-950/40 border border-cyan-800/60 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-cyan-300 font-mono-code">{r.rescuer_callsign}</span>
                        <span className="text-slate-400 text-[10px]">{new Date(r.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-white font-medium">"{r.text}"</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
