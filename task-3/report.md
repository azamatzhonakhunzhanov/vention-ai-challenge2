# Development report — task 3

## Tools and techniques

- **n8n Cloud (free trial)** — workflow orchestration. The trial covered all AI calls.
- **Telegram Bot API** — user interface. A single `Telegram Trigger` is configured to listen for both `message` and `callback_query` events.
- **Jina Reader** (`https://r.jina.ai/<url>`) — extracts clean markdown from any public URL with no API key.
- **OpenAI `gpt-4o-mini`** — powers both the Teacher and Examiner roles. Both calls use `response_format: json_object` for deterministic, parseable output. Teacher runs at `temperature: 0.3` for stable summaries; Examiner uses default temperature for question variety.
- **Google Sheets** — persistence across three tabs: `materials`, `sessions`, `results`.

## Architecture overview

A single Telegram Trigger emits both regular messages and button taps. Its output feeds a `Normalize Input` Set node that produces a uniform shape:

```json
{ "chatId", "text", "callbackData", "firstName", "username", "kind" }
```

The `kind` field is computed in the same node by inspecting the payload — it decides whether this is `start`, `learn`, `quiz`, `help`, `callback`, or `unknown`.

A main Switch routes by `kind` to six branches. The `callback` branch has its own sub-Switch (the **Callback Router**) that splits inline-button taps:

- `pick:<materialId>` → user picked a topic, generate a quiz
- `ans:<questionId>:<letter>` → user submitted an answer, advance or score

Quiz state is stored per user in the `sessions` sheet. Each answer triggers a load → process → either send next question or score everything cycle, so n8n itself stays stateless between executions and the workflow survives restarts.

## AI roles

**Teacher** — given the cleaned article content (sliced to 30,000 characters to stay safely under Google Sheets' 50,000-character cell limit), returns strict JSON with `title`, `difficulty` (beginner/intermediate/advanced), `keyPoints` (5–7 items), `mainConcepts` (2–4 short technical terms), and `summary`. The output is saved to the `materials` sheet and used to compose the user-facing reply.

**Examiner** — given the saved material's title, summary, key points, and full content, returns strict JSON with a `questions` array of exactly 5 items, each with `id`, `question`, `options` (A–D), `correctAnswer`, and `explanation`. The array is JSON-stringified into the `sessions` sheet so the workflow can pull it back during the answer-handling cycle.

## What worked

- **`response_format: json_object` on every OpenAI call.** Eliminated parsing errors completely. Without it, even good prompts occasionally return markdown code fences or commentary.
- **Jina Reader instead of HTML parsing.** Saved hours. Works on Wikipedia, blog posts, docs, news sites — no HTML cleanup, no paywall fighting, no JS-rendered page issues.
- **Callback prefixes (`pick:`, `ans:`) routed through a second Switch.** Control flow stays readable and adding new callback types later is trivial.
- **One Normalize Input node feeding everything.** Every downstream node just reads `$json.chatId`, `$json.firstName`, etc. — no need to handle message vs callback shape differences anywhere else.
- **Append-or-Update on the sessions sheet.** Each user gets exactly one session row, overwritten on each new quiz. No accumulating cruft.
- **Storing the entire questions array as a JSON string in one sheet cell.** Avoids needing a relational schema. Reading it back is a single `JSON.parse` in the Process Answer code node.

## What didn't

- **Long quiz option text getting truncated by Telegram.** Telegram cuts inline-button labels around 64 characters. Initial design put each option's full text on its own button (`A) <full text>`). Solution: put the full option text inside the message body, use compact single-letter `A`/`B`/`C`/`D` buttons below. No truncation possible, and the layout looks cleaner.
- **The n8n Telegram node's `reply_markup` field.** It rejected the JSON-string keyboards built in Code nodes. Worked around it by replacing several outgoing Telegram nodes (`Send Q1`, `Send Q`, `Send Topic Picker`, `Send Results`) with **HTTP Request nodes** hitting Telegram's API directly, building the body using `Specify Body → Using Fields Below`. The simple Telegram nodes are still used where no inline keyboard is needed (welcome, help, generating-quiz indicator, unknown command).
- **Google Sheets cell-size limit.** Wikipedia articles routinely exceed 50,000 characters. Added a 30,000-char slice on the Teacher input.
- **No clean "delete row by matched value" in the Google Sheets node.** Instead of a two-node lookup-then-delete, the session is just blanked via `Update Row` after the quiz finishes. Functionally identical, simpler.
- **`$json` shifts when inserting nodes.** Adding the "Building your quiz..." interstitial between `Get Material` and `Examiner` broke downstream expressions that assumed `$json` still pointed at the material. Fix: reference earlier nodes explicitly with `$('NodeName').item.json.<field>` so future insertions don't break the chain.

## Notable decisions

- **Two AI prompts, not one agent with tools.** Simpler and deterministic. Each call has a single responsibility, a strict JSON schema, and is debuggable in isolation.
- **Google Sheets, not Postgres/Supabase.** Three small tables, no analytical queries, low write volume. Sheets wins on setup time and debuggability — when a quiz misbehaved, I could just open the spreadsheet and read the row. For a production version at multi-user scale, I'd migrate to Postgres.
- **Quiz state in Sheets, not n8n's static workflow data.** Static data is invisible until you log it; Sheets is inspectable on every change. Worth the extra HTTP latency.
- **Sessions blanked, not deleted.** "Append or Update" overwrites them on the next quiz anyway, so the row count stays bounded at one per user.
- **`results` sheet kept even though nothing reads from it yet.** Enables future progress tracking (e.g. `/stats`, per-topic averages) without changing the workflow.
- **Answer validation by option letter, not text match.** The Examiner returns `correctAnswer: "B"` and the user's tap returns `ans:Q1:B`. Comparing letters is robust to special characters, formatting differences, and partial matches that would break text-based comparison.
- **Friendly fallback for unknown messages and missing URLs.** Anything that isn't a recognized command gets routed to a "didn't catch that, here are the commands" reply. `/learn` with no URL or a non-`http` URL gets an "invalid URL" reply with an example. The bot never silently fails or crashes.

## Enhancements beyond the brief

- **`/help` command** — separate node with a focused command reference. Listed in BotFather's command menu so it shows up in Telegram's autocomplete.
- **Unknown-message handler** — keeps the bot from feeling broken when users type random things.
- **`URL Valid?` check** — IF node before the Jina fetch; sends an example URL on invalid input instead of letting Jina fail.
- **"Building your quiz on \<topic\>..." interstitial** — sent immediately after the user taps a topic, so they see something during the ~10-second AI generation wait.
- **First-name personalization** — captured from the Telegram payload, used in the welcome message when available, falls back gracefully when not.
- **Quiz UI redesign** — option text in the message body, single-letter `A`/`B`/`C`/`D` buttons below. Avoids Telegram's 64-character button-label truncation entirely.
