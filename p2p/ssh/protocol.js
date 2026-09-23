import EventEmitter from 'events';

/**
 * Frames and un-frames newline-delimited JSON messages over any duplex stream (SSH session).
 */
export class ProtocolStream extends EventEmitter {
  constructor(stream) {
    super();
    this.stream = stream;
    this.buffer = '';

    this.stream.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop(); // Keep incomplete tail

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const message = JSON.parse(trimmed);
          this.emit('message', message);
        } catch (err) {
          this.emit('error', new Error(`Protocol parse error: ${err.message}`));
        }
      }
    });

    this.stream.on('close', () => this.emit('close'));
    this.stream.on('end', () => this.emit('end'));
    this.stream.on('error', (err) => this.emit('error', err));
  }

  send(data) {
    if (this.stream && this.stream.writable) {
      this.stream.write(JSON.stringify(data) + '\n');
    }
  }

  close() {
    if (this.stream) {
      try {
        this.stream.end();
      } catch (e) {}
    }
  }
}
