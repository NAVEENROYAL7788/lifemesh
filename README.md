# LifeMesh OS | Offline P2P Crisis Relief & Medical Triage Engine

> **Built for extreme climate disasters and communication blackouts.**  
> Supporting **UN SDG 2: Zero Hunger** and **UN SDG 13: Climate Action**.

---

## 📖 Project Overview

During severe floods (e.g., Chennai cyclone inundation), cell towers fail, power grids trip, and cloud APIs become unreachable. Stranded victims in relief shelters lose the ability to request food, drinking water, and critical medicines. 

**LifeMesh** is an offline-first crisis relief and emergency micro-logistics relay operating completely without internet. It combines **local on-device quantized LLM inference** (`onnx-community/Qwen2.5-0.5B-Instruct` q4), **deterministic START medical triage overrides**, **Ed25519 signing and verification on every relay hop**, **AES-256-GCM zero-knowledge patient privacy**, and **fraud-proof digital ration tokens (UN SDG 2)**.

---

## ⚡ Quick Start

### Prerequisites
- Node.js v18+ (tested on v20+)
- No paid API keys required. 100% free and open-source.

### 1. Launch Server (Port 3001)
```bash
cd server
npm install
npm start
```

### 2. Launch Client (Port 5173, Host 0.0.0.0)
```bash
cd client
npm install
npm run dev
```

### 3. Open Web Portals
- **Laptop Command Center:** Open `http://localhost:5173`
- **Mobile Phone (Offline LAN):** Connect phone to the laptop's Wi-Fi hotspot, scan the on-screen pairing QR code, or navigate to `http://<laptop-lan-ip>:5173/?mode=citizen`
- **Rescuer Password:** `RESCUE2026` (Callsign: `RESCUER-ALPHA`)

---

## 🛡️ Feature Transparency Table

In strict compliance with hackathon audit guidelines, working vs. simulated layers are 100% transparent:

| Feature / Layer | Implementation Status | Technical Mechanism |
|---|---|---|
| **Local On-Device LLM** | **LIVE REAL** | Quantized `onnx-community/Qwen2.5-0.5B-Instruct` (q4) executed locally on CPU via `@huggingface/transformers` in `server/model_cache/`. Measured latency (`latency_ms`) returned on every call with zero external network access. |
| **START Protocol Triage Override** | **LIVE REAL** | "The LLM explains, the rules decide" guardrail. Clinical priorities (`RED`, `YELLOW`, `GREEN`, `BLACK`) and scarce hub supplies are allocated strictly by deterministic START rules with multilingual typo & Tamil/Tanglish lexicon fallback. |
| **Asymmetric Cryptography** | **LIVE REAL** | Node.js built-in `crypto.sign` and `crypto.verify` (Ed25519) on every relay hop and at the relief hub. Rogue payload mutations trigger `ED25519_SIGNATURE_MISMATCH` and node quarantine. |
| **Zero-Knowledge Medical Privacy** | **LIVE REAL** | AES-256-GCM encryption of sensitive patient metadata. Intermediate relay nodes inspect only hex ciphertext, IV, and auth tag; only `Central Disaster Relief Hub` possesses the symmetric key to decrypt plaintext. |
| **Digital Ration Tokens (SDG 2)** | **LIVE REAL** | Ed25519-signed ration tokens issued upon SOS verification. Validated via `POST /api/rations/:id/redeem` with active double-spend prevention (`DOUBLE_CLAIM_BLOCKED`). |
| **Offline Sign-Language Camera SOS** | **LIVE REAL** | On-device MediaPipe vision (`@mediapipe/tasks-vision`) with 100% local WASM (`/mediapipe/wasm`) and local task asset (`/mediapipe/hand_landmarker.task`). Detects 4 gestures with a 1.5-second hold progress bar. |
| **Live Phone ↔ Laptop Sync** | **LIVE REAL** | Real-time Server-Sent Events (`GET /api/stream`) broadcasting state across local Wi-Fi / hotspot. Two-way rescuer replies push immediately to phone screens. |
| **Silent-Distress Failsafe** | **LIVE REAL** | 15-second heartbeat countdown timer. Unanswered timer triggers an automated signed RED distress alert for incapacitated victims. |
| **Accessible White-Based UI** | **LIVE REAL** | WCAG AAA high-contrast design (`#F8FAFC` canvas, `#FFFFFF` cards, large text, min 52px touch targets, Elderly Mode, Blind voice synthesis, Deaf visual alerts, Mute pictograms). |
| **Acoustic SOS Beacon** | **LIVE REAL** | Native browser Web Audio API (`AudioContext` + 880 Hz sawtooth `OscillatorNode`) as an audible acoustic distress chirp when radio links fail. |
| **Physical Radio Mesh Topology** | **SIMULATED** | 7-node Chennai flood ward graph (`SYNTHETIC_NODES`) simulating BLE 5.2 / Wi-Fi Direct peer links with real BFS shortest-path routing, hop inspection logs, and $\le 250$-byte BLE discovery header framing. |
| **Planned Production Roadmap** | **PLANNED** | Android Nearby Connections BLE/Wi-Fi Direct radio adapter plugin, camera-based contactless pulse/respiration vitals, state disaster management (NDRF) API integration. |

---

## 📋 Mandatory Buildathon Disclosures

| Category | Disclosure Details |
|---|---|
| **Open Source Libraries** | Node.js built-in `crypto`, Express, CORS, React 18, Vite 6, Tailwind CSS, `@huggingface/transformers` (Apache 2.0), `@mediapipe/tasks-vision` (Apache 2.0), `qrcode.react`, `lucide-react`. |
| **Pretrained Models** | `onnx-community/Qwen2.5-0.5B-Instruct` (quantized q4 ONNX), MediaPipe `hand_landmarker.task` (Google MediaPipe). |
| **Paid APIs Used** | **ZERO.** Zero paid APIs, zero subscriptions, zero cloud inference costs at runtime. |
| **Datasets Used** | **100% Synthetic Placeholder Data.** Synthetic Chennai flood wards (Velachery, Pallikaranai, Madipakkam, Adyar, Saidapet, Thoraipakkam) and synthetic patient records. Zero real personal identifying information (PII). |
| **AI Assistants Used** | Antigravity IDE, Google Gemini, and Anthropic Claude were used during development and planning to assist with codebase architecture and documentation drafting. |
