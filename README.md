# STEMbotix Insights Mockup

Clickable mockup of the STEMbotix insights dashboards (Jira SB-42, SB-43, SB-45).

**Every card uses only data that exists today**, in one of two places:

- **LMS database** (`stembotix-lms-back-end`, `prisma/schema.prisma`)
- **Blockzie database**, read-only through the `feat/blockzie-dashboard` branch (`BLOCKZIE_DATABASE_URL`). LMS and Blockzie users are matched only by a shared `keycloak_id`.

## Tabs

| Tab | What it shows |
|---|---|
| Overview | Reach, learning, trainers in schools, Blockzie and devices, support, website sales, AI use (STEMbotix team only) |
| Department | SB-42 / SB-43. Filters: Course, Location, Month-Year. Download PDF only (no CSV) |
| Institute | SB-45. Classes, courses, trainer visits, students, Blockzie use |
| Course | Lesson completion, learning status, institutes, students |
| Instructor | Sessions, check-in punctuality, attendance, work logs, grading backlog |
| Student | Two views. **Students**: profile, courses, attendance, Blockzie projects, device connections. **Trainers in training**: trainers taking courses as students, found by their login email `trainer<number>@...` (e.g. `trainer1@gmail.com`); left out of school student numbers elsewhere |
| Blockzie & Devices | Logins, projects, device connections (BLE / Wi-Fi / Serial), templates, downloads |
| KCG Programme | KCG colleges by cluster: students per level, training days, attendance, teams and project TRL, project reviews, kit deliveries, college issues, the 6 red flags, college drill-down, programme rules, CSV exports. Same rules as the KCG branch dashboard |
| Online & Engagement (**planned**) | Who is online now, active today, peak, 5-minute graph, active / idle / hidden time per person, drill-down platform → department → institute → class, Excel export. Also a small panel on Department and Institute, and "My Activity" on Student |

## Planned, not built yet

Online presence and active/idle tracking (Feature Track F-038 to F-044) are shown with a **Planned** label
and amber source tags. Their sample data (`src/data/presence.js`) follows the designed tables:
`ActivitySegment`, `UserDailyActivity`, `PresenceSnapshot`, `OrgDailyPresence`. Day = midnight to midnight IST;
idle after 5 minutes without interaction.

## Deliberately left out (not in either database, not planned yet)

Pre/post assessment scores, score improvement, impact grade, board (CBSE/ICSE), institute map,
short LMS IDs. (Kit deliveries now exist for KCG colleges, see the KCG Programme tab.)

## Code layout

- `src/data/db.js`: seeded sample data. Each array mirrors a real table and uses real column names.
- `src/data/kcg.js`: KCG sample data and the rules copied from the KCG branch.
- `src/data/selectors.js`: the joins and calculations the dashboards use.
- `src/components/`: shared cards, tables, filters, PDF frame.
- `src/dashboards/`: one file per tab.

```bash
npm install
npm run dev      # local
npm run build    # production build
```
