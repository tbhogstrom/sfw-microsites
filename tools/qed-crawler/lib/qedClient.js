import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

/**
 * QED.systems API client with rate limiting and caching
 */
export class QEDClient {
  constructor(apiKey = process.env.QED_API_KEY) {
    if (!apiKey) {
      throw new Error('QED_API_KEY not provided. Set it in .env or pass it as argument.');
    }
    this.apiKey = apiKey;
    this.apiUrl = process.env.QED_API_URL || 'https://api.qed.systems';
    this.timeout = parseInt(process.env.QED_API_TIMEOUT || '30000', 10);
    this.cache = new Map();
    this.rateLimitDelay = 100; // ms between requests
    this.lastRequestTime = 0;
    this.maxRetries = 3;
  }

  /**
   * Generate recommendations based on QED scores
   * @param {object} scores - Scores object from QED
   * @returns {string[]} - Array of recommendations
   */
  generateRecommendations(scores) {
    const recommendations = [];
    const threshold = 0.7; // Score below 0.7 gets a recommendation

    if (scores.engagement && scores.engagement < threshold) {
      recommendations.push(
        'Strengthen your opening hook and add more compelling call-to-action elements to improve engagement.'
      );
    }

    if (scores.readability && scores.readability < threshold) {
      recommendations.push(
        'Simplify sentence structure and reduce jargon to improve readability scores.'
      );
    }

    if (scores.tone && scores.tone < threshold) {
      recommendations.push(
        'Align your messaging with brand voice guidelines for consistency.'
      );
    }

    // If no recommendations yet, add a general one
    if (recommendations.length === 0) {
      recommendations.push('Content meets baseline quality standards.');
    }

    return recommendations;
  }

  /**
   * Apply exponential backoff for rate limiting
   * @private
   */
  async applyRateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.rateLimitDelay) {
      await new Promise(resolve =>
        setTimeout(resolve, this.rateLimitDelay - elapsed)
      );
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Fetch and grade a single URL with QED.systems
   * @param {string} url - URL to grade
   * @returns {Promise<object>} - Result object with scores and status
   */
  async gradeUrl(url) {
    // Check cache first
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    let lastError;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        await this.applyRateLimit();

        const response = await fetch(`${this.apiUrl}/grade`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url }),
          timeout: this.timeout
        });

        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`Rate limited. Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const result = {
          url,
          scores: data.scores || {},
          metrics: data.metrics || {},
          status: 'success',
          timestamp: new Date().toISOString()
        };

        // Cache the result
        this.cache.set(url, result);
        return result;
      } catch (err) {
        lastError = err;
        // On timeout, don't retry
        if (err.name === 'AbortError') {
          break;
        }
      }
    }

    // Return error result after retries exhausted
    const errorResult = {
      url,
      status: 'failed',
      error: lastError?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    };

    this.cache.set(url, errorResult);
    return errorResult;
  }

  /**
   * Grade multiple URLs in parallel with concurrency limit
   * @param {string[]} urls - Array of URLs
   * @param {number} concurrency - Max parallel requests (default: 3)
   * @returns {Promise<object[]>} - Array of result objects
   */
  async gradeUrls(urls, concurrency = 3) {
    const results = [];
    const inProgress = [];

    for (const url of urls) {
      const promise = this.gradeUrl(url)
        .then(result => {
          results.push(result);
          inProgress.splice(inProgress.indexOf(promise), 1);
          return result;
        });

      inProgress.push(promise);

      // Wait if we've hit concurrency limit
      if (inProgress.length >= concurrency) {
        await Promise.race(inProgress);
      }
    }

    // Wait for remaining requests
    await Promise.all(inProgress);
    return results;
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }
}
