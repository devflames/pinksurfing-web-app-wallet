/**
 * Minimal chat server — contracts route only (smoke test)
 * Requires PS-App-Backend at $PINKSURFING_ROOT/PS-App-Backend (sibling of this repo).
 */
const path = require('path');

const BACKEND_ROOT = process.env.PINKSURFING_ROOT || path.join(__dirname, '../..');
const chatDir = path.join(BACKEND_ROOT, 'PS-App-Backend/chat');
const chatNodeModules = path.join(chatDir, 'node_modules');

require(path.join(chatNodeModules, 'dotenv')).config({ path: path.join(chatDir, '.env') });
process.chdir(chatDir);

const express = require(path.join(chatNodeModules, 'express'));
const mongoose = require(path.join(chatNodeModules, 'mongoose'));

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/PS_TEST';

const PORT = Number(process.env.CHAT_PORT || 6161);

const contractsRoute = require(path.join(chatDir, 'routes/contracts'));

async function connectMongo() {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    console.log('mongo connected (Atlas)');
    return;
  } catch (err) {
    console.warn('Atlas unavailable:', err.message);
    console.warn('Falling back to in-memory MongoDB for smoke test...');
  }

  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri());
  console.log('mongo connected (in-memory)');
}

async function main() {
  await connectMongo();

  const app = express();
  app.use(express.json());
  app.get('/', (_req, res) => res.json({ status: 'ok', service: 'smoke-contract-chat' }));
  app.use('/chats/contracts', contractsRoute);

  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT} (contracts only)`);
  });
}

main().catch((err) => {
  console.error('Failed to start smoke-contract-chat:', err.message);
  process.exit(1);
});
