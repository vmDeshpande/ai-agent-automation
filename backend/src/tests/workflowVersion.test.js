// backend/src/tests/workflowVersion.test.js
const path = require('path');
const mongoose = require('mongoose');

// ----------------------------------------------------
// IN-MEMORY DATABASE MOCKING (Mongoose override)
// ----------------------------------------------------
const mockWorkflowStore = [];
const mockVersionStore = [];

const makeQuery = (executor, isArray = false) => {
  let sortField = null;
  let sortOrder = 1;

  const query = {
    sort: function (sortQuery) {
      if (sortQuery.versionNumber) {
        sortField = 'versionNumber';
        sortOrder = sortQuery.versionNumber;
      }
      return this;
    },
    populate: function () {
      return this; // mock chaining
    },
    then: function (resolve, reject) {
      try {
        const result = executor();
        if (Array.isArray(result)) {
          if (sortField === 'versionNumber') {
            result.sort((a, b) => {
              return sortOrder === -1
                ? b.versionNumber - a.versionNumber
                : a.versionNumber - b.versionNumber;
            });
          }
          if (!isArray) {
            resolve(result[0] || null);
          } else {
            resolve(result);
          }
        } else {
          resolve(result);
        }
      } catch (err) {
        reject(err);
      }
    },
  };
  return query;
};

const mockWorkflowModel = {
  create: async (data) => {
    const doc = {
      _id: data._id || new mongoose.Types.ObjectId(),
      ...data,
      save: async function () {
        const idx = mockWorkflowStore.findIndex((w) => String(w._id) === String(this._id));
        if (idx !== -1) {
          mockWorkflowStore[idx] = this;
        } else {
          mockWorkflowStore.push(this);
        }
        return this;
      },
      markModified: function () {},
    };
    mockWorkflowStore.push(doc);
    return doc;
  },
  findById: async (id) => {
    const found = mockWorkflowStore.find((w) => String(w._id) === String(id));
    if (found) {
      // return a saveable object copy
      return {
        ...found,
        save: async function () {
          const idx = mockWorkflowStore.findIndex((w) => String(w._id) === String(this._id));
          if (idx !== -1) mockWorkflowStore[idx] = this;
          return this;
        },
        markModified: function () {},
      };
    }
    return null;
  },
  deleteMany: async () => {
    mockWorkflowStore.length = 0;
  },
};

const mockVersionModel = {
  create: async (data) => {
    // Unique check to simulate compound unique index
    const exists = mockVersionStore.some(
      (v) =>
        String(v.workflowId) === String(data.workflowId) && v.versionNumber === data.versionNumber
    );
    if (exists) {
      const err = new Error('Duplicate key');
      err.code = 11000;
      throw err;
    }
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      ...data,
      createdAt: new Date().toISOString(),
    };
    mockVersionStore.push(doc);
    return doc;
  },
  findOne: (query) => {
    return makeQuery(() => {
      return mockVersionStore.filter((v) => {
        if (query.workflowId && String(v.workflowId) !== String(query.workflowId)) return false;
        if (query._id && String(v._id) !== String(query._id)) return false;
        return true;
      });
    }, false);
  },
  find: (query) => {
    return makeQuery(() => {
      return mockVersionStore.filter((v) => {
        if (query.workflowId && String(v.workflowId) !== String(query.workflowId)) return false;
        return true;
      });
    }, true);
  },
  deleteMany: async () => {
    mockVersionStore.length = 0;
  },
};

// Inject mocks into Node's require.cache
const workflowModelPath = path.resolve(__dirname, '../models/workflow.model.js');
require.cache[workflowModelPath] = {
  id: workflowModelPath,
  filename: workflowModelPath,
  loaded: true,
  exports: mockWorkflowModel,
};

const versionModelPath = path.resolve(__dirname, '../models/workflowVersion.model.js');
require.cache[versionModelPath] = {
  id: versionModelPath,
  filename: versionModelPath,
  loaded: true,
  exports: mockVersionModel,
};

// ----------------------------------------------------
// RUN TEST SUITE
// ----------------------------------------------------
const workflowVersionService = require('../services/workflowVersion.service');

async function runTests() {
  console.log('🚀 Starting Workflow Versioning Integration Tests (In-Memory Mock Database)...');

  const userId = new mongoose.Types.ObjectId();
  const workflowId = new mongoose.Types.ObjectId();

  await mockWorkflowModel.deleteMany();
  await mockVersionModel.deleteMany();

  let passed = true;

  try {
    console.log('\n🌱 Seeding test workflow...');
    const workflow = await mockWorkflowModel.create({
      _id: workflowId,
      name: 'Version Control Test Workflow',
      description: 'Initial description',
      userId,
      agentId: null,
      metadata: {
        steps: [{ stepId: 'step-1', type: 'llm', prompt: 'Hello world' }],
        edges: [],
      },
    });
    console.log('✅ Test workflow created.');

    // TEST 1: Initial version creation
    console.log('\n🧪 Test 1: Creating initial version v1...');
    const v1 = await workflowVersionService.createVersionIfNeeded(
      workflow,
      userId,
      'Initial version'
    );

    if (!v1 || v1.versionNumber !== 1) {
      console.error(
        `❌ Test 1 Failed: Expected versionNumber 1, got ${v1 ? v1.versionNumber : 'null'}`
      );
      passed = false;
    } else {
      console.log('✅ Test 1 Passed: Initial version v1 successfully created.');
    }

    // TEST 2: No-op duplicate check
    console.log('\n🧪 Test 2: Checking that duplicate saves do not create new versions...');
    const vSame = await workflowVersionService.createVersionIfNeeded(
      workflow,
      userId,
      'Identical save'
    );

    if (!vSame || vSame.versionNumber !== 1) {
      console.error(
        `❌ Test 2 Failed: Duplicate save created a new version: ${vSame ? vSame.versionNumber : 'null'}`
      );
      passed = false;
    } else {
      console.log('✅ Test 2 Passed: No-op duplicate check succeeded.');
    }

    // TEST 3: Version increment on configuration update
    console.log('\n🧪 Test 3: Updating details to trigger version v2...');
    workflow.description = 'Updated description';
    await workflow.save();

    const v2 = await workflowVersionService.createVersionIfNeeded(
      workflow,
      userId,
      'Updated details'
    );
    if (!v2 || v2.versionNumber !== 2) {
      console.error(
        `❌ Test 3 Failed: Expected versionNumber 2, got ${v2 ? v2.versionNumber : 'null'}`
      );
      passed = false;
    } else if (v2.workflowSnapshot.description !== 'Updated description') {
      console.error(
        `❌ Test 3 Failed: Snapshot description not updated in v2: ${v2.workflowSnapshot.description}`
      );
      passed = false;
    } else {
      console.log('✅ Test 3 Passed: Version incremented to v2 on metadata details change.');
    }

    // TEST 4: Version increment on step list update
    console.log('\n🧪 Test 4: Updating steps in builder to trigger version v3...');
    workflow.metadata.steps.push({ stepId: 'step-2', type: 'delay', seconds: 5 });
    workflow.markModified('metadata');
    await workflow.save();

    const v3 = await workflowVersionService.createVersionIfNeeded(
      workflow,
      userId,
      'Added delay step'
    );
    if (!v3 || v3.versionNumber !== 3) {
      console.error(
        `❌ Test 4 Failed: Expected versionNumber 3, got ${v3 ? v3.versionNumber : 'null'}`
      );
      passed = false;
    } else if (v3.workflowSnapshot.metadata.steps.length !== 2) {
      console.error(
        `❌ Test 4 Failed: Snapshot steps count not correct in v3: ${v3.workflowSnapshot.metadata.steps.length}`
      );
      passed = false;
    } else {
      console.log('✅ Test 4 Passed: Version incremented to v3 on step list changes.');
    }

    // TEST 5: Concurrency Safety under concurrent requests
    console.log('\n🧪 Test 5: Testing concurrent save requests for safe versioning...');
    // Simulate concurrent updates by starting multiple version generation promises in parallel
    const concurrencyPromises = [];
    for (let i = 1; i <= 3; i++) {
      concurrencyPromises.push(
        (async (index) => {
          const tempWorkflow = await mockWorkflowModel.findById(workflowId);
          tempWorkflow.description = `Concurrent change ${index}`;
          await tempWorkflow.save();

          return workflowVersionService.createVersionIfNeeded(
            tempWorkflow,
            userId,
            `Concurrent update ${index}`
          );
        })(i)
      );
    }

    const concurrentResults = await Promise.all(concurrencyPromises);
    const versionNumbers = concurrentResults.map((v) => v.versionNumber).sort();

    console.log('Concurrent version numbers created:', versionNumbers);

    const expectedVersions = [4, 5, 6];
    const match = versionNumbers.every((val, index) => val === expectedVersions[index]);
    if (!match) {
      console.error(
        `❌ Test 5 Failed: Expected sequential version numbers [4, 5, 6], got:`,
        versionNumbers
      );
      passed = false;
    } else {
      console.log(
        '✅ Test 5 Passed: Concurrent requests successfully ordered sequentially via retry loop.'
      );
    }

    // TEST 6: Rollback functionality
    console.log('\n🧪 Test 6: Performing rollback to version v2...');
    const preRollbackDbState = await mockWorkflowModel.findById(workflowId);

    // Find target version v2
    const targetVersion = mockVersionStore.find((v) => v.versionNumber === 2);

    const rolledWorkflow = await workflowVersionService.rollback(
      preRollbackDbState,
      targetVersion._id,
      userId
    );

    if (rolledWorkflow.description !== 'Updated description') {
      console.error(
        `❌ Test 6 Failed: Reverted description mismatch: expected 'Updated description', got '${rolledWorkflow.description}'`
      );
      passed = false;
    } else if (rolledWorkflow.metadata.steps.length !== 1) {
      console.error(
        `❌ Test 6 Failed: Reverted steps mismatch: expected 1 step, got ${rolledWorkflow.metadata.steps.length}`
      );
      passed = false;
    } else {
      console.log('✅ Test 6 Passed: Workflow reverted successfully to v2 snapshot.');
    }

    // Verify pre-rollback version (v7) was created
    const postRollbackLatest = [...mockVersionStore].sort(
      (a, b) => b.versionNumber - a.versionNumber
    )[0];
    if (postRollbackLatest.versionNumber !== 7) {
      console.error(
        `❌ Test 6 verification Failed: Expected post-rollback latest version 7, got ${postRollbackLatest.versionNumber}`
      );
      passed = false;
    } else if (!postRollbackLatest.note.includes('Pre-rollback to v2')) {
      console.error(
        `❌ Test 6 verification Failed: Expected pre-rollback version note, got '${postRollbackLatest.note}'`
      );
      passed = false;
    } else {
      console.log(
        '✅ Test 6 Verification Passed: Reversibility verified. Pre-rollback state captured as v7.'
      );
    }
  } catch (err) {
    console.error('❌ Test execution encountered an unhandled error:', err);
    passed = false;
  }

  if (passed) {
    console.log('\n🎉 ALL WORKFLOW VERSIONING TESTS PASSED SUCCESFULLY!');
    process.exit(0);
  } else {
    console.error('\n❌ SOME TESTS FAILED.');
    process.exit(1);
  }
}

runTests();
