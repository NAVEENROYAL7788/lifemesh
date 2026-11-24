import http from 'node:http';

const BASE_URL = 'http://localhost:3001';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runSmokeTest() {
  console.log('====================================================');
  console.log('🚀 LIFEMESH BACKEND & OFFLINE AI ENGINE SMOKE TEST');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // 1. Health check & model initialization check
  console.log('TEST 1: Health & Offline AI Readiness check...');
  const healthRes = await request('/api/health');
  if (healthRes.ok && healthRes.data.status === 'HEALTHY' && healthRes.data.transport_mode === 'SIMULATED_BLE_WIFI_DIRECT') {
    console.log(`✅ TEST 1 PASSED: Health OK, transport_mode=${healthRes.data.transport_mode}, model_id=${healthRes.data.model_id}`);
    passed++;
  } else {
    console.error('❌ TEST 1 FAILED:', healthRes);
    failed++;
  }

  // 2. Multi-hop SOS + AES-256-GCM Medical Privacy + Ed25519 hop inspection
  console.log('\nTEST 2: Normal Multi-Hop SOS & Zero-Knowledge Medical Privacy...');
  const sosPayload = {
    source_node_id: 'ward-1',
    message: 'Flooding in Velachery shelter, 3 elderly people stranded, need food and medicine',
    medical_mode: 'general',
    accessibility_mode: 'VOICE_ASSIST',
    condition_notes: 'Patient A has chronic hypertension, needs urgent beta-blockers'
  };

  const sosRes = await request('/api/sos', { method: 'POST', body: sosPayload });
  if (sosRes.ok && sosRes.data.status === 'DELIVERED_AND_TRIAGED') {
    const caseRec = sosRes.data.case_record;
    const routing = sosRes.data.routing;
    console.log(`✅ Multi-hop trace: ${routing.hop_trace.join(' -> ')} (${routing.hop_trace.length - 1} hops)`);
    console.log(`✅ Packet size: ${routing.ble_payload_bytes} bytes (BLE-Ready <= 250: ${routing.ble_ready})`);
    console.log(`✅ Triage Tag: ${caseRec.triage_tag} | Score: ${caseRec.triage_score} | Latency: ${caseRec.latency_ms}ms`);
    
    // Verify intermediate hops saw encrypted ciphertext and not plaintext
    const intermediateLog = routing.relay_inspection_log.find(l => l.role_at_hop === 'RELAY_FORWARDER');
    if (intermediateLog && intermediateLog.saw_plaintext_medical_notes === false && intermediateLog.saw_encrypted_ciphertext === true) {
      console.log(`✅ Privacy verified: Intermediate relay (${intermediateLog.node_name}) saw AES ciphertext ONLY, no plaintext.`);
      console.log(`✅ Destination Hub decrypted condition notes: "${caseRec.decrypted_condition_notes}"`);
      passed++;
    } else {
      console.error('❌ Privacy inspection mismatch in relay logs:', intermediateLog);
      failed++;
    }
  } else {
    console.error('❌ TEST 2 FAILED:', sosRes);
    failed++;
  }

  // 3. Rogue Attack Simulation: Tamper detection & Ed25519 signature verification failure
  console.log('\nTEST 3: Rogue Node Packet Tamper Simulation (/api/simulate-tamper)...');
  const tamperRes = await request('/api/simulate-tamper', {
    method: 'POST',
    body: {
      source_node_id: 'ward-1',
      tampered_field: 'message',
      rogue_value: 'TAMPERED: FALSE ALARM CANCEL RESCUE'
    }
  });

  if (tamperRes.status === 403 && tamperRes.data.rejected === true && tamperRes.data.reason === 'ED25519_SIGNATURE_MISMATCH') {
    console.log(`✅ TEST 3 PASSED: Mutated payload rejected! Reason: ${tamperRes.data.reason}`);
    console.log(`✅ Quarantined Rogue Node: ${tamperRes.data.quarantined_node}`);
    passed++;
  } else {
    console.error('❌ TEST 3 FAILED:', tamperRes);
    failed++;
  }

  // 4. Relay Partitioning & Data Mule CRDT Sync
  console.log('\nTEST 4: Relay Partitioning ("Kill Relay Nodes") & Rescue Boat Data Mule CRDT Sync...');
  // Kill transit nodes ward-4 and ward-5 to isolate ward-1
  await request('/api/nodes/ward-4/toggle', { method: 'POST', body: { status: 'OFFLINE' } });
  await request('/api/nodes/ward-5/toggle', { method: 'POST', body: { status: 'OFFLINE' } });

  const partitionedSosRes = await request('/api/sos', {
    method: 'POST',
    body: {
      source_node_id: 'ward-1',
      message: 'Ward 1 cut off completely! Oxygen cylinder required for newborn.',
      medical_mode: 'pregnancy',
      condition_notes: 'Post-delivery mother with neonate distress'
    }
  });

  if (partitionedSosRes.ok && partitionedSosRes.data.status === 'BUFFERED_OFFLINE') {
    console.log(`✅ Partitioning detected: Packet buffered in store-and-forward queue (Queue length: ${partitionedSosRes.data.routing.queue_length})`);
    
    // Dispatch Rescue Boat / Data Mule
    console.log('🚤 Dispatching Data Mule Rescue Boat to collect queued packets...');
    const muleRes = await request('/api/data-mule/sync', { method: 'POST' });
    if (muleRes.ok && muleRes.data.status === 'MULE_SYNC_COMPLETE' && muleRes.data.sync_summary.packets_merged >= 1) {
      console.log(`✅ TEST 4 PASSED: Data Mule visited partitioned nodes, verified Ed25519 signatures, and merged ${muleRes.data.sync_summary.packets_merged} packets into relief hub casualty board via CRDT!`);
      passed++;
    } else {
      console.error('❌ Data Mule sync failed:', muleRes);
      failed++;
    }
  } else {
    console.error('❌ TEST 4 FAILED (Did not buffer):', partitionedSosRes);
    failed++;
  }

  // Restore node statuses
  await request('/api/nodes/ward-4/toggle', { method: 'POST', body: { status: 'ONLINE' } });
  await request('/api/nodes/ward-5/toggle', { method: 'POST', body: { status: 'ONLINE' } });

  // 5. Batch Test Endpoint
  console.log('\nTEST 5: Batch Test Endpoint & Markdown Report Generation...');
  const batchRes = await request('/api/batch-test', {
    method: 'POST',
    body: {
      inputs: [
        { id: 'SOS-01', source_node_id: 'ward-1', message: 'Nenju vali, elderly man unconscious', medical_mode: 'cardiac' },
        { id: 'SOS-02', source_node_id: 'ward-2', message: 'Prasavam valikudhu, full term pregnancy in school shelter', medical_mode: 'pregnancy' },
        { id: 'SOS-03', source_node_id: 'ward-3', message: 'Sugar low mayakkam, insulin theva', medical_mode: 'diabetic' },
        { id: 'SOS-04', source_node_id: 'ward-6', message: 'Rooftop trapped thanni rising need drinking water and food for 4 members', medical_mode: 'trapped' }
      ]
    }
  });

  if (batchRes.ok && batchRes.data.results.length === 4 && batchRes.data.markdown_report) {
    console.log(`✅ TEST 5 PASSED: Batch processed 4 triage cases with AI + START rules.`);
    console.log(`Sample Report excerpt:\n${batchRes.data.markdown_report.slice(0, 300)}...`);
    passed++;
  } else {
    console.error('❌ TEST 5 FAILED:', batchRes);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`🏁 SMOKE TEST COMPLETE: ${passed} PASSED / ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSmokeTest().catch(err => {
  console.error('Fatal Smoke Test Error:', err);
  process.exit(1);
});
