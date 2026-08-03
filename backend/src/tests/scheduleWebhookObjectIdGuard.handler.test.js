/**
 * Issue #283 follow-up — ObjectId-validation guards added to the
 * schedule and webhook list endpoints so CodeQL stops flagging
 * "Database query built from user-controlled sources" on the
 * `req.query.workflowId` parameter.
 *
 * These tests load the controller source via `fs` + `vm` (the same
 * trick used elsewhere in this repo) and exercise `listSchedules` +
 * `listWebhooks` end-to-end with a stubbed Mongoose model so we don't
 * need a live MongoDB connection.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadController(file) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', file), 'utf8');
  const sandbox = {
    module: { exports: {} },
    exports: {},
    require,
    console,
    process,
    Buffer,
  };
  sandbox.module.exports = sandbox.exports;
  // Stub the mongoose models so `require('../models/...')` doesn't blow up
  // during the controller load.
  sandbox.require = function (id) {
    if (
      id.endsWith('/models/schedule.model') ||
      id.endsWith('/models/webhook.model') ||
      id.endsWith('/models/workflow.model')
    ) {
      return {
        find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue([]) }),
        findById: jest.fn(),
      };
    }
    return require(id);
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.module.exports;
}

describe('schedule.controller.listSchedules — workflowId guard', () => {
  let schedule;
  beforeAll(() => {
    schedule = loadController('schedule.controller.js');
  });

  const baseReq = () => ({
    user: { _id: '507f1f77bcf86cd799439011' },
    query: {},
  });

  function res() {
    const r = {
      _status: null,
      _body: null,
      status(c) {
        this._status = c;
        return this;
      },
      json(b) {
        this._body = b;
        return this;
      },
    };
    return r;
  }

  test('accepts a valid 24-char hex ObjectId and forwards it to the filter', async () => {
    const r = res();
    await schedule.listSchedules(
      { ...baseReq(), query: { workflowId: '507f1f77bcf86cd799439011' } },
      r
    );
    expect(r._status).toBeNull();
  });

  test('rejects an obviously-bad workflowId with 400 invalid_workflow_id', async () => {
    const r = res();
    await schedule.listSchedules({ ...baseReq(), query: { workflowId: 'not-an-objectid' } }, r);
    expect(r._status).toBe(400);
    expect(r._body).toEqual({ ok: false, error: 'invalid_workflow_id' });
  });

  test('rejects an HTML-injection attempt', async () => {
    const r = res();
    await schedule.listSchedules(
      { ...baseReq(), query: { workflowId: '<script>alert(1)</script>' } },
      r
    );
    expect(r._status).toBe(400);
    expect(r._body.error).toBe('invalid_workflow_id');
  });

  test('skips the workflowId filter entirely when query is empty', async () => {
    const r = res();
    await schedule.listSchedules(baseReq(), r);
    expect(r._status).toBeNull();
  });
});

describe('webhook.controller.listWebhooks — workflowId guard', () => {
  let webhook;
  beforeAll(() => {
    webhook = loadController('webhook.controller.js');
  });

  const baseReq = () => ({
    user: { _id: '507f1f77bcf86cd799439011' },
    query: {},
  });

  function res() {
    const r = {
      _status: null,
      _body: null,
      status(c) {
        this._status = c;
        return this;
      },
      json(b) {
        this._body = b;
        return this;
      },
    };
    return r;
  }

  test('accepts a valid ObjectId', async () => {
    const r = res();
    await webhook.listWebhooks(
      { ...baseReq(), query: { workflowId: '507f1f77bcf86cd799439011' } },
      r
    );
    expect(r._status).toBeNull();
  });

  test('rejects bad workflowId', async () => {
    const r = res();
    await webhook.listWebhooks({ ...baseReq(), query: { workflowId: '../etc/passwd' } }, r);
    expect(r._status).toBe(400);
    expect(r._body.error).toBe('invalid_workflow_id');
  });
});
