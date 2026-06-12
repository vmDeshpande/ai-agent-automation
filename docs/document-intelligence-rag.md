# Document Intelligence (RAG)

## Document Upload & Supported File Types

The platform allows users to upload custom documents to act as a specialized knowledge base for their agents. The ingestion pipeline supports standard text-based and document formats, ensuring that agents can access and process internal documentation, reports, and knowledge articles.

## Chunking Process

Due to the context window limitations of foundation models, large documents cannot be processed entirely at once. Upon upload, the system automatically executes a chunking process. Documents are parsed and systematically split into smaller, semantically coherent segments while retaining metadata such as the source file name and chunk order.

## Embedding Generation

Following the chunking process, each individual text segment is processed through an embedding model. This generates high-dimensional vector representations of the text, capturing the underlying semantic meaning of the document segments rather than relying on basic keyword matching.

## Retrieval Pipeline

When a workflow requires information from the document base, the retrieval pipeline is activated. The execution engine embeds the current workflow query and performs a similarity search against the stored document chunks. The pipeline retrieves the most contextually relevant chunks based on a configurable similarity threshold.

## Document Chat Workflow

The retrieved document chunks are dynamically injected into the agent's prompt prior to execution. This enables the agent to synthesize answers, extract specific data points, or summarize complex information directly from the uploaded documents. This ensures the agent's output is strictly grounded in the provided factual context.