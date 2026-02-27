# LinkedIn Recruiting Skill

Automate LinkedIn-based recruiting workflows with safety-first approach. Designed for solo founders and small teams who need to find and evaluate candidates without dedicated HR.

## What This Skill Does

1. **Safe LinkedIn Navigation** — Automated browsing with anti-detection patterns (randomized intervals, behavior mixing, rate limiting)
2. **Candidate Discovery** — Boolean search, X-Ray search (via Google), Sales Navigator filters
3. **Deep Profile Analysis** — Structured evaluation across 7 dimensions (tech stack, experience, education, open source, social signals, etc.)
4. **Match Scoring** — Configurable 100-point scoring framework with weighted dimensions
5. **Cross-Verification** — GitHub, tech blogs, App Store, Google Scholar validation
6. **Outreach Drafting** — Personalized message templates based on candidate profile

## When to Use

- You need to find developers/designers/operators for your startup
- You want to do targeted recruiting on LinkedIn without getting rate-limited
- You need a structured way to evaluate candidates across multiple dimensions

## ⚠️ Safety First

**Read `references/safety-guide.md` before any LinkedIn automation.**

Key limits:
- New device: max 10 profile views on day 1
- Daily: max 20 profiles/hour, 5-8 messages/day
- Always randomize intervals (15-90s)
- Always mix in normal behavior (feed browsing, likes)
- Never send batch identical messages

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | This file — overview and instructions |
| `references/safety-guide.md` | LinkedIn anti-detection & rate limiting guide |
| `references/recruiting-methodology.md` | Full recruiting methodology (search → evaluate → outreach) |

## Quick Start

### 1. Search for Candidates

Use Boolean search in LinkedIn:
```
("iOS developer" OR "iOS engineer") AND ("social" OR "IM" OR "voice") AND (city1 OR city2)
```

Or X-Ray search via Google (bypasses LinkedIn search limits):
```
site:linkedin.com/in "iOS" "city" ("social" OR "voice")
```

### 2. Evaluate Candidates

Use the 100-point scoring framework in `references/recruiting-methodology.md`:
- Social product experience (25pts)
- Technical depth (20pts)
- Years of experience (10pts)
- International experience (10pts)
- Real-time/audio-video (10pts)
- AI tools usage (5pts)
- Startup experience (5pts)
- Independent shipping (5pts)
- Education (5pts)
- Stability (5pts)

### 3. Cross-Verify

Always verify LinkedIn claims via:
- GitHub (code quality, activity, contributions)
- Tech blogs (Juejin, Medium, personal sites)
- App Store (verify shipped products)
- Google Scholar (for research roles)

### 4. Outreach

Personalize every message. Key principles:
- Reference specific projects/tech from their profile
- Lead with shared interest, not "we're hiring"
- Lower commitment: "chat for a few minutes" not "interview"
- Include product link/demo
- Send Tuesday-Thursday for best open rates

## Customization

The scoring framework weights are designed for a social/gaming startup hiring iOS developers. To adapt:

1. Adjust dimension weights in the scoring table
2. Update target company lists for your industry
3. Modify message templates for your product/culture
4. Keep safety limits unchanged (those are LinkedIn platform limits)

## Requirements

- Browser tool with a LinkedIn-logged-in profile
- LinkedIn Premium or Sales Navigator recommended (higher limits)
- Patience — safe recruiting is slow recruiting

---

*Created by Kosbling AI Studio | v1.0 | 2026-02-27*
