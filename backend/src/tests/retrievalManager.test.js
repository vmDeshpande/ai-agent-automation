const RetrievalManager = require("../retrieval/RetrievalManager");

describe("RetrievalManager", () => {
  let strategyRegistry;
  let strategySelector;
  let retrievalManager;
  let hybridStrategy;

  beforeEach(() => {
    hybridStrategy = {
      retrieve: jest.fn().mockResolvedValue(["chunk1", "chunk2"]),
    };

    strategyRegistry = {
      has: jest.fn(),
      get: jest.fn(),
    };

    strategySelector = {
      selectStrategy: jest.fn(),
    };

    retrievalManager = new RetrievalManager(
      strategyRegistry,
      strategySelector
    );

    jest.clearAllMocks();
  });

  test("uses StrategySelector when strategy is omitted", async () => {
    strategySelector.selectStrategy.mockResolvedValue("hybrid");
    strategyRegistry.get.mockReturnValue(hybridStrategy);

    const result = await retrievalManager.retrieve(
      null,
      "user1",
      ["doc1"],
      "test query"
    );

    expect(strategySelector.selectStrategy).toHaveBeenCalledTimes(1);

    expect(strategyRegistry.get).toHaveBeenCalledWith("hybrid");

    expect(hybridStrategy.retrieve).toHaveBeenCalledWith(
      null,
      "user1",
      ["doc1"],
      "test query",
      3
    );

    expect(result).toEqual(["chunk1", "chunk2"]);
  });

  test("uses StrategySelector when strategy is auto", async () => {
    strategySelector.selectStrategy.mockResolvedValue("hybrid");
    strategyRegistry.get.mockReturnValue(hybridStrategy);

    await retrievalManager.retrieve(
      null,
      "user1",
      ["doc1"],
      "test query",
      3,
      "auto"
    );

    expect(strategySelector.selectStrategy).toHaveBeenCalledTimes(1);

    expect(strategyRegistry.get).toHaveBeenCalledWith("hybrid");

    expect(hybridStrategy.retrieve).toHaveBeenCalledTimes(1);
  });

  test("uses manually requested strategy when provided", async () => {
    strategyRegistry.has.mockReturnValue(true);
    strategyRegistry.get.mockReturnValue(hybridStrategy);

    const result = await retrievalManager.retrieve(
      null,
      "user1",
      ["doc1"],
      "test query",
      3,
      "hybrid"
    );

    expect(strategySelector.selectStrategy).not.toHaveBeenCalled();

    expect(strategyRegistry.has).toHaveBeenCalledWith("hybrid");

    expect(strategyRegistry.get).toHaveBeenCalledWith("hybrid");

    expect(hybridStrategy.retrieve).toHaveBeenCalledWith(
      null,
      "user1",
      ["doc1"],
      "test query",
      3
    );

    expect(result).toEqual(["chunk1", "chunk2"]);
  });

  test("throws when requested strategy is not registered", async () => {
    strategyRegistry.has.mockReturnValue(false);

    await expect(
      retrievalManager.retrieve(
        null,
        "user1",
        ["doc1"],
        "test query",
        3,
        "invalid"
      )
    ).rejects.toThrow(
      'Retrieval strategy "invalid" is not registered.'
    );

    expect(strategySelector.selectStrategy).not.toHaveBeenCalled();

    expect(strategyRegistry.get).not.toHaveBeenCalled();
  });
});