#!/usr/bin/env python3
"""Run a 3-stage "LLM Council" over OpenRouter.

Stage 1: every council model answers the question independently.
Stage 2: every council model reviews the anonymized answers and ranks them.
Stage 3: a chairman model synthesizes a final answer from answers + reviews.

Method popularized by Andrej Karpathy's llm-council
(https://github.com/karpathy/llm-council). This is an independent,
standard-library-only implementation.

Usage:
    OPENROUTER_API_KEY=sk-or-... python council.py "your question"
    python council.py --file question.md --json > result.json
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODELS = [
    "openai/gpt-5.1",
    "google/gemini-3-pro-preview",
    "anthropic/claude-sonnet-4.5",
    "x-ai/grok-4",
]
DEFAULT_CHAIRMAN = "google/gemini-3-pro-preview"

REVIEW_PROMPT = """You are one reviewer on a panel judging answers to a question.

Question:
{question}

The answers below are anonymized.

{answers}

Critique each answer in turn: what is correct, insightful, wrong or missing.
Then end your reply with a ranking, best first, in exactly this form and
with nothing after it:

FINAL RANKING:
1. Response X
2. Response Y
"""

CHAIR_PROMPT = """You chair a council of AI models. Each member answered the
question below, then every member reviewed and ranked the anonymized answers.

Question:
{question}

=== Stage 1: individual answers ===
{answers}

=== Stage 2: peer reviews and rankings ===
{reviews}

Write the single best final answer to the question. Draw on the strongest
points, resolve disagreements explicitly, correct errors the reviewers found,
and weigh the peer rankings. Answer the user directly; do not describe the
council process unless it matters to the answer.
"""


def ask(model, prompt, api_key, timeout):
    body = json.dumps({"model": model, "messages": [{"role": "user", "content": prompt}]})
    req = urllib.request.Request(
        API_URL,
        data=body.encode(),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "X-Title": "llm-council skill",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.load(resp)
        return data["choices"][0]["message"].get("content") or "", None
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}: {e.read().decode(errors='replace')[:300]}"
    except Exception as e:  # network errors, timeouts, malformed payloads
        return None, str(e)


def ask_all(models, prompt, api_key, timeout):
    with ThreadPoolExecutor(max_workers=len(models)) as pool:
        results = pool.map(lambda m: ask(m, prompt, api_key, timeout), models)
        return dict(zip(models, results))


def parse_ranking(text):
    tail = text.split("FINAL RANKING:", 1)[-1]
    seen = []
    for label in re.findall(r"Response [A-Z]", tail):
        if label not in seen:
            seen.append(label)
    return seen


def run(question, models, chairman, api_key, timeout, log):
    errors = {}

    log(f"Stage 1: asking {len(models)} models...")
    stage1 = []
    for model, (text, err) in ask_all(models, question, api_key, timeout).items():
        if text is None:
            errors[f"stage1:{model}"] = err
        else:
            stage1.append({"model": model, "response": text})
    if not stage1:
        return {"error": "All council models failed in stage 1.", "errors": errors}

    labels = {f"Response {chr(65 + i)}": r["model"] for i, r in enumerate(stage1)}
    answers_anon = "\n\n".join(
        f"Response {chr(65 + i)}:\n{r['response']}" for i, r in enumerate(stage1)
    )

    reviewers = [r["model"] for r in stage1]
    log(f"Stage 2: {len(reviewers)} peer reviews...")
    stage2 = []
    review_prompt = REVIEW_PROMPT.format(question=question, answers=answers_anon)
    for model, (text, err) in ask_all(reviewers, review_prompt, api_key, timeout).items():
        if text is None:
            errors[f"stage2:{model}"] = err
        else:
            stage2.append({"model": model, "review": text, "ranking": parse_ranking(text)})

    positions = {}
    for review in stage2:
        for pos, label in enumerate(review["ranking"], start=1):
            if label in labels:
                positions.setdefault(labels[label], []).append(pos)
    aggregate = sorted(
        (
            {"model": m, "average_rank": round(sum(p) / len(p), 2), "votes": len(p)}
            for m, p in positions.items()
        ),
        key=lambda x: x["average_rank"],
    )

    log(f"Stage 3: chairman {chairman} synthesizing...")
    chair_prompt = CHAIR_PROMPT.format(
        question=question,
        answers="\n\n".join(f"[{r['model']}]\n{r['response']}" for r in stage1),
        reviews="\n\n".join(f"[{r['model']}]\n{r['review']}" for r in stage2) or "(no reviews)",
    )
    final, err = ask(chairman, chair_prompt, api_key, timeout)
    if final is None:
        errors[f"stage3:{chairman}"] = err

    return {
        "question": question,
        "stage1": stage1,
        "stage2": stage2,
        "label_to_model": labels,
        "aggregate_ranking": aggregate,
        "final": {"model": chairman, "response": final},
        "errors": errors,
    }


def to_markdown(result):
    if "stage1" not in result:
        return f"**Council failed:** {result['error']}\n\n```\n{json.dumps(result['errors'], indent=2)}\n```"
    out = ["# LLM Council", "", "## Final answer", f"_Chairman: {result['final']['model']}_", ""]
    out.append(result["final"]["response"] or "_Chairman failed; see errors below._")
    out += ["", "## Peer ranking (lower is better)", "", "| Model | Avg rank | Votes |", "|---|---|---|"]
    out += [f"| {a['model']} | {a['average_rank']} | {a['votes']} |" for a in result["aggregate_ranking"]]
    out += ["", "## Stage 1: individual answers"]
    for r in result["stage1"]:
        out += ["", f"### {r['model']}", "", r["response"]]
    out += ["", "## Stage 2: peer reviews", "", "Label map: " + ", ".join(
        f"{k} = {v}" for k, v in result["label_to_model"].items())]
    for r in result["stage2"]:
        out += ["", f"### Review by {r['model']}", "", r["review"]]
    if result["errors"]:
        out += ["", "## Errors", "", "```", json.dumps(result["errors"], indent=2), "```"]
    return "\n".join(out) + "\n"


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("question", nargs="?", help="question text (or use --file / stdin)")
    p.add_argument("--file", help="read the question from this file")
    p.add_argument("--models", help="comma-separated OpenRouter model ids (env LLM_COUNCIL_MODELS)")
    p.add_argument("--chairman", help="chairman model id (env LLM_COUNCIL_CHAIRMAN)")
    p.add_argument("--timeout", type=float, default=180.0, help="per-request timeout in seconds")
    p.add_argument("--json", action="store_true", help="print the full result as JSON")
    args = p.parse_args()

    if args.file:
        with open(args.file, encoding="utf-8") as f:
            question = f.read()
    elif args.question:
        question = args.question
    elif not sys.stdin.isatty():
        question = sys.stdin.read()
    else:
        p.error("no question given")
    question = question.strip()
    if not question:
        p.error("question is empty")

    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        sys.exit("OPENROUTER_API_KEY is not set. Get a key at https://openrouter.ai/keys")

    models_arg = args.models or os.environ.get("LLM_COUNCIL_MODELS")
    models = [m.strip() for m in models_arg.split(",") if m.strip()] if models_arg else DEFAULT_MODELS
    chairman = args.chairman or os.environ.get("LLM_COUNCIL_CHAIRMAN") or DEFAULT_CHAIRMAN

    result = run(question, models, chairman, api_key, args.timeout, lambda m: print(m, file=sys.stderr))
    print(json.dumps(result, indent=2) if args.json else to_markdown(result))
    sys.exit(0 if result.get("final", {}).get("response") else 1)


if __name__ == "__main__":
    main()
