---
name: llm-council
description: Ask a "council" of several LLMs (GPT, Gemini, Claude, Grok, etc. via OpenRouter) the same question, have them anonymously peer-review and rank each other's answers, then have a chairman model synthesize a final answer. Use when the user asks to "ask the council", wants multiple models' opinions, a cross-model second opinion, or a side-by-side model comparison on a question.
---

# LLM Council

A 3-stage multi-model deliberation, after Andrej Karpathy's
[llm-council](https://github.com/karpathy/llm-council):

1. **First opinions** – each council model answers the question independently.
2. **Peer review** – each model sees the others' answers, anonymized as
   "Response A/B/C…", critiques them, and ends with a `FINAL RANKING:` list.
   Rankings are averaged into an aggregate leaderboard.
3. **Chairman** – one model reads all answers and reviews and writes the final answer.

## Requirements

- `OPENROUTER_API_KEY` in the environment (https://openrouter.ai/keys, with credits).
  If it is missing, tell the user how to set it; never ask them to paste the key into chat.
- Python 3.8+. No third-party packages.

## Running it

```bash
python3 scripts/council.py "What are the trade-offs between Raft and Paxos?" > council.md
```

Paths are relative to this skill's directory. For long or multi-line questions,
write the question to a file and pass `--file question.md`. A council run makes
2N+1 model calls (N = council size) and can take a few minutes, so give the
command a long timeout (e.g. 600000 ms) or run it in the background.

Options:

| Flag / env var | Purpose |
|---|---|
| `--models a,b,c` / `LLM_COUNCIL_MODELS` | OpenRouter model ids for the council (default: `openai/gpt-5.1, google/gemini-3-pro-preview, anthropic/claude-sonnet-4.5, x-ai/grok-4`) |
| `--chairman m` / `LLM_COUNCIL_CHAIRMAN` | Model that writes the final answer (default `google/gemini-3-pro-preview`) |
| `--json` | Emit the full structured result instead of Markdown |
| `--timeout s` | Per-request timeout in seconds (default 180) |

If the user names models, pass them with `--models`. If a default model id is
rejected (OpenRouter renames models), check https://openrouter.ai/models and
override it.

## Presenting results

The Markdown output contains the final answer, the aggregate ranking table, every
individual answer and every review. Show the user the **final answer** and the
**ranking table**, mention notable disagreements between members, and point to the
saved file for the full transcript rather than pasting everything. Report any
entries in the Errors section (failed models are skipped, not fatal). The script
exits non-zero if no final answer was produced.

## Full web UI

Karpathy's original project is a local ChatGPT-style web app (FastAPI + React)
showing each stage in tabs. If the user wants that instead, have them run it
from upstream:

```bash
git clone https://github.com/karpathy/llm-council && cd llm-council
uv sync && (cd frontend && npm install)
echo "OPENROUTER_API_KEY=sk-or-v1-..." > .env
./start.sh   # then open http://localhost:5173
```
