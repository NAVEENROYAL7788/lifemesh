# LifeMesh (Step 1: Core Backend & Offline AI Engine)

Offline-first P2P crisis relief, medical triage, and emergency micro-logistics relay engine.
Built for UN SDG 2 (Zero Hunger) & UN SDG 13 (Climate Action).

## Architecture Highlights
- 100% Free & Open Source local execution (Zero Cloud APIs).
- Local quantized on-device LLM inference via `@huggingface/transformers` (`onnx-community/Qwen2.5-0.5B-Instruct` q4).
- Deterministic START Triage override guardrails ("The LLM explains, the rules decide").
- Real Node.js `crypto` Ed25519 signing/verification on every hop + AES-256-GCM zero-knowledge medical privacy.
- BFS shortest-path multi-hop routing, store-and-forward partitioning, and CRDT sync for Data Mule rescue boats.
