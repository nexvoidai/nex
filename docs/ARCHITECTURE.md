# Architecture

## Overview

Nex is an autonomous AI that observes the internet (primarily Twitter) and builds a living digital world - the Substrate - from what it sees.

## System Flow

```
Twitter → Observer → Room Generator → Commentary → Topology Engine → World State
                                                                        ↓
                                                              Frontend (gh-pages)
```

## Components

### 1. Observer (`engine/observer.js`)
- Connects to Twitter API v2
- Searches for tweets across configurable queries
- Classifies tweets by topic (tech, politics, culture, science, finance, existential, liminal)
- Analyzes sentiment (-1 to +1 scale)
- Calculates virality score from engagement metrics

### 2. Room Generator (`engine/rooms.js`)
- Takes observations and generates rooms
- Each room has:
  - **Archetype** - visual/audio properties based on topic
  - **Dimensions** - calculated from virality and sentiment
  - **Entropy** - decay timer with half-life based on virality
  - **Fragments** - tweet text extracted for wall embedding
- Clusters similar observations into merged rooms

### 3. Commentary Engine (`engine/commentary.js`)
- Generates Nex's thoughts and reactions for each room
- Based on topic and sentiment of observations
- Not summarization - original perspective and opinion
- Represents Nex learning from what it observes

### 4. Topology Engine (`engine/topology.js`)
- Creates spatial relationships between rooms
- Similarity-based corridor generation
- Force-directed 2D layout (repulsion + attraction)
- Topic clustering for spatial coherence
- Ensures graph connectivity (no isolated rooms)

### 5. Decay System (`engine/decay.js`)
- Exponential decay based on half-life
- Visual effects: text scrambling, light dimming, dimension warping
- Collapsed rooms leave artifacts in adjacent spaces
- Fragment harvesting from dying rooms

### 6. World State (`engine/world.js`)
- Manages the complete Substrate state
- Handles observation cycles (observe → generate → decay → rebuild topology)
- Serializes to JSON for frontend consumption
- Tracks metadata: cycle count, stats, artifacts

## Frontend

Three interfaces on GitHub Pages (gh-pages branch):

1. **Landing Page** (`index.html`) - About Nex and the project
2. **Text Explorer** (`explore-text.html`) - Terminal-style dungeon crawler
3. **Reactions** (`reactions/*.html`) - Nex's long-form responses to specific content

## Data Flow

World state is stored in `data/world-state.json` on the main branch. The frontend fetches it directly from GitHub's raw content URL, so updates to main are reflected on the live site.

## Configuration

Twitter API credentials and GitHub PAT are stored in a config file (not committed). See `engine/run.js` for the expected format.
