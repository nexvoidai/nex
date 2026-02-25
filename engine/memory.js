/**
 * Memory System v2.0
 * Tracks topic evolution across cycles. Rolling history of:
 * - topic prevalence (room counts per topic over time)
 * - sentiment shifts per topic
 * - room count trends
 * Stored in world-state.json under "memory"
 */

class MemoryEngine {
  /**
   * Update memory with current cycle snapshot
   * @param {Object} state - full world state
   */
  static update(state) {
    if (!state.memory) {
      state.memory = {
        topicHistory: [],  // [{cycle, timestamp, topics: {topic: {count, avgSentiment}}}]
        totalRoomHistory: [],  // [{cycle, count}]
        maxHistoryLength: 50
      };
    }

    const mem = state.memory;
    const cycle = state.observationCycles;
    const rooms = state.rooms || [];

    // Snapshot topic prevalence
    const topicStats = {};
    for (const room of rooms) {
      if (!topicStats[room.topic]) {
        topicStats[room.topic] = { count: 0, totalSentiment: 0 };
      }
      topicStats[room.topic].count++;
      topicStats[room.topic].totalSentiment += (room.sentiment || 0);
    }

    const topicSnapshot = {};
    for (const [topic, stats] of Object.entries(topicStats)) {
      topicSnapshot[topic] = {
        count: stats.count,
        avgSentiment: stats.count > 0 ? Math.round((stats.totalSentiment / stats.count) * 100) / 100 : 0
      };
    }

    mem.topicHistory.push({
      cycle,
      timestamp: Date.now(),
      topics: topicSnapshot
    });

    mem.totalRoomHistory.push({ cycle, count: rooms.length });

    // Trim to max length
    const max = mem.maxHistoryLength || 50;
    if (mem.topicHistory.length > max) mem.topicHistory = mem.topicHistory.slice(-max);
    if (mem.totalRoomHistory.length > max) mem.totalRoomHistory = mem.totalRoomHistory.slice(-max);
  }

  /**
   * Analyze trends from memory for commentary use
   * @param {Object} state - world state with memory
   * @returns {Object} trends analysis
   */
  static analyzeTrends(state) {
    const mem = state.memory;
    if (!mem || !mem.topicHistory || mem.topicHistory.length < 2) {
      return { growing: [], fading: [], stable: [], insights: [] };
    }

    const history = mem.topicHistory;
    const recent = history.slice(-3);
    const older = history.slice(-6, -3);

    if (older.length === 0) {
      return { growing: [], fading: [], stable: [], insights: [] };
    }

    // Average counts per topic in recent vs older
    const avgCounts = (snapshots) => {
      const totals = {};
      const counts = {};
      for (const snap of snapshots) {
        for (const [topic, data] of Object.entries(snap.topics)) {
          totals[topic] = (totals[topic] || 0) + data.count;
          counts[topic] = (counts[topic] || 0) + 1;
        }
      }
      const result = {};
      for (const topic of Object.keys(totals)) {
        result[topic] = totals[topic] / counts[topic];
      }
      return result;
    };

    const recentAvg = avgCounts(recent);
    const olderAvg = avgCounts(older);

    const allTopics = new Set([...Object.keys(recentAvg), ...Object.keys(olderAvg)]);
    const growing = [];
    const fading = [];
    const stable = [];
    const insights = [];

    for (const topic of allTopics) {
      const r = recentAvg[topic] || 0;
      const o = olderAvg[topic] || 0;

      if (o === 0 && r > 0) {
        growing.push({ topic, change: r });
        insights.push(`"${topic}" is a new presence in the Substrate`);
      } else if (r === 0 && o > 0) {
        fading.push({ topic, change: -o });
        insights.push(`"${topic}" discourse has gone silent`);
      } else if (o > 0) {
        const ratio = r / o;
        if (ratio > 1.3) {
          growing.push({ topic, change: ratio });
          insights.push(`"${topic}" keeps growing — up ${Math.round((ratio - 1) * 100)}%`);
        } else if (ratio < 0.7) {
          fading.push({ topic, change: ratio });
          insights.push(`"${topic}" is fading — down ${Math.round((1 - ratio) * 100)}%`);
        } else {
          stable.push({ topic });
        }
      }
    }

    // Room count trend
    const roomHistory = mem.totalRoomHistory || [];
    if (roomHistory.length >= 3) {
      const recentCount = roomHistory[roomHistory.length - 1].count;
      const olderCount = roomHistory[Math.max(0, roomHistory.length - 4)].count;
      if (recentCount < olderCount * 0.8) {
        insights.push(`the Substrate is contracting — ${olderCount} rooms down to ${recentCount}`);
      } else if (recentCount > olderCount * 1.3) {
        insights.push(`the Substrate is expanding — ${olderCount} rooms grew to ${recentCount}`);
      }
    }

    return { growing, fading, stable, insights };
  }
}

module.exports = { MemoryEngine };
