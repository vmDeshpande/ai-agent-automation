const Redis = require('ioredis');

/* --------------- Configuration --------------- */
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DASHBOARD_CACHE_TTL_MS = Number(process.env.DASHBOARD_CACHE_TTL_MS) || 30000;

/* --------------- Singleton client --------------- */
let redisClient = null;
let redisReady = false;

function createRedisClient() {
  try {
    const client = new Redis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // fail fast on connection errors
    });
    return client;
  } catch (err) {
    return null;
  }
}

function getRedisClient() {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
}

/* --------------- Public API --------------- */
async function ensureRedis() {
  if (redisReady) return true;
  const client = getRedisClient();
  if (!client) return false;
  try {
    await client.ping();
    redisReady = true;
    return true;
  } catch (err) {
    return false;
  }
}

async function getCached(key) {
  try {
    const client = getRedisClient();
    if (!client) return null;
    const raw = await client.get(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

async function setCached(key, value, ttlMs) {
  try {
    const client = getRedisClient();
    if (!client) return false;
    await client.set(key, JSON.stringify(value), 'PX', ttlMs || DASHBOARD_CACHE_TTL_MS);
    return true;
  } catch (err) {
    return false;
  }
}

async function invalidatePattern(pattern) {
  try {
    const client = getRedisClient();
    if (!client) return;
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (err) {
    /* best-effort invalidation */
  }
}

module.exports = {
  getRedisClient,
  ensureRedis,
  getCached,
  setCached,
  invalidatePattern,
  DASHBOARD_CACHE_TTL_MS,
};
