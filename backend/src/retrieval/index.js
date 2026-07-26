const StrategyRegistry = require("./StrategyRegistry");
const RetrievalManager = require("./RetrievalManager");
const StrategySelector = require("./StrategySelector");

const HybridRetrievalStrategy = require("./strategies/HybridRetrievalStrategy");

const strategyRegistry = new StrategyRegistry();

strategyRegistry.register(
  "hybrid",
  new HybridRetrievalStrategy()
);

const strategySelector = new StrategySelector();

const retrievalManager =
    new RetrievalManager(
        strategyRegistry,
        strategySelector
    );

module.exports = retrievalManager;