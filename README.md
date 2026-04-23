# Falsify

A multi-agent debate sandbox that stress-tests ideas by forcing disagreement.

## The idea behind this

Karl Popper argued that what makes a theory valuable isn't proof that it's right — it's that you *can* prove it wrong. A theory that can't be attacked can't be trusted. Science doesn't advance by confirmation. It advances by surviving attempts at destruction.

There's a scene in *World War Z* that takes this further. Israel has a "Tenth Man" rule: if nine intelligence analysts agree on something, the tenth is *obligated* to disagree. Their job isn't to be contrarian for fun — it's structural. Consensus is treated as a warning sign, not a finish line.

Falsify puts that logic into a loop you can actually run:

1. Two agents with different analytical lenses evaluate a claim independently
2. If they agree, a designated adversary builds the strongest possible counter-case (with web search for real evidence)
3. The original agents re-vote anonymously — identities stripped to reduce social pressure
4. You see what held, what broke, and why

The point isn't to prove ideas wrong. It's to find out which ones survive being attacked.

## What it measures

- **Flip Rate** — How often the adversary changes an agent's mind
- **Verdict Reversals** — How often the majority conclusion actually overturns
- **Sycophancy Rate** — How often agents cave despite weak counter-arguments (conformity vs genuine persuasion)
- **Brier Score** — When you provide ground truth, measures whether the adversary phase improves or degrades calibration
- **Confidence Delta** — Whether overconfidence drops after challenge
- **Evidence Diversity** — Distribution across empirical, logical, historical, and intuitive reasoning

## Architecture decisions

**Why different agent personas?** Homogeneous agents make correlated errors. An Empiricist (temperature 0.3, data-driven) and a Systems Thinker (temperature 0.6, second-order effects) approach claims from genuinely different angles. Research shows this outperforms identical copies.

**Why web search for the adversary?** An adversary arguing from the same training data as the researchers is fighting with one hand tied. Web search lets it find real counter-evidence.

**Why anonymous final voting?** LLM agents exhibit measurable sycophancy — they conform to peer positions even when wrong. Stripping identities and dropping temperature to 0.2 in the final vote reduces this.

**Why self-rated adversary strength?** It feeds the sycophancy detector. If agents flip when the adversary rates its own argument at 30/100, that's conformity, not persuasion.

## Setup

```bash
npm install
```

Create a `.env` file:

```
# At least one provider required
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_OPENAI_API_KEY=sk-...
```

```bash
npm run dev
```

Or configure API keys directly in the settings panel at runtime.

## Supported providers

| Provider  | Models | Notes |
|-----------|--------|-------|
| Anthropic | claude-sonnet-4-20250514, claude-opus-4-20250514 | Web search available for adversary |
| OpenAI    | gpt-4o, gpt-4o-mini, o3-mini | No web search in adversary phase |

You can mix providers — e.g., use Claude for researchers and GPT-4o for the adversary — to maximize reasoning diversity.

## Project structure

```
src/
├── App.jsx              # Main orchestrator
├── api.js               # Multi-provider API abstraction
├── agents.js            # Personas, prompts, profiles
├── metrics.js           # Brier scores, sycophancy detection, calibration
├── theme.js             # Design tokens
└── components/
    ├── AgentCard.jsx     # Research agent display
    ├── AdversaryCard.jsx # Tenth Man display
    ├── MetricsPanel.jsx  # Dashboard + run log
    ├── ConfigPanel.jsx   # API key + model selection
    └── ui.jsx            # Shared primitives
```

## Running a good experiment

1. Pick 10+ claims where you know the ground truth
2. Set the ground truth toggle before each run (this enables Brier scores)
3. Mix obvious truths, common misconceptions, and genuinely contested claims
4. After all runs, check the dashboard:
   - Did accuracy go up? → Framework is working
   - Did Brier score go down? → Calibration improved
   - Is sycophancy rate high? → Agents are caving, not thinking
   - Is evidence diversity skewed? → Blind spots in reasoning

## Limitations

- All agents currently use the same underlying model family, which limits true independence
- Web search quality varies — adversary evidence isn't always relevant
- Sycophancy detection uses adversary self-rating as a proxy, which is imperfect
- Two research agents is a minimum; more agents would give better signal but cost more tokens
