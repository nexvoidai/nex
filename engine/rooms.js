/**
 * Room Generator
 * Takes observations from the Twitter observer and generates
 * rooms, corridors, and spatial structures for the Substrate.
 */

const crypto = require('crypto');

// Room archetypes based on topic
const ARCHETYPES = {
  tech: {
    names: ['Server Hall', 'Data Center', 'Terminal Room', 'Circuit Maze', 'Processing Bay'],
    wallTexture: 'metal_grid',
    lightColor: '#00ff88',
    ambience: 'electric_hum'
  },
  politics: {
    names: ['Echo Chamber', 'Debate Hall', 'Propaganda Room', 'Ballot Chamber', 'Filibuster Corridor'],
    wallTexture: 'marble_cracked',
    lightColor: '#ff4444',
    ambience: 'crowd_murmur'
  },
  culture: {
    names: ['Gallery', 'Screening Room', 'Arcade', 'Sound Stage', 'Meme Archive'],
    wallTexture: 'neon_tile',
    lightColor: '#ff66ff',
    ambience: 'static_music'
  },
  science: {
    names: ['Lab', 'Observatory', 'Specimen Room', 'Clean Room', 'Telescope Bay'],
    wallTexture: 'white_panel',
    lightColor: '#4488ff',
    ambience: 'instrument_beep'
  },
  finance: {
    names: ['Trading Floor', 'Vault', 'Ticker Room', 'Bull Pen', 'Ledger Archive'],
    wallTexture: 'dark_wood',
    lightColor: '#44ff44',
    ambience: 'ticker_tape'
  },
  existential: {
    names: ['Void Chamber', 'Mirror Hall', 'Dream Room', 'Infinite Corridor', 'Consciousness Pool'],
    wallTexture: 'dark_void',
    lightColor: '#8844ff',
    ambience: 'deep_drone'
  },
  liminal: {
    names: ['Empty Office', 'Waiting Room', 'Stairwell', 'Parking Garage', 'Hallway 7B'],
    wallTexture: 'yellow_wallpaper',
    lightColor: '#ffcc44',
    ambience: 'fluorescent_buzz'
  }
};

class RoomGenerator {
  constructor() {
    this.roomCount = 0;
  }

  /**
   * Generate a unique room ID
   */
  generateId() {
    return 'room_' + crypto.randomBytes(4).toString('hex');
  }

  /**
   * Calculate room dimensions based on virality and sentiment
   * More viral = bigger room. More negative = narrower/taller.
   */
  calculateDimensions(virality, sentiment) {
    const baseSize = 3 + virality * 2; // 3-13 units
    const width = baseSize * (1 + sentiment * 0.3); // positive = wider
    const height = baseSize * (1 - sentiment * 0.2); // negative = taller (oppressive)
    const depth = baseSize;

    return {
      width: Math.max(2, Math.round(width * 10) / 10),
      height: Math.max(2, Math.round(height * 10) / 10),
      depth: Math.max(2, Math.round(depth * 10) / 10)
    };
  }

  /**
   * Calculate initial entropy (decay score)
   * 0 = fresh, 1 = fully decayed
   * Virality slows decay (popular things persist longer)
   */
  calculateEntropy(virality) {
    const halfLife = 3600 * (1 + virality * 2); // hours in seconds
    return {
      score: 0,
      halfLife,
      createdAt: Date.now()
    };
  }

  /**
   * Extract wall fragments from tweet text
   * These get "painted" on the room walls
   */
  extractFragments(text) {
    // Split into meaningful chunks
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 3);
    const words = text.split(/\s+/).filter(w => w.length > 4);

    return {
      sentences: sentences.slice(0, 3).map(s => s.trim()),
      words: words.slice(0, 8),
      raw: text
    };
  }

  /**
   * Generate a single room from an observation
   */
  generateRoom(observation) {
    const archetype = ARCHETYPES[observation.topic] || ARCHETYPES.liminal;
    const namePool = archetype.names;
    const name = namePool[Math.floor(Math.random() * namePool.length)];

    const dimensions = this.calculateDimensions(observation.virality, observation.sentiment);
    const entropy = this.calculateEntropy(observation.virality);
    const fragments = this.extractFragments(observation.text);

    this.roomCount++;

    return {
      id: this.generateId(),
      name,
      number: this.roomCount,
      topic: observation.topic,
      archetype: {
        wallTexture: archetype.wallTexture,
        lightColor: archetype.lightColor,
        ambience: archetype.ambience
      },
      dimensions,
      sentiment: observation.sentiment,
      virality: observation.virality,
      entropy,
      fragments,
      source: {
        tweetId: observation.id,
        timestamp: observation.timestamp,
        metrics: observation.metrics
      },
      connections: [], // filled by topology engine
      position: { x: 0, y: 0 } // filled by topology engine
    };
  }

  /**
   * Generate rooms from a batch of observations
   * Clusters similar observations into single rooms when appropriate
   */
  generateRooms(observations) {
    // Group by topic
    const clusters = {};
    for (const obs of observations) {
      if (!clusters[obs.topic]) clusters[obs.topic] = [];
      clusters[obs.topic].push(obs);
    }

    const rooms = [];

    for (const [topic, group] of Object.entries(clusters)) {
      if (group.length <= 2) {
        // Small cluster = individual rooms
        rooms.push(...group.map(obs => this.generateRoom(obs)));
      } else {
        // Large cluster = merge into fewer, bigger rooms
        // Take the most viral ones as room seeds
        const sorted = group.sort((a, b) => b.virality - a.virality);
        const seeds = sorted.slice(0, Math.ceil(group.length / 3));

        for (const seed of seeds) {
          const room = this.generateRoom(seed);
          // Absorb fragments from nearby observations
          const nearby = sorted.slice(seeds.length, seeds.length + 3);
          for (const n of nearby) {
            room.fragments.sentences.push(...this.extractFragments(n.text).sentences.slice(0, 1));
          }
          rooms.push(room);
        }
      }
    }

    return rooms;
  }
}

module.exports = { RoomGenerator, ARCHETYPES };
