# Task 1 – Leaderboard Clone: Report

## Approach

I used **vibe coding** with Claude Code (Anthropic's AI-enhanced CLI) running inside VS Code to build the application entirely through natural-language prompts and iterative refinement—writing no code manually.

## Tools & Techniques

| Layer | Choice | Reason |
|---|---|---|
| Framework | React 19 + Vite | Fast dev server, minimal config, straightforward GitHub Pages deploy |
| Styling | Plain CSS (single `App.css`) | No extra dependencies; the design is flat enough to do cleanly with vanilla CSS |
| Deployment | `gh-pages` npm package + GitHub Actions | One-command deploy from `dist/` to the `gh-pages` branch |
| AI assistant | Claude Code (claude-sonnet-4-6) | In-editor agent that scaffolded, wrote, and debugged all code |

## How I handled data replacement

The original leaderboard contains real employee names, photos, job titles, and internal department codes. To comply with responsible AI usage policies, **no real personal data was fed into the AI tool**. Instead:

- **Names** – replaced with entirely fictional names (e.g., "Alex Mercer", "Sandra Kowalski", "Victoria Laine")
- **Photos** – removed entirely; each person is represented by a coloured circle with their initials, matching the fallback avatar pattern common in enterprise apps
- **Department codes** – invented plausible-looking codes with the same structure as the originals (e.g., `US.T1.D1.G1`) but containing no real org data
- **Job titles** – kept realistic-sounding but generic (Senior Software Engineer, Group Manager, Lead QA Engineer, etc.)
- **Activity names** – written to match the original format prefixes (`[REG]`, `[LAB]`, `[UNI]`) with invented topic names
- **Dates & points** – generated to cover 2024–2025 across all quarters so all filters produce meaningful results

## Key features implemented

- **Podium** (top 3) with gold/silver/bronze styling, coloured avatar initials, rank badges, and per-person point totals
- **Ranked list** with per-row activity-type icon counts (monitor = Public Speaking, graduation cap = Education, smiley = University Partnership)
- **Expandable rows** showing a Recent Activity table (activity name, category badge, formatted date, +points)
- **Year filter** – "All Years" / "2025" / "2024" (recalculates points and re-ranks on change)
- **Quarter filter** – "All Quarters" / Q1–Q4 (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec)
- **Category filter** – "All Categories" / Education / Public Speaking / University Partnership
- **Employee search** – live name filter with ✕ clear button
- **Empty state** – info-icon message when no results match the active filters
- All filters combine and re-rank simultaneously; employees with 0 matching points are hidden

## Prompting techniques used

- **Contextual screenshots** – pasted the original UI images directly into the chat so the AI could infer layout, spacing, icon style, and colour palette without any manual description
- **Iterative clarification** – sent additional filter-dropdown screenshots mid-session to lock in exact dropdown options (All Years / 2025, Q1–Q4, category list, empty-state message)
- **Constraint prompting** – explicitly stated "no real names, no real photos, no corporate data" to keep the AI within responsible-use boundaries
- **Decomposition** – broke the task into data layer → components → styles → config → report, reviewing each step before moving to the next
