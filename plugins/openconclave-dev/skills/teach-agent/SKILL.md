---
description: "Teach an OpenConclave agent a lesson from a past mistake by recording the lesson in a knowledge base and rewiring the agent's system prompt to consult the KB before acting. Use when the user says: 'teach this agent', 'add this to the knowledge book', 'save this as supervised learning', 'remember this mistake', 'don't let the agent do this again', 'oc supervised learning', or describes a mistake an agent made and wants it recorded for future runs."
argument-hint: "Describe the mistake, which agent made it, and why it was wrong"
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - mcp__plugin_openconclave-dev_openconclave-dev__list_workflows
  - mcp__plugin_openconclave-dev_openconclave-dev__get_workflow
  - mcp__plugin_openconclave-dev_openconclave-dev__update_workflow
---

# Teach an OpenConclave Agent (Supervised Learning)

You are closing the loop on an OpenConclave supervised-learning incident. An agent in a workflow made a mistake, the user caught it, and now wants the lesson captured so future runs of that agent (and similar ones) do not repeat it.

Your job has two outputs that must always ship together:

1. A knowledge-base document that records the lesson in a way future agents can retrieve.
2. An update to the offending agent's system prompt that forces it to query the knowledge base before doing the kind of work where the mistake occurred.

Never do one without the other. A lesson nobody reads is dead text; an instruction to "check the book" when the book has nothing in it is busywork.

## Inputs you need

Before writing anything, establish:

- **What the mistake was.** Concrete facts: file paths, function names, what the agent produced, what it should have produced. Ask the user if any of this is unclear.
- **Which agent produced it.** Workflow id + node id + agent label. Use `list_workflows` and `get_workflow` to find it if the user only gives you the workflow name.
- **Which knowledge base the agent reads from.** Inspect the agent's node config — look at `config.tools` for a `toolType: "knowledge"` entry, that is the KB id. If there isn't one, the agent has no KB attached and you will need to attach one before teaching works (surface this to the user before proceeding).
- **When the lesson should apply.** Be specific about the trigger. "Before writing any test" is a good trigger. "When reviewing code" is too broad.

## Writing the knowledge document

A good lesson is neither a one-liner platitude nor a tome. Aim for roughly one screen of markdown with this structure:

```markdown
---
tags: <comma-separated tags — mix general testing/coding terms AND the specific symbols involved>
when-to-consult: <one sentence explaining the exact trigger>
---

# <Short, declarative title — the rule itself, not the domain>

Keywords for retrieval: <another pass of retrieval vocabulary including every specific function name, file name, and type name from the incident — this is what lets bug-specific queries pull up the lesson>

## The anti-pattern
<What the mistake looks like in practice. Use concrete language.>

## Warning signs
<Bullet list of how to spot it in the output — things like "test file declares the same interface as the source file">

## What to do instead
<The correct approach, numbered. Include the *easy* correct path AND the escape hatch if the easy path is blocked.>

## Why it matters
<Two or three sentences on the concrete damage the anti-pattern causes. This is what stops agents from shrugging and doing it anyway.>

## Known incident
<Date, workflow, files touched, what was produced, what should have been produced. Be specific — this is what makes bug-specific queries pull the lesson.>
```

**Tag discipline:** the single biggest failure mode of lessons in this KB is poor retrieval. An agent facing a new bug will search with the vocabulary of that bug, not the vocabulary of the lesson. Your tags must cover:

- Generic topical terms ("testing", "code-review", "error-handling", "type-safety")
- Generic anti-pattern terms ("inline-copy", "swallow-error", "magic-string")
- The specific symbols from the known incident (function names, file names, type names)
- The artifact type ("red-test", "regression-test", "vitest", "system-prompt")

Also sprinkle those terms naturally into the body — semantic search rewards content matches, not just frontmatter.

Don't write a lesson that only applies to one file in the codebase. Generalize the rule, but ground it with the specific incident. If you can only think of one example, the lesson is probably too narrow; step back and ask what the underlying principle is.

## Ingesting the document

The openconclave-dev MCP does not expose knowledge tools, so use the HTTP API via Bash.

Find the API URL — usually `http://localhost:4000`. Confirm by running `curl -s http://localhost:4000/api/knowledge` and checking that it returns a JSON list of knowledge bases.

To ingest, write the markdown to a JSON payload and POST it:

```bash
# 1. Write the lesson to a temp markdown file, then build the JSON payload.
#    Use jq or a bun one-liner to build the JSON so you don't have to escape quotes by hand.
cat > /tmp/lesson.md <<'MD'
---
tags: ...
---
# Lesson title
...
MD

bun -e 'const text = await Bun.file("/tmp/lesson.md").text(); await Bun.write("/tmp/lesson.json", JSON.stringify({ filename: "my-lesson.md", text }));'

# 2. POST to the target knowledge base.
curl -s -X POST http://localhost:4000/api/knowledge/<kb-id>/ingest \
  -H "Content-Type: application/json" \
  -d @/tmp/lesson.json
```

The response returns the new `documentId`. Remember it in case you need to replace the document later.

If you are updating an existing lesson rather than adding a new one, delete the old document first so you don't accumulate duplicates:

```bash
curl -s -X DELETE http://localhost:4000/api/knowledge/<kb-id>/documents/<doc-id>
```

## Verifying retrieval before you finish

Do not ship a lesson without confirming it is discoverable. Run at least three searches against the KB and check the lesson appears near the top for each:

1. A generic topical query ("testing lesson", "error handling", "code review")
2. The name of the specific symbol from the incident ("filterDiscussionOutput", "isDiscussionOutput test")
3. A query phrased the way a bug-facing agent would search ("RED test node executor", "regression test vitest")

Use the search endpoint:

```bash
curl -s -X POST http://localhost:4000/api/knowledge/<kb-id>/search \
  -H "Content-Type: application/json" \
  -d '{"query":"<query>","topK":3}'
```

If the lesson does not appear in at least two of the three queries (score above ~0.5, filename matches your lesson), go back and add more keywords to the frontmatter `tags` line and the "Keywords for retrieval" line. Re-ingest and re-verify. Do not skip this step — a lesson with bad retrieval is invisible.

## Updating the agent's system prompt

Fetch the workflow via `get_workflow`, find the target agent node by label or id, and produce a new system prompt that:

1. **Keeps the agent's core role.** Don't rewrite the whole prompt.
2. **Adds a MANDATORY section at or near the top** titled something like "Search the Dev Book BEFORE <trigger action>". Use the word MANDATORY, all caps. Agents respect emphasis.
3. **Tells the agent exactly what to search for.** Give at least two concrete query suggestions: one topical ("testing lesson", "error handling") and one that uses the vocabulary of whatever work is in front of it (the bug's file name, symbol name, or domain terms).
4. **Makes it clear that a found lesson wins.** If the KB contradicts the agent's first instinct, the KB is right. Agents trained to be helpful will otherwise ignore the lesson and do what they were about to do anyway.
5. **Reinforces the rule with an explicit constraint in the Rules section.** Not just "search first", but also something like "Tests must import from the real source module. Never inline copies." Abstract guidance plus concrete constraint.

Example shape to insert:

```
## MANDATORY: Search the Dev Book BEFORE <trigger action>

Before you <do the thing>, call search_knowledge against the <KB name> with queries relevant to the task at hand. At minimum, run these searches and read every hit:

- "<topical query>"
- "<anti-pattern query>"
- <specific terms from the current task — file names, symbol names, domain words>

Apply what the Dev Book says. The knowledge base contains lessons from past reviews where agents made mistakes. If a lesson contradicts your first instinct, the lesson wins — it was put there because the first instinct was wrong.

If no relevant lesson exists, proceed. But you must search first.
```

After constructing the new prompt, call `update_workflow` with the full updated nodes and edges arrays (the update endpoint takes the complete workflow body). Do not try to PATCH just the one node — the API expects a full replace. Preserve every other field of the agent's config exactly.

## Verifying the rewiring

Do not declare victory until you have confirmed both halves landed:

1. Call `get_workflow` again and diff the agent's `systemPrompt` against what you sent. It should match byte-for-byte.
2. Query the KB one more time with the topical query and confirm the lesson still surfaces.
3. Summarize for the user: which KB doc id was created, which agent was updated, and what specific queries will pull the lesson up during a future run.

If the user wants, they can trigger the workflow again on the same input to watch whether the agent actually consults the book this time. That is the real test, but you do not need to run it unless asked.

## Non-goals

- **Do not fix the underlying code** the agent originally screwed up. That is a separate concern; this skill is only about teaching the agent not to repeat the mistake.
- **Do not update multiple agents** unless the user explicitly asks. The lesson may apply to other roles, but the user chooses the scope.
- **Do not invent a new knowledge base.** Use the one the agent already reads from. If there isn't one, stop and tell the user.
- **Do not generalize the lesson across domains** (e.g., turning "don't inline test helpers" into "always import dependencies"). A lesson that tries to apply everywhere applies nowhere.

## Failure modes to watch

- **Duplicate lessons.** Before ingesting a new doc, search the KB for existing lessons on the same topic. If one exists, delete it and re-ingest the merged version rather than adding a parallel doc.
- **Lesson only triggers on its own tags.** Verify retrieval with queries that use the bug's vocabulary, not the lesson's vocabulary. If the lesson only appears when you search for its own title, it will never trigger in production.
- **System prompt grows unboundedly.** Each new lesson should not add a new section to every agent's prompt. Group related instructions. If the prompt is getting long, consider whether the new lesson belongs inline or should be referenced indirectly via the KB search step.
- **Agent doesn't have the KB attached.** Check the agent's `config.tools` for `toolType: "knowledge"`. If missing, telling the agent to "search the Dev Book" does nothing — it has no `search_knowledge` tool. Surface this to the user before continuing.
