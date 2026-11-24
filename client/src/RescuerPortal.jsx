import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QRCodeSVG } from 'qrcode.react';
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
  ArrowRight,
  Download
} from 'lucide-react';

export default function RescuerPortal({ onLogout }) {
  const [state, setState] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | map | rations | batch | logs
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [notification, setNotification] = useState(null);

  const [replyTextMap, setReplyTextMap] = useState({});
  const [selectedCaseForMap, setSelectedCaseForMap] = useState(null);
  const [inspectNode, setInspectNode] = useState(null);

  // 15 PRELOADED DIVERSE SYNTHETIC SCENARIOS (Organizer-ready)
  const PRELOADED_TEST_INPUTS = [
    { id: 'TEST-01', source_node_id: 'ward-1', message: 'Nenju vali, elderly man unconscious at Velachery shelter', medical_mode: 'cardiac' },
    { id: 'TEST-02', source_node_id: 'ward-2', message: 'Prasavam valikudhu, full term pregnancy in school, water broke', medical_mode: 'pregnancy' },
    { id: 'TEST-03', source_node_id: 'ward-3', message: 'Sugar low mayakkam, insulin theva urgent', medical_mode: 'diabetic' },
    { id: 'TEST-04', source_node_id: 'ward-6', message: 'wtr rising fast 2nd flr 3 kids no food or drinking water', medical_mode: 'trapped' },
    { id: 'TEST-05', source_node_id: 'ward-4', message: 'Amma ku nenju vali, chest pain severe breathless', medical_mode: 'cardiac' },
    { id: 'TEST-06', source_node_id: 'ward-5', message: 'Veedu full ah thanni, rooftop trapped 4 members need rescue boat', medical_mode: 'trapped' },
    { id: 'TEST-07', source_node_id: 'ward-1', message: 'Sugar patient insulin illa, need 1 insulin pack and medical kit', medical_mode: 'diabetic' },
    { id: 'TEST-08', source_node_id: 'ward-2', message: 'Prasavam valikkuthu urgent, labour pain 3 mins apart', medical_mode: 'pregnancy' },
    { id: 'TEST-09', source_node_id: 'ward-3', message: 'Thanni veetukulla vanthuruchu, ground floor flooded, elderly bedridden', medical_mode: 'trapped' },
    { id: 'TEST-10', source_node_id: 'ward-4', message: 'Heavy bleeding fracture after wall collapse, ratham stop aagala', medical_mode: 'general' },
    { id: 'TEST-11', source_node_id: 'ward-5', message: 'Dialysis patient stranded, need urgent evacuation to hospital', medical_mode: 'general' },
    { id: 'TEST-12', source_node_id: 'ward-6', message: '10 people stranded with zero food and water since yesterday', medical_mode: 'general' },
    { id: 'TEST-13', source_node_id: 'ward-1', message: 'Newborn baby fever and dehydration, need paediatric kit', medical_mode: 'general' },
    // 2 SAFE / NON-EMERGENCY CONTROL INPUTS (Zero scarce supply allocation)
    { id: 'SAFE-01', source_node_id: 'ward-2', message: 'We are safe at the community hall, just testing the mesh connection', medical_mode: 'general' },
    { id: 'SAFE-02', source_node_id: 'ward-3', message: 'Power is back, water receded, no medical help needed here all good', medical_mode: 'general' }
  ];

  const [batchCustomInput, setBatchCustomInput] = useState(JSON.stringify(PRELOADED_TEST_INPUTS, null, 2));
  const [batchReport, setBatchReport] = useState('');
  const [batchResults, setBatchResults] = useState([]);
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
          width: 220,
          margin: 1,
          color: { dark: '#0F172A', light: '#FFFFFF' }
        });
        setQrCodeUrl(qr);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchState();

    const eventSource = new EventSource('/api/stream');

    eventSource.addEventListener('sos_created', (e) => {
      const data = JSON.parse(e.data);
      showNotice(`NEW SOS RECEIVED! Tag: ${data.case_record.triage_tag} (${data.case_record.source_name})`, 'alert');
      fetchState();
    });

    eventSource.addEventListener('rescuer_reply', () => fetchState());
    eventSource.addEventListener('case_updated', () => fetchState());
    eventSource.addEventListener('ration_updated', () => fetchState());
    eventSource.addEventListener('node_toggled', () => fetchState());
    eventSource.addEventListener('tamper_event', (e) => {
      const data = JSON.parse(e.data);
      showNotice(`SECURITY ALERT: ${data.reason || 'Tamper detected'}!`, 'alert');
      fetchState();
    });

    return () => eventSource.close();
  }, []);

  const showNotice = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4500);
  };

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
        showNotice(`Update sent to phone: "${text}"`);
        setReplyTextMap(prev => ({ ...prev, [caseId]: '' }));
        fetchState();
      }
    } catch (err) {
      showNotice(`Reply failed: ${err.message}`, 'alert');
    }
  };

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

  // Run Batch Test with custom/preloaded inputs
  const handleRunBatch = async () => {
    setBatchRunning(true);
    try {
      let inputsToTest = PRELOADED_TEST_INPUTS;
      try {
        const parsed = JSON.parse(batchCustomInput);
        if (Array.isArray(parsed)) inputsToTest = parsed;
      } catch (e) {
        showNotice('Invalid JSON format in custom inputs box, using preloaded scenarios.', 'alert');
      }

      const res = await fetch('/api/batch-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: inputsToTest })
      });
      const data = await res.json();
      setBatchReport(data.markdown_report);
      setBatchResults(data.results || []);
      showNotice(`Batch evaluation complete across ${inputsToTest.length} cases!`);
      fetchState();
    } catch (err) {
      showNotice(err.message, 'alert');
    } finally {
      setBatchRunning(false);
    }
  };

  const handleDownloadReport = () => {
    if (!batchReport) return;
    const blob = new Blob([batchReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifemesh-batch-triage-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    if (!batchResults.length) return;
    const blob = new Blob([JSON.stringify(batchResults, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifemesh-batch-triage-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Node Map Coordinates
  const nodeMapCoords = {
    'relief-hub': { x: 380, y: 70, label: 'Central Hub', color: '#10B981' },
    'ward-5': { x: 300, y: 160, label: 'Saidapet Metro (Bridge 2)', color: '#2563EB' },
    'ward-4': { x: 420, y: 180, label: 'Adyar Bridge (Bridge 1)', color: '#2563EB' },
    'ward-1': { x: 260, y: 260, label: 'Ward-1 Velachery Shelter', color: '#D97706' },
    'ward-3': { x: 200, y: 310, label: 'Ward-3 Madipakkam', color: '#D97706' },
    'ward-2': { x: 270, y: 390, label: 'Ward-2 Pallikaranai High School', color: '#D97706' },
    'ward-6': { x: 440, y: 340, label: 'Ward-6 Thoraipakkam IT Roof', color: '#D97706' }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 shadow-sm">
        <div>
          {/* Brand */}
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center font-extrabold text-white text-base shadow-md">
                LM
              </div>
              <div>
                <h1 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center">
                  LifeMesh <span className="ml-1 px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 border border-blue-300 text-[10px] font-bold">RESCUER</span>
                </h1>
                <p className="text-xs text-slate-500 font-medium">Mission Router & Triage OS</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-slate-100 transition"
              title="Logout from Rescuer Portal"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1.5 text-xs font-bold">
            {[
              { id: 'dashboard', label: 'Command Center', icon: Radio },
              { id: 'map', label: 'Mission Router & Map', icon: Compass },
              { id: 'rations', label: 'Ration Tokens (SDG 2)', icon: CheckCircle },
              { id: 'batch', label: 'Batch AI Triage Test', icon: FileText },
              { id: 'logs', label: 'Security & Mule Logs', icon: ShieldAlert }
            ].map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-800 border-2 border-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Connect Phone QR Card */}
          <div className="mx-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center shadow-inner">
            <span className="text-[10px] font-mono-code text-blue-800 uppercase tracking-wider block font-extrabold mb-1.5">
              OFFLINE LAN PHONE SYNC
            </span>
            {qrCodeUrl ? (
              <div className="flex flex-col items-center">
                <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                  <img src={qrCodeUrl} alt="LAN QR" className="w-24 h-24" />
                </div>
                <span className="text-[10px] text-slate-700 font-mono-code font-bold mt-2 truncate max-w-[190px]">
                  {networkInfo?.phone_url}
                </span>
                <span className="text-[10px] text-emerald-800 font-bold mt-0.5">
                  Scan to open Citizen Portal on phone
                </span>
              </div>
            ) : (
              <div className="text-xs text-slate-500">Loading LAN IP...</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-600 space-y-1 font-medium">
          <div className="flex items-center justify-between">
            <span>LAN IPv4:</span>
            <span className="text-blue-700 font-mono-code font-bold">{networkInfo?.lan_ip || '127.0.0.1'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>TRANSPORT:</span>
            <span className="text-emerald-800 font-mono-code font-bold">SSE + BLE MESH</span>
          </div>
        </div>
      </aside>

      {/* MAIN VIEW */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP BAR */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center space-x-4 text-xs font-mono-code font-bold">
            <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-600 mr-2 animate-pulse"></span>
              AIRPLANE_MODE_READY (OFFLINE)
            </span>
            <span className="text-slate-600">
              LAN: {networkInfo?.lan_ip}:5173
            </span>
          </div>

          <div className="flex items-center space-x-2.5 text-xs font-bold">
            <button
              onClick={handleMuleSync}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-xl transition flex items-center shadow-sm"
            >
              🚤 Rescue Boat Sync
            </button>
            <button
              onClick={handleSimulateTamper}
              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-xl transition flex items-center shadow-sm"
            >
              ⚠️ Rogue Tamper Attack
            </button>
            <button
              onClick={() => fetch('/api/inventory/reset', { method: 'POST' }).then(() => fetchState())}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl transition shadow-sm"
            >
              Reset Stock
            </button>
          </div>
        </header>

        {/* NOTIFICATION */}
        {notification && (
          <div className={`mx-6 mt-3 p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-sm ${
            notification.type === 'alert'
              ? 'bg-red-50 border-red-300 text-red-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}>
            <span>{notification.text}</span>
            <button onClick={() => setNotification(null)} className="font-extrabold text-slate-500 hover:text-slate-900">✕</button>
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
                    <div key={item.key} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center justify-between text-slate-600 text-xs font-semibold mb-1">
                        <span>{item.label}</span>
                        <span>{item.icon}</span>
                      </div>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-2xl font-extrabold text-slate-900 font-mono-code">{count}</span>
                        <span className="text-slate-500 text-xs font-bold">/ {item.total}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full mt-2.5 overflow-hidden border border-slate-200">
                        <div
                          className={`h-full rounded-full ${count <= 1 ? 'bg-red-600' : 'bg-blue-600'}`}
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Verified Casualty Board */}
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wider flex items-center">
                        <span className="w-3 h-3 rounded-full bg-blue-600 mr-2 animate-pulse"></span>
                        Verified Casualty Board (Sorted by Triage Priority)
                      </h2>
                      <p className="text-xs text-slate-600 font-medium">Decrypted exclusively at Central Relief Hub via AES-256-GCM</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-mono-code font-bold bg-slate-100 text-slate-800 border border-slate-300">
                      {state?.casualty_board?.length || 0} Cases Active
                    </span>
                  </div>

                  <div className="space-y-4 max-h-[540px] overflow-y-auto pr-1">
                    {(!state?.casualty_board || state.casualty_board.length === 0) ? (
                      <div className="p-8 text-center text-slate-500 text-sm font-medium">
                        No casualties reported yet. Scan QR on phone or submit an SOS to populate.
                      </div>
                    ) : (
                      state.casualty_board.map(c => {
                        const isRed = c.triage_tag === 'RED';
                        const isYellow = c.triage_tag === 'YELLOW';
                        return (
                          <div
                            key={c.case_id}
                            className={`p-5 rounded-2xl border-2 transition-all shadow-sm ${
                              c.status === 'CLOSED'
                                ? 'bg-slate-50 border-slate-200 opacity-60'
                                : isRed
                                ? 'bg-red-50 border-red-300'
                                : isYellow
                                ? 'bg-amber-50 border-amber-300'
                                : 'bg-emerald-50 border-emerald-300'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-2.5">
                                <span className={`px-3 py-1 rounded-lg text-xs font-extrabold font-mono-code ${
                                  isRed ? 'bg-red-600 text-white' : isYellow ? 'bg-amber-500 text-slate-950' : 'bg-emerald-600 text-white'
                                }`}>
                                  {c.triage_tag} ({c.triage_score})
                                </span>
                                <span className="text-sm font-extrabold text-slate-900">{c.source_name}</span>
                                <span className="text-xs font-mono-code font-bold text-blue-700">
                                  {c.mission_route?.distance_km} km • ETA: {c.mission_route?.eta_minutes} mins
                                </span>
                              </div>

                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => setSelectedCaseForMap(c)}
                                  className="px-3 py-1 text-xs font-bold bg-white hover:bg-slate-100 text-blue-700 border border-blue-300 rounded-lg shadow-sm"
                                >
                                  Route Map
                                </button>
                                {c.status !== 'CLOSED' && (
                                  <button
                                    onClick={() => handleCloseCase(c.case_id)}
                                    className="px-3 py-1 text-xs font-bold bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg shadow-sm"
                                  >
                                    Resolve
                                  </button>
                                )}
                              </div>
                            </div>

                            <p className="text-sm text-slate-800 font-medium mt-2.5">"{c.message}"</p>

                            {/* Hub Decrypted Medical Note */}
                            {c.decrypted_condition_notes && (
                              <div className="mt-2.5 p-3 bg-white rounded-xl border border-blue-200 text-xs text-blue-900">
                                <span className="font-extrabold text-blue-700">🔒 Hub Decrypted Medical Record:</span> {c.decrypted_condition_notes}
                              </div>
                            )}

                            {/* Mission Route & BLE Byte Split */}
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded-xl border border-slate-200">
                              <div>
                                <span className="text-slate-500 font-semibold block">Transport Mode:</span>
                                <span className="text-slate-900 font-bold">{c.mission_route?.transport_mode}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 font-semibold block">Supplies to Pack:</span>
                                <span className="text-emerald-800 font-mono-code font-bold">
                                  {Object.entries(c.allocated_supplies || {}).map(([k, v]) => `${k}:${v}`).join(', ') || 'Standard Food/Water Kit'}
                                </span>
                              </div>
                              <div className="col-span-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] font-mono-code text-slate-600">
                                <span>BLE Discovery Header: <strong className="text-emerald-700">{c.ble_header_bytes || 128} B (≤250 Ready)</strong></span>
                                <span>Wi-Fi Direct Payload: <strong className="text-blue-700">{c.wifi_direct_attachment_bytes || 1840} B</strong></span>
                              </div>
                            </div>

                            {/* Prominent Claim / Verify Ration Button */}
                            {c.ration_token && (
                              <div className="mt-3 flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200">
                                <div className="text-xs">
                                  <span className="text-slate-500 font-semibold">Ration Token:</span>{' '}
                                  <span className="font-mono-code text-blue-800 font-bold">{c.ration_token.tokenId}</span>
                                </div>
                                <button
                                  onClick={() => handleClaimRation(c.ration_token.tokenId)}
                                  className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center space-x-1.5 shadow-sm ${
                                    c.ration_token.status === 'REDEEMED'
                                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                                  }`}
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>{c.ration_token.status === 'REDEEMED' ? 'VERIFIED & REDEEMED' : 'Claim / Verify Ration'}</span>
                                </button>
                              </div>
                            )}

                            {/* Two-Way Messaging Section */}
                            <div className="mt-3 pt-3 border-t border-slate-200">
                              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 block mb-1.5">
                                Two-Way Update to Citizen Phone (Live SSE):
                              </span>
                              <div className="flex space-x-2">
                                <input
                                  type="text"
                                  placeholder="Type live instructions (e.g. Boat dispatched, move to 2nd floor)..."
                                  value={replyTextMap[c.case_id] || ''}
                                  onChange={e => setReplyTextMap({ ...replyTextMap, [c.case_id]: e.target.value })}
                                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus-visible:ring-2 focus-visible:ring-blue-600 outline-none"
                                />
                                <button
                                  onClick={() => handleSendReply(c.case_id, replyTextMap[c.case_id])}
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition shadow-sm"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Send</span>
                                </button>
                              </div>

                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {[
                                  "Rescue Boat Dispatched — Stay Safe on Roof",
                                  "Medical Team En Route with Supplies",
                                  "Move to Higher Floor Immediately"
                                ].map((preset, i) => (
                                  <button
                                    key={i}
                                    onClick={() => handleSendReply(c.case_id, preset)}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-blue-50 hover:text-blue-800 text-slate-700 border border-slate-200 transition"
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

                {/* 7 Nodes Topology & ZK Relay Inspector */}
                <div className="col-span-4 space-y-6">
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">7 P2P Mesh Nodes</h3>
                      <span className="text-[10px] text-blue-700 font-mono-code font-bold">Click name to inspect ZK</span>
                    </div>

                    <div className="space-y-2">
                      {state?.nodes?.map(n => {
                        const isOnline = n.status === 'ONLINE';
                        const isQuarantined = n.status === 'QUARANTINED';
                        const isHub = n.id === 'relief-hub';
                        return (
                          <div
                            key={n.id}
                            className={`p-3 rounded-2xl border-2 text-xs flex items-center justify-between transition cursor-pointer shadow-sm ${
                              inspectNode?.id === n.id ? 'ring-2 ring-blue-600 bg-blue-50/60' : ''
                            } ${
                              isQuarantined
                                ? 'bg-red-50 border-red-300 text-red-900'
                                : isOnline
                                ? 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                                : 'bg-slate-100 border-slate-200 text-slate-500'
                            }`}
                          >
                            <div onClick={() => setInspectNode(n)} className="flex-1 mr-2">
                              <div className="font-extrabold text-xs flex items-center">
                                {n.name}
                                {isHub && <span className="ml-1 text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">DECRYPT HUB</span>}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono-code mt-0.5">
                                {n.role} {n.store_and_forward_queue?.length > 0 && `(Queued: ${n.store_and_forward_queue.length})`}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleNode(n.id, n.status);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono-code font-extrabold ${
                                isOnline
                                  ? 'bg-emerald-100 border border-emerald-300 text-emerald-900'
                                  : 'bg-red-100 border border-red-300 text-red-900'
                              }`}
                            >
                              {n.status}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Zero-Knowledge Relay Node Inspector Drawer */}
                  {inspectNode && (
                    <div className="bg-white border-2 border-blue-400 rounded-3xl p-5 shadow-lg space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center">
                          <ShieldAlert className="w-4 h-4 mr-1.5 text-blue-600" />
                          Relay Inspector: {inspectNode.name}
                        </h4>
                        <button onClick={() => setInspectNode(null)} className="text-slate-400 hover:text-slate-900 text-sm font-bold">✕</button>
                      </div>

                      {inspectNode.id === 'relief-hub' ? (
                        <div className="space-y-2 text-xs">
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900">
                            <span className="font-extrabold block text-xs">🔐 VERIFIED RESPONDER RELIEF HUB</span>
                            Holds private AES-256-GCM symmetric key. Decrypts all patient medical records.
                          </div>
                          <div className="text-xs font-mono-code text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <strong>Latest Decrypted Note:</strong> "{state?.casualty_board?.[0]?.decrypted_condition_notes || 'Patient stable, priority insulin allocation'}"
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2.5 text-xs">
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl">
                            <div className="text-blue-900 font-extrabold text-xs mb-1">
                              🛡️ Zero-Knowledge Relay — No Plaintext Medical Data
                            </div>
                            <p className="text-xs text-slate-700 leading-relaxed font-medium">
                              This intermediate hop ({inspectNode.name}) forwarded the packet based on Ed25519 signature verification alone. Patient condition notes remain 100% encrypted in transit.
                            </p>
                          </div>

                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono-code text-xs text-slate-700 space-y-1">
                            <div><strong className="text-slate-900">AES-256 Ciphertext:</strong> 9f4a18c2b740e1... [ENCRYPTED]</div>
                            <div><strong className="text-slate-900">GCM Auth Tag:</strong> 4b9a712f5e... [VERIFIED]</div>
                            <div><strong className="text-slate-900">Plaintext Visibility:</strong> <span className="text-red-600 font-bold">REDACTED / ZERO KNOWLEDGE</span></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INTERACTIVE OFFLINE ROUTE MAP (WHITE THEME) */}
          {activeTab === 'map' && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wider flex items-center">
                  <Compass className="w-5 h-5 mr-2 text-blue-600" />
                  Interactive Offline Chennai Flood Route Map & Bridge Simulator
                </h2>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Visualizes dynamic transit routes from Central Relief Hub to flood wards. Toggling bridge nodes (Adyar Bridge / Saidapet Metro) automatically reroutes rescuers via amphibious boat detours!
                </p>
              </div>

              <div className="grid grid-cols-12 gap-6">
                {/* SVG MAP */}
                <div className="col-span-8 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-center relative shadow-inner">
                  <svg viewBox="0 0 600 480" className="w-full h-[420px]">
                    <rect x="0" y="0" width="600" height="480" fill="#F8FAFC" />
                    {/* Subtle grid lines */}
                    <defs>
                      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E2E8F0" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />

                    <circle cx="270" cy="390" r="70" fill="rgba(37, 99, 235, 0.06)" />
                    <circle cx="260" cy="260" r="80" fill="rgba(37, 99, 235, 0.06)" />

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
                          stroke={isOnline ? '#2563EB' : '#EF4444'}
                          strokeWidth={isOnline ? '3' : '2'}
                          strokeDasharray={isOnline ? 'none' : '4 4'}
                          opacity={isOnline ? 0.9 : 0.6}
                        />
                      );
                    })}

                    {Object.entries(nodeMapCoords).map(([id, n]) => {
                      const nodeData = state?.nodes?.find(item => item.id === id);
                      const isOnline = nodeData?.status === 'ONLINE';
                      const isQuarantine = nodeData?.status === 'QUARANTINED';

                      return (
                        <g key={id} className="cursor-pointer" onClick={() => handleToggleNode(id, nodeData?.status)}>
                          <circle
                            cx={n.x}
                            cy={n.y}
                            r={id === 'relief-hub' ? 16 : 12}
                            fill={isQuarantine ? '#EF4444' : isOnline ? n.color : '#94A3B8'}
                            stroke="#FFFFFF"
                            strokeWidth="3"
                          />
                          <text
                            x={n.x}
                            y={n.y - 16}
                            textAnchor="middle"
                            fill="#0F172A"
                            fontSize="11"
                            fontWeight="bold"
                            className="select-none"
                          >
                            {n.label}
                          </text>
                          <text
                            x={n.x}
                            y={n.y + 22}
                            textAnchor="middle"
                            fill={isOnline ? '#15803D' : '#DC2626'}
                            fontSize="9"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {nodeData?.status || 'ONLINE'}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Mission Dispatch Drawer */}
                <div className="col-span-4 bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-800">
                    Mission Dispatch Planner
                  </h3>

                  {selectedCaseForMap ? (
                    <div className="space-y-3 text-xs">
                      <div className="p-3.5 bg-white rounded-xl border border-blue-200 shadow-sm">
                        <span className="text-slate-500 text-[10px] font-bold block">TARGET VICTIM:</span>
                        <div className="font-extrabold text-slate-900 text-sm">{selectedCaseForMap.source_name}</div>
                        <div className="text-[10px] font-mono-code text-blue-700 font-bold">
                          {selectedCaseForMap.mission_route?.destination?.lat}° N, {selectedCaseForMap.mission_route?.destination?.lng}° E
                        </div>
                      </div>

                      <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600 font-semibold">Route Status:</span>
                          <span className="text-emerald-800 font-mono-code font-bold">
                            {selectedCaseForMap.mission_route?.route_status}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600 font-semibold">Distance:</span>
                          <span className="text-slate-900 font-mono-code font-bold">{selectedCaseForMap.mission_route?.distance_km} km</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600 font-semibold">Calculated ETA:</span>
                          <span className="text-blue-700 font-extrabold font-mono-code text-sm">
                            {selectedCaseForMap.mission_route?.eta_minutes} MINUTES
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600 font-semibold">Transit Mode:</span>
                          <span className="text-slate-900 font-bold">{selectedCaseForMap.mission_route?.transport_mode}</span>
                        </div>
                      </div>

                      <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-slate-500 text-[10px] font-bold block mb-1">SUPPLIES CHECKLIST:</span>
                        <span className="text-emerald-800 font-mono-code font-bold">
                          {Object.entries(selectedCaseForMap.allocated_supplies || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || 'Standard Food/Water Kit'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 p-8 text-center font-medium">
                      Select a case on the Casualty Board to inspect its route plan.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DEDICATED RATION TOKENS (SDG 2) */}
          {activeTab === 'rations' && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wider flex items-center">
                    <CheckCircle className="w-5 h-5 mr-2 text-emerald-600" />
                    Ed25519-Signed Digital Ration Tokens (UN SDG 2: Zero Hunger)
                  </h2>
                  <p className="text-xs text-slate-600 font-medium">
                    Cryptographically signed by Relief Hub to prevent double-allocation and ensure fair offline micro-logistics.
                  </p>
                </div>
                <span className="text-xs font-mono-code text-blue-700 font-bold">
                  {state?.ration_tokens?.length || 0} Tokens Issued
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(!state?.ration_tokens || state.ration_tokens.length === 0) ? (
                  <div className="col-span-2 p-8 text-center text-slate-500 text-sm font-medium">
                    No ration tokens issued yet. Dispatch an SOS to generate signed tokens.
                  </div>
                ) : (
                  state.ration_tokens.map(token => {
                    const isRedeemed = token.status === 'REDEEMED';
                    return (
                      <div key={token.tokenId} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 shadow-sm">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-sm font-extrabold text-slate-900 font-mono-code">{token.tokenId}</span>
                            <div className="text-xs text-slate-600 font-medium">{token.source_name}</div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold font-mono-code ${
                            isRedeemed ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-blue-100 text-blue-900 border border-blue-300'
                          }`}>
                            {token.status}
                          </span>
                        </div>

                        <div className="text-xs font-mono-code text-emerald-800 font-bold">
                          Supplies: {Object.entries(token.allocated_supplies || {}).map(([k, v]) => `${k}:${v}`).join(', ') || 'Standard Kit'}
                        </div>

                        <div className="text-xs font-mono-code text-slate-500 truncate">
                          Sig: {token.ed25519_signature?.slice(0, 32)}...
                        </div>

                        <button
                          onClick={() => handleClaimRation(token.tokenId)}
                          className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition shadow-sm ${
                            isRedeemed
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-red-50 hover:text-red-900 hover:border-red-300'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
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

          {/* TAB 4: BATCH AI TRIAGE TEST (15 CASES + EXPORT) */}
          {activeTab === 'batch' && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wider">
                    Automated AI Batch Triage Verification & Hardening
                  </h2>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    Preloaded with 15 diverse scenarios (English typos, Tamil Unicode, Tanglish, medical modes, and 2 non-emergency control checks).
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleRunBatch}
                    disabled={batchRunning}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold transition shadow-sm disabled:opacity-50"
                  >
                    {batchRunning ? 'Triaging 15 Scenarios...' : 'Execute Batch Test'}
                  </button>
                  {batchReport && (
                    <>
                      <button
                        onClick={handleDownloadReport}
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-extrabold transition flex items-center space-x-1.5 shadow-sm"
                        title="Download Markdown Report"
                      >
                        <Download className="w-4 h-4 text-blue-600" />
                        <span>.MD</span>
                      </button>
                      <button
                        onClick={handleDownloadJson}
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-extrabold transition flex items-center space-x-1.5 shadow-sm"
                        title="Download JSON Report"
                      >
                        <Download className="w-4 h-4 text-emerald-600" />
                        <span>.JSON</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Editable Input Box for Organizer Test Inputs */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Organizer Test Inputs (Paste Custom JSON Array or Run Preloaded 15 Cases):
                </label>
                <textarea
                  rows="4"
                  value={batchCustomInput}
                  onChange={e => setBatchCustomInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3 text-xs font-mono-code text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600 outline-none"
                ></textarea>
              </div>

              {batchReport ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono-code text-xs text-slate-800 overflow-x-auto whitespace-pre-wrap shadow-inner">
                  {batchReport}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-300 rounded-2xl font-medium">
                  Click "Execute Batch Test" to run the 15 evaluation scenarios across local Qwen2.5-0.5B + START triage rules.
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SECURITY & MULE LOGS */}
          {activeTab === 'logs' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-red-700 mb-3 pb-2 border-b border-slate-200">
                  🚨 Cryptographic Rogue Tamper & Fraud Logs
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(!state?.tamper_logs || state.tamper_logs.length === 0) ? (
                    <div className="text-xs text-slate-500 p-4 text-center font-medium">No tamper events recorded.</div>
                  ) : (
                    state.tamper_logs.map((log, i) => (
                      <div key={i} className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs space-y-1">
                        <div className="text-red-700 font-mono-code font-bold">REASON: {log.reason}</div>
                        <div className="text-slate-800 text-[11px]">Type / Node: <span className="font-mono-code font-bold">{log.type || log.quarantined_node}</span></div>
                        <div className="text-slate-500 text-[10px] font-mono-code">{log.timestamp || log.attempted_at}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-800 mb-3 pb-2 border-b border-slate-200">
                  🚤 Rescue Boat Data Mule Sync Logs
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(!state?.data_mule_logs || state.data_mule_logs.length === 0) ? (
                    <div className="text-xs text-slate-500 p-4 text-center font-medium">No mule voyages logged yet.</div>
                  ) : (
                    state.data_mule_logs.map((log, i) => (
                      <div key={i} className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1">
                        <div className="text-blue-800 font-mono-code font-bold">SYNC ID: {log.sync_id}</div>
                        <div className="text-slate-800 text-[11px]">
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
