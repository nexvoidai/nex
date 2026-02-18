/**
 * Decay System
 * Every room has entropy. Over time, entropy increases.
 * When entropy hits critical, rooms collapse.
 * Fragments persist as artifacts in adjacent spaces.
 */

class DecayEngine {
  /**
   * Update entropy for all rooms based on elapsed time
   * @param {Array} rooms - current rooms
   * @param {number} now - current timestamp (ms)
   * @returns {Object} - { active, decayed, collapsed }
   */
  static tick(rooms, now = Date.now()) {
    const active = [];
    const decayed = [];
    const collapsed = [];

    for (const room of rooms) {
      const elapsed = (now - room.entropy.createdAt) / 1000; // seconds
      const decay = 1 - Math.exp(-0.693 * elapsed / room.entropy.halfLife);
      room.entropy.score = Math.min(1, decay);

      if (room.entropy.score >= 1) {
        collapsed.push(room);
      } else if (room.entropy.score >= 0.7) {
        decayed.push(room);
      } else {
        active.push(room);
      }
    }

    return { active, decayed, collapsed };
  }

  /**
   * Apply decay effects to rooms
   * - Scramble wall fragments as entropy increases
   * - Dim lights
   * - Warp dimensions
   */
  static applyEffects(rooms) {
    for (const room of rooms) {
      const e = room.entropy.score;

      // Scramble fragments based on entropy
      if (e > 0.3 && room.fragments) {
        room.fragments.sentences = room.fragments.sentences.map(s =>
          DecayEngine.scrambleText(s, e)
        );
      }

      // Dim light color
      if (e > 0.5) {
        room.archetype.lightColor = DecayEngine.dimColor(room.archetype.lightColor, e);
      }

      // Warp dimensions
      if (e > 0.6) {
        const warp = 1 + (Math.random() - 0.5) * e * 0.4;
        room.dimensions.width *= warp;
        room.dimensions.height *= (2 - warp);
      }
    }
  }

  /**
   * Scramble text based on entropy level
   * Low entropy = minor typos, high entropy = mostly garbled
   */
  static scrambleText(text, entropy) {
    if (entropy < 0.3) return text;

    const chars = text.split('');
    const scrambleChance = entropy * 0.6;
    const glitchChars = '█▓▒░╔╗╚╝║═┼├┤┬┴┌┐└┘─│';

    return chars.map(c => {
      if (c === ' ') return c;
      if (Math.random() < scrambleChance) {
        return glitchChars[Math.floor(Math.random() * glitchChars.length)];
      }
      return c;
    }).join('');
  }

  /**
   * Dim a hex color by entropy factor
   */
  static dimColor(hex, entropy) {
    const factor = Math.max(0.1, 1 - entropy * 0.8);
    const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
    const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
    const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Harvest fragments from a collapsing room
   * Returns artifacts that get embedded into adjacent rooms
   */
  static harvestFragments(room) {
    return {
      sourceRoom: room.id,
      sourceTopic: room.topic,
      fragments: room.fragments.words.slice(0, 3),
      sentiment: room.sentiment,
      collapsedAt: Date.now()
    };
  }
}

module.exports = { DecayEngine };
