class DocumentAnalyzer {
  analyze(document, text, chunks) {
    const estimatedWordCount = this.countWords(text);
    const averageChunkLength = this.calculateAverageChunkLength(chunks);

    const headingInfo = this.detectHeadings(text);
    const hasTables = this.detectTables(text);
    const chunkCount = chunks?.length || 0;

    return {
      estimatedWordCount,
      averageChunkLength,
      chunkCount,
      hasHeadings: headingInfo.hasHeadings,
      headingCount: headingInfo.headingCount,
      hasTables,
      fileType: document.fileType || 'unknown',
      estimatedComplexity: this.estimateComplexity(chunkCount, estimatedWordCount),
    };
  }

  countWords(text) {
    if (!text || !text.trim()) {
      return 0;
    }

    return text.trim().split(/\s+/).length;
  }

  calculateAverageChunkLength(chunks) {
    if (!chunks || chunks.length === 0) {
      return 0;
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

    return Math.round(totalLength / chunks.length);
  }

  detectHeadings(text) {
    if (!text) {
      return {
        hasHeadings: false,
        headingCount: 0,
      };
    }

    const headingPatterns = [
      // Markdown headings
      /^#{1,6}\s+\S+/gm,

      // Chapter 1
      /^Chapter\s+\d+[:\s-].*/gim,

      // Section 2
      /^Section\s+\d+[:\s-].*/gim,

      // 1. Introduction
      /^\d+(\.\d+)*\.\s+[A-Za-z].*/gm,

      // ALL CAPS headings
      /^[A-Z][A-Z\s]{4,30}$/gm,
    ];

    let headingCount = 0;

    for (const pattern of headingPatterns) {
      const matches = text.match(pattern);

      if (matches) {
        headingCount += matches.length;
      }
    }

    return {
      hasHeadings: headingCount > 0,
      headingCount,
    };
  }

  detectTables(text) {
    if (!text) {
      return false;
    }
    const markdownTable = /\|.+\|[\r\n]+\|[-:\s|]+\|/.test(text);
    // Markdown tables
    if (markdownTable) {
      return true;
    }

    // CSV-like rows
    const commaSeparatedRows = text.match(/^.+,.+$/gm);
    if (commaSeparatedRows && commaSeparatedRows.length >= 2) {
      return true;
    }

    // Tab-separated rows
    const tabSeparatedRows = text.match(/^.+\t.+$/gm);
    if (tabSeparatedRows && tabSeparatedRows.length >= 2) {
      return true;
    }

    return false;
  }

  estimateComplexity(chunkCount, wordCount) {
    if (chunkCount < 20 && wordCount < 5000) {
      return 'low';
    }

    if (chunkCount < 100 && wordCount < 30000) {
      return 'medium';
    }

    return 'high';
  }
}

module.exports = new DocumentAnalyzer();
