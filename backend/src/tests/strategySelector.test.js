const StrategySelector = require("../retrieval/StrategySelector");
const Document = require("../models/document.model");

jest.mock("../models/document.model");

describe("StrategySelector", () => {
  let strategySelector;

  beforeEach(() => {
    strategySelector = new StrategySelector();
    jest.clearAllMocks();
  });

  test("returns hybrid when no document IDs are provided", async () => {
    const strategy = await strategySelector.selectStrategy(
      null,
      null,
      [],
      "test query"
    );

    expect(strategy).toBe("hybrid");
    expect(Document.find).not.toHaveBeenCalled();
  });

  test("returns hybrid when documents have no analysis metadata", async () => {
    Document.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { metadata: {} },
          { metadata: {} },
        ]),
      }),
    });

    const strategy = await strategySelector.selectStrategy(
      null,
      null,
      ["doc1", "doc2"],
      "test query"
    );

    expect(strategy).toBe("hybrid");
  });

  test("returns hybrid for low complexity documents", async () => {
    Document.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            metadata: {
              analysis: {
                estimatedComplexity: "low",
              },
            },
          },
        ]),
      }),
    });

    const strategy = await strategySelector.selectStrategy(
      null,
      null,
      ["doc1"],
      "test query"
    );

    expect(strategy).toBe("hybrid");
  });

  test("returns hybrid for high complexity documents", async () => {
    Document.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            metadata: {
              analysis: {
                estimatedComplexity: "high",
              },
            },
          },
        ]),
      }),
    });

    const strategy = await strategySelector.selectStrategy(
      null,
      null,
      ["doc1"],
      "test query"
    );

    expect(strategy).toBe("hybrid");
  });
});