const meta = {
  id: "test_tool",
  name: "Test Tool",
  version: "1.0.0",
  category: "Testing",
  description: "A test tool to verify auto-discovery",
  fields: [
    {
      name: "testField",
      label: "Test Field",
      type: "text",
      required: true
    }
  ]
};

async function run(step, context, interpolate) {
  return { success: true, testField: step.testField };
}

module.exports = { meta, run };
