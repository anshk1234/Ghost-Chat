import ssh2 from 'ssh2';
import EventEmitter from 'events';
import { ProtocolStream } from './protocol.js';

export class GhostSSHServer extends EventEmitter {
  constructor({ port = 2222, privateKey, alias, fingerprint }) {
    super();
    this.port = port;
    this.privateKey = privateKey;
    this.alias = alias;
    this.fingerprint = fingerprint;
    this.server = null;
    this.activeConnections = new Set();
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = new ssh2.Server({
        hostKeys: [this.privateKey],
      }, (client, info) => {
        const remoteIp = info.ip;
        let peerUsername = 'Anonymous';

        client.on('authentication', (ctx) => {
          peerUsername = ctx.username || 'Peer';
          // Accept any SSH authentication method (publickey or password or none)
          ctx.accept();
        });

        client.on('ready', () => {
          client.on('session', (accept, reject) => {
            const session = accept();

            const handleStream = (stream) => {
              const proto = new ProtocolStream(stream);
              const connectionInfo = {
                client,
                session,
                stream,
                protocol: proto,
                remoteIp,
                username: peerUsername,
                direction: 'inbound',
              };

              this.activeConnections.add(connectionInfo);

              // Immediately perform protocol handshake
              proto.send({
                type: 'handshake',
                alias: this.alias,
                fingerprint: this.fingerprint,
              });

              proto.on('close', () => {
                this.activeConnections.delete(connectionInfo);
                this.emit('peer_disconnected', connectionInfo);
              });

              this.emit('peer_connected', connectionInfo);
            };

            session.on('exec', (accept, reject, execInfo) => {
              const stream = accept();
              handleStream(stream);
            });

            session.on('shell', (accept) => {
              const stream = accept();
              handleStream(stream);
            });
          });
        });

        client.on('error', (err) => {
          this.emit('warning', `Incoming client error from ${remoteIp}: ${err.message}`);
        });
      });

      this.server.on('error', (err) => {
        this.emit('error', err);
        reject(err);
      });

      this.server.listen(this.port, '0.0.0.0', () => {
        const address = this.server.address();
        this.port = address.port;
        this.emit('listening', { port: this.port });
        resolve(this.port);
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      for (const conn of this.activeConnections) {
        try {
          conn.client.end();
        } catch (e) {}
      }
      this.activeConnections.clear();
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
