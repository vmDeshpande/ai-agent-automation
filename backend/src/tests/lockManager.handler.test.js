const LockManager = require('../services/lockManager.service');
const Lock = require('../models/lock.model');

jest.mock('../models/lock.model');

describe('Lock Manager Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('acquireLock', () => {
    it('should acquire lock successfully when it does not exist', async () => {
      // Mock findOneAndUpdate returning null (no active/expired lock found)
      Lock.findOneAndUpdate.mockResolvedValue(null);
      // Mock create succeeding
      Lock.create.mockResolvedValue({
        lockKey: 'lock:test:123',
        ownerId: 'worker-1',
        expiresAt: new Date(Date.now() + 10000),
      });

      const result = await LockManager.acquireLock('lock:test:123', 10000, 'worker-1');
      expect(result).toBe(true);
      expect(Lock.findOneAndUpdate).toHaveBeenCalled();
      expect(Lock.create).toHaveBeenCalled();
    });

    it('should reclaim lock if lock is expired', async () => {
      // Mock findOneAndUpdate returning updated lock (meaning expired lock was overtaken)
      Lock.findOneAndUpdate.mockResolvedValue({
        lockKey: 'lock:test:123',
        ownerId: 'worker-1',
        expiresAt: new Date(Date.now() + 10000),
      });

      const result = await LockManager.acquireLock('lock:test:123', 10000, 'worker-1');
      expect(result).toBe(true);
      expect(Lock.findOneAndUpdate).toHaveBeenCalled();
      expect(Lock.create).not.toHaveBeenCalled();
    });

    it('should fail to acquire lock if already held by another worker', async () => {
      // Mock findOneAndUpdate returning null (no expired lock available)
      Lock.findOneAndUpdate.mockResolvedValue(null);
      // Mock create throwing Duplicate Key Error (code 11000)
      const duplicateError = new Error('Duplicate key');
      duplicateError.code = 11000;
      Lock.create.mockRejectedValue(duplicateError);

      const result = await LockManager.acquireLock('lock:test:123', 10000, 'worker-1');
      expect(result).toBe(false);
      expect(Lock.findOneAndUpdate).toHaveBeenCalled();
      expect(Lock.create).toHaveBeenCalled();
    });
  });

  describe('releaseLock', () => {
    it('should release lock successfully if owned by releaser', async () => {
      Lock.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await LockManager.releaseLock('lock:test:123', 'worker-1');
      expect(result).toBe(true);
      expect(Lock.deleteOne).toHaveBeenCalledWith({
        lockKey: 'lock:test:123',
        ownerId: 'worker-1',
      });
    });

    it('should return false if lock was not deleted', async () => {
      Lock.deleteOne.mockResolvedValue({ deletedCount: 0 });

      const result = await LockManager.releaseLock('lock:test:123', 'worker-1');
      expect(result).toBe(false);
    });
  });

  describe('acquireSemaphore', () => {
    it('should return false immediately when limit is less than 1', async () => {
      const result = await LockManager.acquireSemaphore('api:slack', 0, 5000, 'worker-1');
      expect(result).toBe(false);
      // No DB calls should be made for an invalid limit
      expect(Lock.findOneAndUpdate).not.toHaveBeenCalled();
      expect(Lock.create).not.toHaveBeenCalled();
    });

    it('should reset an expired semaphore document and acquire a slot regardless of its old count', async () => {
      // Step 1 (expired reset) matches — simulates a zombie doc at semaphoreCount === limit
      Lock.findOneAndUpdate.mockResolvedValueOnce({
        lockKey: 'sem:api:slack',
        semaphoreCount: 1,
        expiresAt: new Date(Date.now() + 5000),
      });

      const result = await LockManager.acquireSemaphore('api:slack', 3, 5000, 'worker-1');
      expect(result).toBe(true);
      // Only one findOneAndUpdate call should be made (the expired-doc reset)
      expect(Lock.findOneAndUpdate).toHaveBeenCalledTimes(1);
      // create should not be called since the expired doc was taken over
      expect(Lock.create).not.toHaveBeenCalled();
    });

    it('should increment count on an active semaphore document when below limit', async () => {
      // Step 1 (expired check) finds nothing
      Lock.findOneAndUpdate.mockResolvedValueOnce(null);
      // Step 2 (active increment) succeeds
      Lock.findOneAndUpdate.mockResolvedValueOnce({
        lockKey: 'sem:api:slack',
        semaphoreCount: 2,
        expiresAt: new Date(Date.now() + 5000),
      });

      const result = await LockManager.acquireSemaphore('api:slack', 3, 5000, 'worker-2');
      expect(result).toBe(true);
      expect(Lock.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(Lock.create).not.toHaveBeenCalled();
    });

    it('should return false when active semaphore is at capacity', async () => {
      // Step 1 (expired check) finds nothing
      Lock.findOneAndUpdate.mockResolvedValueOnce(null);
      // Step 2 (active increment) finds nothing because semaphoreCount === limit
      Lock.findOneAndUpdate.mockResolvedValueOnce(null);
      // Step 3 create throws duplicate-key because the doc exists (still at limit)
      const duplicateError = new Error('Duplicate key');
      duplicateError.code = 11000;
      Lock.create.mockRejectedValue(duplicateError);

      const result = await LockManager.acquireSemaphore('api:slack', 3, 5000, 'worker-3');
      expect(result).toBe(false);
      expect(Lock.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(Lock.create).toHaveBeenCalledTimes(1);
    });

    it('should create a new semaphore document when no document exists', async () => {
      // Step 1: no expired doc
      Lock.findOneAndUpdate.mockResolvedValueOnce(null);
      // Step 2: no active doc (nothing to increment)
      Lock.findOneAndUpdate.mockResolvedValueOnce(null);
      // Step 3: create succeeds (first worker to arrive)
      Lock.create.mockResolvedValue({
        lockKey: 'sem:api:slack',
        semaphoreCount: 1,
        expiresAt: new Date(Date.now() + 5000),
      });

      const result = await LockManager.acquireSemaphore('api:slack', 3, 5000, 'worker-1');
      expect(result).toBe(true);
      expect(Lock.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(Lock.create).toHaveBeenCalledTimes(1);
      // Verify the document is created with the correct semaphore key prefix
      expect(Lock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          lockKey: 'sem:api:slack',
          semaphoreCount: 1,
          ownerId: 'worker-1',
        })
      );
    });

    it('should return false when a concurrent worker wins the create race', async () => {
      // Step 1 & 2: no existing document found
      Lock.findOneAndUpdate.mockResolvedValue(null);
      // Another worker inserted first — unique index violation
      const duplicateError = new Error('Duplicate key');
      duplicateError.code = 11000;
      Lock.create.mockRejectedValue(duplicateError);

      const result = await LockManager.acquireSemaphore('api:slack', 3, 5000, 'worker-2');
      expect(result).toBe(false);
    });
  });

  describe('releaseSemaphore', () => {
    it('should decrement semaphoreCount when count is greater than 1', async () => {
      // findOneAndUpdate matches (count > 1 → decrement)
      Lock.findOneAndUpdate.mockResolvedValue({
        lockKey: 'sem:api:slack',
        semaphoreCount: 2,
      });

      const result = await LockManager.releaseSemaphore('api:slack');
      expect(result).toBe(true);
      expect(Lock.findOneAndUpdate).toHaveBeenCalledWith(
        { lockKey: 'sem:api:slack', semaphoreCount: { $gt: 1 } },
        { $inc: { semaphoreCount: -1 } },
        { new: true }
      );
      // deleteOne should not be called when count was still > 1
      expect(Lock.deleteOne).not.toHaveBeenCalled();
    });

    it('should delete the semaphore document when count would reach zero', async () => {
      // findOneAndUpdate does not match (count is 1, not > 1)
      Lock.findOneAndUpdate.mockResolvedValue(null);
      Lock.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await LockManager.releaseSemaphore('api:slack');
      expect(result).toBe(true);
      expect(Lock.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(Lock.deleteOne).toHaveBeenCalledWith({ lockKey: 'sem:api:slack' });
    });

    it('should return false when the semaphore document does not exist', async () => {
      // No active document to decrement
      Lock.findOneAndUpdate.mockResolvedValue(null);
      // Document also not found to delete
      Lock.deleteOne.mockResolvedValue({ deletedCount: 0 });

      const result = await LockManager.releaseSemaphore('api:slack');
      expect(result).toBe(false);
    });
  });
});

