import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

/**
 * QED.systems API client with rate limiting and caching
 * Uses public QED API - no authentication required
 */
export class QEDClient {
  constructor(handle = process.env.QED_HANDLE || 'default') {
    this.handle = handle;
    this.apiUrl = process.env.QED_API_URL || 'https://qed.systems';
    this.timeout = parseInt(process.env.QED_API_TIMEOUT || '30000', 10);
    this.cache = new Map();
    this.rateLimitDelay = 500; // ms between requests to avoid rate limiting
    this.lastRequestTime = 0;
    this.maxRetries = 3;
  }

  /**
   * Generate recommendations based on QED scores (0-100 scale)
   * @param {object} scores - Scores object from QED with trait scores
   * @returns {string[]} - Array of recommendations
   */
  generateRecommendations(scores = {}) {
    const recommendations = [];
    const threshold = 70; // Score below 70/100 gets a recommendation

    // Map QED trait names to recommendations
    const traitRecommendations = {
      'human_readability': 'Improve human readability: simplify sentence structure, reduce jargon, use shorter paragraphs.',
      'readability': 'Improve readability: simplify sentence structure, reduce jargon, use shorter paragraphs.',
      'clarity': 'Enhance clarity: make language more precise and avoid ambiguous phrasing.',
      'tone': 'Align tone with brand voice: ensure consistent, professional messaging throughout.',
      'engagement': 'Strengthen engagement: improve opening hook, add compelling CTAs, use conversational language.',
      'professional': 'Maintain professional tone: ensure expertise and credibility signals throughout.',
      'trust': 'Build trust: add social proof, testimonials, credentials, and transparency about process.',
      'cta': 'Strengthen calls-to-action: make next steps explicit and easy to follow.',
      'local_relevance': 'Increase local relevance: add geographic specificity and local context.'
    };

    // Check all available traits in the scores
    for (const [trait, score] of Object.entries(scores)) {
      if (typeof score === 'number' && score < threshold) {
        const rec = traitRecommendations[trait] || `Improve ${trait}: score is ${score}/100.`;
        recommendations.push(rec);
      }
    }

    // If no recommendations, content meets baseline
    if (recommendations.length === 0) {
      recommendations.push('Content meets baseline quality standards across all evaluated dimensions.');
    }

    return recommendations.slice(0, 3); // Return top 3 recommendations
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
   * Fetch and grade a single URL with QED.systems public API
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

        // QED endpoint: POST /p/{handle} with content (URL or text)
        const response = await fetch(`${this.apiUrl}/p/${this.handle}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ content: url }),
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

        // QED returns { scores: { trait: score, ... }, composite: score, ... }
        const result = {
          url,
          scores: data.scores || {},
          composite: data.composite || 0,
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
