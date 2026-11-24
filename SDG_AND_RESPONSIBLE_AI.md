# LifeMesh OS: UN SDG Alignment & Responsible AI Statement

> Prepared for Hackathon Judges & Compliance Reviewers  
> Project: **LifeMesh (Problem Statement 1)**  
> SDGs Addressed: **UN SDG 2 (Zero Hunger)** & **UN SDG 13 (Climate Action)**

---

## 1. UN SDG Alignment

### UN SDG 2: Zero Hunger & Micro-Logistics Fairness
In disaster blackouts, emergency food rations and clean drinking water are finite. Relief operations frequently suffer from hoarding, double-claiming, and chaotic ad-hoc distribution.
- **Scarcity-Aware Allocation:** Finite stocks (`water_packs`, `food_rations`, `medical_kits`, `insulin_packs`, `rescue_boats`) are tracked in real-time and allocated strictly in response to validated clinical needs.
- **Fraud-Proof Ed25519 Ration Tokens:** Every verified SOS generates an asymmetric cryptographic token signed by the `Central Disaster Relief Hub`. When redeemed at a shelter or distribution boat, the hub verifies the signature. Any re-claim attempt is blocked as `DOUBLE_CLAIM_BLOCKED` and logged in the security ledger, preventing duplicate allocations and ensuring equitable access to nourishment.

### UN SDG 13: Climate Action & Disaster Resilience
Extreme weather events (cyclones, urban flash floods, rising sea levels) routinely knock out cellular base stations and terrestrial power grids.
- **Zero-Cloud Local Autonomy:** LifeMesh runs 100% offline in Airplane Mode. AI triage, cryptographic verification, and packet routing execute on standard consumer hardware without relying on distant data centers.
- **Dynamic Climate Route Detours:** When physical transit choke points (such as the Adyar Bridge or Saidapet Metro elevated corridors) are submerged or marked offline, LifeMesh recalculates ETAs and automatically routes responders via amphibious vessels.
- **Store-and-Forward Mesh Partitioning:** Partitioned nodes buffer signed distress packets in local queues until physical "Data Mule" rescue boats make contact, merging records via Conflict-free Replicated Data Type (CRDT) Last-Write-Wins deduplication.

---

## 2. Privacy by Design & Zero-Knowledge Architecture

1. **Zero Runtime Data Leakage:** All LLM extraction and vision tasks execute locally via ONNX Runtime and local WebAssembly. Zero audio, video, or message text is transmitted to external cloud endpoints.
2. **Intermediate Relay Confidentiality (AES-256-GCM):** While distress packets must hop across untrusted civilian peer nodes to reach the hub, patient medical metadata (e.g., pregnancy trimester, diabetic insulin dependence, psychiatric vulnerability) is symmetrically encrypted at the origin using the hub's sealed AES-256 key. Intermediate nodes see only `{ iv, authTag, ciphertext }`, preserving patient dignity under crisis.
3. **Synthetic Data Hygiene:** All coordinates, node identifiers, and patient records utilized in demonstrations and tests are purely synthetic placeholders modeled on public Chennai geographical landmarks. Zero personal identifying information (PII) is collected or stored.

---

## 3. Handling Wrong, Incomplete, or Adversarial AI Outputs

LLMs are probabilistic and susceptible to hallucinations, formatting errors, and latency spikes. LifeMesh adheres to strict deterministic guardrails:

### "The LLM Explains, The Rules Decide"
- **Role Division:** The on-device LLM (`Qwen2.5-0.5B-Instruct` q4) is tasked *only* with natural language understanding—parsing unstructured English, Tamil, and Tanglish text into a structured symptom dictionary.
- **Deterministic START Triage:** The final clinical triage score (0–100), severity color tag (`RED`, `YELLOW`, `GREEN`, `BLACK`), and resource deductions are computed by deterministic clinical algorithms based on the Simple Triage and Rapid Treatment (START) protocol. The LLM is never permitted to set priority tags or allocate supplies autonomously.

### Guardrails & Fallback Mechanisms
1. **Confidence Threshold & Latency Timeout:** If the local LLM model takes longer than 25 seconds, outputs malformed JSON, or returns a confidence score $< 0.65$, the system automatically switches to a deterministic regex/keyword lexicon (`fallback_used: true`, `needs_human_review: true`).
2. **Multilingual Crisis Lexicon:** The deterministic engine supports Tamil Unicode (`நெஞ்சு வலி`, `பிரசவம்`, `வெள்ளம்`), colloquial Tanglish (`nenju vali`, `prasavam valikudhu`, `sugar low mayakkam`, `thanni veetukulla`), and common typos (`wtr rising`, `no food`).
3. **False-Positive Supply Protection:** Input strings containing safe or testing phrases (`"We are safe"`, `"Just testing the mesh"`, `"Power is back, all good"`) are categorized as `GREEN` with a low priority score (15/100) and are explicitly prevented from consuming scarce insulin, medical kits, or rescue vessels.
4. **Cryptographic Tamper Defense:** If a malicious node alters distress details mid-transit (e.g., falsely elevating an emergency or modifying requested rations), the sender's Ed25519 signature fails verification (`ED25519_SIGNATURE_MISMATCH`). The packet is dropped immediately, and the rogue node is quarantined from future routing.
