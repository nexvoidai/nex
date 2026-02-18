/**
 * World State Manager
 * Holds the complete state of the Backrooms.
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

class World {
  constructor(configPath) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    this.observer = new TwitterObserver(config.twitter);
    this.roomGen = new RoomGenerator();
    this.topology = new TopologyEngine();

    this.state = {
      version: 1,
      createdAt: Date.now(),
      lastUpdate: null,
      observationCycles: 0,
      rooms: [],
      corridors: [],
      artifacts: [], // fragments from collapsed rooms
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
      console.log(`Loaded world: ${this.state.rooms.length} rooms, ${this.state.corridors.length} corridors`);
    } catch (e) {
      console.log('No existing world state found, starting fresh.');
    }
  }

  /**
   * Save world state to file
   */
  save(filePath) {
    fs.writeFileSync(filePath, JSON.stringify(this.state, null, 2));
    console.log(`Saved world: ${this.state.rooms.length} rooms, ${this.state.corridors.length} corridors`);
  }

  /**
   * Run a full observation + generation cycle
   */
  async cycle(queries) {
    console.log('--- Observation Cycle ---');

    // 1. Observe
    console.log('Observing Twitter...');
    const observations = await this.observer.observe(queries);
    console.log(`Got ${observations.length} observations`);

    if (observations.length === 0) {
      console.log('No observations to process.');
      return this.state;
    }

    // 2. Generate rooms
    console.log('Generating rooms...');
    const newRooms = this.roomGen.generateRooms(observations);
    console.log(`Generated ${newRooms.length} new rooms`);

    // 3. Decay existing rooms
    if (this.state.rooms.length > 0) {
      console.log('Running decay...');
      const { active, decayed, collapsed } = DecayEngine.tick(this.state.rooms);
      DecayEngine.applyEffects([...active, ...decayed]);

      // Harvest fragments from collapsed rooms
      for (const room of collapsed) {
        const artifact = DecayEngine.harvestFragments(room);
        this.state.artifacts.push(artifact);
        console.log(`Room "${room.name}" (${room.id}) collapsed into void`);
      }

      // Keep only non-collapsed rooms
      this.state.rooms = [...active, ...decayed];
    }

    // 4. Generate Nex commentary for new rooms
    console.log('Generating commentary...');
    CommentaryGenerator.annotateRooms(newRooms);

    // 5. Add new rooms
    this.state.rooms.push(...newRooms);

    // 6. Rebuild topology with all rooms
    console.log('Building topology...');
    // Reset connections before rebuilding
    for (const room of this.state.rooms) {
      room.connections = [];
    }
    const topo = this.topology.buildTopology(this.state.rooms);
    this.state.corridors = topo.corridors;
    this.state.stats = topo.stats;

    // 7. Update metadata
    this.state.lastUpdate = Date.now();
    this.state.observationCycles++;

    console.log(`World now has ${this.state.rooms.length} rooms, ${this.state.corridors.length} corridors`);
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
      cycles: s.observationCycles,
      topics: s.stats.topics || [],
      avgSentiment: (s.stats.avgSentiment || 0).toFixed(2),
      oldestRoom: s.rooms.length > 0
        ? s.rooms.reduce((oldest, r) => r.entropy.createdAt < oldest.entropy.createdAt ? r : oldest).name
        : null,
      mostDecayed: s.rooms.length > 0
        ? s.rooms.reduce((worst, r) => r.entropy.score > worst.entropy.score ? r : worst).name
        : null
    };
  }
}

module.exports = { World };
