# LifeMesh OS | Offline P2P Crisis Relief & Medical Triage Engine

> **Built for extreme climate disasters and communication blackouts.**  
> Supporting **UN SDG 2: Zero Hunger** and **UN SDG 13: Climate Action**.

---

## 🛡️ Feature Transparency & Compliance Statement

In compliance with our hackathon audit principles, working vs. simulated layers are 100% transparent:

- **LIVE REAL IMPLEMENTATIONS (GENUINELY EXECUTING):**
  - **Offline Local On-Device LLM:** Quantized `onnx-community/Qwen2.5-0.5B-Instruct` (`q4`) running purely on-device via `@huggingface/transformers` with zero cloud calls and measured latency (`latency_ms`).
  - **Deterministic START Triage Engine:** "The LLM explains, the rules decide" guardrail. Clinical priorities, tags (`RED`, `YELLOW`, `GREEN`, `BLACK`), and finite stock allocations are computed by strict clinical rules with multilingual fallback (Tamil, Tanglish, English).
  - **Real Cryptography:** Ed25519 asymmetric signing and verification on every relay hop and destination (`node:crypto.sign` and `node:crypto.verify`).
  - **Zero-Knowledge Medical Privacy:** AES-256-GCM encryption of sensitive patient metadata. Intermediate relay forwarders see only hex ciphertext, IV, and auth tag; only `relief-hub` decrypts it.
  - **Cryptographic Ration Tokens (SDG 2):** Every verified SOS creates an Ed25519-signed digital ration token with real double-claim fraud rejection (`DOUBLE_CLAIM_BLOCKED`).
  - **Live Offline LAN Two-Way Relay:** Real-time Server-Sent Events (`/api/stream`) synchronizing laptop and mobile phones across local Wi-Fi / hotspot.
  - **Multi-Modal Accessibility:** Elderly high-contrast scaling, Blind voice-first mode (`window.speechSynthesis`), Deaf flashing visual alerts, and Mute 1-tap pictogram grid.
- **SIMULATED LAYERS:**
  - **Simulated BLE / Wi-Fi Direct Peer Radios:** A 7-node adjacency graph (`SYNTHETIC_NODES`) simulating Chennai flood-zone wards with real BFS shortest-path routing, hop inspection logs, and compressed payload byte checks (`ble_payload_bytes`).

---

## 📱 Two-Role Architecture & Demo Flow

### 1. Citizen / Victim Portal (Zero Password — 1-Tap Access)
- **Instant Access:** No login, no password, no barriers.
- **Multilingual Support:** English, தமிழ் (Tamil), and Tanglish.
- **1-Tap Emergency Pictograms:**
  - 🫀 **Cardiac Emergency** (`Nenju vali / நெஞ்சு வலி`)
  - 👶 **Pregnancy / Labour** (`Prasavam / பிரசவம்`)
  - 💉 **Diabetic / Insulin** (`Sugar low / இன்சுலின்`)
  - 🌊 **Flood Trapped** (`Thanniyula maatikittom / வெள்ளம்`)
  - 🍞 **Food & Water Depleted** (`Saapaadu theva`)
- **Live Rescue Tracker & Incoming Messages:** Displays real-time updates broadcasted by rescuers, dynamic ETA in minutes, and QR ration token card.

### 2. Rescuer Command Center (Password Protected)
- **Authentication:** Demo access via password `RESCUE2026`.
- **Verified Casualty Board:** Prioritized by START triage scores.
- **Interactive Offline Route Map (SVG):** Visualizes the Central Relief Hub, 6 flood wards, and bridges. Dynamically recalculates route ETAs and reroutes to amphibious rescue boats when bridge transit nodes (`Ward-4 Adyar Bridge` or `Ward-5 Saidapet Metro`) are flooded/toggled offline.
- **Two-Way Messaging:** Push real-time instructions directly to stranded citizens' phones over SSE.
- **Ration Tokens (SDG 2):** Audit and verify digital tokens, with live double-spend protection.
- **Network Pairing QR Code:** Automatically displays local LAN IP (e.g., `http://172.16.4.99:5173/?mode=citizen`) for instant phone scanning during live stage demos.

---

## 🚀 Quickstart & Offline Execution

### 1. Start Server & Client
```bash
# Terminal 1: Backend & Local AI Engine (Port 3001)
cd server
npm start

# Terminal 2: Vite Client (Port 5173, Host 0.0.0.0)
cd client
npm run dev
```

### 2. Run Test Suites
```bash
# Automated verification test suites:
cd server
node juryTest.js   # Verifies LAN IP, Auth, SOS, Two-Way SSE, Ration Tokens, Bridge Rerouting
node smokeTest.js  # Verifies Local LLM, Cryptography, Tamper Attacks, CRDT Mule Sync
```
