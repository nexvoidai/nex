/**
 * Topology Engine
 * Takes generated rooms and creates spatial relationships.
 * Force-directed layout — rooms push/pull based on topic similarity
 * and sentiment proximity. Outputs a connected map.
 */

class TopologyEngine {
  constructor() {
    this.rooms = [];
    this.corridors = [];
  }

  /**
   * Calculate similarity between two rooms (0-1)
   * Same topic = high similarity, similar sentiment = higher
   */
  similarity(roomA, roomB) {
    let score = 0;

    // Topic match
    if (roomA.topic === roomB.topic) score += 0.5;

    // Sentiment proximity (closer sentiment = more similar)
    const sentDiff = Math.abs(roomA.sentiment - roomB.sentiment);
    score += (1 - sentDiff) * 0.3;

    // Virality proximity
    const virDiff = Math.abs(roomA.virality - roomB.virality);
    score += Math.max(0, (1 - virDiff / 5)) * 0.2;

    return score;
  }

  /**
   * Generate corridors between rooms based on similarity
   * Optimized: group by topic first to avoid O(n²) full scan
   */
  generateCorridors(rooms, threshold = 0.4) {
    const corridors = [];
    const corridorSet = new Set();

    // Group rooms by topic for fast intra-topic connections
    const byTopic = new Map();
    for (const room of rooms) {
      if (!byTopic.has(room.topic)) byTopic.set(room.topic, []);
      byTopic.get(room.topic).push(room);
    }

    const addCorridor = (a, b, sim) => {
      const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
      if (corridorSet.has(key)) return;
      corridorSet.add(key);
      corridors.push({
        id: `corridor_${a.id}_${b.id}`,
        from: a.id, to: b.id,
        similarity: sim,
        width: 1 + sim * 3,
        length: Math.max(2, (1 - sim) * 10),
        decay: 0
      });
      a.connections.push(b.id);
      b.connections.push(a.id);
    };

    // Intra-topic connections (same topic = 0.5 base similarity, almost always connects)
    for (const [topic, group] of byTopic) {
      for (let i = 0; i < group.length; i++) {
        // Connect to up to 5 nearest neighbors by sentiment to cap corridor count
        const scored = [];
        for (let j = i + 1; j < group.length; j++) {
          scored.push({ room: group[j], sim: this.similarity(group[i], group[j]) });
        }
        scored.sort((a, b) => b.sim - a.sim);
        for (let k = 0; k < Math.min(5, scored.length); k++) {
          if (scored[k].sim >= threshold) {
            addCorridor(group[i], scored[k].room, scored[k].sim);
          }
        }
      }
    }

    // Cross-topic: sample up to 3 connections per room to other topics
    const topics = [...byTopic.keys()];
    for (const [topic, group] of byTopic) {
      for (const room of group) {
        if (room.connections.length >= 3) continue; // already well-connected
        let crossCount = 0;
        for (const otherTopic of topics) {
          if (otherTopic === topic || crossCount >= 3) break;
          const others = byTopic.get(otherTopic);
          // Pick a random sample of up to 5 to check
          const sample = others.length <= 5 ? others : others.sort(() => Math.random() - 0.5).slice(0, 5);
          for (const other of sample) {
            const sim = this.similarity(room, other);
            if (sim >= threshold) {
              addCorridor(room, other, sim);
              crossCount++;
              break;
            }
          }
        }
      }
    }

    // Ensure connectivity — every room has at least one connection
    for (const room of rooms) {
      if (room.connections.length === 0 && rooms.length > 1) {
        // Connect to same-topic neighbor or closest room
        const sameTopicRooms = byTopic.get(room.topic) || [];
        let bestSim = -1, bestRoom = null;
        const candidates = sameTopicRooms.length > 1 ? sameTopicRooms : rooms.slice(0, 50);
        for (const other of candidates) {
          if (other.id === room.id) continue;
          const sim = this.similarity(room, other);
          if (sim > bestSim) { bestSim = sim; bestRoom = other; }
        }
        if (bestRoom) addCorridor(room, bestRoom, bestSim);
      }
    }

    return corridors;
  }

  /**
   * Force-directed layout to position rooms in 2D space
   * Runs iteratively — connected rooms attract, all rooms repel
   */
  layoutRooms(rooms, corridors, iterations = null) {
    // Scale iterations with room count — fewer iterations for large worlds
    if (iterations === null) {
      iterations = rooms.length > 300 ? 30 : rooms.length > 100 ? 50 : 100;
    }
    // Initialize positions randomly
    for (const room of rooms) {
      room.position = {
        x: (Math.random() - 0.5) * 100,
        y: (Math.random() - 0.5) * 100
      };
    }

    const roomMap = new Map(rooms.map(r => [r.id, r]));
    const corridorSet = new Set(corridors.map(c => `${c.from}|${c.to}`));

    const repulsionStrength = 500;
    const attractionStrength = 0.05;
    const damping = 0.9;

    // Velocity for each room
    const velocity = new Map(rooms.map(r => [r.id, { x: 0, y: 0 }]));

    for (let iter = 0; iter < iterations; iter++) {
      const temp = 1 - iter / iterations; // cooling

      for (const room of rooms) {
        let fx = 0, fy = 0;

        // Repulsion from nearby rooms (skip if too far — force is negligible)
        for (const other of rooms) {
          if (other.id === room.id) continue;
          const dx = room.position.x - other.position.x;
          const dy = room.position.y - other.position.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > 10000) continue; // skip rooms > 100 units away
          const dist = Math.max(1, Math.sqrt(distSq));
          const force = repulsionStrength / (dist * dist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }

        // Attraction to connected rooms
        for (const connId of room.connections) {
          const other = roomMap.get(connId);
          if (!other) continue;
          const dx = other.position.x - room.position.x;
          const dy = other.position.y - room.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          fx += dx * attractionStrength;
          fy += dy * attractionStrength;
        }

        // Topic clustering — slight pull toward same-topic rooms
        for (const other of rooms) {
          if (other.id === room.id || other.topic !== room.topic) continue;
          const dx = other.position.x - room.position.x;
          const dy = other.position.y - room.position.y;
          fx += dx * 0.01;
          fy += dy * 0.01;
        }

        const v = velocity.get(room.id);
        v.x = (v.x + fx * temp) * damping;
        v.y = (v.y + fy * temp) * damping;
      }

      // Apply velocities
      for (const room of rooms) {
        const v = velocity.get(room.id);
        room.position.x += v.x;
        room.position.y += v.y;
        room.position.x = Math.round(room.position.x * 100) / 100;
        room.position.y = Math.round(room.position.y * 100) / 100;
      }
    }

    return rooms;
  }

  /**
   * Build complete topology from rooms
   */
  buildTopology(rooms) {
    const corridors = this.generateCorridors(rooms);
    this.layoutRooms(rooms, corridors);
    this.rooms = rooms;
    this.corridors = corridors;

    return {
      rooms,
      corridors,
      stats: {
        totalRooms: rooms.length,
        totalCorridors: corridors.length,
        topics: [...new Set(rooms.map(r => r.topic))],
        avgSentiment: rooms.reduce((sum, r) => sum + r.sentiment, 0) / rooms.length || 0,
        avgVirality: rooms.reduce((sum, r) => sum + r.virality, 0) / rooms.length || 0
      }
    };
  }
}

module.exports = { TopologyEngine };
