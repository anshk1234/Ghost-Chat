#!/usr/bin/env node

import { GhostEngine } from '../p2p/core/engine.js';
import { GhostTUI } from '../p2p/tui/app.js';

// Parse simple CLI flags: e.g. node bin/ghost-chat.js --port 2222 --alias Alice
const args = process.argv.slice(2);
let port = 2222;
let alias = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' || args[i] === '-p') {
    port = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--alias' || args[i] === '-u') {
    alias = args[i + 1];
    i++;
  } else if (!isNaN(parseInt(args[i], 10))) {
    port = parseInt(args[i], 10);
  } else if (!alias) {
    alias = args[i];
  }
}

async function main() {
  const engine = new GhostEngine({
    port,
    alias: alias || undefined,
  });

  try {
    await engine.start();
    const tui = new GhostTUI(engine);
    tui.start();
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

main();
