class RetrievalManager {
  constructor(strategyRegistry) {
    this.strategyRegistry = strategyRegistry;
  }
  selectStrategy(agent, userId, documentIds, query) {
        // Placeholder for future intelligent strategy selection.
        return "hybrid";
    }
  async retrieve(agent, userId, documentIds, query, topK = 3) {
    const strategyName = this.selectStrategy(
            agent,
            userId,
            documentIds,
            query
        );

        const strategy = this.strategyRegistry.get(strategyName);

        return strategy.retrieve(
            agent,
            userId,
            documentIds,
            query,
            topK
        );
    }
}
module.exports = RetrievalManager;