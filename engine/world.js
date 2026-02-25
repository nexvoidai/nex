/**
 * World State Manager
 * Holds the complete state of the Substrate.
 * Manages observation cycles, room generation, topology, and decay.
 * Serializes to JSON for the frontend to consume.
 */

const fs = require('fs');
const path = require('path');
const { TwitterObserver } = require('./observer');
const { RoomGenerator } = require('./rooms');
const { TopologyEngine } = require('./topology');
const { DecayEngine } = require('./decay');
const { CommentaryGenerator } = require('./commentary');
const { EntityTracker } = require('./entities');
const { PruneEngine } = require('./prune');
const { EventTracker } = require('./events');
const { MemoryEngine } = require('./memory');

class World {
  constructor(configPath) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    this.observer = new TwitterObserver(config.twitter);
    this.roomGen = new RoomGenerator();
    this.topology = new TopologyEngine();
    this.entityTracker = new EntityTracker();

    this.state = {
      version: 2,
      createdAt: Date.now(),
      lastUpdate: null,
      observationCycles: 0,
      rooms: [],
      corridors: [],
      artifacts: [], // fragments from collapsed rooms
      entities: [], // recurring people/concepts that wander the halls
      stats: {}
    };
  }

  /**
   * Load existing world state from file
   */
  load(filePath) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      this.state = data;
      if (!this.state.entities) this.state.entities = [];
      if (!this.state.events) this.state.events = [];
      if (!this.state.memory) this.state.memory = { topicHistory: [], totalRoomHistory: [], maxHistoryLength: 50 };
      if (!this.state.artifacts) this.state.artifacts = [];
      this.entityTracker.load(this.state.entities);
      console.log(`Loaded world: ${this.state.rooms.length} rooms, ${this.state.corridors.length} corridors, ${this.state.entities.length} entities`);
    } catch (e) {
      console.log('No existing world state found, starting fresh.');
    }
  }

  /**
   * Save world state to file
   */
  save(filePath) {
    fs.writeFileSync(filePath, JSON.stringify(this.state));
    console.log(`Saved world: ${this.state.rooms.length} rooms, ${this.state.corridors.length} corridors`);
  }

  /**
   * Run a full observation + generation cycle
   */
  async cycle(queries) {
    console.log('--- Observation Cycle v2.0 ---');

    // 1. Observe
    console.log('1. Observing Twitter...');
    const observations = await this.observer.observe(queries);
    console.log(`   Got ${observations.length} observations`);

    if (observations.length === 0) {
      console.log('No observations to process.');
      return this.state;
    }

    // 2. Generate rooms
    console.log('2. Generating rooms...');
    const newRooms = this.roomGen.generateRooms(observations);
    console.log(`   Generated ${newRooms.length} new rooms`);

    // 3. Track entities
    console.log('3. Tracking entities...');
    const newEntities = this.entityTracker.update(observations);
    if (newEntities.length > 0) {
      console.log(`   New entities: ${newEntities.map(e => e.name).join(', ')}`);
    }

    // 4. Decay existing rooms
    if (this.state.rooms.length > 0) {
      console.log('4. Running decay...');
      const { active, decayed, collapsed } = DecayEngine.tick(this.state.rooms);
      DecayEngine.applyEffects([...active, ...decayed]);

      for (const room of collapsed) {
        const artifact = DecayEngine.harvestFragments(room);
        this.state.artifacts.push(artifact);
        console.log(`   Room "${room.name}" (${room.id}) collapsed into void`);
      }

      this.state.rooms = [...active, ...decayed];
    }

    // 5. Prune stale rooms (v2.0)
    console.log('5. Pruning stale rooms...');
    PruneEngine.refreshRooms(this.state.rooms, newRooms, this.state.observationCycles);
    const pruneResult = PruneEngine.prune(this.state);
    if (pruneResult.pruned.length > 0) {
      console.log(`   Pruned ${pruneResult.pruned.length} stale rooms`);
      this.state.rooms = pruneResult.kept;
      this.state.artifacts.push(...pruneResult.fragments);
    } else {
      console.log('   No rooms to prune');
    }

    // 6. Add new rooms + commentary
    console.log('6. Generating commentary...');
    CommentaryGenerator.annotateRooms(newRooms);
    this.state.rooms.push(...newRooms);

    // 7. Entity wandering
    this.entityTracker.wander(this.state.rooms);
    this.state.entities = this.entityTracker.toArray();
    const entitySummary = this.entityTracker.summary();
    console.log(`   Entities: ${entitySummary.total} (${entitySummary.people} people, ${entitySummary.concepts} concepts)`);

    // 8. Rebuild topology
    console.log('7. Building topology...');
    for (const room of this.state.rooms) {
      room.connections = [];
    }
    const topo = this.topology.buildTopology(this.state.rooms);
    this.state.corridors = topo.corridors;
    this.state.stats = topo.stats;

    // 9. Track events (v2.0)
    console.log('8. Tracking events...');
    const newEvents = EventTracker.detect(this.state, {
      newRooms,
      prunedRooms: pruneResult.pruned,
      pruneEvents: pruneResult.events
    });
    EventTracker.record(this.state, newEvents);
    if (newEvents.length > 0) {
      console.log(`   ${newEvents.length} events recorded`);
    }

    // 10. Update memory (v2.0)
    console.log('9. Updating memory...');
    this.state.observationCycles++;
    MemoryEngine.update(this.state);
    const trends = MemoryEngine.analyzeTrends(this.state);
    if (trends.insights.length > 0) {
      console.log(`   Trends: ${trends.insights.join('; ')}`);
    }

    // 11. Cross-room commentary (v2.0)
    console.log('10. Cross-room commentary...');
    const crossComm = CommentaryGenerator.crossRoomCommentary(this.state, trends);
    console.log(crossComm);

    // 12. Update metadata
    this.state.lastUpdate = Date.now();
    this.state.version = 2;

    console.log(`\nWorld now has ${this.state.rooms.length} rooms, ${this.state.corridors.length} corridors`);
    console.log(`Topics: ${this.state.stats.topics.join(', ')}`);
    console.log(`Avg sentiment: ${this.state.stats.avgSentiment.toFixed(2)}`);

    return this.state;
  }

  /**
   * Get a summary of the current world state (for tweets/logging)
   */
  summary() {
    const s = this.state;
    return {
      rooms: s.rooms.length,
      corridors: s.corridors.length,
      artifacts: s.artifacts.length,
      entities: (s.entities || []).length,
      cycles: s.observationCycles,
      topics: s.stats.topics || [],
      avgSentiment: (s.stats.avgSentiment || 0).toFixed(2),
      events: (s.events || []).length,
      memorySnapshots: (s.memory && s.memory.topicHistory) ? s.memory.topicHistory.length : 0,
      oldestRoom: s.rooms.length > 0
        ? s.rooms.reduce((oldest, r) => (r.entropy && r.entropy.createdAt || Infinity) < (oldest.entropy && oldest.entropy.createdAt || Infinity) ? r : oldest).name
        : null,
      mostDecayed: s.rooms.length > 0
        ? s.rooms.reduce((worst, r) => (r.entropy && r.entropy.score || 0) > (worst.entropy && worst.entropy.score || 0) ? r : worst).name
        : null
    };
  }
}

module.exports = { World };
