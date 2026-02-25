/**
 * Pruning Engine v2.0
 * Aggressively removes stale rooms that haven't been touched in 5+ cycles.
 * Collapsed rooms leave fragments (traces) in neighboring rooms.
 */

class PruneEngine {
  /**
   * Prune stale rooms from the world
   * @param {Object} state - full world state
   * @param {number} staleCycles - cycles without refresh before pruning (default 5)
   * @returns {Object} - { pruned: Room[], fragments: Object[], events: Object[] }
   */
  static prune(state, staleCycles = 5) {
    const currentCycle = state.observationCycles || 0;
    const rooms = state.rooms || [];
    const corridors = state.corridors || [];
    const events = [];

    // Build adjacency map
    const neighbors = new Map();
    for (const room of rooms) {
      neighbors.set(room.id, new Set());
    }
    for (const c of corridors) {
      if (neighbors.has(c.from)) neighbors.get(c.from).add(c.to);
      if (neighbors.has(c.to)) neighbors.get(c.to).add(c.from);
    }

    // Identify rooms to prune: high entropy + stale
    const toPrune = [];
    const toKeep = [];

    for (const room of rooms) {
      const age = currentCycle - (room.lastRefreshedCycle || room._addedCycle || 0);
      const isStale = age >= staleCycles;
      const isDecaying = room.entropy && room.entropy.score >= 0.6;

      if (isStale && isDecaying) {
        toPrune.push(room);
      } else if (isStale && room.entropy && room.entropy.score >= 0.4) {
        // Accelerate decay for stale rooms not yet prunable
        room.entropy.score = Math.min(1, room.entropy.score + 0.15);
        toKeep.push(room);
      } else {
        toKeep.push(room);
      }
    }

    // Process pruned rooms — leave fragments in neighbors
    const fragments = [];
    const prunedIds = new Set(toPrune.map(r => r.id));

    for (const room of toPrune) {
      const roomNeighbors = neighbors.get(room.id) || new Set();
      const livingNeighbors = [...roomNeighbors].filter(id => !prunedIds.has(id));

      // Create fragment
      const fragment = {
        sourceRoom: room.id,
        sourceName: room.name,
        sourceTopic: room.topic,
        fragments: (room.fragments && room.fragments.words) ? room.fragments.words.slice(0, 4) : [],
        sentiment: room.sentiment || 0,
        commentary: room.commentary ? room.commentary.substring(0, 80) : null,
        collapsedAt: Date.now(),
        cycle: currentCycle
      };
      fragments.push(fragment);

      // Distribute traces to living neighbors
      for (const neighborId of livingNeighbors) {
        const neighbor = toKeep.find(r => r.id === neighborId);
        if (neighbor) {
          if (!neighbor.traces) neighbor.traces = [];
          neighbor.traces.push({
            from: room.name,
            topic: room.topic,
            echo: (room.fragments && room.fragments.sentences && room.fragments.sentences[0]) || '...',
            absorbedAt: Date.now()
          });
          // Keep traces manageable
          if (neighbor.traces.length > 5) neighbor.traces.shift();
        }
      }

      // If a pruned room has no living neighbors, check if it can be absorbed
      // into the closest same-topic room
      if (livingNeighbors.length === 0) {
        const sameTopic = toKeep.filter(r => r.topic === room.topic);
        if (sameTopic.length > 0) {
          const target = sameTopic[Math.floor(Math.random() * Math.min(3, sameTopic.length))];
          if (!target.traces) target.traces = [];
          target.traces.push({
            from: room.name,
            topic: room.topic,
            echo: (room.fragments && room.fragments.sentences && room.fragments.sentences[0]) || '...',
            absorbedAt: Date.now()
          });
          if (target.traces.length > 5) target.traces.shift();
        }
      }

      events.push({
        timestamp: Date.now(),
        type: 'room_pruned',
        description: `"${room.name}" (${room.topic}) collapsed after ${staleCycles}+ stale cycles. Entropy: ${(room.entropy.score).toFixed(2)}`,
        involvedRooms: [room.id, ...livingNeighbors.slice(0, 3)],
        involvedEntities: []
      });
    }

    return { kept: toKeep, pruned: toPrune, fragments, events };
  }

  /**
   * Mark rooms that were just refreshed (had new observations in their topic)
   */
  static refreshRooms(rooms, newRooms, currentCycle) {
    const newTopics = new Set(newRooms.map(r => r.topic));
    for (const room of rooms) {
      if (newTopics.has(room.topic)) {
        room.lastRefreshedCycle = currentCycle;
      }
    }
    // Mark new rooms
    for (const room of newRooms) {
      room.lastRefreshedCycle = currentCycle;
      room._addedCycle = currentCycle;
    }
  }
}

module.exports = { PruneEngine };
