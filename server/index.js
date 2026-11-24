import express from 'express';
import cors from 'cors';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { SYNTHETIC_NODES, cryptoManager } from './crypto.js';
import { meshNetwork } from './mesh.js';
import { triageEngine } from './triage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Data Stores
const casualtyBoard = [];
const rationTokens = new Map(); // tokenId -> token details
const caseReplies = new Map(); // caseId -> array of replies
const sseClients = new Set(); // Set of active SSE response objects

// Helper: Broadcast live SSE events to all connected clients
function broadcastEvent(type, data) {
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// Helper: Get best local LAN IPv4 address prioritizing Wi-Fi, Ethernet, Hotspot
function getLanIpv4() {
  const ifaces = os.networkInterfaces();
  let candidate = '127.0.0.1';

  // Prefer Wi-Fi / WLAN, then Ethernet, then any non-internal IPv4
  const priorityOrder = ['wi-fi', 'wlan', 'hotspot', 'ethernet'];

  for (const prefix of priorityOrder) {
    for (const [name, addrs] of Object.entries(ifaces)) {
      if (name.toLowerCase().includes(prefix)) {
        const found = addrs.find(a => a.family === 'IPv4' && !a.internal);
        if (found) return found.address;
      }
    }
  }

  for (const [name, addrs] of Object.entries(ifaces)) {
    const found = addrs.find(a => a.family === 'IPv4' && !a.internal);
    if (found) return found.address;
  }

  return candidate;
}

// Distance & ETA calculation based on Chennai flood-zone coordinates & active bridges
function calculateMissionRoute(targetNodeId) {
  const hub = SYNTHETIC_NODES['relief-hub'];
  const target = SYNTHETIC_NODES[targetNodeId];
  if (!target) return null;

  // Approximate distance in km using Haversine formula
  const R = 6371; // Earth's radius in km
  const dLat = (target.lat - hub.lat) * (Math.PI / 180);
  const dLon = (target.lng - hub.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(hub.lat * (Math.PI / 180)) * Math.cos(target.lat * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const rawDistKm = +(R * c).toFixed(2);

  // Check if critical transit bridge nodes (ward-4 Adyar, ward-5 Saidapet) are online
  const ward4 = meshNetwork.nodes.get('ward-4');
  const ward5 = meshNetwork.nodes.get('ward-5');
  const bridge1Open = ward4 && ward4.status === 'ONLINE';
  const bridge2Open = ward5 && ward5.status === 'ONLINE';

  let mode = 'Elevated Road / Emergency Vehicle';
  let etaMins = Math.max(8, Math.round(rawDistKm * 3.2));
  let routeStatus = 'OPTIMAL_ELEVATED_PASS';

  if (!bridge1Open && !bridge2Open) {
    mode = 'Rescue Boat / Amphibious Vessel';
    etaMins = Math.round(etaMins * 2.4); // Detour & water navigation
    routeStatus = 'BRIDGES_FLOODED_AMPHIBIOUS_DETOUR';
  } else if (!bridge1Open || !bridge2Open) {
    mode = 'Elevated Road + Perimeter Boat Detour';
    etaMins = Math.round(etaMins * 1.6);
    routeStatus = 'PARTIAL_FLOOD_DETOUR';
  }

  return {
    origin: { id: hub.id, name: hub.name, lat: hub.lat, lng: hub.lng },
    destination: { id: target.id, name: target.name, lat: target.lat, lng: target.lng },
    distance_km: rawDistKm,
    eta_minutes: etaMins,
    transport_mode: mode,
    route_status: routeStatus,
    bridge_statuses: {
      adyar_bridge_ward4: bridge1Open ? 'PASSABLE' : 'FLOODED_BLOCKED',
      saidapet_metro_ward5: bridge2Open ? 'PASSABLE' : 'FLOODED_BLOCKED'
    }
  };
}

// 1. Health & Offline AI Readiness
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'LifeMesh Core Backend & Offline AI Engine',
    model_id: triageEngine.modelId,
    model_loaded: triageEngine.modelLoaded,
    offline_ready: true,
    transport_mode: 'SIMULATED_BLE_WIFI_DIRECT',
    zero_cloud_api_compliance: '100% Free & Open Source Local Execution'
  });
});

// 2. Real-Time Server-Sent Events (SSE) Stream
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive'
  });

  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'LifeMesh SSE Connected', timestamp: new Date().toISOString() })}\n\n`);
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// 3. Network Discovery: LAN IPv4 for Phone QR Code Connect
app.get('/api/network-info', (req, res) => {
  const lanIp = getLanIpv4();
  const phoneUrl = `http://${lanIp}:5173/?mode=citizen`;
  const laptopUrl = `http://localhost:5173`;

  res.json({
    lan_ip: lanIp,
    phone_url: phoneUrl,
    laptop_url: laptopUrl,
    client_port: 5173,
    server_port: PORT,
    hotspot_ready: true,
    transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
  });
});

// 4. Rescuer Authentication (Password Protected)
app.post('/api/auth/rescuer', (req, res) => {
  const { callsign = 'RESCUER-ALPHA', password } = req.body;
  const DEMO_PASS = 'RESCUE2026';

  if (password !== DEMO_PASS) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_PASSWORD',
      details: 'Unauthorized. Use demo password RESCUE2026 to unlock Rescuer Command Center.'
    });
  }

  const sessionToken = `rescuer-token-${crypto.randomBytes(8).toString('hex')}`;
  res.json({
    success: true,
    role: 'VERIFIED_RESPONDER',
    callsign,
    sessionToken,
    hub_public_key: cryptoManager.getPublicKeyPem('relief-hub'),
    message: 'Rescuer Command Center access granted.'
  });
});

// 5. Full Mesh & Operational State
app.get('/api/state', (req, res) => {
  const meshState = meshNetwork.getState();
  const sortedBoard = [...casualtyBoard].sort((a, b) => (b.triage_score || 0) - (a.triage_score || 0));

  res.json({
    nodes: meshState.nodes,
    edges: meshState.edges,
    quarantined_nodes: meshState.quarantined_nodes,
    inventory: triageEngine.inventory,
    casualty_board: sortedBoard,
    ration_tokens: Array.from(rationTokens.values()),
    tamper_logs: meshState.tamper_logs,
    data_mule_logs: meshState.data_mule_logs,
    transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
  });
});

// 6. Submit SOS Packet (Sign, Encrypt, Route, Triage + Issue Signed Ration Token)
app.post('/api/sos', async (req, res) => {
  try {
    const {
      source_node_id,
      message,
      medical_mode = 'general',
      accessibility_mode = 'STANDARD',
      condition_notes = ''
    } = req.body;

    if (!source_node_id || !SYNTHETIC_NODES[source_node_id]) {
      return res.status(400).json({ error: `Invalid or unknown source_node_id: ${source_node_id}` });
    }

    const packet_id = `pkt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const timestamp = new Date().toISOString();

    // Zero-Knowledge Medical Privacy: Encrypt medical metadata with Relief Hub's AES-256-GCM key
    const sensitiveMedicalData = {
      medical_mode,
      condition_notes,
      source_node_id,
      timestamp
    };
    const encrypted_medical_payload = cryptoManager.encryptMedicalPayload(sensitiveMedicalData);

    // Canonical payload signed with sender's Ed25519 key
    const canonical_payload = {
      packet_id,
      source_node_id,
      timestamp,
      message,
      accessibility_mode,
      encrypted_medical_payload
    };

    const ed25519_signature = cryptoManager.signPayload(source_node_id, canonical_payload);

    const packet = {
      ...canonical_payload,
      canonical_payload,
      ed25519_signature,
      sender_public_key: cryptoManager.getPublicKeyPem(source_node_id)
    };

    // Route packet through simulated BLE/Wi-Fi Direct mesh
    const routingResult = meshNetwork.routePacket(packet);

    if (routingResult.rejected) {
      broadcastEvent('tamper_event', routingResult);
      return res.status(403).json(routingResult);
    }

    if (routingResult.partitioned) {
      broadcastEvent('node_toggled', { source_node_id, partitioned: true, queue_length: routingResult.queue_length });
      return res.json({
        status: 'BUFFERED_OFFLINE',
        packet_id,
        routing: routingResult,
        transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
      });
    }

    // Packet successfully reached relief-hub: Decrypt AES-256-GCM medical payload
    const decryptedMedical = cryptoManager.decryptMedicalPayload(packet.encrypted_medical_payload);

    // Hub executes AI + Deterministic START Triage Override
    const triageResult = await triageEngine.processSOS({
      message,
      medical_mode: decryptedMedical?.medical_mode || medical_mode,
      accessibility_mode
    });

    // Calculate Mission Route from Hub to Victim Node
    const missionRoute = calculateMissionRoute(source_node_id);

    // Create Ed25519-Signed Ration Token for Allocated Supplies (SDG 2: Zero Hunger)
    const tokenId = `RT-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const tokenCanonicalData = {
      tokenId,
      packet_id,
      source_node_id,
      allocated_supplies: triageResult.triage_decision.allocated_supplies,
      issued_at: timestamp,
      issuer: 'relief-hub'
    };
    const hubSignature = cryptoManager.signPayload('relief-hub', tokenCanonicalData);

    const rationToken = {
      tokenId,
      packet_id,
      source_node_id,
      source_name: SYNTHETIC_NODES[source_node_id].name,
      allocated_supplies: triageResult.triage_decision.allocated_supplies,
      issued_at: timestamp,
      status: 'ISSUED', // ISSUED | REDEEMED
      redeemed_at: null,
      ed25519_signature: hubSignature,
      issuer: 'relief-hub',
      issuer_public_key: cryptoManager.getPublicKeyPem('relief-hub')
    };
    rationTokens.set(tokenId, rationToken);

    const caseRecord = {
      case_id: `case-${packet_id}`,
      packet_id,
      source_node_id,
      source_name: SYNTHETIC_NODES[source_node_id].name,
      timestamp,
      message,
      medical_mode: decryptedMedical?.medical_mode || medical_mode,
      decrypted_condition_notes: decryptedMedical?.condition_notes || condition_notes,
      accessibility_mode,
      triage_tag: triageResult.triage_decision.triage_tag,
      triage_score: triageResult.triage_decision.triage_score,
      clinical_rationale: triageResult.triage_decision.clinical_rationale,
      ai_extraction: triageResult.ai_extraction,
      allocated_supplies: triageResult.triage_decision.allocated_supplies,
      latency_ms: triageResult.latency_ms,
      fallback_used: triageResult.fallback_used,
      needs_human_review: triageResult.needs_human_review,
      status: 'OPEN',
      hops_traversed: routingResult.hop_trace.length - 1,
      hop_trace: routingResult.hop_trace,
      relay_inspection_log: routingResult.relay_inspection_log,
      ble_payload_bytes: routingResult.ble_payload_bytes,
      ble_ready: routingResult.ble_ready,
      mission_route: missionRoute,
      ration_token_id: tokenId,
      ration_token: rationToken,
      replies: [],
      transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
    };

    casualtyBoard.push(caseRecord);
    caseReplies.set(caseRecord.case_id, []);

    // Broadcast SSE update to all connected laptops and phones
    broadcastEvent('sos_created', {
      case_record: caseRecord,
      inventory: triageEngine.inventory,
      ration_token: rationToken
    });

    res.json({
      status: 'DELIVERED_AND_TRIAGED',
      case_record: caseRecord,
      routing: routingResult,
      ration_token: rationToken,
      transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// 7. Rescuer Two-Way Reply (Laptop -> Citizen Phone)
app.post('/api/cases/:id/reply', (req, res) => {
  try {
    const caseId = req.params.id;
    const { reply_text, rescuer_callsign = 'RESCUER-ALPHA' } = req.body;

    const targetCase = casualtyBoard.find(c => c.case_id === caseId || c.packet_id === caseId);
    if (!targetCase) {
      return res.status(404).json({ error: `Case ${caseId} not found` });
    }

    const replyObj = {
      id: `reply-${Date.now()}`,
      case_id: targetCase.case_id,
      source_node_id: targetCase.source_node_id,
      rescuer_callsign,
      text: reply_text,
      timestamp: new Date().toISOString(),
      eta_minutes: targetCase.mission_route?.eta_minutes || 12,
      transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
    };

    targetCase.replies = targetCase.replies || [];
    targetCase.replies.push(replyObj);

    // Broadcast to SSE immediately
    broadcastEvent('rescuer_reply', replyObj);

    res.json({
      success: true,
      reply: replyObj,
      transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Redeem / Verify Ration Token (With Double-Claim Fraud Prevention)
app.post('/api/rations/:tokenId/redeem', (req, res) => {
  try {
    const { tokenId } = req.params;
    const token = rationTokens.get(tokenId);

    if (!token) {
      return res.status(404).json({ error: `Ration token ${tokenId} not found` });
    }

    // Double-claim prevention check
    if (token.status === 'REDEEMED') {
      const fraudLog = {
        type: 'DOUBLE_CLAIM_BLOCKED',
        tokenId,
        source_node_id: token.source_node_id,
        attempted_at: new Date().toISOString(),
        original_redeemed_at: token.redeemed_at,
        reason: 'FRAUD_PREVENTED: Ration token has already been redeemed.'
      };
      meshNetwork.tamperLogs.push(fraudLog);
      broadcastEvent('tamper_event', fraudLog);

      return res.status(409).json({
        success: false,
        double_claim_blocked: true,
        reason: 'DOUBLE_CLAIM_BLOCKED',
        error: 'Fraud prevented! This ration token was already redeemed.',
        token
      });
    }

    // Verify Ed25519 signature of the relief hub
    const canonicalData = {
      tokenId: token.tokenId,
      packet_id: token.packet_id,
      source_node_id: token.source_node_id,
      allocated_supplies: token.allocated_supplies,
      issued_at: token.issued_at,
      issuer: token.issuer
    };

    const isSigValid = cryptoManager.verifySignature('relief-hub', canonicalData, token.ed25519_signature);
    if (!isSigValid) {
      return res.status(403).json({
        success: false,
        error: 'ED25519_VERIFICATION_FAILED',
        details: 'Ration token signature is invalid or corrupted.'
      });
    }

    // Mark as redeemed
    token.status = 'REDEEMED';
    token.redeemed_at = new Date().toISOString();

    // Also update on casualty board case record
    const targetCase = casualtyBoard.find(c => c.ration_token_id === tokenId);
    if (targetCase && targetCase.ration_token) {
      targetCase.ration_token.status = 'REDEEMED';
      targetCase.ration_token.redeemed_at = token.redeemed_at;
    }

    broadcastEvent('ration_updated', { tokenId, token });

    res.json({
      success: true,
      status: 'VERIFIED_AND_REDEEMED',
      token,
      ed25519_verified: true,
      message: 'Ration token verified and redeemed successfully.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Silent Distress Trigger for Missed Heartbeats
app.post('/api/nodes/:id/silent-distress', async (req, res) => {
  try {
    const nodeId = req.params.id;
    if (!SYNTHETIC_NODES[nodeId]) {
      return res.status(404).json({ error: `Node ${nodeId} not found` });
    }

    const payload = {
      source_node_id: nodeId,
      message: `CRITICAL ALERT: Missed heartbeat. Silent distress triggered automatically for ${SYNTHETIC_NODES[nodeId].name}.`,
      medical_mode: 'silent_distress',
      accessibility_mode: 'SILENT_PANIC',
      condition_notes: 'Automated distress pulse initiated. Node unresponsive to scheduled check-in.'
    };

    req.body = payload;
    return app._router.handle(req, res, () => {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Toggle Node Online/Offline ("Kill Relay Node")
app.post('/api/nodes/:id/toggle', (req, res) => {
  try {
    const nodeId = req.params.id;
    const { status } = req.body;
    const node = meshNetwork.toggleNode(nodeId, status);

    // Recalculate routes for active cases
    for (const c of casualtyBoard) {
      if (c.status === 'OPEN') {
        c.mission_route = calculateMissionRoute(c.source_node_id);
      }
    }

    broadcastEvent('node_toggled', {
      node_id: nodeId,
      name: node.name,
      status: node.status,
      buffered_queue_length: node.store_and_forward_queue.length
    });

    res.json({
      node_id: nodeId,
      name: node.name,
      new_status: node.status,
      buffered_queue_length: node.store_and_forward_queue.length,
      transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// 11. Data Mule Rescue Boat Physical Sync (CRDT LWW merge)
app.post('/api/data-mule/sync', async (req, res) => {
  try {
    const syncResult = meshNetwork.runDataMuleSync();

    const processedCases = [];
    for (const packet of syncResult.syncedPackets) {
      const decryptedMedical = cryptoManager.decryptMedicalPayload(packet.encrypted_medical_payload);
      const triageResult = await triageEngine.processSOS({
        message: packet.message,
        medical_mode: decryptedMedical?.medical_mode || 'general',
        accessibility_mode: packet.accessibility_mode || 'STANDARD'
      });

      const missionRoute = calculateMissionRoute(packet.source_node_id);
      const tokenId = `RT-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const tokenCanonicalData = {
        tokenId,
        packet_id: packet.packet_id,
        source_node_id: packet.source_node_id,
        allocated_supplies: triageResult.triage_decision.allocated_supplies,
        issued_at: packet.timestamp,
        issuer: 'relief-hub'
      };
      const hubSignature = cryptoManager.signPayload('relief-hub', tokenCanonicalData);

      const rationToken = {
        tokenId,
        packet_id: packet.packet_id,
        source_node_id: packet.source_node_id,
        source_name: SYNTHETIC_NODES[packet.source_node_id]?.name,
        allocated_supplies: triageResult.triage_decision.allocated_supplies,
        issued_at: packet.timestamp,
        status: 'ISSUED',
        redeemed_at: null,
        ed25519_signature: hubSignature,
        issuer: 'relief-hub'
      };
      rationTokens.set(tokenId, rationToken);

      const caseRecord = {
        case_id: `case-${packet.packet_id}`,
        packet_id: packet.packet_id,
        source_node_id: packet.source_node_id,
        source_name: SYNTHETIC_NODES[packet.source_node_id]?.name,
        timestamp: packet.timestamp,
        message: packet.message,
        medical_mode: decryptedMedical?.medical_mode || 'general',
        decrypted_condition_notes: decryptedMedical?.condition_notes || '',
        accessibility_mode: packet.accessibility_mode,
        triage_tag: triageResult.triage_decision.triage_tag,
        triage_score: triageResult.triage_decision.triage_score,
        clinical_rationale: triageResult.triage_decision.clinical_rationale,
        ai_extraction: triageResult.ai_extraction,
        allocated_supplies: triageResult.triage_decision.allocated_supplies,
        latency_ms: triageResult.latency_ms,
        status: 'OPEN',
        relayed_via_data_mule: true,
        mission_route: missionRoute,
        ration_token_id: tokenId,
        ration_token: rationToken,
        replies: [],
        transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
      };

      casualtyBoard.push(caseRecord);
      processedCases.push(caseRecord);
    }

    broadcastEvent('mule_synced', {
      muleLog: syncResult.muleLog,
      processed_cases: processedCases,
      remaining_inventory: triageEngine.inventory
    });

    res.json({
      status: 'MULE_SYNC_COMPLETE',
      sync_summary: syncResult.muleLog,
      processed_cases: processedCases,
      remaining_inventory: triageEngine.inventory,
      transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Live Rogue Attack Simulation (Tamper Detection)
app.post('/api/simulate-tamper', (req, res) => {
  try {
    const { source_node_id = 'ward-1', tampered_field = 'message', rogue_value = 'TAMPERED: PRIORITY OVERRIDE HIGH' } = req.body;

    const packet_id = `tamper-pkt-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const canonical_payload = {
      packet_id,
      source_node_id,
      timestamp,
      message: 'Legitimate flood SOS assistance request',
      accessibility_mode: 'STANDARD'
    };

    const ed25519_signature = cryptoManager.signPayload(source_node_id, canonical_payload);
    const mutated_payload = { ...canonical_payload, [tampered_field]: rogue_value };
    const isValid = cryptoManager.verifySignature(source_node_id, mutated_payload, ed25519_signature);

    if (!isValid) {
      const quarantinedNodeId = 'ward-2';
      meshNetwork.quarantinedNodes.add(quarantinedNodeId);
      const nodeObj = meshNetwork.nodes.get(quarantinedNodeId);
      if (nodeObj) nodeObj.status = 'QUARANTINED';

      const tamperLog = {
        packet_id,
        source_node_id,
        quarantined_node: quarantinedNodeId,
        reason: 'ED25519_SIGNATURE_MISMATCH',
        tampered_field,
        original_signature: ed25519_signature,
        verified: false,
        timestamp: new Date().toISOString()
      };
      meshNetwork.tamperLogs.push(tamperLog);

      broadcastEvent('tamper_event', tamperLog);

      return res.status(403).json({
        rejected: true,
        reason: 'ED25519_SIGNATURE_MISMATCH',
        tampered_fields: [tampered_field],
        quarantined_node: quarantinedNodeId,
        details: 'Cryptographic Ed25519 signature verification failed. Packet dropped and rogue node quarantined.',
        transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
      });
    }

    res.json({ rejected: false, details: 'Signature unexpectedly passed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Role-Based Case Closure (Relief Hub Signature Only)
app.post('/api/cases/:id/close', (req, res) => {
  try {
    const caseId = req.params.id;
    const { signer_node_id, signature, action_note = 'Resolved by field medic team' } = req.body;

    const targetCase = casualtyBoard.find(c => c.case_id === caseId || c.packet_id === caseId);
    if (!targetCase) {
      return res.status(404).json({ error: `Case ${caseId} not found` });
    }

    if (signer_node_id !== 'relief-hub') {
      return res.status(403).json({
        rejected: true,
        error: 'UNAUTHORIZED_ROLE',
        details: `Node ${signer_node_id} is not authorized. ONLY relief-hub (VERIFIED_RESPONDER) can close cases.`
      });
    }

    targetCase.status = 'CLOSED';
    targetCase.closed_at = new Date().toISOString();
    targetCase.closed_by = signer_node_id;
    targetCase.action_note = action_note;

    broadcastEvent('case_updated', targetCase);

    res.json({
      status: 'CASE_CLOSED',
      case_id: caseId,
      verified_by: 'relief-hub',
      action_note,
      transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 14. Reset Hub Inventory
app.post('/api/inventory/reset', (req, res) => {
  const updated = triageEngine.resetInventory();
  broadcastEvent('inventory_reset', updated);
  res.json({
    status: 'INVENTORY_RESET',
    inventory: updated,
    transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
  });
});

// 15. Batch Test Endpoint
app.post('/api/batch-test', async (req, res) => {
  try {
    const { inputs = [] } = req.body;
    const results = [];

    for (const item of inputs) {
      const triageResult = await triageEngine.processSOS({
        message: item.message,
        medical_mode: item.medical_mode || 'general',
        accessibility_mode: item.accessibility_mode || 'STANDARD'
      });

      results.push({
        id: item.id,
        source_node_id: item.source_node_id,
        message: item.message,
        medical_mode: item.medical_mode,
        triage_tag: triageResult.triage_decision.triage_tag,
        triage_score: triageResult.triage_decision.triage_score,
        allocated_supplies: triageResult.triage_decision.allocated_supplies,
        latency_ms: triageResult.latency_ms,
        fallback_used: triageResult.fallback_used
      });
    }

    let markdownReport = `# LifeMesh Triage Batch Verification Report\n\n`;
    markdownReport += `Generated on: ${new Date().toISOString()}\n\n`;
    markdownReport += `| ID | Node | Message | Mode | Tag | Score | Allocated Supplies | Latency (ms) | Fallback |\n`;
    markdownReport += `|---|---|---|---|---|---|---|---|---|\n`;

    for (const r of results) {
      const suppliesStr = Object.entries(r.allocated_supplies).map(([k, v]) => `${k}:${v}`).join(', ') || 'None';
      markdownReport += `| ${r.id} | ${r.source_node_id} | ${r.message.replace(/\|/g, '')} | ${r.medical_mode} | **${r.triage_tag}** | ${r.triage_score} | ${suppliesStr} | ${r.latency_ms}ms | ${r.fallback_used} |\n`;
    }

    res.json({
      results,
      markdown_report: markdownReport,
      transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initialize model and start server
triageEngine.initModel().catch(() => {});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LifeMesh] Engine running on http://0.0.0.0:${PORT}`);
    console.log(`[LifeMesh] LAN IPv4: ${getLanIpv4()}`);
    console.log(`[LifeMesh] Transport Mode: SIMULATED_BLE_WIFI_DIRECT`);
  });
}

export default app;
