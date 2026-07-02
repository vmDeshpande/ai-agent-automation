// backend/src/tests/workflowApi.test.js
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ----------------------------------------------------
// IN-MEMORY DATABASE MOCKING (Mongoose override)
// ----------------------------------------------------
const mockWorkflowStore = [];
const mockTaskStore = [];
const mockApiKeyStore = [];

const mockWorkflowModel = {
  find: (query) => {
    return {
      sort: () => {
        return mockWorkflowStore.filter((w) => String(w.userId) === String(query.userId));
      },
    };
  },
  findById: async (id) => {
    return mockWorkflowStore.find((w) => String(w._id) === String(id)) || null;
  },
  findOne: async (query) => {
    if (query['apiSettings.endpointName']) {
      return (
        mockWorkflowStore.find(
          (w) => w.apiSettings?.endpointName === query['apiSettings.endpointName']
        ) || null
      );
    }
    return null;
  },
};

const mockTaskModel = {
  create: async (data) => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      ...data,
      stepResults: [],
      retryHistory: [],
      save: async function () {
        const idx = mockTaskStore.findIndex((t) => String(t._id) === String(this._id));
        if (idx !== -1) mockTaskStore[idx] = this;
        return this;
      },
    };
    mockTaskStore.push(doc);
    return doc;
  },
  findById: async (id) => {
    const found = mockTaskStore.find((t) => String(t._id) === String(id));
    if (found) {
      return {
        ...found,
        save: async function () {
          const idx = mockTaskStore.findIndex((t) => String(t._id) === String(this._id));
          if (idx !== -1) mockTaskStore[idx] = this;
          return this;
        },
      };
    }
    return null;
  },
};

const mockApiKeyModel = {
  find: async (query) => {
    return mockApiKeyStore.filter(
      (k) => String(k.userId) === String(query.userId) && k.status === query.status
    );
  },
  findOne: async (query) => {
    return (
      mockApiKeyStore.find(
        (k) => String(k._id) === String(query._id) && String(k.userId) === String(query.userId)
      ) || null
    );
  },
  create: async (data) => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      createdAt: new Date(),
      ...data,
      save: async function () {
        const idx = mockApiKeyStore.findIndex((k) => String(k._id) === String(this._id));
        if (idx !== -1) mockApiKeyStore[idx] = this;
        return this;
      },
    };
    mockApiKeyStore.push(doc);
    return doc;
  },
};

// Inject mocks into require.cache
const workflowModelPath = path.resolve(__dirname, '../models/workflow.model.js');
require.cache[workflowModelPath] = {
  id: workflowModelPath,
  filename: workflowModelPath,
  loaded: true,
  exports: mockWorkflowModel,
};

const taskModelPath = path.resolve(__dirname, '../models/task.model.js');
require.cache[taskModelPath] = {
  id: taskModelPath,
  filename: taskModelPath,
  loaded: true,
  exports: mockTaskModel,
};

const apiKeyModelPath = path.resolve(__dirname, '../models/apiKey.model.js');
require.cache[apiKeyModelPath] = {
  id: apiKeyModelPath,
  filename: apiKeyModelPath,
  loaded: true,
  exports: mockApiKeyModel,
};

// Mock workflowMetadata utilities
const mockWorkflowMetadata = {
  getWorkflowGraph: (workflow) => {
    return {
      steps: workflow.metadata?.steps || [],
      edges: workflow.metadata?.edges || [],
    };
  },
};
const workflowMetadataPath = path.resolve(__dirname, '../utils/workflowMetadata.js');
require.cache[workflowMetadataPath] = {
  id: workflowMetadataPath,
  filename: workflowMetadataPath,
  loaded: true,
  exports: mockWorkflowMetadata,
};

// ----------------------------------------------------
// IMPORT CONTROLLERS UNDER TEST
// ----------------------------------------------------
const apiKeyController = require('../controllers/apiKey.controller');
const workflowApiController = require('../controllers/workflowApi.public.controller');

// ----------------------------------------------------
// RUN TESTS
// ----------------------------------------------------
async function runTests() {
  console.log('🚀 Starting Workflow API Endpoints Integration Test Suite (Mock DB)...');

  const userId = new mongoose.Types.ObjectId();
  let passed = true;

  // Helper mock Response object
  function makeMockResponse() {
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (data) {
        this.body = data;
        return this;
      },
      setHeader: function (name, value) {
        this.headers[name] = value;
        return this;
      },
    };
    return res;
  }

  try {
    // -------------------------------------------------
    // TEST 1: API Key Creation
    // -------------------------------------------------
    console.log('\n🧪 Test 1: Creating a new API Key...');
    const req1 = {
      user: { _id: userId },
      body: { name: 'Production Client' },
    };
    const res1 = makeMockResponse();

    await apiKeyController.createApiKey(req1, res1);

    if (res1.statusCode !== 201 || !res1.body.ok || !res1.body.rawKey) {
      console.error('❌ Test 1 Failed: API Key creation response invalid.', res1.body);
      passed = false;
    } else {
      console.log(
        '✅ Test 1 Passed: API Key successfully created. Plaintext key:',
        res1.body.rawKey
      );
    }

    const rawKey = res1.body.rawKey;
    const apiKeyDoc = mockApiKeyStore[0];

    // -------------------------------------------------
    // TEST 2: API Key Verification (Bcrypt comparison)
    // -------------------------------------------------
    console.log('\n🧪 Test 2: Verifying API Key bcrypt hash matching...');
    const keyMatch = await bcrypt.compare(rawKey, apiKeyDoc.keyHash);
    if (!keyMatch) {
      console.error('❌ Test 2 Failed: Plaintext key does not match keyHash stored in DB.');
      passed = false;
    } else {
      console.log('✅ Test 2 Passed: Plaintext key matches stored keyHash.');
    }

    // -------------------------------------------------
    // TEST 3: API Key Revocation
    // -------------------------------------------------
    console.log('\n🧪 Test 3: Revoking the API Key...');
    const req3 = {
      user: { _id: userId },
      params: { id: apiKeyDoc._id },
    };
    const res3 = makeMockResponse();

    await apiKeyController.revokeApiKey(req3, res3);

    if (res3.statusCode !== 200 || apiKeyDoc.status !== 'revoked') {
      console.error(
        '❌ Test 3 Failed: API Key was not successfully marked as revoked.',
        res3.statusCode,
        apiKeyDoc.status
      );
      passed = false;
    } else {
      console.log('✅ Test 3 Passed: API Key marked as revoked successfully.');
    }

    // Re-activate key for subsequent tests
    apiKeyDoc.status = 'active';

    // -------------------------------------------------
    // TEST 4: Public Workflow Call (Slug resolution & authentication check)
    // -------------------------------------------------
    console.log('\n🧪 Test 4: Accessing workflow endpoint with authentication...');

    // Seed mock workflow
    const workflowId = new mongoose.Types.ObjectId();
    const testWorkflow = {
      _id: workflowId,
      name: 'Summarize Document Service',
      userId,
      apiSettings: {
        enabled: true,
        endpointName: 'summarizer-service',
        authentication: true,
        rateLimit: false,
        responseStepId: 'step-2',
      },
      metadata: {
        steps: [
          { stepId: 'step-1', name: 'Fetch Data', type: 'http' },
          { stepId: 'step-2', name: 'Summarize Text', type: 'llm' },
        ],
        edges: [{ source: 'step-1', target: 'step-2' }],
      },
      tasks: [],
      save: async function () {
        return this;
      },
    };
    mockWorkflowStore.push(testWorkflow);

    // Call without authorization header
    const req4_no_auth = {
      params: { idOrSlug: 'summarizer-service' },
      headers: {},
      query: {},
    };
    const res4_no_auth = makeMockResponse();
    await workflowApiController.receivePublicWorkflowCall(req4_no_auth, res4_no_auth);

    if (res4_no_auth.statusCode !== 401 || res4_no_auth.body.error !== 'missing_bearer_token') {
      console.error(
        '❌ Test 4 Failed: Expected 401 missing_bearer_token.',
        res4_no_auth.statusCode,
        res4_no_auth.body
      );
      passed = false;
    } else {
      console.log('✅ Test 4 Part A Passed: Successfully rejected unauthenticated request.');
    }

    // Call with correct bearer auth key
    const req4_auth = {
      params: { idOrSlug: 'summarizer-service' },
      headers: {
        authorization: `Bearer ${rawKey}`,
        'x-source-workflow-id': 'parent_wf_123',
        'x-source-workflow-name': 'Parent Workflow',
        'x-source-task-id': 'parent_task_456',
      },
      query: { async: 'true' }, // run async so we don't start the poll wait loop in this test step
    };
    const res4_auth = makeMockResponse();
    await workflowApiController.receivePublicWorkflowCall(req4_auth, res4_auth);

    if (res4_auth.statusCode !== 202 || !res4_auth.body.ok || !res4_auth.body.taskId) {
      console.error(
        '❌ Test 4 Failed: Auth request did not launch task successfully.',
        res4_auth.statusCode,
        res4_auth.body
      );
      passed = false;
    } else {
      console.log('✅ Test 4 Part B Passed: Authenticated async request successfully authorized.');
    }

    const createdTask = mockTaskStore[0];

    // -------------------------------------------------
    // TEST 5: Tracing Provenance Check
    // -------------------------------------------------
    console.log('\n🧪 Test 5: Checking parent workflow invocation tracking data...');
    if (
      createdTask.metadata.trigger !== 'workflow_api' ||
      createdTask.metadata.sourceWorkflowId !== 'parent_wf_123' ||
      createdTask.metadata.sourceWorkflowName !== 'Parent Workflow' ||
      createdTask.metadata.sourceTaskId !== 'parent_task_456'
    ) {
      console.error(
        '❌ Test 5 Failed: Tracing headers not mapped correctly onto created task metadata.',
        createdTask.metadata
      );
      passed = false;
    } else {
      console.log('✅ Test 5 Passed: Tracing metadata matches incoming x-source parent headers.');
    }

    // -------------------------------------------------
    // TEST 6: Sync Polling Wait & Response step mapping
    // -------------------------------------------------
    console.log('\n🧪 Test 6: Simulating synchronous execution & output step mapping...');

    // Schedule background mock task worker execution completion
    setTimeout(() => {
      const taskInStore = mockTaskStore[mockTaskStore.length - 1];
      if (taskInStore) {
        taskInStore.status = 'completed';
        taskInStore.stepResults = [
          { stepId: 'step-1', type: 'http', success: true, output: 'Raw data input text' },
          { stepId: 'step-2', type: 'llm', success: true, output: 'This is the summary output.' },
        ];
      }
    }, 400);

    const req6 = {
      params: { idOrSlug: 'summarizer-service' },
      headers: { authorization: `Bearer ${rawKey}` },
      query: {}, // default sync wait mode
    };
    const res6 = makeMockResponse();

    // This will poll mockTaskStore until task status changes to completed
    await workflowApiController.receivePublicWorkflowCall(req6, res6);

    if (res6.statusCode !== 200) {
      console.error('❌ Test 6 Failed: Sync request failed.', res6.statusCode, res6.body);
      passed = false;
    } else if (res6.body.output !== 'This is the summary output.') {
      console.error(
        '❌ Test 6 Failed: Expected response mapping of step-2 to serve as final JSON body. Got:',
        res6.body
      );
      passed = false;
    } else {
      console.log(
        '✅ Test 6 Passed: Sync request blocked, waited for task completed, and returned mapped step output successfully!'
      );
    }
  } catch (err) {
    console.error('❌ Test execution encountered an unhandled error:', err);
    passed = false;
  }

  if (passed) {
    console.log('\n🎉 ALL WORKFLOW API ENDPOINT INTEGRATION TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('\n❌ SOME INTEGRATION TESTS FAILED.');
    process.exit(1);
  }
}

runTests();
