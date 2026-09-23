import dgram from 'dgram';
import EventEmitter from 'events';

const DISCOVERY_PORT = 44555;
const BEACON_INTERVAL = 4000;
const PEER_TIMEOUT = 12000;

export class PeerDiscovery extends EventEmitter {
  constructor({ alias, ip, sshPort, fingerprint }) {
    super();
    this.alias = alias;
    this.ip = ip;
    this.sshPort = sshPort;
    this.fingerprint = fingerprint;

    this.socket = null;
    this.timer = null;
    this.cleanupTimer = null;
    this.discoveredPeers = new Map(); // key: `${ip}:${port}` -> peer
  }

  start() {
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.socket.on('error', (err) => {
      // Don't crash if UDP broadcast port is busy or blocked by local firewall
      this.emit('warning', `Discovery UDP warning: ${err.message}`);
    });

    this.socket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'ghost_beacon') {
          // Ignore own beacon
          if (data.fingerprint === this.fingerprint && data.port === this.sshPort) {
            return;
          }

          const peerKey = `${data.ip}:${data.port}`;
          const peer = {
            alias: data.alias || 'Anonymous',
            ip: data.ip || rinfo.address,
            port: data.port,
            fingerprint: data.fingerprint,
            lastSeen: Date.now(),
          };

          const isNew = !this.discoveredPeers.has(peerKey);
          this.discoveredPeers.set(peerKey, peer);

          if (isNew) {
            this.emit('peer_found', peer);
          }
          this.emit('peers_updated', Array.from(this.discoveredPeers.values()));
        }
      } catch (e) {
        // Ignore malformed packets
      }
    });

    this.socket.bind(DISCOVERY_PORT, '0.0.0.0', () => {
      try {
        this.socket.setBroadcast(true);
      } catch (e) {}

      // Start periodic beacon
      this.broadcastBeacon();
      this.timer = setInterval(() => this.broadcastBeacon(), BEACON_INTERVAL);

      // Periodic pruning of stale peers
      this.cleanupTimer = setInterval(() => this.pruneStalePeers(), 5000);
    });
  }

  broadcastBeacon() {
    if (!this.socket) return;
    const payload = JSON.stringify({
      type: 'ghost_beacon',
      alias: this.alias,
      ip: this.ip,
      port: this.sshPort,
      fingerprint: this.fingerprint,
      timestamp: Date.now(),
    });

    const message = Buffer.from(payload);
    try {
      this.socket.send(message, 0, message.length, DISCOVERY_PORT, '255.255.255.255');
    } catch (e) {}
  }

  pruneStalePeers() {
    const now = Date.now();
    let changed = false;
    for (const [key, peer] of this.discoveredPeers.entries()) {
      if (now - peer.lastSeen > PEER_TIMEOUT) {
        this.discoveredPeers.delete(key);
        this.emit('peer_lost', peer);
        changed = true;
      }
    }
    if (changed) {
      this.emit('peers_updated', Array.from(this.discoveredPeers.values()));
    }
  }

  getPeers() {
    return Array.from(this.discoveredPeers.values());
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {}
    }
  }
}
