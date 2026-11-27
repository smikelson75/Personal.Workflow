// Preload module: node --import <this file>. Any network entry point throws and
// appends a line to the file named by SKILL_REVIEW_BLOCK_MARKER.
import { appendFileSync } from 'node:fs';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

function blocked(name) {
  return () => {
    const marker = process.env.SKILL_REVIEW_BLOCK_MARKER;
    if (marker) appendFileSync(marker, `${name}\n`);
    throw new Error(`network blocked: ${name}`);
  };
}

net.Socket.prototype.connect = blocked('net.Socket.prototype.connect');
dns.lookup = blocked('dns.lookup');
dns.promises.lookup = blocked('dns.promises.lookup');
http.request = blocked('http.request');
https.request = blocked('https.request');
globalThis.fetch = blocked('fetch');
