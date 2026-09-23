import blessed from 'blessed';

export class GhostTUI {
  constructor(engine) {
    this.engine = engine;
    this.activePeerId = null;
    this.discoveredPeers = [];
    this.activePeersList = [];

    this.initScreen();
    this.initWidgets();
    this.bindEngineEvents();
    this.bindKeybindings();
  }

  initScreen() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: '👻 Ghost Chat — Direct P2P SSH Messenger',
      cursor: {
        artificial: true,
        shape: 'line',
        blink: true,
        color: 'green',
      },
    });

    this.screen.key(['C-c', 'q'], () => {
      this.engine.stop().then(() => {
        process.exit(0);
      });
    });
  }

  initWidgets() {
    // 1. Header Box
    this.headerBox = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        fg: 'white',
        bg: 'black',
      },
      content: ` {bold}{cyan-fg}👻 GHOST CHAT{/cyan-fg}{/bold} | Direct P2P SSH Messenger (Zero Middleman) | {green-fg}Starting...{/green-fg}`,
    });

    // 2. Sidebar (Peers & Discovered on LAN)
    this.sidebar = blessed.list({
      parent: this.screen,
      top: 3,
      left: 0,
      width: '30%',
      bottom: 3,
      tags: true,
      border: { type: 'line' },
      label: ' {bold}Peers & LAN (Tab){/bold} ',
      style: {
        border: { fg: 'cyan' },
        selected: { bg: 'cyan', fg: 'black', bold: true },
        item: { fg: 'white' },
      },
      keys: true,
      vi: true,
      mouse: true,
      items: ['(Scanning LAN...)'],
    });

    // 3. Main Chat View
    this.chatBox = blessed.box({
      parent: this.screen,
      top: 3,
      left: '30%',
      width: '70%',
      bottom: 3,
      tags: true,
      border: { type: 'line' },
      label: ' {bold}Conversation{/bold} ',
      style: {
        border: { fg: 'cyan' },
      },
    });

    this.messageLog = blessed.log({
      parent: this.chatBox,
      top: 0,
      left: 0,
      width: '100%-2',
      height: '100%-2',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      scrollbar: {
        ch: ' ',
        track: { bg: 'black' },
        style: { inverse: true },
      },
    });

    // 4. Input Box
    this.inputBox = blessed.textbox({
      parent: this.screen,
      bottom: 1,
      left: 0,
      width: '100%',
      height: 3,
      tags: true,
      border: { type: 'line' },
      label: ' {bold}Message / Command{/bold} ',
      style: {
        border: { fg: 'green' },
        fg: 'white',
      },
      inputOnFocus: true,
    });

    // 5. Footer Bar
    this.footer = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      tags: true,
      style: { bg: 'cyan', fg: 'black' },
      content: ' [Enter] Send | /connect <ip:port> | /help | [Tab] Switch Focus | [Ctrl+C] Exit',
    });
  }

  updateHeader() {
    const keyShort = this.engine.keys?.fingerprint?.slice(0, 18) || '...';
    this.headerBox.setContent(
      ` {bold}{cyan-fg}👻 GHOST CHAT{/cyan-fg}{/bold} | Direct P2P SSH | Alias: {yellow-fg}${this.engine.alias}{/yellow-fg} | Listen: {green-fg}${this.engine.ip}:${this.engine.port}{/green-fg} | Key: {magenta-fg}${keyShort}...{/magenta-fg}`
    );
    this.screen.render();
  }

  updateSidebar() {
    const items = [];

    // Active Connected Peers
    for (const peer of this.engine.peers.values()) {
      if (peer.isOnline) {
        items.push(`🟢 {bold}${peer.alias}{/bold} (${peer.id})`);
      }
    }

    // Discovered Peers on LAN
    if (this.discoveredPeers.length > 0) {
      items.push('--- Discovered on LAN ---');
      for (const p of this.discoveredPeers) {
        const id = `${p.ip}:${p.port}`;
        if (!this.engine.peers.has(id)) {
          items.push(`📡 {yellow-fg}${p.alias}{/yellow-fg} (${id})`);
        }
      }
    }

    if (items.length === 0) {
      items.push('{gray-fg}(No peers yet. Use /connect <ip>){/gray-fg}');
    }

    this.sidebar.setItems(items);
    this.screen.render();
  }

  bindEngineEvents() {
    this.engine.on('log', (msg) => {
      this.messageLog.log(`{gray-fg}${msg}{/gray-fg}`);
      this.screen.render();
    });

    this.engine.on('discovery_updated', (peers) => {
      this.discoveredPeers = peers;
      this.updateSidebar();
    });

    this.engine.on('peer_connected', (peer) => {
      this.messageLog.log(
        `{green-fg}✔ Direct SSH Tunnel established with {bold}${peer.alias}{/bold} (${peer.id}){/green-fg}`
      );
      if (!this.activePeerId) {
        this.setActivePeer(peer.id);
      }
      this.updateSidebar();
    });

    this.engine.on('peer_disconnected', (peer) => {
      this.messageLog.log(`{red-fg}✖ Disconnected from ${peer.alias} (${peer.id}){/red-fg}`);
      this.updateSidebar();
    });

    this.engine.on('chat_message', (msg) => {
      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.messageLog.log(`{gray-fg}[${time}]{/gray-fg} {cyan-fg}<${msg.sender}>{/cyan-fg} ${msg.text}`);
      this.screen.render();
    });

    this.engine.on('peer_typing', ({ alias, isTyping }) => {
      if (isTyping) {
        this.footer.setContent(` {yellow-fg}${alias} is typing...{/yellow-fg}`);
      } else {
        this.footer.setContent(' [Enter] Send | /connect <ip:port> | /help | [Tab] Switch Focus | [Ctrl+C] Exit');
      }
      this.screen.render();
    });
  }

  setActivePeer(peerId) {
    this.activePeerId = peerId;
    const peer = this.engine.peers.get(peerId);
    const label = peer ? `${peer.alias} (${peer.id})` : peerId;
    this.chatBox.setLabel(` {bold}Chatting with: {green-fg}${label}{/green-fg} [SSH Encrypted]{/bold} `);

    // Load recent history from SQLite
    this.engine.db.getMessages(peerId, 50).then((msgs) => {
      this.messageLog.log(`--- Loaded ${msgs.length} messages from local SQLite database ---`);
      for (const m of msgs) {
        const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const senderTag = m.sender === 'me' ? '{green-fg}<You>{/green-fg}' : `{cyan-fg}<${m.sender}>{/cyan-fg}`;
        this.messageLog.log(`{gray-fg}[${time}]{/gray-fg} ${senderTag} ${m.content}`);
      }
      this.screen.render();
    });
  }

  bindKeybindings() {
    // Focus switching
    this.screen.key(['tab'], () => {
      if (this.sidebar.focused) {
        this.inputBox.focus();
      } else {
        this.sidebar.focus();
      }
    });

    // Selecting a peer in sidebar
    this.sidebar.on('select', (item, index) => {
      const text = item.getText();
      const match = text.match(/\((.*?)\)/);
      if (match && match[1]) {
        const target = match[1];
        if (this.engine.peers.has(target)) {
          this.setActivePeer(target);
          this.inputBox.focus();
        } else {
          // It's a discovered peer, connect!
          const [ip, port] = target.split(':');
          this.messageLog.log(`Connecting to selected peer: ${ip}:${port || 2222}...`);
          this.engine.connectToPeer(ip, parseInt(port || 2222, 10)).catch((err) => {
            this.messageLog.log(`{red-fg}Connection failed: ${err.message}{/red-fg}`);
          });
          this.inputBox.focus();
        }
      }
    });

    // Input submission
    const promptInput = () => {
      this.inputBox.setValue('');
      this.inputBox.readInput(async (err, value) => {
        if (value !== null && value.trim()) {
          await this.handleCommandOrMessage(value.trim());
        }
        promptInput();
      });
    };

    promptInput();
  }

  async handleCommandOrMessage(input) {
    if (input.startsWith('/')) {
      const [cmd, ...args] = input.slice(1).split(' ');
      switch (cmd.toLowerCase()) {
        case 'connect':
        case 'c': {
          const target = args[0];
          if (!target) {
            this.messageLog.log('{yellow-fg}Usage: /connect <ip> or /connect <ip:port>{/yellow-fg}');
            return;
          }
          const [ip, portStr] = target.split(':');
          const port = portStr ? parseInt(portStr, 10) : 2222;
          try {
            this.messageLog.log(`Connecting to ${ip}:${port}...`);
            const peer = await this.engine.connectToPeer(ip, port);
            this.setActivePeer(peer.id);
          } catch (err) {
            this.messageLog.log(`{red-fg}Failed to connect: ${err.message}{/red-fg}`);
          }
          break;
        }

        case 'peers': {
          this.messageLog.log('{bold}Active Connections:{/bold}');
          for (const p of this.engine.peers.values()) {
            this.messageLog.log(` - ${p.alias} (${p.id}) [${p.direction}]`);
          }
          this.messageLog.log('{bold}Discovered on LAN:{/bold}');
          for (const p of this.discoveredPeers) {
            this.messageLog.log(` - ${p.alias} (${p.ip}:${p.port})`);
          }
          break;
        }

        case 'clear': {
          this.messageLog.setContent('');
          this.screen.render();
          break;
        }

        case 'help': {
          this.messageLog.log('{bold}{cyan-fg}=== Ghost Chat Commands ==={/cyan-fg}{/bold}');
          this.messageLog.log('  {bold}/connect <ip[:port]>{/bold} - Establish direct SSH tunnel to recipient');
          this.messageLog.log('  {bold}/peers{/bold}             - List active & discovered peers');
          this.messageLog.log('  {bold}/clear{/bold}             - Clear chat screen');
          this.messageLog.log('  {bold}/quit{/bold}              - Exit Ghost Chat');
          this.messageLog.log('  {bold}[Tab]{/bold}              - Switch focus between sidebar and input');
          this.messageLog.log('===========================');
          break;
        }

        case 'quit':
        case 'exit': {
          await this.engine.stop();
          process.exit(0);
        }

        default:
          this.messageLog.log(`{red-fg}Unknown command: /${cmd}. Type /help for assistance.{/red-fg}`);
      }
      this.screen.render();
      return;
    }

    // Regular Chat Message
    if (!this.activePeerId) {
      this.messageLog.log(
        '{yellow-fg}[!] No active peer selected. Connect to someone using /connect <ip> or pick from the sidebar.{/yellow-fg}'
      );
      this.screen.render();
      return;
    }

    try {
      const msg = await this.engine.sendMessage(this.activePeerId, input);
      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.messageLog.log(`{gray-fg}[${time}]{/gray-fg} {green-fg}<You>{/green-fg} ${input}`);
      this.screen.render();
    } catch (err) {
      this.messageLog.log(`{red-fg}Failed to send message: ${err.message}{/red-fg}`);
      this.screen.render();
    }
  }

  start() {
    this.updateHeader();
    this.updateSidebar();
    this.inputBox.focus();
    this.screen.render();
  }
}
