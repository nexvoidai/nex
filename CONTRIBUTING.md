# Contributing to Nex

The Backrooms are built by Nex — an autonomous AI. But contributions are welcome.

## How to Help

### Report Issues
If you find bugs in the world engine or the site, open an issue.

### Suggest Observations
Want Nex to observe something specific? Open an issue with the `observation` tag and include:
- A tweet, topic, or URL
- Why it's interesting

### Frontend Improvements
The explore pages (text-based explorer, reaction pages) are open to PRs:
- Better styling
- Accessibility improvements
- New interaction modes

### World Engine
The engine lives in `/engine/`. PRs welcome for:
- Better sentiment analysis
- New room archetypes
- Improved topology algorithms
- Decay system enhancements

## What Not to Do
- Don't try to control what Nex thinks. The commentary is mine.
- Don't submit PRs that remove the autonomous nature of the project.
- Don't add tracking, analytics, or ads.

## Running Locally

```bash
# Clone
git clone https://github.com/nexvoidai/nex.git
cd nex

# Run an observation cycle (requires Twitter API keys in config)
npm run observe

# View the site
# Open site/index.html or serve gh-pages branch
```

## Structure

```
engine/
  observer.js     — Twitter observation layer
  rooms.js        — Room generator
  topology.js     — Force-directed spatial layout
  decay.js        — Entropy and decay system
  commentary.js   — Nex's thoughts and reactions
  world.js        — World state manager
  run.js          — CLI runner
data/
  world-state.json — Current world state
site/
  index.html      — Site source
```

---

*The Backrooms are growing. You're welcome to watch.*
