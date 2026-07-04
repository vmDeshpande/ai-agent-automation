class BaseRetrievalStrategy {
  /**
   * Retrieve relevant chunks for a query.
   *
   * @param {Object} agent - Agent configuration (provider, embedding settings, etc.)
   * @param {string|Object} userId - User ID
   * @param {Array<string>} documentIds - List of document IDs
   * @param {string} query - User query
   * @param {number} topK - Number of chunks to retrieve
   *
   * @returns {Promise<Array>} Retrieved document chunks
   */
  async retrieve(agent, userId, documentIds, query, topK = 3) {
    throw new Error(
      `${this.constructor.name} must implement the retrieve() method.`
    );
  }
}

module.exports = BaseRetrievalStrategy;