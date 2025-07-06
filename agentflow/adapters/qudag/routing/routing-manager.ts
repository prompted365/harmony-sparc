/**
 * Routing Manager for QuDAG Adapter
 * Handles onion routing and anonymous communication through the network
 */

import {
  QuDAGConfig,
  SecureMessage,
  OnionRoutingConfig,
  QuDAGError,
  QuDAGErrorCode
} from '../types';
// TODO: Replace with agentflow logger when available
const logger = {
  debug: (...args: any[]) => console.debug('[RoutingManager]', ...args),
  info: (...args: any[]) => console.info('[RoutingManager]', ...args),
  warn: (...args: any[]) => console.warn('[RoutingManager]', ...args),
  error: (...args: any[]) => console.error('[RoutingManager]', ...args)
};

interface OnionLayer {
  nodeId: string;
  encryptedPayload: Uint8Array;
  nextHop: string | null;
}

interface CircuitNode {
  id: string;
  publicKey: string;
  address: string;
  latency: number;
  reliability: number;
}

interface Circuit {
  id: string;
  nodes: CircuitNode[];
  createdAt: number;
  lastUsed: number;
  totalMessages: number;
  failures: number;
}

export class RoutingManager {
  private config: QuDAGConfig;
  private circuits: Map<string, Circuit> = new Map();
  private nodeDirectory: Map<string, CircuitNode> = new Map();
  private maxCircuits: number = 10;
  private circuitTTL: number = 3600000; // 1 hour
  private minReliability: number = 0.8;

  constructor(config: QuDAGConfig) {
    this.config = config;
    this.initializeNodeDirectory();
    this.startCircuitMaintenance();
  }

  /**
   * Send message through onion routing circuit
   */
  async sendThroughOnionRoute(
    message: SecureMessage, 
    hops: number
  ): Promise<void> {
    try {
      // Get or create circuit
      const circuit = await this.getOrCreateCircuit(hops);
      
      // Create onion layers
      const onionPacket = await this.createOnionPacket(message, circuit);
      
      // Send through first hop
      await this.sendToNode(circuit.nodes[0], onionPacket);
      
      // Update circuit stats
      circuit.lastUsed = Date.now();
      circuit.totalMessages++;
      
      logger.debug('Message sent through onion route', {
        messageId: message.id,
        circuitId: circuit.id,
        hops: circuit.nodes.length
      });
    } catch (error) {
      logger.error('Failed to send through onion route', error);
      throw new QuDAGError(
        'Onion routing failed',
        QuDAGErrorCode.CONNECTION_FAILED,
        error
      );
    }
  }

  /**
   * Create new onion routing circuit
   */
  async createCircuit(hops: number): Promise<Circuit> {
    try {
      // Select nodes for circuit
      const nodes = await this.selectCircuitNodes(hops);
      
      if (nodes.length < hops) {
        throw new QuDAGError(
          'Insufficient nodes for circuit',
          QuDAGErrorCode.CONNECTION_FAILED
        );
      }

      // Create circuit
      const circuit: Circuit = {
        id: this.generateCircuitId(),
        nodes,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        totalMessages: 0,
        failures: 0
      };

      // Negotiate circuit with nodes (simulated)
      await this.negotiateCircuit(circuit);

      // Store circuit
      this.circuits.set(circuit.id, circuit);

      logger.info('Created onion routing circuit', {
        circuitId: circuit.id,
        hops: nodes.length,
        nodes: nodes.map(n => n.id)
      });

      return circuit;
    } catch (error) {
      logger.error('Failed to create circuit', error);
      throw error;
    }
  }

  /**
   * Get existing circuit or create new one
   */
  private async getOrCreateCircuit(hops: number): Promise<Circuit> {
    // Find existing valid circuit
    for (const [id, circuit] of this.circuits) {
      if (
        circuit.nodes.length === hops &&
        this.isCircuitValid(circuit) &&
        circuit.failures / (circuit.totalMessages || 1) < 0.1
      ) {
        return circuit;
      }
    }

    // Create new circuit
    return await this.createCircuit(hops);
  }

  /**
   * Create onion packet with layered encryption
   */
  private async createOnionPacket(
    message: SecureMessage,
    circuit: Circuit
  ): Promise<Uint8Array> {
    // In production, this would:
    // 1. Encrypt message for final recipient
    // 2. Add each layer of encryption for circuit nodes (reverse order)
    // 3. Use ML-KEM for each layer
    
    // For now, simulate layered encryption
    let packet = this.serializeMessage(message);
    
    // Apply encryption layers in reverse order
    for (let i = circuit.nodes.length - 1; i >= 0; i--) {
      const node = circuit.nodes[i];
      const nextHop = i < circuit.nodes.length - 1 ? circuit.nodes[i + 1].id : message.recipient;
      
      packet = await this.encryptLayer(packet, node, nextHop);
    }

    return packet;
  }

  /**
   * Encrypt single onion layer
   */
  private async encryptLayer(
    payload: Uint8Array,
    node: CircuitNode,
    nextHop: string
  ): Promise<Uint8Array> {
    // In production, use ML-KEM encryption with node's public key
    // For now, simulate by adding layer header
    
    const header = new TextEncoder().encode(JSON.stringify({
      nodeId: node.id,
      nextHop,
      timestamp: Date.now()
    }));

    const layerSize = header.length + payload.length + 32; // 32 for auth tag
    const layer = new Uint8Array(layerSize);
    
    layer.set(header, 0);
    layer.set(payload, header.length);
    
    // Add simulated auth tag
    const authTag = new Uint8Array(32);
    this.fillRandom(authTag);
    layer.set(authTag, header.length + payload.length);

    return layer;
  }

  /**
   * Send packet to node
   */
  private async sendToNode(node: CircuitNode, packet: Uint8Array): Promise<void> {
    // In production, send to actual node via P2P network
    // For now, simulate network transmission
    
    await this.simulateNetworkDelay(node.latency);
    
    // Simulate reliability
    if (Math.random() > node.reliability) {
      throw new Error('Node transmission failed');
    }

    logger.debug('Packet sent to node', {
      nodeId: node.id,
      packetSize: packet.length
    });
  }

  /**
   * Select nodes for circuit
   */
  private async selectCircuitNodes(hops: number): Promise<CircuitNode[]> {
    const availableNodes = Array.from(this.nodeDirectory.values())
      .filter(node => node.reliability >= this.minReliability);

    if (availableNodes.length < hops) {
      throw new Error('Not enough reliable nodes');
    }

    // Select diverse nodes (different /24 subnets if possible)
    const selected: CircuitNode[] = [];
    const usedSubnets = new Set<string>();

    for (let i = 0; i < hops; i++) {
      const candidates = availableNodes.filter(node => {
        // Skip if already selected
        if (selected.some(s => s.id === node.id)) return false;
        
        // Prefer nodes from different subnets
        const subnet = this.getSubnet(node.address);
        return !usedSubnets.has(subnet);
      });

      // Fall back to any available node if needed
      const pool = candidates.length > 0 ? candidates : 
        availableNodes.filter(n => !selected.some(s => s.id === n.id));

      if (pool.length === 0) break;

      // Select node with best reliability
      const node = pool.reduce((best, current) => 
        current.reliability > best.reliability ? current : best
      );

      selected.push(node);
      usedSubnets.add(this.getSubnet(node.address));
    }

    return selected;
  }

  /**
   * Negotiate circuit with nodes
   */
  private async negotiateCircuit(circuit: Circuit): Promise<void> {
    // In production, perform actual circuit negotiation
    // For now, simulate negotiation delay
    await new Promise(resolve => setTimeout(resolve, 50 * circuit.nodes.length));
  }

  /**
   * Check if circuit is still valid
   */
  private isCircuitValid(circuit: Circuit): boolean {
    // Check age
    if (Date.now() - circuit.createdAt > this.circuitTTL) {
      return false;
    }

    // Check if all nodes are still available
    for (const node of circuit.nodes) {
      const currentNode = this.nodeDirectory.get(node.id);
      if (!currentNode || currentNode.reliability < this.minReliability) {
        return false;
      }
    }

    return true;
  }

  /**
   * Initialize node directory with test nodes
   */
  private initializeNodeDirectory(): void {
    // In production, nodes would be discovered via DHT
    // For now, add simulated nodes
    const testNodes: CircuitNode[] = [
      { id: 'node1', publicKey: 'pk1', address: '192.168.1.10', latency: 10, reliability: 0.99 },
      { id: 'node2', publicKey: 'pk2', address: '192.168.2.20', latency: 15, reliability: 0.95 },
      { id: 'node3', publicKey: 'pk3', address: '10.0.0.30', latency: 20, reliability: 0.98 },
      { id: 'node4', publicKey: 'pk4', address: '10.0.1.40', latency: 25, reliability: 0.92 },
      { id: 'node5', publicKey: 'pk5', address: '172.16.0.50', latency: 30, reliability: 0.96 }
    ];

    for (const node of testNodes) {
      this.nodeDirectory.set(node.id, node);
    }
  }

  /**
   * Start circuit maintenance
   */
  private startCircuitMaintenance(): void {
    setInterval(() => {
      // Clean up old circuits
      for (const [id, circuit] of this.circuits) {
        if (!this.isCircuitValid(circuit)) {
          this.circuits.delete(id);
          logger.debug('Removed expired circuit', { circuitId: id });
        }
      }

      // Maintain circuit pool
      if (this.circuits.size > this.maxCircuits) {
        // Remove least recently used
        const sorted = Array.from(this.circuits.entries())
          .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
        
        while (this.circuits.size > this.maxCircuits && sorted.length > 0) {
          const [id] = sorted.shift()!;
          this.circuits.delete(id);
        }
      }
    }, 60000); // Every minute
  }

  /**
   * Serialize message
   */
  private serializeMessage(message: SecureMessage): Uint8Array {
    const json = JSON.stringify({
      id: message.id,
      sender: message.sender,
      recipient: message.recipient,
      timestamp: message.timestamp,
      nonce: message.nonce
    });
    
    const metadata = new TextEncoder().encode(json);
    const packet = new Uint8Array(metadata.length + message.payload.length + message.signature.length);
    
    packet.set(metadata, 0);
    packet.set(message.payload, metadata.length);
    packet.set(message.signature, metadata.length + message.payload.length);
    
    return packet;
  }

  /**
   * Get subnet from address
   */
  private getSubnet(address: string): string {
    // Extract /24 subnet
    const parts = address.split('.');
    if (parts.length >= 3) {
      return parts.slice(0, 3).join('.');
    }
    return address;
  }

  /**
   * Simulate network delay
   */
  private async simulateNetworkDelay(latency: number): Promise<void> {
    // Add some jitter (±20%)
    const jitter = latency * 0.2 * (Math.random() - 0.5);
    const delay = Math.max(1, latency + jitter);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Generate circuit ID
   */
  private generateCircuitId(): string {
    return `circuit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Fill array with random data
   */
  private fillRandom(array: Uint8Array): void {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      const cryptoNode = require('crypto');
      cryptoNode.randomFillSync(array);
    }
  }

  /**
   * Get routing statistics
   */
  getStatistics(): any {
    const stats = {
      activeCircuits: this.circuits.size,
      totalNodes: this.nodeDirectory.size,
      reliableNodes: Array.from(this.nodeDirectory.values())
        .filter(n => n.reliability >= this.minReliability).length,
      averageHops: 0,
      totalMessages: 0
    };

    if (this.circuits.size > 0) {
      const circuits = Array.from(this.circuits.values());
      stats.averageHops = circuits.reduce((sum, c) => sum + c.nodes.length, 0) / circuits.length;
      stats.totalMessages = circuits.reduce((sum, c) => sum + c.totalMessages, 0);
    }

    return stats;
  }
}