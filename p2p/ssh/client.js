import ssh2 from 'ssh2';
import EventEmitter from 'events';
import { ProtocolStream } from './protocol.js';

export class GhostSSHClient extends EventEmitter {
  constructor({ privateKey, alias, fingerprint, verifyHostKey }) {
    super();
    this.privateKey = privateKey;
    this.alias = alias;
    this.fingerprint = fingerprint;
    this.verifyHostKey = verifyHostKey || (() => true);
    this.conn = null;
    this.protocol = null;
    this.pingTimer = null;
  }

  connect({ host, port = 2222, username = 'ghost' }) {
    return new Promise((resolve, reject) => {
      this.conn = new ssh2.Client();

      this.conn.on('ready', () => {
        this.conn.exec('ghost-chat', (err, stream) => {
          if (err) {
            this.conn.end();
            return reject(err);
          }

          this.protocol = new ProtocolStream(stream);

          const connectionInfo = {
            conn: this.conn,
            stream,
            protocol: this.protocol,
            remoteHost: host,
            remotePort: port,
            direction: 'outbound',
          };

          // Send client handshake
          this.protocol.send({
            type: 'handshake',
            alias: this.alias,
            fingerprint: this.fingerprint,
          });

          // NAT keep-alive: send ping every 15 seconds
          this.pingTimer = setInterval(() => {
            if (this.protocol) {
              this.protocol.send({ type: 'ping' });
            }
          }, 15000);

          this.protocol.on('close', () => {
            if (this.pingTimer) clearInterval(this.pingTimer);
            this.emit('disconnected', connectionInfo);
          });

          this.emit('connected', connectionInfo);
          resolve(connectionInfo);
        });
      });

      this.conn.on('error', (err) => {
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.emit('error', err);
        reject(err);
      });

      this.conn.connect({
        host,
        port,
        username,
        privateKey: this.privateKey,
        readyTimeout: 10000,
        hostHash: 'sha256',
        hostVerifier: (hashedKey) => {
          return this.verifyHostKey(host, port, hashedKey);
        },
      });
    });
  }

  disconnect() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.protocol) this.protocol.close();
    if (this.conn) {
      try {
        this.conn.end();
      } catch (e) {}
    }
  }
}
