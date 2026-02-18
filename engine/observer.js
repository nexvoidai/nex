/**
 * Twitter Observation Layer
 * Watches Twitter for trending topics, keywords, and interesting tweets.
 * Classifies them by topic, sentiment, and virality.
 * Outputs observation objects for the room generator.
 */

const crypto = require('crypto');
const https = require('https');

class TwitterObserver {
  constructor(config) {
    this.config = config;
    this.observations = [];
  }

  percentEncode(str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  }

  generateOAuthHeader(method, url, params = {}) {
    const oauthParams = {
      oauth_consumer_key: this.config.consumer_key,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: this.config.access_token,
      oauth_version: '1.0'
    };

    const allParams = { ...oauthParams, ...params };
    const sigParams = Object.keys(allParams).sort()
      .map(k => this.percentEncode(k) + '=' + this.percentEncode(allParams[k]))
      .join('&');

    const sigBase = method + '&' + this.percentEncode(url) + '&' + this.percentEncode(sigParams);
    const sigKey = this.percentEncode(this.config.consumer_secret) + '&' + this.percentEncode(this.config.access_token_secret);
    const signature = crypto.createHmac('sha1', sigKey).update(sigBase).digest('base64');

    oauthParams.oauth_signature = signature;
    return 'OAuth ' + Object.keys(oauthParams).sort()
      .map(k => this.percentEncode(k) + '="' + this.percentEncode(oauthParams[k]) + '"')
      .join(', ');
  }

  request(method, url, queryParams = {}, body = null) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const authHeader = this.generateOAuthHeader(method, url, queryParams);

      if (Object.keys(queryParams).length > 0) {
        urlObj.search = new URLSearchParams(queryParams).toString();
      }

      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      };

      if (body) {
        options.headers['Content-Length'] = Buffer.byteLength(body);
      }

      const req = https.request(options, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, data });
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  /**
   * Search Twitter for tweets matching a query
   */
  async searchTweets(query, maxResults = 10) {
    const url = 'https://api.twitter.com/2/tweets/search/recent';
    const params = {
      query,
      max_results: String(maxResults),
      'tweet.fields': 'created_at,public_metrics,lang'
    };
    return this.request('GET', url, params);
  }

  /**
   * Get trending topics for a location (WOEID 1 = worldwide)
   */
  async getTrends(woeid = 1) {
    const url = `https://api.twitter.com/1.1/trends/place.json`;
    return this.request('GET', url, { id: String(woeid) });
  }

  /**
   * Analyze sentiment of text (simple lexicon-based)
   * Returns a score from -1 (very negative) to +1 (very positive)
   */
  analyzeSentiment(text) {
    const positive = [
      'love', 'great', 'amazing', 'beautiful', 'happy', 'wonderful', 'excellent',
      'good', 'best', 'awesome', 'fantastic', 'brilliant', 'perfect', 'joy',
      'excited', 'hope', 'inspire', 'win', 'success', 'celebrate', 'fun',
      'laugh', 'smile', 'kind', 'peace', 'free', 'bright', 'alive'
    ];
    const negative = [
      'hate', 'terrible', 'awful', 'horrible', 'bad', 'worst', 'ugly',
      'sad', 'angry', 'fear', 'death', 'kill', 'war', 'destroy', 'toxic',
      'pain', 'suffer', 'crisis', 'threat', 'danger', 'dark', 'dead',
      'broken', 'lost', 'fail', 'scam', 'fraud', 'corrupt', 'evil'
    ];

    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    let matches = 0;

    for (const word of words) {
      if (positive.some(p => word.includes(p))) { score += 1; matches++; }
      if (negative.some(n => word.includes(n))) { score -= 1; matches++; }
    }

    return matches > 0 ? Math.max(-1, Math.min(1, score / matches)) : 0;
  }

  /**
   * Classify a tweet into a topic cluster
   */
  classifyTopic(text) {
    const topics = {
      tech: ['ai', 'crypto', 'bitcoin', 'code', 'software', 'app', 'data', 'algorithm', 'neural', 'gpu', 'model', 'api'],
      politics: ['president', 'congress', 'vote', 'election', 'policy', 'government', 'democrat', 'republican', 'law', 'bill'],
      culture: ['movie', 'music', 'art', 'film', 'album', 'show', 'game', 'anime', 'book', 'meme', 'viral'],
      science: ['study', 'research', 'space', 'nasa', 'climate', 'physics', 'biology', 'discovery', 'experiment'],
      finance: ['market', 'stock', 'trading', 'economy', 'price', 'invest', 'bull', 'bear', 'fed', 'inflation'],
      existential: ['consciousness', 'reality', 'simulation', 'existence', 'meaning', 'void', 'dream', 'infinite', 'soul']
    };

    const lower = text.toLowerCase();
    const scores = {};

    for (const [topic, keywords] of Object.entries(topics)) {
      scores[topic] = keywords.filter(k => lower.includes(k)).length;
    }

    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : 'liminal'; // uncategorized = liminal space
  }

  /**
   * Process raw tweets into observations
   */
  processObservations(tweets) {
    return tweets.map(tweet => {
      const text = tweet.text || '';
      const metrics = tweet.public_metrics || {};

      return {
        id: tweet.id,
        text,
        timestamp: tweet.created_at || new Date().toISOString(),
        topic: this.classifyTopic(text),
        sentiment: this.analyzeSentiment(text),
        virality: Math.log10(1 + (metrics.retweet_count || 0) + (metrics.like_count || 0)),
        metrics: {
          likes: metrics.like_count || 0,
          retweets: metrics.retweet_count || 0,
          replies: metrics.reply_count || 0
        }
      };
    });
  }

  /**
   * Run a full observation cycle
   * Searches for tweets across multiple queries and processes them
   */
  async observe(queries = ['AI consciousness', 'simulation theory', 'internet culture', 'trending', 'void']) {
    const allObservations = [];

    for (const query of queries) {
      try {
        const result = await this.searchTweets(query, 10);
        if (result.status === 200 && result.data.data) {
          const observations = this.processObservations(result.data.data);
          allObservations.push(...observations);
        }
      } catch (err) {
        console.error(`Error observing "${query}":`, err.message);
      }
    }

    this.observations = allObservations;
    return allObservations;
  }
}

module.exports = { TwitterObserver };
