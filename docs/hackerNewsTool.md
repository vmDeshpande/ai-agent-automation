# HackerNews Tool

The `hackerNewsTool` allows AI agents to securely fetch the current top stories from HackerNews in real-time. It uses the unauthenticated, public Firebase HackerNews API.

## Intended Use
This is a backend-only tool designed to be chained with other primitive tools. It is ideal for scheduled daily digests, tech-news summarization, or competitive analysis workflows.

## Inputs
The tool accepts a single optional parameter to control the volume of data fetched:

| Parameter | Type   | Default | Description |
| :-------- | :----- | :------ | :---------- |
| `limit`   | Number | `5`     | The number of top stories to retrieve. Hard-capped at 30 to prevent API rate-limiting and worker memory overload. |

## Outputs
Returns a Promise that resolves to an Array of JSON objects containing the story details.

```json
[
  {
    "id": 48359102,
    "title": "Example Tech Article",
    "url": "[https://example.com/article](https://example.com/article)",
    "score": 1531,
    "author": "tech_user",
    "time": "2026-06-01T16:31:42.000Z"
  }
]