class StrategyRegistry {
  constructor() {
    this.strategies = new Map();
  }

  register(name, strategy) {
    this.strategies.set(name, strategy);
  }

  get(name) {
    const strategy = this.strategies.get(name);

    if (!strategy) {
      throw new Error(`Retrieval strategy "${name}" is not registered.`);
    }

    return strategy;
  }

  has(name) {
    return this.strategies.has(name);
  }
}

module.exports = StrategyRegistry;