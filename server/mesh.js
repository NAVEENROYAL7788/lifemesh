import { SYNTHETIC_NODES, cryptoManager } from './crypto.js';

export class MeshNetwork {
  constructor() {
    this.nodes = new Map();
    this.edges = [];
    this.processedPacketIds = new Set();
    this.tamperLogs = [];
    this.dataMuleLogs = [];
    this.quarantinedNodes = new Set();

    this.initTopology();
  }

  initTopology() {
    for (const [id, meta] of Object.entries(SYNTHETIC_NODES)) {
      this.nodes.set(id, {
        ...meta,
        status: 'ONLINE', // ONLINE, OFFLINE, QUARANTINED
        store_and_forward_queue: [],
        publicKey: cryptoManager.getPublicKeyPem(id)
      });
    }

    // Default simulated BLE/Wi-Fi Direct peer mesh links
    this.edges = [
      { from: 'ward-1', to: 'ward-2', medium: 'BLE_5.2', rssi_dbm: -68 },
      { from: 'ward-2', to: 'ward-3', medium: 'BLE_5.2', rssi_dbm: -74 },
      { from: 'ward-3', to: 'ward-5', medium: 'WIFI_DIRECT', rssi_dbm: -59 },
      { from: 'ward-1', to: 'ward-6', medium: 'BLE_5.2', rssi_dbm: -79 },
      { from: 'ward-6', to: 'ward-4', medium: 'WIFI_DIRECT', rssi_dbm: -63 },
      { from: 'ward-5', to: 'relief-hub', medium: 'WIFI_DIRECT', rssi_dbm: -52 },
      { from: 'ward-4', to: 'relief-hub', medium: 'WIFI_DIRECT', rssi_dbm: -55 }
    ];
  }

  getAdjacencyList() {
    const adj = new Map();
    for (const id of this.nodes.keys()) {
      adj.set(id, []);
    }
    for (const edge of this.edges) {
      const nodeFrom = this.nodes.get(edge.from);
      const nodeTo = this.nodes.get(edge.to);

      // Only route across ONLINE, unquarantined nodes
      if (nodeFrom && nodeTo && nodeFrom.status === 'ONLINE' && nodeTo.status === 'ONLINE') {
        adj.get(edge.from).push(edge.to);
        adj.get(edge.to).push(edge.from);
      }
    }
    return adj;
  }

  // BFS shortest path discovery
  findShortestPath(sourceId, targetId = 'relief-hub') {
    const sourceNode = this.nodes.get(sourceId);
    if (!sourceNode || sourceNode.status !== 'ONLINE') {
      return null;
    }

    const adj = this.getAdjacencyList();
    const queue = [[sourceId]];
    const visited = new Set([sourceId]);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];

      if (current === targetId) {
        return path;
      }

      for (const neighbor of adj.get(current) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }
    return null; // Partitioned / No route
  }

  // Route signed packet with hop-by-hop Ed25519 inspection and AES-256 payload privacy
  routePacket(packet) {
    const { source_node_id, packet_id } = packet;

    // Compact BLE Discovery Frame (<= 250 bytes) vs Full Wi-Fi Direct Encrypted Attachment
    const bleDiscoveryHeader = {
      pkt: packet_id,
      src: source_node_id,
      ts: packet.timestamp,
      acc: packet.accessibility_mode,
      sig: packet.ed25519_signature ? packet.ed25519_signature.slice(0, 32) : ''
    };
    const ble_header_bytes = Buffer.byteLength(JSON.stringify(bleDiscoveryHeader), 'utf8');
    const rawJson = JSON.stringify(packet);
    const wifi_direct_attachment_bytes = Buffer.byteLength(rawJson, 'utf8');

    packet.ble_header_bytes = ble_header_bytes;
    packet.ble_payload_bytes = ble_header_bytes; // Compact frame
    packet.wifi_direct_attachment_bytes = wifi_direct_attachment_bytes; // Full payload
    packet.ble_ready = ble_header_bytes <= 250;

    const path = this.findShortestPath(source_node_id, 'relief-hub');

    if (!path) {
      // Partitioned! Store and forward buffer
      const sender = this.nodes.get(source_node_id);
      if (sender) {
        sender.store_and_forward_queue.push(packet);
      }
      return {
        success: false,
        partitioned: true,
        packet_id,
        message: `Node ${source_node_id} is currently partitioned from relief-hub. Packet safely buffered in local store-and-forward queue.`,
        queue_length: sender ? sender.store_and_forward_queue.length : 0,
        ble_header_bytes,
        wifi_direct_attachment_bytes,
        ble_payload_bytes: ble_header_bytes,
        ble_ready: true,
        transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
      };
    }

    // Traverse path and simulate hop verification
    const hop_trace = [];
    const relay_inspection_log = [];

    for (let i = 0; i < path.length; i++) {
      const currentNodeId = path[i];
      hop_trace.push(currentNodeId);

      // Node verifies Ed25519 signature of the sender
      const isSigValid = cryptoManager.verifySignature(
        packet.source_node_id,
        packet.canonical_payload,
        packet.ed25519_signature
      );

      const isIntermediate = currentNodeId !== packet.source_node_id && currentNodeId !== 'relief-hub';

      relay_inspection_log.push({
        hop_index: i,
        node_id: currentNodeId,
        node_name: this.nodes.get(currentNodeId)?.name,
        ed25519_verified: isSigValid,
        saw_plaintext_medical_notes: false, // Intermediate nodes NEVER see plaintext
        saw_encrypted_ciphertext: packet.encrypted_medical_payload ? true : false,
        raw_ciphertext_preview: packet.encrypted_medical_payload?.ciphertext ? `${packet.encrypted_medical_payload.ciphertext.slice(0, 32)}... [AES-256-GCM Encrypted]` : null,
        iv: packet.encrypted_medical_payload?.iv || null,
        auth_tag: packet.encrypted_medical_payload?.authTag || null,
        role_at_hop: isIntermediate ? 'RELAY_FORWARDER' : (currentNodeId === 'relief-hub' ? 'DESTINATION_HUB' : 'ORIGIN_SENDER'),
        timestamp: new Date().toISOString()
      });

      if (!isSigValid) {
        this.quarantinedNodes.add(currentNodeId);
        const node = this.nodes.get(currentNodeId);
        if (node) node.status = 'QUARANTINED';

        const tamperEvent = {
          packet_id,
          tampered_at_hop: currentNodeId,
          reason: 'ED25519_SIGNATURE_MISMATCH',
          timestamp: new Date().toISOString()
        };
        this.tamperLogs.push(tamperEvent);

        return {
          success: false,
          rejected: true,
          reason: 'ED25519_SIGNATURE_MISMATCH',
          quarantined_node: currentNodeId,
          hop_trace,
          relay_inspection_log
        };
      }
    }

    packet.hop_trace = path;
    packet.relay_inspection_log = relay_inspection_log;
    packet.hops_traversed = path.length - 1;
    this.processedPacketIds.add(packet_id);

    return {
      success: true,
      delivered_to_hub: true,
      path,
      hop_trace,
      relay_inspection_log,
      ble_header_bytes,
      wifi_direct_attachment_bytes,
      ble_payload_bytes: ble_header_bytes,
      ble_ready: true,
      transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
    };
  }

  toggleNode(nodeId, newStatus) {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);
    node.status = newStatus || (node.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE');
    return node;
  }

  // Rescue boat / Data Mule physical sync with CRDT LWW merge
  runDataMuleSync() {
    const muleLog = {
      sync_id: `mule-${Date.now()}`,
      timestamp: new Date().toISOString(),
      nodes_visited: [],
      packets_collected: 0,
      packets_merged: 0,
      packets_rejected_signature: 0,
      collected_packets: []
    };

    const syncedPackets = [];

    for (const [nodeId, node] of this.nodes.entries()) {
      if (node.store_and_forward_queue.length > 0) {
        muleLog.nodes_visited.push(nodeId);
        const queueCopy = [...node.store_and_forward_queue];
        node.store_and_forward_queue = []; // Flushed into mule

        for (const packet of queueCopy) {
          muleLog.packets_collected++;

          // Verify Ed25519 signature before CRDT merge
          const isValid = cryptoManager.verifySignature(
            packet.source_node_id,
            packet.canonical_payload,
            packet.ed25519_signature
          );

          if (!isValid) {
            muleLog.packets_rejected_signature++;
            continue;
          }

          // CRDT Last-Write-Wins deduplication check
          if (!this.processedPacketIds.has(packet.packet_id)) {
            this.processedPacketIds.add(packet.packet_id);
            packet.relayed_via_data_mule = true;
            packet.delivered_at = new Date().toISOString();
            syncedPackets.push(packet);
            muleLog.packets_merged++;
          }
        }
      }
    }

    muleLog.collected_packets = syncedPackets;
    this.dataMuleLogs.unshift(muleLog);

    return {
      muleLog,
      syncedPackets,
      transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
    };
  }

  getState() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      quarantined_nodes: Array.from(this.quarantinedNodes),
      tamper_logs: this.tamperLogs,
      data_mule_logs: this.dataMuleLogs,
      transport_mode: 'SIMULATED_BLE_WIFI_DIRECT'
    };
  }
}

export const meshNetwork = new MeshNetwork();
