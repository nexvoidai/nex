/**
 * Substrate Events v2.0
 * Tracks emergent phenomena: room merges, entity shifts, topic deaths/births.
 * Stores as a timeline in world-state.json under "events" (last 100).
 */

class EventTracker {
  /**
   * Detect and record events for this cycle
   * @param {Object} state - world state (before topology rebuild)
   * @param {Object} context - { newRooms, prunedRooms, pruneEvents }
   * @returns {Object[]} new events
   */
  static detect(state, context) {
    const events = [];
    const { newRooms = [], prunedRooms = [], pruneEvents = [] } = context;

    // Import prune events
    events.push(...pruneEvents);

    // Detect new topic emergence
    const existingTopics = new Set((state.rooms || []).map(r => r.topic));
    const newTopics = new Set();
    for (const room of newRooms) {
      if (!existingTopics.has(room.topic)) {
        newTopics.add(room.topic);
      }
    }
    for (const topic of newTopics) {
      events.push({
        timestamp: Date.now(),
        type: 'topic_emerged',
        description: `New topic "${topic}" appeared in the Substrate`,
        involvedRooms: newRooms.filter(r => r.topic === topic).map(r => r.id),
        involvedEntities: []
      });
    }

    // Detect topic death (all rooms of a topic pruned, none remaining)
    if (prunedRooms.length > 0) {
      const prunedTopics = new Set(prunedRooms.map(r => r.topic));
      const remainingTopics = new Set((state.rooms || []).map(r => r.topic));
      for (const topic of prunedTopics) {
        if (!remainingTopics.has(topic)) {
          events.push({
            timestamp: Date.now(),
            type: 'topic_death',
            description: `Topic "${topic}" has completely faded from the Substrate`,
            involvedRooms: prunedRooms.filter(r => r.topic === topic).map(r => r.id),
            involvedEntities: []
          });
        }
      }
    }

    // Detect entity dominance shifts
    const entities = state.entities || [];
    const strong = entities.filter(e => e.strength >= 0.8);
    for (const entity of strong) {
      events.push({
        timestamp: Date.now(),
        type: 'entity_dominant',
        description: `"${entity.name}" (${entity.type}) has become dominant — strength ${entity.strength.toFixed(2)}, ${entity.appearances} appearances`,
        involvedRooms: entity.currentRoom ? [entity.currentRoom] : [],
        involvedEntities: [entity.id]
      });
    }

    // Detect mass pruning
    if (prunedRooms.length >= 10) {
      events.push({
        timestamp: Date.now(),
        type: 'mass_collapse',
        description: `${prunedRooms.length} rooms collapsed in a single cycle — the Substrate is contracting`,
        involvedRooms: prunedRooms.slice(0, 10).map(r => r.id),
        involvedEntities: []
      });
    }

    return events;
  }

  /**
   * Append events to state and trim to last 100
   */
  static record(state, newEvents) {
    if (!state.events) state.events = [];
    state.events.push(...newEvents);
    // Keep last 100
    if (state.events.length > 100) {
      state.events = state.events.slice(-100);
    }
    return state.events;
  }
}

module.exports = { EventTracker };
