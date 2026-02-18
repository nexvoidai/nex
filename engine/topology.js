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
   * Rooms with high similarity get connected
   */
  generateCorridors(rooms, threshold = 0.4) {
    const corridors = [];

    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const sim = this.similarity(rooms[i], rooms[j]);
        if (sim >= threshold) {
          const corridor = {
            id: `corridor_${rooms[i].id}_${rooms[j].id}`,
            from: rooms[i].id,
            to: rooms[j].id,
            similarity: sim,
            width: 1 + sim * 3, // more similar = wider corridor
            length: Math.max(2, (1 - sim) * 10), // more similar = shorter
            decay: 0
          };
          corridors.push(corridor);

          // Update room connections
          rooms[i].connections.push(rooms[j].id);
          rooms[j].connections.push(rooms[i].id);
        }
      }
    }

    // Ensure connectivity — every room has at least one connection
    for (const room of rooms) {
      if (room.connections.length === 0 && rooms.length > 1) {
        // Connect to the most similar room
        let bestSim = -1;
        let bestRoom = null;
        for (const other of rooms) {
          if (other.id === room.id) continue;
          const sim = this.similarity(room, other);
          if (sim > bestSim) {
            bestSim = sim;
            bestRoom = other;
          }
        }
        if (bestRoom) {
          corridors.push({
            id: `corridor_${room.id}_${bestRoom.id}`,
            from: room.id,
            to: bestRoom.id,
            similarity: bestSim,
            width: 1 + bestSim * 3,
            length: Math.max(2, (1 - bestSim) * 10),
            decay: 0
          });
          room.connections.push(bestRoom.id);
          bestRoom.connections.push(room.id);
        }
      }
    }

    return corridors;
  }

  /**
   * Force-directed layout to position rooms in 2D space
   * Runs iteratively — connected rooms attract, all rooms repel
   */
  layoutRooms(rooms, corridors, iterations = 100) {
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

        // Repulsion from all other rooms
        for (const other of rooms) {
          if (other.id === room.id) continue;
          const dx = room.position.x - other.position.x;
          const dy = room.position.y - other.position.y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
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
