import crypto from 'node:crypto';

// 7 Synthetic Nodes representing flood-prone wards in Chennai relief scenario
export const SYNTHETIC_NODES = {
  'ward-1': { id: 'ward-1', name: 'Ward-1 Velachery Shelter', role: 'SHELTER_RELAY', lat: 12.9815, lng: 80.2180 },
  'ward-2': { id: 'ward-2', name: 'Ward-2 Pallikaranai High School', role: 'SHELTER_RELAY', lat: 12.9349, lng: 80.2137 },
  'ward-3': { id: 'ward-3', name: 'Ward-3 Madipakkam Community Hall', role: 'SHELTER_RELAY', lat: 12.9647, lng: 80.1961 },
  'ward-4': { id: 'ward-4', name: 'Ward-4 Adyar Bridge Post', role: 'TRANSIT_RELAY', lat: 13.0067, lng: 80.2570 },
  'ward-5': { id: 'ward-5', name: 'Ward-5 Saidapet Metro Elevated', role: 'TRANSIT_RELAY', lat: 13.0158, lng: 80.2227 },
  'ward-6': { id: 'ward-6', name: 'Ward-6 Thoraipakkam IT Park Roof', role: 'SHELTER_RELAY', lat: 12.9416, lng: 80.2362 },
  'relief-hub': { id: 'relief-hub', name: 'Central Disaster Relief Hub', role: 'VERIFIED_RESPONDER', lat: 13.0827, lng: 80.2707 }
};

class CryptoManager {
  constructor() {
    this.keyPairs = new Map();
    this.hubAesKey = crypto.randomBytes(32); // AES-256-GCM key known strictly to relief-hub
    this.generateNodeKeys();
  }

  generateNodeKeys() {
    for (const [nodeId, meta] of Object.entries(SYNTHETIC_NODES)) {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
      this.keyPairs.set(nodeId, {
        meta,
        publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
        privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
        publicKeyObj: publicKey,
        privateKeyObj: privateKey
      });
    }
  }

  getPublicKeyPem(nodeId) {
    const pair = this.keyPairs.get(nodeId);
    return pair ? pair.publicKeyPem : null;
  }

  signPayload(nodeId, canonicalData) {
    const pair = this.keyPairs.get(nodeId);
    if (!pair) throw new Error(`Node keypair for ${nodeId} not found`);
    const dataBuffer = Buffer.from(typeof canonicalData === 'string' ? canonicalData : JSON.stringify(canonicalData));
    const signature = crypto.sign(null, dataBuffer, pair.privateKeyObj);
    return signature.toString('hex');
  }

  verifySignature(nodeId, canonicalData, signatureHex) {
    const pair = this.keyPairs.get(nodeId);
    if (!pair) return false;
    try {
      const dataBuffer = Buffer.from(typeof canonicalData === 'string' ? canonicalData : JSON.stringify(canonicalData));
      const sigBuffer = Buffer.from(signatureHex, 'hex');
      return crypto.verify(null, dataBuffer, pair.publicKeyObj, sigBuffer);
    } catch (err) {
      return false;
    }
  }

  // Zero-Knowledge Encrypt: Sensitive medical data encrypted using Hub's AES-256-GCM key
  encryptMedicalPayload(medicalData) {
    const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.hubAesKey, iv);
    const plaintext = JSON.stringify(medicalData);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      iv: iv.toString('hex'),
      authTag,
      ciphertext,
      recipient: 'relief-hub',
      algorithm: 'AES-256-GCM'
    };
  }

  // Decryptable strictly at relief-hub
  decryptMedicalPayload(encryptedPayload) {
    if (!encryptedPayload || !encryptedPayload.ciphertext) return null;
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.hubAesKey,
        Buffer.from(encryptedPayload.iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(encryptedPayload.authTag, 'hex'));
      let decrypted = decipher.update(encryptedPayload.ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (err) {
      throw new Error(`AES-256-GCM Decryption failed: ${err.message}`);
    }
  }
}

export const cryptoManager = new CryptoManager();
