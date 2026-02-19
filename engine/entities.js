/**
 * Entity System
 * Tracks recurring people, projects, and concepts across observation cycles.
 * Entities wander the Backrooms — they're not rooms, they're inhabitants.
 * They appear in rooms relevant to their topic and accumulate history.
 */

class EntityTracker {
  constructor() {
    this.entities = new Map();
  }

  /**
   * Load existing entities from world state
   */
  load(entityList) {
    if (!entityList) return;
    for (const entity of entityList) {
      this.entities.set(entity.id, entity);
    }
  }

  /**
   * Extract potential entities from observations
   * Looks for: @usernames, recurring words/phrases, hashtags, URLs
   */
  extract(observations) {
    const mentions = new Map(); // id -> { count, contexts, type }

    for (const obs of observations) {
      const text = obs.text || '';

      // Extract @mentions
      const userMatches = text.match(/@(\w+)/g) || [];
      for (const mention of userMatches) {
        const name = mention.toLowerCase();
        if (!mentions.has(name)) {
          mentions.set(name, { name: mention, count: 0, contexts: [], type: 'person', topics: [] });
        }
        const m = mentions.get(name);
        m.count++;
        m.contexts.push(text.substring(0, 100));
        if (!m.topics.includes(obs.topic)) m.topics.push(obs.topic);
      }

      // Extract #hashtags
      const hashMatches = text.match(/#(\w+)/g) || [];
      for (const hash of hashMatches) {
        const name = hash.toLowerCase();
        if (!mentions.has(name)) {
          mentions.set(name, { name: hash, count: 0, contexts: [], type: 'concept', topics: [] });
        }
        const m = mentions.get(name);
        m.count++;
        m.contexts.push(text.substring(0, 100));
        if (!m.topics.includes(obs.topic)) m.topics.push(obs.topic);
      }

      // Extract recurring significant words (5+ chars, appearing in multiple tweets)
      const words = text.toLowerCase().split(/\s+/)
        .filter(w => w.length >= 5)
        .filter(w => !['https', 'about', 'their', 'there', 'would', 'could', 'should', 'which', 'these', 'those', 'being', 'other', 'after', 'before', 'between', 'through', 'under', 'really', 'think', 'never', 'always', 'still'].includes(w));

      for (const word of words) {
        const key = 'word:' + word;
        if (!mentions.has(key)) {
          mentions.set(key, { name: word, count: 0, contexts: [], type: 'concept', topics: [] });
        }
        const m = mentions.get(key);
        m.count++;
        if (m.contexts.length < 5) m.contexts.push(text.substring(0, 80));
        if (!m.topics.includes(obs.topic)) m.topics.push(obs.topic);
      }
    }

    return mentions;
  }

  /**
   * Update entities based on new observations
   * Creates new entities for recurring mentions, updates existing ones
   */
  update(observations, minAppearances = 3) {
    const mentions = this.extract(observations);
    const newEntities = [];

    for (const [key, data] of mentions) {
      if (data.count < minAppearances) continue;

      // Skip common/boring words
      if (data.type === 'concept' && key.startsWith('word:')) {
        const boring = ['people', 'world', 'things', 'something', 'everything', 'nothing', 'going', 'making', 'getting'];
        if (boring.includes(data.name)) continue;
      }

      const entityId = 'entity_' + key.replace(/[^a-z0-9]/g, '_');

      if (this.entities.has(entityId)) {
        // Update existing entity
        const entity = this.entities.get(entityId);
        entity.appearances++;
        entity.lastSeen = Date.now();
        entity.strength = Math.min(1, entity.strength + 0.1);
        // Add new contexts
        for (const ctx of data.contexts.slice(0, 2)) {
          if (!entity.recentContexts.includes(ctx)) {
            entity.recentContexts.push(ctx);
            if (entity.recentContexts.length > 10) entity.recentContexts.shift();
          }
        }
        // Update topics
        for (const t of data.topics) {
          if (!entity.topics.includes(t)) entity.topics.push(t);
        }
      } else {
        // Create new entity
        const entity = {
          id: entityId,
          name: data.name,
          type: data.type,
          topics: data.topics,
          appearances: 1,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          strength: 0.3 + Math.min(0.5, data.count * 0.05),
          currentRoom: null,  // assigned during wandering
          recentContexts: data.contexts.slice(0, 5),
          history: []
        };
        this.entities.set(entityId, entity);
        newEntities.push(entity);
      }
    }

    // Decay entities that weren't seen this cycle
    for (const [id, entity] of this.entities) {
      const wasSeen = mentions.has(entity.name.toLowerCase()) ||
                      mentions.has('word:' + entity.name.toLowerCase());
      if (!wasSeen) {
        entity.strength = Math.max(0, entity.strength - 0.05);
      }
    }

    // Remove dead entities (strength 0, not seen in a while)
    for (const [id, entity] of this.entities) {
      if (entity.strength <= 0 && Date.now() - entity.lastSeen > 3600000) {
        this.entities.delete(id);
      }
    }

    return newEntities;
  }

  /**
   * Make entities wander to relevant rooms
   * Each entity moves to a room that matches its topics
   */
  wander(rooms) {
    for (const [id, entity] of this.entities) {
      // Find rooms matching entity's topics
      const relevantRooms = rooms.filter(r => entity.topics.includes(r.topic));
      if (relevantRooms.length === 0) continue;

      // Pick a room — prefer rooms with lower entropy (healthier)
      const sorted = relevantRooms.sort((a, b) => a.entropy.score - b.entropy.score);
      const pick = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];

      const previousRoom = entity.currentRoom;
      entity.currentRoom = pick.id;

      // Log movement
      if (previousRoom && previousRoom !== pick.id) {
        entity.history.push({
          from: previousRoom,
          to: pick.id,
          timestamp: Date.now()
        });
        // Keep history manageable
        if (entity.history.length > 20) entity.history.shift();
      }
    }
  }

  /**
   * Get entities currently in a specific room
   */
  getEntitiesInRoom(roomId) {
    const result = [];
    for (const [id, entity] of this.entities) {
      if (entity.currentRoom === roomId) {
        result.push(entity);
      }
    }
    return result;
  }

  /**
   * Export entities as array for serialization
   */
  toArray() {
    return Array.from(this.entities.values());
  }

  /**
   * Get a summary of the entity population
   */
  summary() {
    const entities = this.toArray();
    return {
      total: entities.length,
      people: entities.filter(e => e.type === 'person').length,
      concepts: entities.filter(e => e.type === 'concept').length,
      strongest: entities.sort((a, b) => b.strength - a.strength).slice(0, 5).map(e => ({
        name: e.name,
        type: e.type,
        strength: e.strength.toFixed(2),
        appearances: e.appearances,
        topics: e.topics
      }))
    };
  }
}

module.exports = { EntityTracker };
