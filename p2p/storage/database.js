import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Local-First SQLite Database
 * Stores chat history, known host fingerprints, and contacts locally on disk.
 */

export class Database {
  constructor(dbPath = path.join(process.cwd(), 'data', 'ghost_chat.db')) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new sqlite3.Database(dbPath);
    this.init();
  }

  init() {
    this.db.serialize(() => {
      // Messages table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          peer_id TEXT NOT NULL,
          sender TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          delivered INTEGER DEFAULT 1
        )
      `);

      // Contacts table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS contacts (
          id TEXT PRIMARY KEY,
          alias TEXT NOT NULL,
          ip TEXT NOT NULL,
          port INTEGER NOT NULL,
          fingerprint TEXT,
          last_seen INTEGER NOT NULL
        )
      `);

      // Known Hosts (SSH TOFU verification)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS known_hosts (
          host TEXT PRIMARY KEY,
          fingerprint TEXT NOT NULL,
          trusted INTEGER DEFAULT 1,
          first_seen INTEGER NOT NULL,
          last_seen INTEGER NOT NULL
        )
      `);
    });
  }

  saveMessage(peerId, sender, content, timestamp = Date.now()) {
    return new Promise((resolve, reject) => {
      const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;
      const query = `INSERT INTO messages (id, peer_id, sender, content, timestamp) VALUES (?, ?, ?, ?, ?)`;
      this.db.run(query, [id, peerId, sender, content, timestamp], function (err) {
        if (err) return reject(err);
        resolve({ id, peerId, sender, content, timestamp });
      });
    });
  }

  getMessages(peerId, limit = 100) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM messages 
        WHERE peer_id = ? 
        ORDER BY timestamp ASC 
        LIMIT ?
      `;
      this.db.all(query, [peerId, limit], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  saveContact(alias, ip, port, fingerprint) {
    return new Promise((resolve, reject) => {
      const id = `${ip}:${port}`;
      const now = Date.now();
      const query = `
        INSERT INTO contacts (id, alias, ip, port, fingerprint, last_seen)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          alias = excluded.alias,
          fingerprint = excluded.fingerprint,
          last_seen = excluded.last_seen
      `;
      this.db.run(query, [id, alias, ip, port, fingerprint, now], (err) => {
        if (err) return reject(err);
        resolve({ id, alias, ip, port, fingerprint });
      });
    });
  }

  getContacts() {
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT * FROM contacts ORDER BY last_seen DESC`, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  getKnownHost(host) {
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT * FROM known_hosts WHERE host = ?`, [host], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }

  saveKnownHost(host, fingerprint, trusted = 1) {
    return new Promise((resolve, reject) => {
      const now = Date.now();
      const query = `
        INSERT INTO known_hosts (host, fingerprint, trusted, first_seen, last_seen)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(host) DO UPDATE SET
          fingerprint = excluded.fingerprint,
          last_seen = excluded.last_seen,
          trusted = excluded.trusted
      `;
      this.db.run(query, [host, fingerprint, trusted, now, now], (err) => {
        if (err) return reject(err);
        resolve({ host, fingerprint, trusted });
      });
    });
  }

  close() {
    return new Promise((resolve) => {
      this.db.close(() => resolve());
    });
  }
}
