import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_INVENTORY = {
  water_packs: 6,
  food_rations: 4,
  medical_kits: 3,
  insulin_packs: 2,
  rescue_boats: 2
};

// Pure deterministic Tamil / Tanglish / English crisis keyword dictionary
const CRISIS_LEXICON = {
  cardiac: ['nenju vali', 'chest pain', 'heart attack', 'marapu', 'breathless', 'cardiac', 'pulse weak'],
  pregnancy: ['prasavam', 'pregnant', 'delivery', 'labour pain', 'valikudhu', 'thaai', 'full term', 'water broke'],
  diabetic: ['sugar', 'insulin', 'low sugar', 'diabetic', 'mayakkam', 'seeni'],
  trapped: ['thanni', 'flood', 'roof', 'rooftop', 'trapped', 'water level high', 'marathula', 'submerged', 'water rising', 'surrounded by water'],
  silent_distress: ['missed heartbeat', 'silent distress', 'panic switch', 'no response'],
  injuries: ['bleeding', 'fracture', 'broken', 'ratham', 'wound', 'head injury'],
  vulnerability: ['elderly', 'paati', 'thatha', 'baby', 'child', 'kulandhai', 'disabled', 'wheelchair', 'dialysis', 'bedridden']
};

class TriageEngine {
  constructor() {
    this.modelId = 'onnx-community/Qwen2.5-0.5B-Instruct';
    this.pipeline = null;
    this.modelLoaded = false;
    this.loadingPromise = null;
    this.inventory = { ...DEFAULT_INVENTORY };
  }

  resetInventory() {
    this.inventory = { ...DEFAULT_INVENTORY };
    return { ...this.inventory };
  }

  async initModel() {
    if (this.modelLoaded) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      try {
        console.log(`[TriageEngine] Initializing on-device LLM (${this.modelId})...`);
        const { pipeline, env } = await import('@huggingface/transformers');
        
        // Cache weights locally so it runs 100% offline in Airplane mode
        env.cacheDir = path.resolve(__dirname, 'model_cache');
        env.allowLocalModels = true;
        
        this.pipeline = await pipeline('text-generation', this.modelId, {
          dtype: 'q4',
          device: 'cpu'
        });
        this.modelLoaded = true;
        console.log(`[TriageEngine] LLM model loaded successfully into ${env.cacheDir}`);
      } catch (err) {
        console.warn(`[TriageEngine] Local LLM init notice (fallback ready): ${err.message}`);
        this.modelLoaded = false;
      }
    })();

    return this.loadingPromise;
  }

  // Deterministic Keyword Extractor (covers English + Tamil/Tanglish)
  extractKeywordsDeterministic(text = '', medicalMode = 'general') {
    const lower = (text + ' ' + medicalMode).toLowerCase();
    const detected_symptoms = [];
    const vulnerability_flags = [];
    const requested_supplies = [];
    let estimatedPeople = 1;

    // Detect people count
    const peopleMatch = lower.match(/(\d+)\s*(people|persons|per|members|aalu|family)/i);
    if (peopleMatch) {
      estimatedPeople = parseInt(peopleMatch[1], 10);
    } else if (lower.includes('family') || lower.includes('kudumbam')) {
      estimatedPeople = 4;
    }

    // Check crisis lexicon
    for (const [category, words] of Object.entries(CRISIS_LEXICON)) {
      for (const w of words) {
        if (lower.includes(w)) {
          if (category === 'vulnerability') {
            vulnerability_flags.push(w);
          } else {
            detected_symptoms.push(`${category}:${w}`);
          }
        }
      }
    }

    if (medicalMode && medicalMode !== 'general') {
      detected_symptoms.push(`mode:${medicalMode}`);
    }

    // Supply mapping
    if (lower.includes('water') || lower.includes('thanni') || lower.includes('thirsty')) {
      requested_supplies.push('water_packs');
    }
    if (lower.includes('food') || lower.includes('pasikudhu') || lower.includes('ration') || lower.includes('eating')) {
      requested_supplies.push('food_rations');
    }
    if (lower.includes('insulin') || lower.includes('sugar') || medicalMode === 'diabetic') {
      requested_supplies.push('insulin_packs');
    }
    if (lower.includes('boat') || lower.includes('boat venum') || lower.includes('evacuate') || lower.includes('trapped')) {
      requested_supplies.push('rescue_boats');
    }
    if (detected_symptoms.length > 0 || medicalMode !== 'general') {
      requested_supplies.push('medical_kits');
    }

    return {
      detected_symptoms: Array.from(new Set(detected_symptoms)),
      people_affected: Math.max(1, estimatedPeople),
      vulnerability_flags: Array.from(new Set(vulnerability_flags)),
      requested_supplies: Array.from(new Set(requested_supplies)),
      plain_summary: `[Deterministic Fallback] Urgent report: ${detected_symptoms.join(', ') || 'Crisis assistance required'}.`,
      confidence: 0.82
    };
  }

  // Step A: Local LLM Extraction with Timeout Guardrail
  async extractWithLLM(message, medicalMode, timeoutMs = 15000) {
    const startTime = Date.now();
    let fallback_used = false;
    let needs_human_review = false;
    let extraction = null;

    if (!this.modelLoaded && !this.loadingPromise) {
      this.initModel().catch(() => {});
    }

    const runInference = async () => {
      if (!this.pipeline) throw new Error('Model pipeline not initialized');

      const systemPrompt = `You are LifeMesh Emergency Triage AI. Extract structured data from emergency messages in English, Tamil, or Tanglish. Output ONLY valid JSON:
{
  "detected_symptoms": ["string"],
  "people_affected": 1,
  "vulnerability_flags": ["string"],
  "requested_supplies": ["water_packs" | "food_rations" | "medical_kits" | "insulin_packs" | "rescue_boats"],
  "plain_summary": "one line summary",
  "confidence": 0.9
}`;

      const userPrompt = `Message: "${message}"\nMedical Mode: "${medicalMode}"\nJSON Output:`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const output = await this.pipeline(messages, {
        max_new_tokens: 180,
        temperature: 0.1,
        do_sample: false
      });

      const responseText = output[0]?.generated_text;
      let rawContent = '';
      if (Array.isArray(responseText)) {
        const assistantMsg = responseText.find(m => m.role === 'assistant');
        rawContent = assistantMsg ? assistantMsg.content : JSON.stringify(responseText);
      } else if (typeof responseText === 'object') {
        rawContent = responseText.content || JSON.stringify(responseText);
      } else {
        rawContent = String(responseText);
      }

      // JSON parsing attempt with regex match
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON structure found in LLM output');
      const parsed = JSON.parse(jsonMatch[0]);

      if (typeof parsed.confidence !== 'number' || parsed.confidence < 0.65) {
        throw new Error(`Low confidence: ${parsed.confidence}`);
      }
      return parsed;
    };

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('LLM_INFERENCE_TIMEOUT')), timeoutMs)
      );
      extraction = await Promise.race([runInference(), timeoutPromise]);
    } catch (err) {
      fallback_used = true;
      needs_human_review = true;
      extraction = this.extractKeywordsDeterministic(message, medicalMode);
    }

    const latency_ms = Date.now() - startTime;
    return {
      extraction,
      latency_ms,
      fallback_used,
      needs_human_review
    };
  }

  // Step B: Pure Deterministic START Triage Override & Supply Allocation
  computeDeterministicTriage(extraction, medicalMode, accessibilityMode) {
    let score = 25; // baseline
    let tag = 'GREEN';
    const reasons = [];

    const symptoms = (extraction.detected_symptoms || []).join(' ').toLowerCase();
    const flags = (extraction.vulnerability_flags || []).join(' ').toLowerCase();
    const mode = (medicalMode || 'general').toLowerCase();

    // Critical RED condition rules (Life-threatening)
    if (
      mode === 'cardiac' ||
      mode === 'silent_distress' ||
      symptoms.includes('chest pain') ||
      symptoms.includes('nenju') ||
      symptoms.includes('breathless') ||
      symptoms.includes('unconscious') ||
      symptoms.includes('ratham') ||
      symptoms.includes('bleeding') ||
      (mode === 'pregnancy' && (symptoms.includes('labour') || symptoms.includes('valikudhu') || symptoms.includes('water broke')))
    ) {
      score = 92;
      tag = 'RED';
      reasons.push('CRITICAL_PHYSIOLOGICAL_INSTABILITY: Immediate life threat identified.');
    } else if (
      mode === 'pregnancy' ||
      mode === 'diabetic' ||
      mode === 'trapped' ||
      flags.includes('elderly') ||
      flags.includes('baby') ||
      flags.includes('dialysis') ||
      symptoms.includes('fracture') ||
      symptoms.includes('sugar')
    ) {
      score = 68;
      tag = 'YELLOW';
      reasons.push('SERIOUS_URGENT: Patient vulnerable or non-ambulatory, requires prompt stabilization.');
    } else if (extraction.people_affected > 5) {
      score = 55;
      tag = 'YELLOW';
      reasons.push('MASS_GATHERING_DISTRESS: High volume of affected persons.');
    } else {
      score = 30;
      tag = 'GREEN';
      reasons.push('STABLE_WALKING_WOUNDED: Ambulation intact, deferred non-critical care.');
    }

    // Micro-logistics Allocation based on inventory
    const allocated_supplies = {};
    const requested = extraction.requested_supplies || [];

    const deductIfAvailable = (item, qty) => {
      const current = this.inventory[item] || 0;
      const count = Math.min(current, qty);
      if (count > 0) {
        this.inventory[item] -= count;
        allocated_supplies[item] = count;
      } else {
        allocated_supplies[item] = 0; // Depleted
      }
    };

    // Severity based prioritization
    if (tag === 'RED') {
      deductIfAvailable('medical_kits', 1);
      deductIfAvailable('rescue_boats', 1);
      if (mode === 'diabetic') deductIfAvailable('insulin_packs', 1);
      deductIfAvailable('water_packs', Math.min(2, extraction.people_affected));
    } else if (tag === 'YELLOW') {
      if (requested.includes('medical_kits') || mode !== 'general') deductIfAvailable('medical_kits', 1);
      if (mode === 'diabetic' || requested.includes('insulin_packs')) deductIfAvailable('insulin_packs', 1);
      if (requested.includes('rescue_boats')) deductIfAvailable('rescue_boats', 1);
      deductIfAvailable('water_packs', Math.min(2, extraction.people_affected));
      deductIfAvailable('food_rations', Math.min(2, extraction.people_affected));
    } else {
      // GREEN
      deductIfAvailable('water_packs', 1);
      deductIfAvailable('food_rations', 1);
    }

    return {
      triage_tag: tag,
      triage_score: score,
      clinical_rationale: reasons.join(' '),
      allocated_supplies,
      remaining_hub_inventory: { ...this.inventory },
      transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
    };
  }

  // Full Pipeline Execution
  async processSOS({ message, medical_mode, accessibility_mode }) {
    const { extraction, latency_ms, fallback_used, needs_human_review } = await this.extractWithLLM(
      message,
      medical_mode
    );

    const triageDecision = this.computeDeterministicTriage(
      extraction,
      medical_mode,
      accessibility_mode
    );

    return {
      ai_extraction: extraction,
      triage_decision: triageDecision,
      latency_ms,
      fallback_used,
      needs_human_review,
      pipeline_mode: 'THE_LLM_EXPLAINS_THE_RULES_DECIDE'
    };
  }
}

export const triageEngine = new TriageEngine();
