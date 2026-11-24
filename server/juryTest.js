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

async function runJuryUpgradeVerification() {
  console.log('====================================================');
  console.log('🚀 LIFEMESH JURY UPGRADE VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // 1. Network Discovery & LAN IPv4 endpoint
  console.log('TEST 1: Network Info & Offline LAN Phone URL...');
  const netRes = await request('/api/network-info');
  if (netRes.ok && netRes.data.lan_ip && netRes.data.phone_url.includes('?mode=citizen')) {
    console.log(`✅ TEST 1 PASSED: LAN IP=${netRes.data.lan_ip}, Phone URL=${netRes.data.phone_url}`);
    passed++;
  } else {
    console.error('❌ TEST 1 FAILED:', netRes);
    failed++;
  }

  // 2. Rescuer Password Authentication
  console.log('\nTEST 2: Rescuer Authentication (Password Protected)...');
  const authFail = await request('/api/auth/rescuer', { method: 'POST', body: { password: 'WRONG_PASSWORD' } });
  const authPass = await request('/api/auth/rescuer', { method: 'POST', body: { password: 'RESCUE2026', callsign: 'RESCUER-BETA' } });

  if (authFail.status === 401 && authPass.ok && authPass.data.role === 'VERIFIED_RESPONDER') {
    console.log(`✅ TEST 2 PASSED: Invalid password rejected (401), valid password RESCUE2026 unlocked role ${authPass.data.role}`);
    passed++;
  } else {
    console.error('❌ TEST 2 FAILED:', { authFail, authPass });
    failed++;
  }

  // 3. Citizen SOS + Signed Ration Token Creation + Route Calculation
  console.log('\nTEST 3: Citizen SOS Dispatch + Mission Route + Signed Ration Token...');
  const sosRes = await request('/api/sos', {
    method: 'POST',
    body: {
      source_node_id: 'ward-1',
      message: 'Ward 1 flood surge, diabetic patient need urgent insulin and drinking water',
      medical_mode: 'diabetic',
      condition_notes: 'Elderly patient on insulin therapy'
    }
  });

  let createdTokenId = null;
  let createdCaseId = null;

  if (sosRes.ok && sosRes.data.ration_token && sosRes.data.case_record.mission_route) {
    createdTokenId = sosRes.data.ration_token.tokenId;
    createdCaseId = sosRes.data.case_record.case_id;
    const route = sosRes.data.case_record.mission_route;
    console.log(`✅ SOS Triaged! Case ID: ${createdCaseId}`);
    console.log(`✅ Route: ${route.distance_km} km | ETA: ${route.eta_minutes} mins | Mode: ${route.transport_mode}`);
    console.log(`✅ Ration Token Generated: ${createdTokenId} (Ed25519 Sig: ${sosRes.data.ration_token.ed25519_signature.slice(0, 24)}...)`);
    passed++;
  } else {
    console.error('❌ TEST 3 FAILED:', sosRes);
    failed++;
  }

  // 4. Two-Way Rescuer Reply (Laptop -> Citizen Phone)
  console.log('\nTEST 4: Two-Way Message Transmission (POST /api/cases/:id/reply)...');
  const replyRes = await request(`/api/cases/${createdCaseId}/reply`, {
    method: 'POST',
    body: {
      reply_text: 'Rescue Boat Dispatched with Insulin and Clean Water — Stay on 2nd Floor',
      rescuer_callsign: 'RELIEF-COMMAND'
    }
  });

  if (replyRes.ok && replyRes.data.reply.text.includes('Rescue Boat Dispatched')) {
    console.log(`✅ TEST 4 PASSED: Rescuer reply broadcasted: "${replyRes.data.reply.text}"`);
    passed++;
  } else {
    console.error('❌ TEST 4 FAILED:', replyRes);
    failed++;
  }

  // 5. Ration Token Claim Verification & Double-Claim Fraud Prevention
  console.log('\nTEST 5: Ration Token Claim & Double-Claim Fraud Block (SDG 2)...');
  const claim1 = await request(`/api/rations/${createdTokenId}/redeem`, { method: 'POST' });
  const claim2 = await request(`/api/rations/${createdTokenId}/redeem`, { method: 'POST' });

  if (
    claim1.ok &&
    claim1.data.status === 'VERIFIED_AND_REDEEMED' &&
    claim2.status === 409 &&
    claim2.data.double_claim_blocked === true &&
    claim2.data.reason === 'DOUBLE_CLAIM_BLOCKED'
  ) {
    console.log(`✅ Claim 1: Verified Hub Ed25519 Signature & Redeemed successfully!`);
    console.log(`✅ Claim 2: DOUBLE_CLAIM_BLOCKED — Fraud Attempt Prevented (HTTP 409)!`);
    console.log(`✅ TEST 5 PASSED: Real double-spend protection verified.`);
    passed++;
  } else {
    console.error('❌ TEST 5 FAILED:', { claim1, claim2 });
    failed++;
  }

  // 6. Dynamic Route Rerouting on Bridge Partitioning
  console.log('\nTEST 6: Dynamic Route Rerouting on Transit Bridge Partition...');
  // Kill Adyar Bridge and Saidapet Metro
  await request('/api/nodes/ward-4/toggle', { method: 'POST', body: { status: 'OFFLINE' } });
  await request('/api/nodes/ward-5/toggle', { method: 'POST', body: { status: 'OFFLINE' } });

  const stateRes = await request('/api/state');
  const targetCase = stateRes.data.casualty_board.find(c => c.case_id === createdCaseId);

  if (targetCase && targetCase.mission_route.route_status === 'BRIDGES_FLOODED_AMPHIBIOUS_DETOUR') {
    console.log(`✅ TEST 6 PASSED: Transit bridges flooded! Status updated to ${targetCase.mission_route.route_status}, Mode: ${targetCase.mission_route.transport_mode}, ETA increased to ${targetCase.mission_route.eta_minutes} mins.`);
    passed++;
  } else {
    console.error('❌ TEST 6 FAILED:', targetCase?.mission_route);
    failed++;
  }

  // Restore bridges
  await request('/api/nodes/ward-4/toggle', { method: 'POST', body: { status: 'ONLINE' } });
  await request('/api/nodes/ward-5/toggle', { method: 'POST', body: { status: 'ONLINE' } });

  console.log('\n====================================================');
  console.log(`🏁 JURY UPGRADE SUITE: ${passed} PASSED / ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

runJuryUpgradeVerification().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
