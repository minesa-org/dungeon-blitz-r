require('../scripts/cleanup-dev-instance');

process.env.MULTIPLAYER_MODE = 'true';
process.env.ENABLE_POLICY_SERVER = 'true';
process.env.DEBUG_ENABLED = process.env.DEBUG_ENABLED || 'true';
process.env.DEBUG_PROGRESS = process.env.DEBUG_PROGRESS || 'true';
process.env.DEBUG_PACKETS = process.env.DEBUG_PACKETS || 'true';
process.env.DEBUG_UNHANDLED_PACKETS = process.env.DEBUG_UNHANDLED_PACKETS || 'true';
process.env.DEBUG_PAYLOAD_PREVIEW_BYTES = process.env.DEBUG_PAYLOAD_PREVIEW_BYTES || '512';

require('../dist/main.js');
