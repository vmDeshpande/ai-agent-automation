// backend/src/tests/workflowVariables.handler.test.js
//
// Issue #283 — Variables CRUD validation + persistence semantics.
//
// Pure unit-style tests that exercise the controller's helpers without
// hitting the database. The controller is small enough that driving it
// end-to-end via a mocked Mongoose model would add more setup than
// logic, so we test the validation/normalization helpers directly via
// the `__test__` export. Combined with the API integration covered by
// the route file's curl checks, this gives us enough coverage to land
// the PR without dragging Mongoose + Express into the unit tests.

const workflowVariables = require('../controllers/workflowVariables.controller');
const { normalizeVariables, publicShape, NAME_REGEX, SECRET_SENTINEL } = workflowVariables.__test__;

describe('workflowVariables.normalizeVariables (Issue #283)', () => {
  it('rejects non-array input with variables_must_be_array', () => {
    expect(normalizeVariables(null).error).toEqual({ code: 400, msg: 'variables_must_be_array' });
    expect(normalizeVariables('x').error.msg).toBe('variables_must_be_array');
    expect(normalizeVariables({}).error.msg).toBe('variables_must_be_array');
  });

  it('rejects more than 100 variables with too_many_variables', () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => ({
      name: `v${i}`,
      isSecret: false,
      value: 'x',
    }));
    expect(normalizeVariables(tooMany).error.msg).toBe('too_many_variables');
  });

  it('rejects variable without a name', () => {
    expect(normalizeVariables([{ isSecret: false, value: 'x' }]).error.msg).toMatch(/name_invalid/);
  });

  it('rejects names that violate the regex', () => {
    const bad = ['1starts_with_digit', 'has space', 'has-dash', '', 'x'.repeat(65)];
    for (const n of bad) {
      expect(normalizeVariables([{ name: n, isSecret: false, value: 'x' }]).error.msg).toMatch(
        /name_invalid/
      );
    }
    // sanity check the regex itself
    expect(NAME_REGEX.test('CamelCase_123')).toBe(true);
    expect(NAME_REGEX.test('Good4')).toBe(true);
  });

  it('rejects duplicate names within the same array', () => {
    const dup = [
      { name: 'X', isSecret: false, value: '1' },
      { name: 'X', isSecret: false, value: '2' },
    ];
    expect(normalizeVariables(dup).error.msg).toMatch(/name_duplicate/);
  });

  it('rejects entries missing isSecret', () => {
    expect(normalizeVariables([{ name: 'A' }]).error.msg).toMatch(/isSecret_required/);
  });

  it('rejects non-secret entries with non-string values', () => {
    expect(normalizeVariables([{ name: 'A', isSecret: false, value: 123 }]).error.msg).toMatch(
      /value_required/
    );
    expect(normalizeVariables([{ name: 'A', isSecret: false }]).error.msg).toMatch(
      /value_required/
    );
  });

  it('rejects values longer than 4000 chars', () => {
    expect(
      normalizeVariables([{ name: 'A', isSecret: false, value: 'x'.repeat(4001) }]).error.msg
    ).toMatch(/value_too_long/);
  });

  it('passes through a well-formed non-secret variable with updatedAt', () => {
    const out = normalizeVariables([{ name: 'Env', isSecret: false, value: 'production' }]).value;
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Env');
    expect(out[0]._v_value).toBe('production');
    expect(out[0].isSecret).toBe(false);
    expect(out[0].updatedAt).toBeInstanceOf(Date);
  });

  it('stores secret sentinel in _v_value when isSecret is true', () => {
    const out = normalizeVariables([{ name: 'API_KEY', isSecret: true }]).value;
    expect(out[0]._v_value).toBe(SECRET_SENTINEL);
    expect(out[0].isSecret).toBe(true);
  });
});

describe('workflowVariables.publicShape (Issue #283)', () => {
  it('masks the value for secret variables', () => {
    expect(
      publicShape({ name: 'A', _v_value: 'plaintext', isSecret: true, updatedAt: new Date() })
    ).toEqual({
      name: 'A',
      isSecret: true,
      value: null,
      updatedAt: expect.any(Date),
    });
  });

  it('returns the plaintext for non-secret variables', () => {
    expect(
      publicShape({ name: 'A', _v_value: 'plaintext', isSecret: false, updatedAt: new Date() })
    ).toEqual({
      name: 'A',
      isSecret: false,
      value: 'plaintext',
      updatedAt: expect.any(Date),
    });
  });

  it('handles a missing _v_value gracefully', () => {
    expect(publicShape({ name: 'A', isSecret: false, updatedAt: new Date() }).value).toBeNull();
  });
});

describe('workflowVariables exports (Issue #283)', () => {
  it('exports the three handlers plus the helpers', () => {
    expect(typeof workflowVariables.listVariables).toBe('function');
    expect(typeof workflowVariables.replaceVariables).toBe('function');
    expect(typeof workflowVariables.deleteVariable).toBe('function');
    expect(typeof workflowVariables.__test__.normalizeVariables).toBe('function');
  });
});
