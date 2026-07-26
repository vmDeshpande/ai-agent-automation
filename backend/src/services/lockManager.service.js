const Lock = require('../models/lock.model');

/**
 * Distributed Lock Manager using MongoDB atomic findOneAndUpdate primitives.
 * Provides exclusive locking (acquireLock / releaseLock) and counting semaphores
 * (acquireSemaphore / releaseSemaphore) for coordinating multi-worker execution
 * without requiring Redis or other external dependencies.
 */
class LockManager {
  /**
   * Tries to acquire an exclusive lock. Returns false immediately if the lock
   * is already held by another worker and has not expired. If the lock is
   * expired or does not exist, it is atomically claimed.
   *
   * @param {string} lockKey - Unique identifier for the lock resource
   * @param {number} ttlMs   - Time-to-live in milliseconds before the lock auto-expires
   * @param {string} ownerId - Caller's unique identifier (e.g. `workerId:taskId`)
   * @returns {Promise<boolean>} true if the lock was acquired, false otherwise
   */
  static async acquireLock(lockKey, ttlMs, ownerId) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    try {
      // Attempt to take over an existing but expired lock document atomically.
      const lock = await Lock.findOneAndUpdate(
        {
          lockKey,
          $or: [
            { expiresAt: { $lt: now } }, // lock has expired
          ],
        },
        {
          $set: {
            ownerId,
            expiresAt,
            acquiredAt: now,
            semaphoreCount: 0,
          },
        },
        { new: true, upsert: false }
      );

      if (lock) {
        return true;
      }

      // No expired lock found — try to insert a fresh document.
      // If a concurrent worker already inserted one, the unique index on lockKey
      // will throw a duplicate-key error (code 11000), which we treat as "lock busy".
      await Lock.create({
        lockKey,
        ownerId,
        expiresAt,
        acquiredAt: now,
        semaphoreCount: 0,
      });

      return true;
    } catch (err) {
      if (err.code === 11000) {
        // Another worker holds the lock — expected, not an error.
        return false;
      }
      console.error('[LockManager] acquireLock error:', err.message);
      return false;
    }
  }

  /**
   * Releases an exclusive lock, but only if the caller is the registered owner.
   * Prevents one worker from accidentally releasing another worker's lock.
   *
   * @param {string} lockKey - Unique identifier for the lock resource
   * @param {string} ownerId - Must match the ownerId set when the lock was acquired
   * @returns {Promise<boolean>} true if the lock was deleted, false otherwise
   */
  static async releaseLock(lockKey, ownerId) {
    try {
      const result = await Lock.deleteOne({ lockKey, ownerId });
      return result.deletedCount > 0;
    } catch (err) {
      console.error('[LockManager] releaseLock error:', err.message);
      return false;
    }
  }

  /**
   * Acquires a counting semaphore slot for the given resource key.
   * A semaphore allows at most `limit` concurrent holders. When the count
   * would exceed `limit`, acquisition fails without blocking.
   *
   * Semaphore state is stored in a single Lock document per resourceKey.
   * Acquisition is handled in three distinct atomic steps to avoid the false-
   * negative that occurs when an expired document still has semaphoreCount at
   * the limit (TTL monitor hasn't cleaned it up yet):
   *
   *   1. If an EXPIRED document exists, reset it unconditionally (semaphoreCount
   *      becomes 1) — the old count is irrelevant once the TTL has passed.
   *   2. If an ACTIVE document exists with semaphoreCount < limit, increment it.
   *   3. If no document exists at all, create one with semaphoreCount = 1.
   *
   * @param {string} resourceKey - Unique identifier for the shared resource
   * @param {number} limit       - Maximum number of concurrent holders allowed
   * @param {number} ttlMs       - TTL in milliseconds for the semaphore document
   * @param {string} ownerId     - Caller's unique identifier (informational)
   * @returns {Promise<boolean>} true if a semaphore slot was acquired, false if at capacity
   */
  static async acquireSemaphore(resourceKey, limit, ttlMs, ownerId) {
    if (limit < 1) {
      return false;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    const semKey = `sem:${resourceKey}`;

    try {
      // Step 1: Reset any expired semaphore document unconditionally.
      // An expired document's semaphoreCount is no longer meaningful — treating
      // it as "at limit" would be a false negative, so we reset it to 1 and
      // take over the slot rather than waiting for the TTL monitor to delete it.
      const expiredReset = await Lock.findOneAndUpdate(
        {
          lockKey: semKey,
          expiresAt: { $lt: now }, // document is expired
        },
        {
          $set: {
            ownerId,
            expiresAt,
            acquiredAt: now,
            semaphoreCount: 1,
          },
        },
        { new: true }
      );

      if (expiredReset) {
        return true;
      }

      // Step 2: Increment count on an active (non-expired) document only if
      // there is still a slot available (semaphoreCount < limit).
      const incremented = await Lock.findOneAndUpdate(
        {
          lockKey: semKey,
          expiresAt: { $gte: now }, // document is still valid
          semaphoreCount: { $lt: limit },
        },
        {
          $inc: { semaphoreCount: 1 },
          $set: { ownerId, expiresAt, acquiredAt: now },
        },
        { new: true }
      );

      if (incremented) {
        return true;
      }

      // Step 3: No document exists at all — create one.
      // If a concurrent worker beats us here, the unique index on lockKey will
      // throw a duplicate-key error (11000), which means the semaphore is now
      // held by that worker. We treat that as "at limit" and return false.
      await Lock.create({
        lockKey: semKey,
        ownerId,
        expiresAt,
        acquiredAt: now,
        semaphoreCount: 1,
      });

      return true;
    } catch (err) {
      if (err.code === 11000) {
        // Concurrent insert — semaphore is at limit or just became active.
        return false;
      }
      console.error('[LockManager] acquireSemaphore error:', err.message);
      return false;
    }
  }

  /**
   * Releases one slot of a counting semaphore. Decrements the count; once the
   * count reaches zero, the document is removed to allow a clean next cycle.
   *
   * @param {string} resourceKey - Unique identifier for the shared resource
   * @returns {Promise<boolean>} true if the semaphore was decremented/released
   */
  static async releaseSemaphore(resourceKey) {
    const semKey = `sem:${resourceKey}`;

    try {
      // Decrement count. If count would drop to zero, delete the document.
      const doc = await Lock.findOneAndUpdate(
        { lockKey: semKey, semaphoreCount: { $gt: 1 } },
        { $inc: { semaphoreCount: -1 } },
        { new: true }
      );

      if (doc) {
        return true;
      }

      // Count was 1 (or document doesn't exist) — remove entirely.
      const result = await Lock.deleteOne({ lockKey: semKey });
      return result.deletedCount > 0;
    } catch (err) {
      console.error('[LockManager] releaseSemaphore error:', err.message);
      return false;
    }
  }
}

module.exports = LockManager;
