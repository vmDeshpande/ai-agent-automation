const StrategyRegistry = require("./StrategyRegistry");
const RetrievalManager = require("./RetrievalManager");

const HybridRetrievalStrategy = require("./strategies/HybridRetrievalStrategy");

const strategyRegistry = new StrategyRegistry();

strategyRegistry.register(
  "hybrid",
  new HybridRetrievalStrategy()
);

const retrievalManager = new RetrievalManager(strategyRegistry);

module.exports = retrievalManager;