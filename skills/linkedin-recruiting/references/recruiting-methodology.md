# LinkedIn Recruiting Methodology

> Full methodology for AI-assisted LinkedIn recruiting. Designed for solo founders and small teams.

---

## 1. LinkedIn Search Best Practices

### Boolean Search Syntax (use directly in LinkedIn search bar)

**Example — iOS developer search:**
```
("iOS developer" OR "iOS engineer" OR "Swift developer") AND (City1 OR City2)
```

**Advanced — with domain filter:**
```
("iOS" OR "Swift" OR "SwiftUI") AND ("social" OR "IM" OR "voice" OR "real-time") AND (City1 OR City2)
```

**X-Ray Search (search LinkedIn via Google, bypasses LinkedIn search limits):**
```
site:linkedin.com/in "iOS" "City" ("social" OR "voice")
site:linkedin.com/in "iOS developer" "City" "social"
```

### Sales Navigator Advanced Search Tips
With Premium/Sales Navigator:
- **Spotlight Filters**: "Open to Work" — active job seekers respond 3-5x more
- **Years of experience**: Set range (e.g., 3-8 years)
- **Current/Past company**: Enter target companies
- **Geography**: Set target region

### Search Workflow (per session)
1. Boolean search to generate candidate list
2. Prioritize "Open to Work" status
3. Sort by current/past company relevance
4. Click into profiles for details (follow safety SOP)
5. Cross-verify (GitHub/Google search)

---

## 2. Candidate Profile Deep Analysis Template

### A. Basic Info
| Field | Notes |
|-------|-------|
| Name | Full name |
| Location | City |
| Current role | Company + Title |
| LinkedIn URL | Full link |
| Open to Work | Yes/No |
| Connections | 500+ indicates industry activity |

### B. Education
| Field | Notes |
|-------|-------|
| University | Tier (top/mid/other) |
| Major | CS/Software/Communications/Other |
| Degree | BS/MS/PhD |
| Graduation year | Calculate work experience |
| Special marks | Scholarships/competitions/exchange |

### C. Work History (reverse chronological, per role)
| Field | Notes |
|-------|-------|
| Company | + brief description |
| Title | Developer / Senior / Lead |
| Duration | Start-end dates |
| Key responsibilities | Extract from description |
| Related products | What apps/products shipped |
| Tech stack | Languages, frameworks |
| Team size | If mentioned |
| Tenure pattern | Average time per role |

### D. Technical Stack Assessment
| Dimension | Details |
|-----------|---------|
| Primary language | Main language(s) |
| Frameworks | Relevant frameworks |
| Domain-specific | Audio/video, real-time, ML, etc. |
| Networking | HTTP libs, WebSocket, etc. |
| Architecture | MVVM / MVP / Clean / etc. |
| CI/CD | Build/deploy tooling |
| AI tools | Cursor / Copilot / etc. |
| Cross-platform | Flutter / RN / KMM / etc. |

### E. Open Source / GitHub
| Field | Notes |
|-------|-------|
| GitHub URL | Find from LinkedIn/Google |
| Activity | Contribution graph density |
| Top repos | Highest-star projects |
| OSS contributions | PRs to well-known projects |
| Code quality | Spot-check: comments/architecture/tests |
| Side projects | Independent apps |

### F. Content & Research
| Field | Notes |
|-------|-------|
| Tech blog | Medium/Dev.to/personal site |
| Speaking | Conferences/meetups |
| Papers | Google Scholar |
| Community | Stack Overflow reputation |

### G. Social Signals
| Field | Notes |
|-------|-------|
| LinkedIn activity | Recent posts/engagement |
| Groups/topics | What they follow |
| Recommendations | Colleague endorsements |
| Mutual connections | Shared contacts with you |

---

## 3. Match Scoring Framework

### Scoring Dimensions (100 points total)

| Dimension | Weight | Scoring Criteria |
|-----------|--------|-----------------|
| **Domain experience** | 25pts | Direct domain experience = 20-25; Related = 10-15; None = 0 |
| **Technical depth** | 20pts | Expert in target stack = 18-20; Competent = 12-15; Junior = 5-10 |
| **Years of experience** | 10pts | 3-5yr = 8-10; 5-8yr = 10; >8yr = 7 (salary risk); <3yr = 3-5 |
| **International experience** | 10pts | Has shipped globally = 8-10; None = 0 |
| **Specialized skills** | 10pts | Has niche expertise you need = 8-10; None = 0 |
| **AI tools usage** | 5pts | Active user = 4-5; Familiar = 2-3; None = 0 |
| **Startup experience** | 5pts | Has startup/small team exp = 4-5; None = 0 |
| **Independent shipping** | 5pts | Shipped own product = 5; Contributed = 3; None = 0 |
| **Education** | 5pts | Top tier = 4-5; Mid = 2-3 |
| **Stability** | 5pts | Avg tenure >2yr = 5; 1-2yr = 3; <1yr = 0 |

### Match Grades
- **A (80-100)**: Strongly recommended, contact first
- **B (60-79)**: Recommended, worth contacting
- **C (40-59)**: Backup, has clear gaps
- **D (<40)**: Not a match, skip

---

## 4. Cross-Verification Methods

LinkedIn profiles need external verification:

### GitHub Search
```
site:github.com "candidate-name" language:swift
site:github.com "candidate-name" iOS
```
- Check contribution graph (activity)
- Check highest-star repos (signature work)
- Check PR history (OSS contributions)
- Spot-check code quality

### Tech Blog Search
```
site:medium.com "candidate name" keyword
site:dev.to "candidate name" keyword
```

### Google Comprehensive Search
```
"candidate name" "company name" developer
"candidate name" developer city
```

### App Store Verification
If candidate claims to have shipped an app:
- Search App Store to confirm existence
- Check ratings and reviews
- Check last update date

---

## 5. Outreach Strategy

### Personalized Message Template — Technical Candidate

```
Hi [Name],

Noticed your work on [specific project/tech from their profile] at [Company] — 
[specific thing that impressed you].

We're building [one-line product description] — [what makes it interesting technically].

Small team ([size]), [team background]. Your experience with [specific skill] 
is exactly what we need.

Would you be open to a quick chat? Not necessarily about a role — would love 
to exchange thoughts on [relevant tech topic].

[Your name]
```

### Personalized Message Template — Independent Developer

```
Hi [Name],

Checked out your [GitHub project / App name] — [specific thing you liked].

We're working on something interesting: [one-line description]. Early team, 
everyone has significant product influence.

Your independent dev skills + [specific experience] feel like a great fit. 
Interested in hearing more?

[Your name]
```

### Outreach Key Principles
1. **Build rapport first** — Reference specific projects/tech, prove you read their profile
2. **Don't lead with hiring** — Start with shared interests
3. **Highlight differentiation** — Early team, product influence, equity, interesting tech
4. **Lower commitment** — "Quick chat" not "interview"
5. **Include demo/link** — Let them see what you're building

### Timing & Limits
- ⚠️ **Never send identical messages** — LinkedIn detects message similarity
- ⚠️ **Max 5-8 messages per day** — Even with Premium
- ⚠️ **Don't follow up on no-replies** — "I don't know this person" reports hurt your score
- ⚠️ **Prioritize "Open to Work"** — 3-5x higher response rate
- ⚠️ **Mutual connections matter** — 46% higher response rate
- ⚠️ **Tuesday-Thursday** — Best open rates
- ⚠️ **Avoid weekends and late nights** — Looks unprofessional

### Red Flags in Candidates
- 🚩 Average tenure under 1 year — stability risk
- 🚩 LinkedIn description doesn't match cross-verification
- 🚩 Only company names, no details — may have been peripheral
- 🚩 "Full-stack" but shallow everywhere — jack of all trades
- 🚩 Only asks about salary in first conversation — may not be startup-minded

---

## 6. Recommended Tools

| Tool | Purpose | Safety |
|------|---------|--------|
| LinkedIn Sales Navigator | Advanced search + Open to Work filter | ✅ Official |
| Google X-Ray Search | Bypass LinkedIn search limits | ✅ Completely safe |
| GitHub Search | Cross-verify technical ability | ✅ Completely safe |
| Google Scholar | Check research/paper contributions | ✅ Completely safe |
| App Store | Verify shipped products | ✅ Completely safe |

**Not recommended**: Chrome extension-based LinkedIn automation tools (high risk)

---

*v1.0 | 2026-02-27 | Kosbling AI Studio*
