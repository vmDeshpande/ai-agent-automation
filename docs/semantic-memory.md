# Semantic Memory

## Memory Storage

Agent memory is stored securely and locally within the MongoDB database. The system does not require an external vector database, ensuring that all data remains self-contained and private without external SaaS dependencies.

## Embedding Generation

When an agent processes information designated for memory retention, the text is converted into vector embeddings. These embeddings represent the semantic meaning of the text, allowing the system to understand context beyond simple keyword matching.

## Similarity Retrieval

During workflow execution, the engine queries the memory storage using cosine similarity. It compares the current execution context against stored embeddings. The system retrieves the top *K* most relevant memories, sorted by highest similarity score, to dynamically inject into the agent's prompt.

## Memory Management UI

A dedicated interface within the frontend dashboard allows users to inspect, modify, and delete the semantic memories associated with individual agents. This provides full visibility into what the agent has learned over time.

## Retention Policies

To maintain performance and relevance, the system supports retention caps per agent. These policies govern how much historical data is retained, automatically pruning the oldest or least relevant memories when the threshold is reached.