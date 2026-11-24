import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  ShieldAlert,
  Radio,
  Share2,
  FileText,
  Lock,
  QrCode,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Send,
  RefreshCw,
  LogOut,
  Clock,
  Compass,
  ArrowRight
} from 'lucide-react';

export default function RescuerPortal({ onLogout }) {
  const [state, setState] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | map | rations | batch | logs
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [notification, setNotification] = useState(null);

  // Two-way reply input state per case
  const [replyTextMap, setReplyTextMap] = useState({});
  const [selectedCaseForMap, setSelectedCaseForMap] = useState(null);

  // Batch evaluation
  const [batchReport, setBatchReport] = useState('');
  const [batchRunning, setBatchRunning] = useState(false);

  const fetchState = async () => {
    try {
      const [sRes, nRes] = await Promise.all([
        fetch('/api/state').then(r => r.json()),
        fetch('/api/network-info').then(r => r.json())
      ]);
      setState(sRes);
      setNetworkInfo(nRes);

      if (nRes?.phone_url && !qrCodeUrl) {
        const qr = await QRCode.toDataURL(nRes.phone_url, {
          width: 200,
          margin: 1,
          color: { dark: '#07111E', light: '#06B6D4' }
        });
        setQrCodeUrl(qr);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchState();

    // Subscribe to SSE real-time stream
    const eventSource = new EventSource('/api/stream');

    eventSource.addEventListener('sos_created', (e) => {
      const data = JSON.parse(e.data);
      showNotice(`NEW SOS RECEIVED! Tag: ${data.case_record.triage_tag} (${data.case_record.source_name})`, 'alert');
      fetchState();
    });

    eventSource.addEventListener('rescuer_reply', () => {
      fetchState();
    });

    eventSource.addEventListener('case_updated', () => {
      fetchState();
    });

    eventSource.addEventListener('ration_updated', () => {
      fetchState();
    });

    eventSource.addEventListener('node_toggled', () => {
      fetchState();
    });

    eventSource.addEventListener('tamper_event', (e) => {
      const data = JSON.parse(e.data);
      showNotice(`SECURITY ALERT: ${data.reason || 'Tamper detected'}!`, 'alert');
      fetchState();
    });

    return () => {
      eventSource.close();
    };
  }, []);

  const showNotice = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4500);
  };

  // Send two-way message to Citizen Phone
  const handleSendReply = async (caseId, text) => {
    if (!text) return;
    try {
      const res = await fetch(`/api/cases/${caseId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply_text: text, rescuer_callsign: 'COMMAND-RELIEF-HUB' })
      });
      const data = await res.json();
      if (data.success) {
        showNotice(`Update broadcasted to citizen phone: "${text}"`);
        setReplyTextMap(prev => ({ ...prev, [caseId]: '' }));
        fetchState();
      }
    } catch (err) {
      showNotice(`Reply failed: ${err.message}`, 'alert');
    }
  };

  // Claim / Verify Ration directly from Rescuer Portal
  const handleClaimRation = async (tokenId) => {
    try {
      const res = await fetch(`/api/rations/${tokenId}/redeem`, { method: 'POST' });
      const data = await res.json();
      if (res.status === 409 || data.double_claim_blocked) {
        showNotice(`DOUBLE_CLAIM_BLOCKED — Fraud Attempt Prevented!`, 'alert');
      } else if (data.success) {
        showNotice(`Ration Token ${tokenId} verified with Ed25519 signature & redeemed!`);
      }
      fetchState();
    } catch (err) {
      showNotice(`Claim error: ${err.message}`, 'alert');
    }
  };

  // Toggle Node
  const handleToggleNode = async (nodeId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
      const res = await fetch(`/api/nodes/${nodeId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      showNotice(`Node ${data.name} set to ${data.new_status}. Route ETAs recalculated.`);
      fetchState();
    } catch (err) {
      showNotice(err.message, 'alert');
    }
  };

  // Rescue Boat Mule Sync
  const handleMuleSync = async () => {
    try {
      const res = await fetch('/api/data-mule/sync', { method: 'POST' });
      const data = await res.json();
      showNotice(`Data Mule rescue boat synced ${data.sync_summary.packets_merged} packets via CRDT!`);
      fetchState();
    } catch (err) {
      showNotice(err.message, 'alert');
    }
  };

  // Simulate Tamper
  const handleSimulateTamper = async () => {
    try {
      const res = await fetch('/api/simulate-tamper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_node_id: 'ward-1',
          tampered_field: 'message',
          rogue_value: 'TAMPERED: ROUTING SPOOF'
        })
      });
      const data = await res.json();
      if (data.rejected) {
        showNotice(`ROGUE ATTACK DETECTED! Ed25519 mismatch. Node ${data.quarantined_node} quarantined!`, 'alert');
      }
      fetchState();
    } catch (err) {
      showNotice(err.message, 'alert');
    }
  };

  // Close Case
  const handleCloseCase = async (caseId) => {
    try {
      const res = await fetch(`/api/cases/${caseId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signer_node_id: 'relief-hub', action_note: 'Resolved on-site by field medics.' })
      });
      const data = await res.json();
      showNotice(`Case ${caseId} closed with relief hub signature.`);
      fetchState();
    } catch (err) {
      showNotice(err.message, 'alert');
    }
  };

  // Run Batch Test
  const handleRunBatch = async () => {
    setBatchRunning(true);
    try {
      const res = await fetch('/api/batch-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: [
            { id: 'SOS-01', source_node_id: 'ward-1', message: 'Nenju vali, elderly man unconscious', medical_mode: 'cardiac' },
            { id: 'SOS-02', source_node_id: 'ward-2', message: 'Prasavam valikudhu, full term pregnancy in school shelter', medical_mode: 'pregnancy' },
            { id: 'SOS-03', source_node_id: 'ward-3', message: 'Sugar low mayakkam, insulin theva', medical_mode: 'diabetic' },
            { id: 'SOS-04', source_node_id: 'ward-6', message: 'Rooftop trapped thanni rising need drinking water and food for 4 members', medical_mode: 'trapped' }
          ]
        })
      });
      const data = await res.json();
      setBatchReport(data.markdown_report);
      showNotice('Batch evaluation complete!');
      fetchState();
    } catch (err) {
      showNotice(err.message, 'alert');
    } finally {
      setBatchRunning(false);
    }
  };

  // Node positions on SVG Map (synthetic Chennai relief coordinates)
  const nodeMapCoords = {
    'relief-hub': { x: 380, y: 70, label: 'Central Hub', color: '#10B981' },
    'ward-5': { x: 300, y: 160, label: 'Saidapet Metro (Bridge 2)', color: '#06B6D4' },
    'ward-4': { x: 420, y: 180, label: 'Adyar Bridge (Bridge 1)', color: '#06B6D4' },
    'ward-1': { x: 260, y: 260, label: 'Ward-1 Velachery Shelter', color: '#F59E0B' },
    'ward-3': { x: 200, y: 310, label: 'Ward-3 Madipakkam', color: '#F59E0B' },
    'ward-2': { x: 270, y: 390, label: 'Ward-2 Pallikaranai High School', color: '#F59E0B' },
    'ward-6': { x: 440, y: 340, label: 'Ward-6 Thoraipakkam IT Roof', color: '#F59E0B' }
  };

  return (
    <div className="flex h-screen bg-[#07111E] text-slate-100 overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0A192F] border-r border-[#1E3A5F] flex flex-col justify-between shrink-0">
        <div>
          {/* Brand */}
          <div className="p-5 border-b border-[#1E3A5F] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-500 flex items-center justify-center font-bold text-white text-base shadow-lg shadow-cyan-500/20">
                LM
              </div>
              <div>
                <h1 className="font-bold text-white text-xs tracking-tight flex items-center">
                  LifeMesh <span className="ml-1 px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px]">RESCUER</span>
                </h1>
                <p className="text-[10px] text-slate-400">Mission Router & Triage OS</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
              title="Logout from Rescuer Portal"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1.5 text-xs font-medium">
            {[
              { id: 'dashboard', label: 'Command Center', icon: Radio },
              { id: 'map', label: 'Mission Router & Map', icon: Compass },
              { id: 'rations', label: 'Ration Tokens (SDG 2)', icon: CheckCircle },
              { id: 'batch', label: 'Batch AI Triage Test', icon: FileText },
              { id: 'logs', label: 'Security & Mule Logs', icon: ShieldAlert }
            ].map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition ${
                    activeTab === item.id
                      ? 'bg-[#112240] text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#112240]/40'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Connect Phone QR Card */}
          <div className="mx-4 p-3 bg-[#112240] border border-[#1E3A5F] rounded-xl text-center">
            <span className="text-[10px] font-mono-code text-cyan-400 uppercase tracking-wider block font-bold mb-1.5">
              OFFLINE LAN PHONE SYNC
            </span>
            {qrCodeUrl ? (
              <div className="flex flex-col items-center">
                <div className="bg-white p-1 rounded-lg shadow-md">
                  <img src={qrCodeUrl} alt="LAN QR" className="w-24 h-24" />
                </div>
                <span className="text-[9px] text-slate-300 font-mono-code mt-1.5 truncate max-w-[190px]">
                  {networkInfo?.phone_url}
                </span>
                <span className="text-[9px] text-emerald-400 font-semibold mt-0.5">
                  Scan to open Citizen Portal on phone
                </span>
              </div>
            ) : (
              <div className="text-[10px] text-slate-400">Loading LAN IP...</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1E3A5F] bg-[#081528] text-[10px] text-slate-400 space-y-1">
          <div className="flex items-center justify-between">
            <span>LAN IPv4:</span>
            <span className="text-cyan-400 font-mono-code">{networkInfo?.lan_ip || '127.0.0.1'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>TRANSPORT:</span>
            <span className="text-emerald-400 font-mono-code">SSE + BLE MESH</span>
          </div>
        </div>
      </aside>

      {/* MAIN VIEW */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP BAR */}
        <header className="h-16 bg-[#0A192F] border-b border-[#1E3A5F] px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-4 text-xs font-mono-code">
            <span className="px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-600/50 text-emerald-300 flex items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
              AIRPLANE_MODE_READY (OFFLINE)
            </span>
            <span className="text-slate-400">
              LAN: {networkInfo?.lan_ip}:5173
            </span>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <button
              onClick={handleMuleSync}
              className="px-3 py-1.5 bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 border border-cyan-600/60 rounded-lg font-medium transition"
            >
              🚤 Rescue Boat Sync
            </button>
            <button
              onClick={handleSimulateTamper}
              className="px-3 py-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-700/60 rounded-lg font-medium transition"
            >
              ⚠️ Rogue Tamper Attack
            </button>
            <button
              onClick={() => fetch('/api/inventory/reset', { method: 'POST' }).then(() => fetchState())}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-lg font-medium transition"
            >
              Reset Stock
            </button>
          </div>
        </header>

        {/* NOTIFICATION */}
        {notification && (
          <div className={`mx-6 mt-3 p-3 rounded-xl border text-xs flex items-center justify-between ${
            notification.type === 'alert'
              ? 'bg-rose-950/90 border-rose-600 text-rose-200 red-glow'
              : 'bg-emerald-950/90 border-emerald-600 text-emerald-200 green-glow'
          }`}>
            <span>{notification.text}</span>
            <button onClick={() => setNotification(null)} className="font-bold text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* CONTENT */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: COMMAND CENTER DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Finite Stock Bar */}
              <div className="grid grid-cols-5 gap-4">
                {[
                  { label: 'Water Packs', key: 'water_packs', icon: '💧', total: 6 },
                  { label: 'Food Rations', key: 'food_rations', icon: '🍞', total: 4 },
                  { label: 'Medical Kits', key: 'medical_kits', icon: '🩹', total: 3 },
                  { label: 'Insulin Packs', key: 'insulin_packs', icon: '💉', total: 2 },
                  { label: 'Rescue Boats', key: 'rescue_boats', icon: '🚤', total: 2 }
                ].map(item => {
                  const count = state?.inventory?.[item.key] ?? 0;
                  const pct = Math.round((count / item.total) * 100);
                  return (
                    <div key={item.key} className="bg-[#112240] border border-[#1E3A5F] rounded-xl p-4">
                      <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span>{item.label}</span>
                        <span>{item.icon}</span>
                      </div>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-2xl font-bold text-white font-mono-code">{count}</span>
                        <span className="text-slate-400 text-xs">/ {item.total}</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${count <= 1 ? 'bg-rose-500' : 'bg-cyan-500'}`}
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Verified Casualty Board with Two-Way Reply */}
              <div className="grid grid-cols-12 gap-6">
                {/* Cases Column (8 Cols) */}
                <div className="col-span-8 bg-[#112240] border border-[#1E3A5F] rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-between pb-3 border-b border-[#1E3A5F] mb-4">
                    <div>
                      <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 mr-2 animate-pulse"></span>
                        Verified Casualty Board (Sorted by Triage Priority)
                      </h2>
                      <p className="text-[11px] text-slate-400">Decrypted exclusively at Central Relief Hub via AES-256-GCM</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono-code bg-slate-800 text-slate-300">
                      {state?.casualty_board?.length || 0} Cases Active
                    </span>
                  </div>

                  <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
                    {(!state?.casualty_board || state.casualty_board.length === 0) ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        No casualties reported yet. Scan QR on phone or submit an SOS to populate.
                      </div>
                    ) : (
                      state.casualty_board.map(c => {
                        const isRed = c.triage_tag === 'RED';
                        const isYellow = c.triage_tag === 'YELLOW';
                        return (
                          <div
                            key={c.case_id}
                            className={`p-4 rounded-xl border transition-all ${
                              c.status === 'CLOSED'
                                ? 'bg-[#0A192F]/60 border-slate-800 opacity-60'
                                : isRed
                                ? 'bg-rose-950/20 border-rose-800/80 red-glow'
                                : isYellow
                                ? 'bg-amber-950/20 border-amber-800/60'
                                : 'bg-emerald-950/20 border-emerald-800/60'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-2">
                                <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold font-mono-code ${
                                  isRed ? 'bg-rose-600 text-white' : isYellow ? 'bg-amber-500 text-black' : 'bg-emerald-600 text-white'
                                }`}>
                                  {c.triage_tag} ({c.triage_score})
                                </span>
                                <span className="text-xs font-semibold text-white">{c.source_name}</span>
                                <span className="text-[10px] font-mono-code text-cyan-400">
                                  {c.mission_route?.distance_km} km • ETA: {c.mission_route?.eta_minutes} mins
                                </span>
                              </div>

                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => setSelectedCaseForMap(c)}
                                  className="px-2 py-0.5 text-[10px] bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700 rounded transition"
                                >
                                  View Route Map
                                </button>
                                {c.status !== 'CLOSED' && (
                                  <button
                                    onClick={() => handleCloseCase(c.case_id)}
                                    className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-emerald-900 text-slate-300 hover:text-emerald-200 border border-slate-700 rounded transition"
                                  >
                                    Resolve Case
                                  </button>
                                )}
                              </div>
                            </div>

                            <p className="text-xs text-slate-200 mt-2">"{c.message}"</p>

                            {/* Hub Decrypted Medical Record */}
                            {c.decrypted_condition_notes && (
                              <div className="mt-2 p-2 bg-[#0A192F] rounded-lg border border-cyan-900/60 text-[11px] text-cyan-200">
                                <span className="font-semibold text-cyan-400">🔒 Hub Decrypted Medical Note:</span> {c.decrypted_condition_notes}
                              </div>
                            )}

                            {/* Mission Route & Supplies */}
                            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] bg-[#0A192F]/80 p-2.5 rounded-lg border border-slate-800">
                              <div>
                                <span className="text-slate-400 block">Assigned Transport Mode:</span>
                                <span className="text-white font-medium">{c.mission_route?.transport_mode}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block">Supplies to Pack:</span>
                                <span className="text-emerald-300 font-mono-code">
                                  {Object.entries(c.allocated_supplies || {}).map(([k, v]) => `${k}:${v}`).join(', ') || 'Standard Pack'}
                                </span>
                              </div>
                            </div>

                            {/* Prominent Claim / Verify Ration Button */}
                            {c.ration_token && (
                              <div className="mt-2.5 flex items-center justify-between bg-slate-900/60 p-2 rounded-lg border border-cyan-800/40">
                                <div className="text-[11px]">
                                  <span className="text-slate-400">Ration Token:</span>{' '}
                                  <span className="font-mono-code text-cyan-300 font-semibold">{c.ration_token.tokenId}</span>
                                </div>
                                <button
                                  onClick={() => handleClaimRation(c.ration_token.tokenId)}
                                  className={`px-3 py-1 rounded text-[11px] font-bold transition flex items-center space-x-1 ${
                                    c.ration_token.status === 'REDEEMED'
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                                      : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                                  }`}
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  <span>{c.ration_token.status === 'REDEEMED' ? 'VERIFIED & REDEEMED' : 'Claim / Verify Ration'}</span>
                                </button>
                              </div>
                            )}

                            {/* Two-Way Messaging Section (Laptop -> Phone) */}
                            <div className="mt-3 pt-3 border-t border-slate-800">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                                Two-Way Update to Citizen Phone (Live SSE):
                              </span>
                              <div className="flex space-x-2">
                                <input
                                  type="text"
                                  placeholder="Type live instructions (e.g. Boat dispatched, move to 2nd floor)..."
                                  value={replyTextMap[c.case_id] || ''}
                                  onChange={e => setReplyTextMap({ ...replyTextMap, [c.case_id]: e.target.value })}
                                  className="flex-1 bg-[#0A192F] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                                />
                                <button
                                  onClick={() => handleSendReply(c.case_id, replyTextMap[c.case_id])}
                                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>Send</span>
                                </button>
                              </div>

                              {/* Quick 1-click Preset Replies */}
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {[
                                  "Rescue Boat Dispatched — Stay Safe on Roof",
                                  "Medical Team En Route with Supplies",
                                  "Move to Higher Floor Immediately"
                                ].map((preset, i) => (
                                  <button
                                    key={i}
                                    onClick={() => handleSendReply(c.case_id, preset)}
                                    className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-cyan-950 hover:text-cyan-300 text-slate-300 border border-slate-700 transition"
                                  >
                                    + {preset}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 7 Nodes Topology & Chaos Toggles (4 Cols) */}
                <div className="col-span-4 space-y-6">
                  <div className="bg-[#112240] border border-[#1E3A5F] rounded-2xl p-4 shadow-lg">
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#1E3A5F]">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white">7 P2P Mesh Nodes</h3>
                      <span className="text-[10px] text-cyan-400 font-mono-code">Click to Kill/Restore</span>
                    </div>

                    <div className="space-y-2">
                      {state?.nodes?.map(n => {
                        const isOnline = n.status === 'ONLINE';
                        const isQuarantined = n.status === 'QUARANTINED';
                        return (
                          <div
                            key={n.id}
                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition ${
                              isQuarantined
                                ? 'bg-rose-950/40 border-rose-600 text-rose-300'
                                : isOnline
                                ? 'bg-[#0A192F] border-slate-800 text-slate-200'
                                : 'bg-slate-900/40 border-slate-800 text-slate-500'
                            }`}
                          >
                            <div>
                              <div className="font-semibold text-[11px]">{n.name}</div>
                              <div className="text-[9px] text-slate-400 font-mono-code">
                                {n.role} {n.store_and_forward_queue?.length > 0 && `(Queued: ${n.store_and_forward_queue.length})`}
                              </div>
                            </div>
                            <button
                              onClick={() => handleToggleNode(n.id, n.status)}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono-code font-bold ${
                                isOnline
                                  ? 'bg-emerald-950 border border-emerald-600 text-emerald-300'
                                  : 'bg-rose-950 border border-rose-700 text-rose-300'
                              }`}
                            >
                              {n.status}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INTERACTIVE OFFLINE ROUTE MAP & MISSION PLANNER */}
          {activeTab === 'map' && (
            <div className="bg-[#112240] border border-[#1E3A5F] rounded-2xl p-6 shadow-lg space-y-6">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
                  <Compass className="w-4 h-4 mr-2 text-cyan-400" />
                  Interactive Offline Chennai Flood Route Map & Bridge Simulator
                </h2>
                <p className="text-xs text-slate-400">
                  Visualizes dynamic transit routes from Central Relief Hub to flood wards. Toggling bridge nodes (Adyar Bridge / Saidapet Metro) automatically reroutes rescuers via amphibious boat detours!
                </p>
              </div>

              <div className="grid grid-cols-12 gap-6">
                {/* SVG MAP */}
                <div className="col-span-8 bg-[#07111E] border border-slate-800 rounded-xl p-4 flex items-center justify-center relative">
                  <svg viewBox="0 0 600 480" className="w-full h-[420px]">
                    {/* Background flood zones */}
                    <rect x="0" y="0" width="600" height="480" fill="#07111E" />
                    <circle cx="270" cy="390" r="70" fill="rgba(6, 182, 212, 0.08)" />
                    <circle cx="260" cy="260" r="80" fill="rgba(6, 182, 212, 0.08)" />

                    {/* Links / Edges */}
                    {state?.edges?.map((e, idx) => {
                      const from = nodeMapCoords[e.from];
                      const to = nodeMapCoords[e.to];
                      if (!from || !to) return null;

                      const fromNode = state?.nodes?.find(n => n.id === e.from);
                      const toNode = state?.nodes?.find(n => n.id === e.to);
                      const isOnline = fromNode?.status === 'ONLINE' && toNode?.status === 'ONLINE';

                      return (
                        <line
                          key={idx}
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke={isOnline ? '#06B6D4' : '#F43F5E'}
                          strokeWidth={isOnline ? '2.5' : '1.5'}
                          strokeDasharray={isOnline ? 'none' : '4 4'}
                          opacity={isOnline ? 0.8 : 0.4}
                        />
                      );
                    })}

                    {/* Nodes */}
                    {Object.entries(nodeMapCoords).map(([id, n]) => {
                      const nodeData = state?.nodes?.find(item => item.id === id);
                      const isOnline = nodeData?.status === 'ONLINE';
                      const isQuarantine = nodeData?.status === 'QUARANTINED';

                      return (
                        <g key={id} className="cursor-pointer" onClick={() => handleToggleNode(id, nodeData?.status)}>
                          <circle
                            cx={n.x}
                            cy={n.y}
                            r={id === 'relief-hub' ? 14 : 10}
                            fill={isQuarantine ? '#F43F5E' : isOnline ? n.color : '#475569'}
                            stroke="#ffffff"
                            strokeWidth="2"
                          />
                          <text
                            x={n.x}
                            y={n.y - 14}
                            textAnchor="middle"
                            fill="#E2E8F0"
                            fontSize="10"
                            fontWeight="bold"
                            className="select-none"
                          >
                            {n.label}
                          </text>
                          <text
                            x={n.x}
                            y={n.y + 20}
                            textAnchor="middle"
                            fill={isOnline ? '#10B981' : '#F43F5E'}
                            fontSize="8"
                            fontFamily="monospace"
                          >
                            {nodeData?.status || 'ONLINE'}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Mission Dispatch Drawer */}
                <div className="col-span-4 bg-[#0A192F] border border-slate-800 rounded-xl p-4 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                    Mission Dispatch Planner
                  </h3>

                  {selectedCaseForMap ? (
                    <div className="space-y-3 text-xs">
                      <div className="p-3 bg-[#112240] rounded-lg border border-cyan-800">
                        <span className="text-slate-400 text-[10px] block">TARGET VICTIM:</span>
                        <div className="font-bold text-white text-sm">{selectedCaseForMap.source_name}</div>
                        <div className="text-[10px] font-mono-code text-cyan-300">
                          {selectedCaseForMap.mission_route?.destination?.lat}° N, {selectedCaseForMap.mission_route?.destination?.lng}° E
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Route Status:</span>
                          <span className="text-emerald-400 font-mono-code font-bold">
                            {selectedCaseForMap.mission_route?.route_status}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Distance:</span>
                          <span className="text-white font-mono-code">{selectedCaseForMap.mission_route?.distance_km} km</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Calculated ETA:</span>
                          <span className="text-cyan-400 font-bold font-mono-code text-sm">
                            {selectedCaseForMap.mission_route?.eta_minutes} MINUTES
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Transit Mode:</span>
                          <span className="text-white">{selectedCaseForMap.mission_route?.transport_mode}</span>
                        </div>
                      </div>

                      <div className="p-3 bg-[#112240] rounded-lg border border-slate-800">
                        <span className="text-slate-400 text-[10px] block mb-1">SUPPLIES CHECKLIST:</span>
                        <span className="text-emerald-300 font-mono-code">
                          {Object.entries(selectedCaseForMap.allocated_supplies || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || 'Standard Food/Water Kit'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 p-6 text-center">
                      Select a case on the Casualty Board to inspect its route plan.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DEDICATED RATION TOKENS (SDG 2) */}
          {activeTab === 'rations' && (
            <div className="bg-[#112240] border border-[#1E3A5F] rounded-2xl p-6 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#1E3A5F]">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-emerald-400" />
                    Ed25519-Signed Digital Ration Tokens (UN SDG 2: Zero Hunger)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Cryptographically signed by Relief Hub to prevent double-allocation and ensure fair offline micro-logistics.
                  </p>
                </div>
                <span className="text-xs font-mono-code text-cyan-400">
                  {state?.ration_tokens?.length || 0} Tokens Issued
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(!state?.ration_tokens || state.ration_tokens.length === 0) ? (
                  <div className="col-span-2 p-8 text-center text-slate-500 text-xs">
                    No ration tokens issued yet. Dispatch an SOS to generate signed tokens.
                  </div>
                ) : (
                  state.ration_tokens.map(token => {
                    const isRedeemed = token.status === 'REDEEMED';
                    return (
                      <div key={token.tokenId} className="p-4 bg-[#0A192F] border border-cyan-800/60 rounded-xl space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs font-bold text-white font-mono-code">{token.tokenId}</span>
                            <div className="text-[11px] text-slate-300">{token.source_name}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono-code ${
                            isRedeemed ? 'bg-emerald-950 text-emerald-300 border border-emerald-600' : 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                          }`}>
                            {token.status}
                          </span>
                        </div>

                        <div className="text-xs font-mono-code text-emerald-300">
                          Supplies: {Object.entries(token.allocated_supplies || {}).map(([k, v]) => `${k}:${v}`).join(', ') || 'Standard Kit'}
                        </div>

                        <div className="text-[10px] font-mono-code text-slate-400 truncate">
                          Sig: {token.ed25519_signature?.slice(0, 32)}...
                        </div>

                        <button
                          onClick={() => handleClaimRation(token.tokenId)}
                          className={`w-full py-2 rounded-lg text-xs font-bold transition ${
                            isRedeemed
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-600 hover:bg-rose-950 hover:text-rose-300 hover:border-rose-600'
                              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md'
                          }`}
                        >
                          {isRedeemed ? 'Re-Claim (Test Fraud Rejection)' : 'Claim / Verify Ration Token'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: BATCH AI TRIAGE TEST */}
          {activeTab === 'batch' && (
            <div className="bg-[#112240] border border-[#1E3A5F] rounded-2xl p-6 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Automated AI Batch Triage Verification
                  </h2>
                  <p className="text-xs text-slate-400">
                    Runs 4 Tamil/Tanglish/English emergency scenarios through on-device Qwen2.5-0.5B-Instruct + START protocol override.
                  </p>
                </div>
                <button
                  onClick={handleRunBatch}
                  disabled={batchRunning}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  {batchRunning ? 'Triaging...' : 'Execute Batch Test'}
                </button>
              </div>

              {batchReport ? (
                <div className="p-4 bg-[#0A192F] border border-slate-800 rounded-xl font-mono-code text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">
                  {batchReport}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  Click "Execute Batch Test" to evaluate on-device models.
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SECURITY & MULE LOGS */}
          {activeTab === 'logs' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-[#112240] border border-[#1E3A5F] rounded-2xl p-5 shadow-lg">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-3 pb-2 border-b border-[#1E3A5F]">
                  🚨 Cryptographic Rogue Tamper & Fraud Logs
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(!state?.tamper_logs || state.tamper_logs.length === 0) ? (
                    <div className="text-xs text-slate-500 p-4 text-center">No tamper events recorded.</div>
                  ) : (
                    state.tamper_logs.map((log, i) => (
                      <div key={i} className="p-3 bg-[#0A192F] border border-rose-900/60 rounded-xl text-xs space-y-1">
                        <div className="text-rose-400 font-mono-code font-bold">REASON: {log.reason}</div>
                        <div className="text-slate-300 text-[11px]">Type / Node: <span className="font-mono-code text-white">{log.type || log.quarantined_node}</span></div>
                        <div className="text-slate-500 text-[10px] font-mono-code">{log.timestamp || log.attempted_at}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-[#112240] border border-[#1E3A5F] rounded-2xl p-5 shadow-lg">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3 pb-2 border-b border-[#1E3A5F]">
                  🚤 Rescue Boat Data Mule Sync Logs
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(!state?.data_mule_logs || state.data_mule_logs.length === 0) ? (
                    <div className="text-xs text-slate-500 p-4 text-center">No mule voyages logged yet.</div>
                  ) : (
                    state.data_mule_logs.map((log, i) => (
                      <div key={i} className="p-3 bg-[#0A192F] border border-cyan-900/60 rounded-xl text-xs space-y-1">
                        <div className="text-cyan-300 font-mono-code font-bold">SYNC ID: {log.sync_id}</div>
                        <div className="text-slate-300 text-[11px]">
                          Visited: {log.nodes_visited.join(', ') || 'None'} | Collected: {log.packets_collected} | Merged: {log.packets_merged}
                        </div>
                        <div className="text-slate-500 text-[10px] font-mono-code">{log.timestamp}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
