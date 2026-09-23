import EventEmitter from 'events';
import { loadOrCreateKeypair } from '../ssh/keys.js';
import { Database } from '../storage/database.js';
import { getLocalIpAddress } from '../network/interfaces.js';
import { PeerDiscovery } from '../network/discovery.js';
import { GhostSSHServer } from '../ssh/server.js';
import { GhostSSHClient } from '../ssh/client.js';

export class GhostEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.alias = options.alias || 'Ghost_' + Math.floor(100 + Math.random() * 900);
    this.port = options.port || 2222;
    this.ip = getLocalIpAddress();

    this.keys = null;
    this.db = null;
    this.server = null;
    this.discovery = null;

    // Active established peer sessions: Map<peerId, PeerSession>
    this.peers = new Map();
  }

  async start() {
    this.log(`Initializing Ghost Chat P2P Engine...`);

    // 1. Load / generate local SSH keys
    this.keys = loadOrCreateKeypair();
    this.log(`Loaded SSH Key. Fingerprint: ${this.keys.fingerprint}`);

    // 2. Initialize local SQLite Database
    this.db = new Database();
    this.log(`Local SQLite database connected at data/ghost_chat.db`);

    // 3. Start embedded SSH Server
    this.server = new GhostSSHServer({
      port: this.port,
      privateKey: this.keys.privateKey,
      alias: this.alias,
      fingerprint: this.keys.fingerprint,
    });

    this.server.on('peer_connected', (connInfo) => this.handleInboundConnection(connInfo));
    this.server.on('warning', (msg) => this.emit('warning', msg));

    try {
      this.port = await this.server.start();
      this.log(`Direct SSH Server listening on ${this.ip}:${this.port}`);
    } catch (err) {
      if (err.code === 'EADDRINUSE') {
        this.log(`Port ${this.port} in use, picking random available port...`);
        this.server.port = 0;
        this.port = await this.server.start();
        this.log(`Direct SSH Server listening on ${this.ip}:${this.port}`);
      } else {
        throw err;
      }
    }

    // 4. Start LAN Peer Discovery Beacon
    this.discovery = new PeerDiscovery({
      alias: this.alias,
      ip: this.ip,
      sshPort: this.port,
      fingerprint: this.keys.fingerprint,
    });

    this.discovery.on('peer_found', (peer) => {
      this.log(`📡 Discovered peer on LAN: ${peer.alias} (${peer.ip}:${peer.port})`);
      this.emit('discovery_updated', this.discovery.getPeers());
    });

    this.discovery.on('peers_updated', (peers) => {
      this.emit('discovery_updated', peers);
    });

    this.discovery.start();
    this.log(`LAN Discovery beacon started on UDP 44555`);
  }

  log(msg) {
    this.emit('log', `[${new Date().toLocaleTimeString()}] ${msg}`);
  }

  /**
   * Handle incoming connection from a peer
   */
  handleInboundConnection(connInfo) {
    const { remoteIp, protocol } = connInfo;
    this.log(`Incoming SSH connection from ${remoteIp}`);

    let peerSession = {
      id: `${remoteIp}`,
      alias: 'Connecting...',
      ip: remoteIp,
      port: 2222,
      fingerprint: null,
      protocol,
      direction: 'inbound',
      isOnline: true,
      connectedAt: Date.now(),
    };

    protocol.on('message', async (msg) => {
      await this.handleProtocolMessage(peerSession, msg);
    });

    protocol.on('close', () => {
      peerSession.isOnline = false;
      this.peers.delete(peerSession.id);
      this.log(`Peer ${peerSession.alias} (${peerSession.id}) disconnected.`);
      this.emit('peer_disconnected', peerSession);
    });
  }

  /**
   * Dial a peer directly using SSH
   */
  async connectToPeer(ip, port = 2222) {
    const peerId = `${ip}:${port}`;
    if (this.peers.has(peerId) && this.peers.get(peerId).isOnline) {
      return this.peers.get(peerId);
    }

    this.log(`Dialing peer directly via SSH -> ${ip}:${port}...`);

    const client = new GhostSSHClient({
      privateKey: this.keys.privateKey,
      alias: this.alias,
      fingerprint: this.keys.fingerprint,
      verifyHostKey: async (host, port, hashedKey) => {
        // TOFU (Trust On First Use) Host key verification
        const hostKey = `${host}:${port}`;
        const existing = await this.db.getKnownHost(hostKey);
        if (existing) {
          if (existing.fingerprint !== hashedKey) {
            this.log(`⚠️ HOST KEY MISMATCH for ${hostKey}! Expected: ${existing.fingerprint}, Got: ${hashedKey}`);
            return false;
          }
          return true;
        } else {
          // New host, record in database
          await this.db.saveKnownHost(hostKey, hashedKey, 1);
          this.log(`[TOFU] Accepted and saved new host key for ${hostKey}: ${hashedKey.slice(0, 16)}...`);
          return true;
        }
      },
    });

    try {
      const connInfo = await client.connect({ host: ip, port });
      this.log(`✅ Direct SSH Tunnel established with ${ip}:${port}!`);

      const peerSession = {
        id: peerId,
        alias: `${ip}:${port}`,
        ip,
        port,
        fingerprint: null,
        protocol: connInfo.protocol,
        client,
        direction: 'outbound',
        isOnline: true,
        connectedAt: Date.now(),
      };

      this.peers.set(peerId, peerSession);

      connInfo.protocol.on('message', async (msg) => {
        await this.handleProtocolMessage(peerSession, msg);
      });

      connInfo.protocol.on('close', () => {
        peerSession.isOnline = false;
        this.peers.delete(peerId);
        this.log(`Connection closed with ${peerSession.alias}`);
        this.emit('peer_disconnected', peerSession);
      });

      this.emit('peer_connected', peerSession);
      return peerSession;
    } catch (err) {
      this.log(`❌ Failed to connect to ${ip}:${port}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Handle incoming protocol messages over the encrypted SSH stream
   */
  async handleProtocolMessage(peerSession, msg) {
    switch (msg.type) {
      case 'handshake': {
        peerSession.alias = msg.alias || peerSession.alias;
        peerSession.fingerprint = msg.fingerprint;
        if (peerSession.direction === 'inbound') {
          peerSession.id = `${peerSession.ip}:${msg.port || peerSession.port || 2222}`;
          this.peers.set(peerSession.id, peerSession);
        }

        // Save peer to local SQLite contacts
        await this.db.saveContact(
          peerSession.alias,
          peerSession.ip,
          peerSession.port,
          peerSession.fingerprint
        );

        this.log(`Handshake complete with ${peerSession.alias} [${peerSession.fingerprint?.slice(0, 14)}...]`);
        this.emit('peer_connected', peerSession);
        break;
      }

      case 'chat': {
        const { id, text, timestamp } = msg;
        // Save to local database
        await this.db.saveMessage(peerSession.id, peerSession.alias, text, timestamp || Date.now());
        this.emit('chat_message', {
          peerId: peerSession.id,
          sender: peerSession.alias,
          text,
          timestamp: timestamp || Date.now(),
          direction: 'in',
        });
        break;
      }

      case 'typing': {
        this.emit('peer_typing', {
          peerId: peerSession.id,
          alias: peerSession.alias,
          isTyping: !!msg.isTyping,
        });
        break;
      }

      case 'ping': {
        peerSession.protocol.send({ type: 'pong' });
        break;
      }

      case 'pong': {
        // Heartbeat ack
        break;
      }

      default:
        break;
    }
  }

  /**
   * Send a chat message to a peer over the direct SSH stream
   */
  async sendMessage(peerId, text) {
    const peer = this.peers.get(peerId);
    if (!peer || !peer.isOnline || !peer.protocol) {
      throw new Error(`Peer ${peerId} is not connected.`);
    }

    const timestamp = Date.now();
    const id = `msg_${timestamp}_${Math.random().toString(36).substr(2, 6)}`;

    // Transmit over SSH channel
    peer.protocol.send({
      type: 'chat',
      id,
      text,
      timestamp,
    });

    // Save to local SQLite database
    await this.db.saveMessage(peerId, 'me', text, timestamp);

    return {
      id,
      peerId,
      sender: 'me',
      text,
      timestamp,
      direction: 'out',
    };
  }

  sendTyping(peerId, isTyping) {
    const peer = this.peers.get(peerId);
    if (peer && peer.protocol) {
      peer.protocol.send({ type: 'typing', isTyping });
    }
  }

  async stop() {
    this.log(`Shutting down P2P Engine...`);
    if (this.discovery) this.discovery.stop();
    for (const peer of this.peers.values()) {
      if (peer.protocol) peer.protocol.close();
      if (peer.client) peer.client.disconnect();
    }
    this.peers.clear();
    if (this.server) await this.server.stop();
    if (this.db) await this.db.close();
  }
}
