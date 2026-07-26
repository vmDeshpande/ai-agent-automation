const Document = require("../models/document.model");

class StrategySelector {
  /**
   * Select the retrieval strategy for the current request.
   */
  async selectStrategy(agent, userId, documentIds, query) {
    const documentAnalyses = await this.getDocumentAnalyses(documentIds);

    return this.chooseStrategy(documentAnalyses, query);
  }

  /**
   * Load document analysis metadata generated during ingestion.
   */
  async getDocumentAnalyses(documentIds) {
    if (!documentIds?.length) {
      return [];
    }

    const documents = await Document.find({
      _id: { $in: documentIds },
    })
      .select("metadata.analysis")
      .lean();

    return documents
      .map((document) => document.metadata?.analysis)
      .filter(Boolean);
  }

  /**
   * Placeholder for future intelligent strategy selection.
   */
  chooseStrategy(documentAnalyses, query) {
    const hasHighComplexity = documentAnalyses.some(
        (analysis) => analysis.estimatedComplexity === "high"
    );

    if (hasHighComplexity) {
        return "hybrid";
    }

    return "hybrid";
    }
}

module.exports = StrategySelector;