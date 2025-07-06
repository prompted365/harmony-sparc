#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.production' });

// Start the server by requiring the server module
// The server.js has logic to start when it's the main module
require('./dist/server');