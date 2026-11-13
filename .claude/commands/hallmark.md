---
name: hallmark
description: "Anti-AI-slop and synthetic design audit & remediation. Enforces high-craft website design principles from nutlope/hallmark, preventing generic AI aesthetic. Usage: /hallmark [prompt] | /hallmark audit <path> | /hallmark redesign <path>"
argument-hint: "<prompt> | audit <path> | redesign <path>"
---

# /hallmark

Enforce high-craft website design principles against generic AI aesthetic, synthetic layout slop, and model convergence. Based on `nutlope/hallmark`.

## Usage

```bash
/hallmark                       # Design a new clean, non-generated UI page
/hallmark "Hero section for..." # Build a specific component following Hallmark floor rules
/hallmark audit <path>          # Audit an existing webpage or CSS for AI slop & violations
/hallmark redesign <path>       # Refactor an existing design to meet Hallmark craft floor
```

## Hallmark Floor Rules (Non-Waivable)

1. **Tokens Only**: Every color and font family goes through CSS tokens declared at `:root`. No raw colors or font families downstream.
2. **Smooth & Precise**: Never `transition: all`. Never animate `width`, `height`, `top`, or `left`.
3. **Typography Purity**: Never one italic word inside a roman heading. Never an eyebrow label in tracked capitals or small-caps.
4. **Layout Safety**: `overflow-x: clip` on both `html` and `body`. Never `overflow: hidden`, never `100vw`.
5. **No AI Slop / Convergence**:
   - Never purple-to-blue gradients
   - Never card-inside-a-card stacking
   - Never emoji icons or hand-drawn OS/browser mockups
   - Never fabricated metrics, synthetic testimonials, or fake logo walls
6. **Hero Discipline**: Headline, single-sentence subhead, and primary action must fit within 1280x800 viewport without scrolling. Max ~80 words per screen.

## Skill Reference

See skill `hallmark` (`.claude/skills/hallmark/SKILL.md` or `.agents/skills/hallmark/SKILL.md`).

