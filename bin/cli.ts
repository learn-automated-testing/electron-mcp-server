#!/usr/bin/env node

import { runServer } from '../src/server.js';

runServer().catch(err => {
  console.error('Failed to start Electron MCP server:', err);
  process.exit(1);
});
