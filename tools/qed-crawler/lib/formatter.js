import { stringify } from 'csv-stringify/sync';

/**
 * Format QED results as JSON or CSV
 */
export class Formatter {
  constructor(format = 'json') {
    if (!['json', 'csv'].includes(format)) {
      throw new Error('Format must be "json" or "csv"');
    }
    this.formatType = format;
  }

  /**
   * Generate recommendations from scores
   * @param {object} scores
   * @returns {string[]}
   */
  generateRecommendations(scores = {}) {
    const recommendations = [];
    const threshold = 0.7;

    if ((scores.engagement || 0) < threshold) {
      recommendations.push(
        'Strengthen your opening hook and add compelling call-to-action elements.'
      );
    }

    if ((scores.readability || 0) < threshold) {
      recommendations.push(
        'Simplify sentence structure and reduce jargon for better readability.'
      );
    }

    if ((scores.tone || 0) < threshold) {
      recommendations.push(
        'Ensure consistent brand voice throughout the content.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Content meets baseline quality standards.');
    }

    return recommendations;
  }

  /**
   * Add recommendations to a single result
   * @param {object} result
   * @returns {object}
   */
  addRecommendations(result) {
    return {
      ...result,
      recommendations: this.generateRecommendations(result.scores)
    };
  }

  /**
   * Format results as JSON string
   * @param {object[]} results
   * @returns {string}
   */
  formatJson(results) {
    return JSON.stringify(results, null, 2);
  }

  /**
   * Format results as CSV string
   * @param {object[]} results
   * @returns {string}
   */
  formatCsv(results) {
    const records = results.map(result => ({
      url: result.url,
      engagement: result.scores?.engagement || '',
      readability: result.scores?.readability || '',
      tone: result.scores?.tone || '',
      recommendation_1: result.recommendations?.[0] || '',
      recommendation_2: result.recommendations?.[1] || '',
      status: result.status,
      error: result.error || ''
    }));

    return stringify(records, { header: true });
  }

  /**
   * Format results based on configured format
   * @param {object[]} results
   * @returns {string}
   */
  format(results) {
    // Add recommendations to all results
    const enrichedResults = results.map(r => this.addRecommendations(r));

    if (this.formatType === 'json') {
      return this.formatJson(enrichedResults);
    } else if (this.formatType === 'csv') {
      return this.formatCsv(enrichedResults);
    }

    throw new Error(`Unknown format: ${this.formatType}`);
  }
}
