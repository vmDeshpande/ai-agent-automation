// backend/src/tools/hackerNewsTool.js

/**
 * Fetch the current top stories from HackerNews.
 * We use the native fetch API (available in Node 18+).
 * @param {number} limit - How many stories to return (default 5, max 30).
 * @returns {Promise<Array|Object>} Array of story objects, or an error object.
 */
async function getTopStories(limit = 5) {
  // 1. Input Validation: AI models sometimes pass strings instead of numbers.
  // We parse it, ensure it's at least 1, and cap it at 30 to prevent the AI 
  // from spamming the HackerNews API and getting the server IP banned.
  const parsedLimit = parseInt(limit, 10);
  const safeLimit = Math.min(Math.max(1, isNaN(parsedLimit) ? 5 : parsedLimit), 30);

  try {
    // 2. Fetch the array of top story IDs
    const response = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
    
    if (!response.ok) {
      throw new Error(`HN API responded with status: ${response.status}`);
    }
    
    const storyIds = await response.json();

    // 3. Take only the top 'safeLimit' IDs
    const topIds = storyIds.slice(0, safeLimit);

    // 4. Fetch the full details for each story ID concurrently
    // Promise.all runs these requests at the same time for maximum speed.
    const stories = await Promise.all(
      topIds.map(async (id) => {
        const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        if (!itemRes.ok) return null; // Ignore failed individual items
        return itemRes.json();
      })
    );

    // 5. Format the output cleanly for the AI Agent
    return stories
      .filter(story => story !== null) // Remove any failed fetches
      .map(story => ({
        id: story.id,
        title: story.title,
        // If a story is a text post, it might not have a URL. Provide a fallback.
        url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
        score: story.score,
        author: story.by,
        // Convert UNIX timestamp to a readable ISO format for the LLM
        time: new Date(story.time * 1000).toISOString()
      }));

  } catch (error) {
    console.error("[HackerNewsTool] Error fetching top stories:", error.message);
    
    // 6. Graceful Degradation
    // We do NOT throw the error to the main process. We return it as an object.
    // This allows the AI agent to see the error and try something else, 
    // rather than crashing the entire Node.js worker.
    return { 
      error: "Failed to fetch HackerNews top stories.", 
      details: error.message 
    };
  }
}

/**
 * Standardized Tool Contract Interface Mapping Implementation
 */
async function run(step, context, interpolate) {
  const parsedLimit = step.limit || 5;
  return await getTopStories(parsedLimit);
}

module.exports = { getTopStories, run };