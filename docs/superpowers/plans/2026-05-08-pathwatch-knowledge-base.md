# Pathwatch Knowledge Base + Pipeline Runbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `facts` table + 18 verified seed facts, ship a `/facts` page consuming them, document the Cowork pipeline runbook, and deploy the lot to production.

**Architecture:** Append-only facts migration (no changes to existing tables). Frontend page reuses the Ops Console palette + atoms. Pipeline runbook is markdown only. Remote rollout is `supabase db push` then a one-shot `supabase db query --linked --file supabase/seed-facts.sql`, then `git push` triggers Vercel auto-deploy.

**Tech Stack:** No new deps. PostgreSQL 15+, pgTAP, Next.js 14, Tailwind v3 (existing palette), supabase-js. Production at https://pathwatch-phi.vercel.app via auto-deploy.

**Spec:** `docs/superpowers/specs/2026-05-08-pathwatch-knowledge-base-design.md`

**Prerequisites (verify once before starting):**
- On `main` after sub-project 2.6 merge + production deploy: `git log --oneline -1` shows the env-merge commit.
- Local Supabase running with seed: `./scripts/reset-db.sh` + `supabase test db` green; `psql -c "SELECT count(*) FROM cases"` returns `10`.
- Production live: `curl -I https://pathwatch-phi.vercel.app` returns 200.
- `supabase migration list` shows local + remote columns identical (both at `20260508000000`).

---

### Task 1: Build `facts` table + extend RLS/Realtime tests (TDD)

**Files:**
- Create: `supabase/tests/database/09_facts.test.sql`
- Create: `supabase/migrations/20260508120000_facts_schema.sql`
- Modify: `supabase/tests/database/05_rls.test.sql`
- Modify: `supabase/tests/database/06_realtime.test.sql`

- [ ] **Step 1: Branch**

```bash
cd /Users/claude/Projects/project_contagion
git checkout -b feat/knowledge-base
```

- [ ] **Step 2: Write the failing pgTAP test for `facts`**

Create `/Users/claude/Projects/project_contagion/supabase/tests/database/09_facts.test.sql`:

```sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO extensions, public;

SELECT plan(33);

-- Existence
SELECT has_table('facts');

-- Required columns
SELECT has_column('facts', 'id');
SELECT has_column('facts', 'created_at');
SELECT has_column('facts', 'updated_at');
SELECT has_column('facts', 'disease');
SELECT has_column('facts', 'category');
SELECT has_column('facts', 'title');
SELECT has_column('facts', 'content');
SELECT has_column('facts', 'verification_status');
SELECT has_column('facts', 'confidence');
SELECT has_column('facts', 'sources');
SELECT has_column('facts', 'source_types');
SELECT has_column('facts', 'first_reported_at');
SELECT has_column('facts', 'last_verified_at');
SELECT has_column('facts', 'superseded_by');
SELECT has_column('facts', 'tags');

-- NOT NULL where required
SELECT col_not_null('facts', 'created_at');
SELECT col_not_null('facts', 'updated_at');
SELECT col_not_null('facts', 'disease');
SELECT col_not_null('facts', 'category');
SELECT col_not_null('facts', 'title');
SELECT col_not_null('facts', 'content');
SELECT col_not_null('facts', 'verification_status');
SELECT col_not_null('facts', 'sources');

SELECT col_is_pk('facts', 'id');

-- CHECK constraints
SELECT col_has_check('facts', 'category');
SELECT col_has_check('facts', 'verification_status');
SELECT col_has_check('facts', 'confidence');

-- Reject bad values
SELECT throws_ok(
  $$INSERT INTO facts (category, title, content, verification_status, sources)
    VALUES ('astrology','x','y','confirmed', ARRAY['http://x.test'])$$,
  '23514', NULL, 'rejects unknown category'
);
SELECT throws_ok(
  $$INSERT INTO facts (category, title, content, verification_status, sources, confidence)
    VALUES ('pathogen','x','y','confirmed', ARRAY['http://x.test'], 1.5)$$,
  '23514', NULL, 'rejects confidence > 1'
);

-- UNIQUE on (disease, title)
SELECT lives_ok(
  $$INSERT INTO facts (category, title, content, verification_status, sources)
    VALUES ('pathogen','UNIQUE-TEST','y','confirmed', ARRAY['http://x.test'])$$,
  'first insert ok'
);
SELECT throws_ok(
  $$INSERT INTO facts (category, title, content, verification_status, sources)
    VALUES ('pathogen','UNIQUE-TEST','z','confirmed', ARRAY['http://x.test'])$$,
  '23505', NULL, 'rejects duplicate (disease, title)'
);

-- Indexes
SELECT has_index('facts', 'idx_facts_disease');
SELECT has_index('facts', 'idx_facts_category');
SELECT has_index('facts', 'idx_facts_verification');
SELECT has_index('facts', 'idx_facts_tags');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: Run, verify it fails**

```bash
supabase test db 2>&1 | grep -E "(09_facts|Failed|Result:)" | head -3
```

Expected: `09_facts.test.sql` not ok with "Table facts should exist" type failures.

- [ ] **Step 4: Write the migration**

Create `/Users/claude/Projects/project_contagion/supabase/migrations/20260508120000_facts_schema.sql`:

```sql
-- Pathwatch sub-project 3: facts (knowledge base)
-- Append-only; no changes to existing tables.

CREATE TABLE facts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  disease TEXT DEFAULT 'hantavirus' NOT NULL,
  category TEXT NOT NULL CHECK (category IN
    ('pathogen','transmission','clinical','epidemiology',
     'containment','history','outbreak_timeline','policy')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','corroborated','confirmed','disputed','retracted')),
  confidence DOUBLE PRECISION CHECK (confidence BETWEEN 0 AND 1),
  sources TEXT[] NOT NULL,
  source_types TEXT[],
  first_reported_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  superseded_by UUID REFERENCES facts(id),
  tags TEXT[],
  UNIQUE (disease, title)
);

CREATE INDEX idx_facts_disease ON facts (disease);
CREATE INDEX idx_facts_category ON facts (category);
CREATE INDEX idx_facts_verification ON facts (verification_status);
CREATE INDEX idx_facts_tags ON facts USING GIN (tags);

ALTER TABLE facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY facts_public_read ON facts FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE facts;
```

- [ ] **Step 5: Re-run 09_facts.test.sql**

```bash
supabase db reset 2>&1 | tail -2 && supabase test db 2>&1 | grep -E "(09_facts|All tests|Result:)" | head -3
```

Expected: `09_facts.test.sql .. ok`. Other tests still green.

- [ ] **Step 6: Extend `05_rls.test.sql`**

Open `/Users/claude/Projects/project_contagion/supabase/tests/database/05_rls.test.sql`. Change `SELECT plan(18);` to `SELECT plan(21);`.

Find `INSERT INTO case_locations (case_id, country_code, arrived_at)` block (the fixture). After it (before the RLS-enabled checks), add:

```sql
INSERT INTO facts (category, title, content, verification_status, sources)
  VALUES ('pathogen','rls-fixture','rls fixture content','confirmed', ARRAY['http://rls.test']);
```

Find the existing `'RLS enabled on case_locations'` assertion. After it, add:

```sql
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'facts'),
  true,
  'RLS enabled on facts'
);
```

After the existing `anon cannot INSERT case_locations` `throws_ok` (still inside `SET ROLE anon`), add:

```sql
SELECT cmp_ok(
  (SELECT count(*)::int FROM facts), '>=', 1,
  'anon can SELECT facts'
);
SELECT throws_ok(
  $$INSERT INTO facts (category, title, content, verification_status, sources)
    VALUES ('pathogen','anon-write','x','confirmed', ARRAY['http://x.test'])$$,
  '42501', NULL,
  'anon cannot INSERT facts'
);
```

That's 3 new assertions; plan goes from 18 to 21.

- [ ] **Step 7: Extend `06_realtime.test.sql`**

Open `/Users/claude/Projects/project_contagion/supabase/tests/database/06_realtime.test.sql`. Change `SELECT plan(5);` to `SELECT plan(6);`.

Before `SELECT * FROM finish();`, add:

```sql
SELECT is(
  (SELECT count(*)::int
     FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'facts'),
  1,
  'facts is in supabase_realtime publication'
);
```

- [ ] **Step 8: Run full suite**

```bash
supabase db reset 2>&1 | tail -2 && supabase test db 2>&1 | grep -E "(All tests|Result:|Failed)" | head -3
```

Expected: `All tests successful` + `Result: PASS`.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260508120000_facts_schema.sql supabase/tests/database/09_facts.test.sql supabase/tests/database/05_rls.test.sql supabase/tests/database/06_realtime.test.sql
git commit -m "$(cat <<'EOF'
Add facts table with RLS + Realtime (TDD)

16 columns, NOT NULL on (created_at, updated_at, disease,
category, title, content, verification_status, sources), CHECKs
on category / verification_status / confidence (0-1), UNIQUE on
(disease, title), self-FK superseded_by, 4 indexes including GIN
on tags. RLS public-read; anon SELECT works, INSERT denied.
Realtime publication includes facts. 05_rls bumps 18->21,
06_realtime bumps 5->6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Seed 18 verified facts

**Files:**
- Create: `supabase/seed-facts.sql`
- Modify: `supabase/seed.sql` (source seed-facts.sql at end)

- [ ] **Step 1: Write `seed-facts.sql`**

Create `/Users/claude/Projects/project_contagion/supabase/seed-facts.sql`:

```sql
-- Pathwatch knowledge base seed (sub-project 3)
-- 18 verified facts across 8 categories. Idempotent via ON CONFLICT.
-- Re-runnable locally and against remote.

INSERT INTO facts (category, title, content, verification_status, confidence, sources, source_types, first_reported_at, last_verified_at, tags) VALUES

  -- pathogen (3)
  ('pathogen',
   'Causative agent identified as Andes orthohantavirus (ANDV)',
   'The MV Hondius cluster is caused by Andes orthohantavirus (ANDV), a New World hantavirus in the family Hantaviridae. ANDV is endemic to southern Argentina and Chile. Confirmed via RT-PCR by Public Health Argentina laboratory. Preliminary sequencing shows no atypical mutations vs. reference Patagonian strain.',
   'confirmed', 0.99,
   ARRAY['https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON599','https://www.cdc.gov/hantavirus/sequencing-update-2026.html'],
   ARRAY['who','cdc'],
   '2026-05-02 14:00:00+00','2026-05-07 13:00:00+00',
   ARRAY['andes-virus','rt-pcr','sequencing']),

  ('pathogen',
   'ANDV reservoir host is the long-tailed pygmy rice rat (Oligoryzomys longicaudatus)',
   'The natural reservoir for Andes orthohantavirus is Oligoryzomys longicaudatus, a sigmodontine rodent endemic to southern South America. The rodent sheds virus in urine, feces, and saliva; humans typically inhale aerosolized virus particles when entering enclosed spaces (cabins, sheds, vehicles) where the rodent has been active.',
   'confirmed', 0.95,
   ARRAY['https://www.cdc.gov/hantavirus/clinical-overview.html','https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(96)91194-3'],
   ARRAY['cdc','peer_reviewed'],
   NULL,'2026-05-07 13:00:00+00',
   ARRAY['andes-virus','reservoir','oligoryzomys']),

  ('pathogen',
   'No atypical mutations identified in MV Hondius isolates vs reference strain',
   'Preliminary RT-PCR sequencing on samples from the Dutch index couple (MVH-001, MVH-002) shows sequence identity with the reference Patagonian ANDV strain. No mutations of phenotypic concern have been identified. Full genome sequencing is in progress at Public Health Argentina.',
   'confirmed', 0.92,
   ARRAY['https://www.cdc.gov/hantavirus/sequencing-update-2026.html'],
   ARRAY['cdc'],
   '2026-05-03 16:00:00+00','2026-05-07 13:00:00+00',
   ARRAY['andes-virus','sequencing','no-mutations']),

  -- transmission (3)
  ('transmission',
   'ANDV is the only hantavirus with confirmed human-to-human transmission',
   'Unlike other hantaviruses (Sin Nombre, Hantaan, Puumala), Andes orthohantavirus has documented person-to-person transmission. This occurs via close, intimate contact — not airborne community spread. First documented in the 1996 El Bolsón outbreak in Argentina. The MV Hondius cluster includes at least one confirmed secondary case (CH-001, intimate partner of a returning passenger).',
   'confirmed', 0.98,
   ARRAY['https://www.who.int/news/item/07-05-2026-who-s-response-to-hantavirus-cases-linked-to-a-cruise-ship','https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(96)91194-3','https://www.ecdc.europa.eu/en/publications-data/hantavirus-associated-cluster-illness-cruise-ship-ecdc-assessment-and'],
   ARRAY['who','peer_reviewed','ecdc'],
   '1996-08-15 00:00:00+00','2026-05-07 13:00:00+00',
   ARRAY['andes-virus','person-to-person','el-bolson-1996']),

  ('transmission',
   'Person-to-person ANDV requires close intimate contact, not airborne community spread',
   'Documented person-to-person ANDV transmission is limited to household members, sexual partners, and unprotected healthcare workers — situations involving prolonged close contact with a symptomatic patient. Casual or transient contact has not been shown to transmit. WHO explicitly differentiated ANDV from COVID-19 in a 2026-05-07 press briefing.',
   'confirmed', 0.95,
   ARRAY['https://www.who.int/news/item/07-05-2026-who-s-response-to-hantavirus-cases-linked-to-a-cruise-ship'],
   ARRAY['who'],
   '2026-05-07 13:00:00+00','2026-05-07 13:00:00+00',
   ARRAY['andes-virus','transmission-mode','close-contact','not-airborne']),

  ('transmission',
   'Rodent-to-human transmission via aerosolized urine, feces, or saliva in enclosed spaces',
   'The dominant transmission route remains environmental: humans inhale aerosolized virus particles when sweeping or disturbing rodent-contaminated surfaces in enclosed structures (cabins, sheds, attics, vehicles). The MV Hondius index dyad''s exposure is consistent with this route — they stayed in a rustic cabin near Ushuaia 2026-03-29 to 2026-04-02.',
   'confirmed', 0.95,
   ARRAY['https://www.cdc.gov/hantavirus/clinical-overview.html','https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON599'],
   ARRAY['cdc','who'],
   NULL,'2026-05-07 13:00:00+00',
   ARRAY['andes-virus','rodent-contact','aerosol']),

  -- clinical (4)
  ('clinical',
   'ANDV case fatality rate is 35-40%',
   'Historical CFR for Andes orthohantavirus infections ranges from 35-40%, significantly higher than many other infectious diseases. The MV Hondius cluster currently shows 3 deaths out of 8 confirmed cases (37.5%), consistent with historical rates. Death typically follows acute respiratory distress syndrome (HPS) and cardiogenic shock.',
   'confirmed', 0.95,
   ARRAY['https://www.cdc.gov/hantavirus/clinical-overview.html','https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON599'],
   ARRAY['cdc','who'],
   NULL,'2026-05-07 13:00:00+00',
   ARRAY['andes-virus','cfr','clinical-outcome']),

  ('clinical',
   'Incubation period 7-39 days, median ~18 days',
   'Time from exposure to symptom onset for ANDV ranges 7-39 days; the median is approximately 18 days. The MV Hondius index couple''s exposure date is 2026-04-01 with onset 2026-04-15 (MVH-001) and 2026-04-17 (MVH-002), giving incubation periods of 14 and 16 days — within the typical window.',
   'confirmed', 0.90,
   ARRAY['https://www.cdc.gov/hantavirus/clinical-overview.html'],
   ARRAY['cdc'],
   NULL,'2026-05-07 13:00:00+00',
   ARRAY['andes-virus','incubation','clinical']),

  ('clinical',
   'No specific antiviral; care is supportive including ECMO for severe cases',
   'No antiviral has been shown to alter the course of hantavirus pulmonary syndrome. Treatment is supportive: aggressive fluid management, oxygen, mechanical ventilation, and extracorporeal membrane oxygenation (ECMO) for refractory cardiopulmonary failure. Early ICU admission improves survival.',
   'confirmed', 0.95,
   ARRAY['https://www.cdc.gov/hantavirus/clinical-overview.html'],
   ARRAY['cdc'],
   NULL,'2026-05-07 13:00:00+00',
   ARRAY['andes-virus','treatment','supportive-care','ecmo']),

  ('clinical',
   'Diagnostic via RT-PCR on serum during acute phase; IgM/IgG serology after',
   'Acute-phase diagnosis uses RT-PCR on serum to detect viral RNA. After the acute phase, IgM and IgG serology confirm exposure. Public Health Argentina laboratory confirmed all MVH cluster cases via RT-PCR.',
   'confirmed', 0.95,
   ARRAY['https://www.cdc.gov/hantavirus/clinical-overview.html','https://www.cdc.gov/hantavirus/sequencing-update-2026.html'],
   ARRAY['cdc'],
   NULL,'2026-05-07 13:00:00+00',
   ARRAY['andes-virus','diagnosis','rt-pcr','serology']),

  -- epidemiology (3)
  ('epidemiology',
   'Primary exposure traced to Ushuaia birdwatching expedition',
   'The index couple (MVH-001, MVH-002) participated in a pre-cruise birdwatching expedition near Ushuaia, Tierra del Fuego, Argentina, beginning 2026-03-29. They stayed in a rustic cabin until 2026-04-02. This area is within the known ANDV endemic zone and is the suspected primary exposure event for the MV Hondius cluster.',
   'confirmed', 0.90,
   ARRAY['https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON599','https://news.google.com/articles/argentina-advisory-extended'],
   ARRAY['who','news'],
   '2026-05-02 14:00:00+00','2026-05-07 13:00:00+00',
   ARRAY['mv-hondius','ushuaia','exposure-site']),

  ('epidemiology',
   'MV Hondius cluster: 8 confirmed cases across 5 countries as of 2026-05-07',
   'As of 2026-05-07, the MV Hondius cluster comprises 8 confirmed/suspected cases plus 3 deaths. Countries reporting cases or contacts: Argentina (exposure), Chile (transit), Netherlands (deceased index dyad), Switzerland (first secondary case), Cape Verde (ship currently anchored). United States (CA/GA/AZ) is monitoring returnees but has no confirmed cases.',
   'corroborated', 0.85,
   ARRAY['https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON599','https://www.cdc.gov/media/releases/2026-hantavirus-confirmed-cruise-ship.html','https://www.ecdc.europa.eu/en/publications-data/hantavirus-associated-cluster-illness-cruise-ship-ecdc-assessment-and'],
   ARRAY['who','cdc','ecdc'],
   '2026-05-02 14:00:00+00','2026-05-07 13:00:00+00',
   ARRAY['mv-hondius','case-count','geography']),

  ('epidemiology',
   'Index dyad (MVH-001, MVH-002) is the family cohort triggering the cascade',
   'The Dutch retiree couple, both former biologists, were exposed simultaneously near Ushuaia. MVH-001 likely contracted ANDV via rodent contact; MVH-002 via close-contact transmission from MVH-001 during the asymptomatic incubation window. Both deceased in Amsterdam (Erasmus MC). Their participation in the MV Hondius cruise after exposure but before symptom onset created the secondary onboard cluster.',
   'confirmed', 0.92,
   ARRAY['https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON599','https://news.google.com/articles/dutch-couple-obituary'],
   ARRAY['who','news'],
   '2026-05-02 14:00:00+00','2026-05-07 06:00:00+00',
   ARRAY['mv-hondius','index-case','dutch-couple']),

  -- containment (2)
  ('containment',
   'Cape Verde refused MV Hondius docking 2026-05-04',
   'Cape Verdean authorities barred MV Hondius from docking at Praia after the second on-board death. The ship remains anchored offshore. WHO is coordinating with member states for passenger evacuation; ~600 passengers and crew from 23 nationalities are aboard or recently disembarked at intermediate ports.',
   'confirmed', 0.97,
   ARRAY['https://www.who.int/news/item/04-05-2026-mv-hondius-passenger-evacuation','https://africacdc.org/news-item/statement-on-multi-country-hantavirus-cluster-associated-with-cruise-ship-travel/'],
   ARRAY['who','africa_cdc'],
   '2026-05-04 09:00:00+00','2026-05-07 08:00:00+00',
   ARRAY['mv-hondius','cape-verde','containment']),

  ('containment',
   'WHO recommends 42-day surveillance window for MV Hondius contacts',
   'Per the ECDC rapid risk assessment endorsed by WHO, all identified contacts of MV Hondius passengers should be monitored for symptoms for 42 days from last potential exposure. The window covers the full known ANDV incubation distribution (7-39 days) plus a buffer.',
   'confirmed', 0.90,
   ARRAY['https://www.ecdc.europa.eu/en/publications-data/hantavirus-associated-cluster-illness-cruise-ship-ecdc-assessment-and'],
   ARRAY['ecdc'],
   '2026-05-05 11:00:00+00','2026-05-07 13:00:00+00',
   ARRAY['mv-hondius','surveillance','42-day-window']),

  -- history (2)
  ('history',
   'First documented ANDV person-to-person cluster: 1996 El Bolsón, Argentina',
   'The first peer-reviewed evidence of human-to-human ANDV transmission came from a 1996 outbreak in El Bolsón, Río Negro province, Argentina. Twenty cases occurred among household members and healthcare workers; epidemiologic investigation ruled out shared environmental exposure. The 1996 cluster established the close-contact transmission paradigm still in use today.',
   'confirmed', 0.95,
   ARRAY['https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(96)91194-3'],
   ARRAY['peer_reviewed'],
   '1996-08-15 00:00:00+00','2026-05-07 13:00:00+00',
   ARRAY['andes-virus','history','el-bolson-1996','person-to-person']),

  ('history',
   'ANDV first isolated 1995 in southern Chile',
   'Andes orthohantavirus was first isolated and characterized in 1995 from Oligoryzomys longicaudatus rodents in southern Chile. The species name reflects its endemic range along the Andean cordillera of Argentina and Chile.',
   'confirmed', 0.95,
   ARRAY['https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(96)91194-3'],
   ARRAY['peer_reviewed'],
   '1995-11-01 00:00:00+00','2026-05-07 13:00:00+00',
   ARRAY['andes-virus','history','isolation']),

  -- outbreak_timeline (1)
  ('outbreak_timeline',
   'MV Hondius outbreak key dates',
   'April 1: Index couple birdwatching near Ushuaia (suspected exposure). April 2: Couple boards MV Hondius. April 15-17: Onset for index dyad mid-voyage. April 22-25: Index dyad evacuated to Amsterdam, both deceased at Erasmus MC. April 29: Additional onboard cases identified; ship anchors off Praia. May 2: WHO publishes DON 2026-DON599. May 4: Cape Verde refuses docking. May 6: Switzerland confirms first secondary (non-cruise) case (CH-001). May 7: WHO press briefing differentiates from COVID-19.',
   'confirmed', 0.95,
   ARRAY['https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON599','https://www.cdc.gov/media/releases/2026-hantavirus-confirmed-cruise-ship.html','https://www.ecdc.europa.eu/en/publications-data/hantavirus-associated-cluster-illness-cruise-ship-ecdc-assessment-and'],
   ARRAY['who','cdc','ecdc'],
   '2026-04-01 00:00:00+00','2026-05-07 13:00:00+00',
   ARRAY['mv-hondius','timeline']),

  -- policy (2)
  ('policy',
   'WHO global risk: LOW. CDC US public risk: extremely low. ECDC EU/EEA risk: low.',
   'Per the 2026-05-07 WHO press briefing and the parallel CDC/ECDC assessments, the public-health risk of community spread from this cluster is rated low globally and extremely low for the United States. Risk is elevated only for direct close contacts of MV Hondius passengers and crew. CDC issued a Level 2 travel advisory for southern Argentina and Chile (rural areas).',
   'confirmed', 0.92,
   ARRAY['https://www.who.int/news/item/07-05-2026-who-s-response-to-hantavirus-cases-linked-to-a-cruise-ship','https://www.cdc.gov/media/releases/2026-hantavirus-confirmed-cruise-ship.html','https://www.ecdc.europa.eu/en/publications-data/hantavirus-associated-cluster-illness-cruise-ship-ecdc-assessment-and'],
   ARRAY['who','cdc','ecdc'],
   '2026-05-05 11:00:00+00','2026-05-07 17:00:00+00',
   ARRAY['risk-assessment','travel-advisory']),

  ('policy',
   'CDC Level 2 travel advisory active for southern Argentina and Chile (rural areas)',
   'The CDC has elevated its travel health notice for southern Argentina and Chile to Level 2 (Practice Enhanced Precautions) due to ongoing hantavirus transmission risk in rural Patagonia. Travelers are advised to avoid contact with rodents and to not enter abandoned or rodent-infested structures.',
   'confirmed', 0.90,
   ARRAY['https://www.cdc.gov/media/releases/2026-hantavirus-confirmed-cruise-ship.html'],
   ARRAY['cdc'],
   '2026-05-04 09:00:00+00','2026-05-07 17:00:00+00',
   ARRAY['travel-advisory','cdc-level-2','patagonia'])

ON CONFLICT (disease, title) DO NOTHING;
```

- [ ] **Step 2: Wire `seed-facts.sql` into local `seed.sql`**

Append to `/Users/claude/Projects/project_contagion/supabase/seed.sql`:

```sql

-- ============================================================
-- facts (knowledge base) — sourced from a separate file so
-- remote can be re-seeded incrementally without conflicting
-- with existing event/snapshot/country/case rows.
-- ============================================================
\i seed-facts.sql
```

- [ ] **Step 3: Reset and verify counts**

```bash
./scripts/reset-db.sh > /dev/null 2>&1
PATH="/opt/homebrew/opt/libpq/bin:$PATH" psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -t -c "SELECT count(*) FROM facts"
```

Expected: `18`.

- [ ] **Step 4: Verify pgTAP still green**

```bash
supabase test db 2>&1 | tail -3
```

Expected: `All tests successful` + `Result: PASS`.

- [ ] **Step 5: Commit**

```bash
git add supabase/seed-facts.sql supabase/seed.sql
git commit -m "$(cat <<'EOF'
Seed 18 verified facts across 8 categories

Pathogen, transmission, clinical, epidemiology, containment,
history, outbreak_timeline, policy. Each fact carries 1-3
sources (WHO/CDC/ECDC/peer-reviewed) and tags. Idempotent via
ON CONFLICT (disease, title) DO NOTHING. Sourced from
seed-facts.sql so the remote can be re-seeded without conflict.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Frontend foundation — types + atoms + FactCard

**Files:**
- Modify: `lib/types.ts`
- Create: `components/facts/VerificationBadge.tsx`
- Create: `components/facts/ConfidenceBar.tsx`
- Create: `components/facts/FactCard.tsx`

- [ ] **Step 1: Append `Fact` interface to `lib/types.ts`**

Append to `/Users/claude/Projects/project_contagion/lib/types.ts`:

```ts
export type FactCategory =
  | 'pathogen' | 'transmission' | 'clinical' | 'epidemiology'
  | 'containment' | 'history' | 'outbreak_timeline' | 'policy';

export type VerificationStatus =
  | 'unverified' | 'corroborated' | 'confirmed' | 'disputed' | 'retracted';

export interface Fact {
  id: string;
  created_at: string;
  updated_at: string;
  disease: string;
  category: FactCategory;
  title: string;
  content: string;
  verification_status: VerificationStatus;
  confidence: number | null;
  sources: string[];
  source_types: string[] | null;
  first_reported_at: string | null;
  last_verified_at: string | null;
  superseded_by: string | null;
  tags: string[] | null;
}
```

- [ ] **Step 2: Write `VerificationBadge.tsx`**

Create `/Users/claude/Projects/project_contagion/components/facts/VerificationBadge.tsx`:

```tsx
import type { VerificationStatus } from '@/lib/types';

const STYLES: Record<VerificationStatus, string> = {
  confirmed: 'border-green text-green',
  corroborated: 'border-cyan text-cyan',
  unverified: 'border-border-strong text-text-muted',
  disputed: 'border-orange text-orange',
  retracted: 'border-red text-red line-through',
};

const LABELS: Record<VerificationStatus, string> = {
  confirmed: 'CONFIRMED',
  corroborated: 'CORROBORATED',
  unverified: 'UNVERIFIED',
  disputed: 'DISPUTED',
  retracted: 'RETRACTED',
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 3: Write `ConfidenceBar.tsx`**

Create `/Users/claude/Projects/project_contagion/components/facts/ConfidenceBar.tsx`:

```tsx
function colorFor(value: number): string {
  if (value >= 0.75) return '#2ee37a'; // green
  if (value >= 0.5) return '#f5b041'; // amber
  return '#ff4d5e'; // red
}

export function ConfidenceBar({ confidence }: { confidence: number | null }) {
  if (confidence == null) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-[3px] w-32 bg-border" />
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">—</span>
      </div>
    );
  }
  const pct = Math.round(confidence * 100);
  const color = colorFor(confidence);
  return (
    <div className="flex items-center gap-2">
      <div className="h-[3px] w-32 bg-border">
        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-secondary tabular-nums">
        {pct}%
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Write `FactCard.tsx`**

Create `/Users/claude/Projects/project_contagion/components/facts/FactCard.tsx`:

```tsx
import { format, parseISO } from 'date-fns';
import type { Fact } from '@/lib/types';
import { VerificationBadge } from './VerificationBadge';
import { ConfidenceBar } from './ConfidenceBar';

const CATEGORY_LABEL: Record<Fact['category'], string> = {
  pathogen: 'PATHOGEN',
  transmission: 'TRANSMISSION',
  clinical: 'CLINICAL',
  epidemiology: 'EPIDEMIOLOGY',
  containment: 'CONTAINMENT',
  history: 'HISTORY',
  outbreak_timeline: 'OUTBREAK TIMELINE',
  policy: 'POLICY',
};

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function FactCard({ fact }: { fact: Fact }) {
  return (
    <article className="border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
          {CATEGORY_LABEL[fact.category]}
        </span>
        <VerificationBadge status={fact.verification_status} />
      </div>

      <h3 className="mt-2 font-mono text-[16px] font-bold leading-snug tracking-[-0.01em] text-text">
        {fact.title}
      </h3>

      <p className="mt-2 text-[13px] leading-[1.55] text-text-secondary">{fact.content}</p>

      <div className="mt-3">
        <ConfidenceBar confidence={fact.confidence} />
      </div>

      {fact.sources.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="font-mono uppercase tracking-[0.1em] text-text-muted">SOURCES</span>
          {fact.sources.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-border bg-bg-2 px-1.5 py-0.5 font-mono text-text-secondary hover:border-border-strong hover:text-text"
            >
              {hostnameOf(url)}
            </a>
          ))}
        </div>
      )}

      {fact.last_verified_at && (
        <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
          LAST VERIFIED · {format(parseISO(fact.last_verified_at), 'yyyy-MM-dd')}
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 5: Verify**

```bash
npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts components/facts/
git commit -m "$(cat <<'EOF'
Add Fact types + VerificationBadge + ConfidenceBar + FactCard

VerificationBadge: status-colored mono pill (confirmed=green,
corroborated=cyan, disputed=orange, retracted=red strikethrough,
unverified=muted). ConfidenceBar: 3px gradient bar (red < 0.5 <
amber < 0.75 < green) with % label; NULL renders empty bar + dash.
FactCard: category label + badge + title + content + confidence +
source pills (hostnames) + last-verified date.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `/facts` page + FactsClient + TopBar nav link

**Files:**
- Create: `app/facts/page.tsx`
- Create: `components/facts/FactsClient.tsx`
- Modify: `components/ops/TopBar.tsx`

- [ ] **Step 1: Write `FactsClient.tsx`**

Create `/Users/claude/Projects/project_contagion/components/facts/FactsClient.tsx`:

```tsx
'use client';
import { useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Fact, FactCategory, VerificationStatus } from '@/lib/types';
import { FactCard } from './FactCard';

const CATEGORIES: FactCategory[] = [
  'pathogen', 'transmission', 'clinical', 'epidemiology',
  'containment', 'history', 'outbreak_timeline', 'policy',
];

const STATUSES: VerificationStatus[] = ['confirmed', 'corroborated', 'unverified', 'disputed'];

export function FactsClient({ facts }: { facts: Fact[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const category = searchParams.get('category') as FactCategory | null;
  const verification = searchParams.get('verification') as VerificationStatus | null;
  const q = searchParams.get('q') ?? '';

  function setParam(key: string, value: string | null) {
    const u = new URLSearchParams(searchParams.toString());
    if (value == null || value === '') u.delete(key);
    else u.set(key, value);
    const qs = u.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return facts
      .filter((f) => {
        if (category && f.category !== category) return false;
        if (verification && f.verification_status !== verification) return false;
        if (f.verification_status === 'retracted' && verification !== 'retracted') return false;
        if (ql && !`${f.title} ${f.content}`.toLowerCase().includes(ql)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        const ac = a.confidence ?? -1;
        const bc = b.confidence ?? -1;
        return bc - ac;
      });
  }, [facts, category, verification, q]);

  return (
    <main className="mx-auto flex max-w-[960px] flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-mono text-[26px] font-bold leading-tight tracking-[-0.01em] text-text">
          KNOWLEDGE BASE
        </h1>
        <p className="mt-1 max-w-[60ch] text-[13px] leading-[1.5] text-text-secondary">
          Verified facts about the outbreak. Each entry has a confidence score and source attribution.
          Pipeline writes corroborate or supersede entries as new intel comes in.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-2 border-y border-border py-3 font-mono text-[10.5px] uppercase tracking-[0.1em]">
        <span className="text-text-muted">CATEGORY</span>
        <button
          onClick={() => setParam('category', null)}
          className={`border px-2 py-1 ${
            !category ? 'border-green text-text' : 'border-border text-text-muted hover:text-text'
          }`}
        >
          ALL
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setParam('category', c)}
            className={`border px-2 py-1 ${
              category === c ? 'border-green text-text' : 'border-border text-text-muted hover:text-text'
            }`}
          >
            {c.replace('_', ' ')}
          </button>
        ))}

        <span className="ml-4 text-text-muted">STATUS</span>
        <select
          value={verification ?? ''}
          onChange={(e) => setParam('verification', e.target.value || null)}
          className="border border-border bg-surface px-2 py-1 text-text"
        >
          <option value="">ANY</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="retracted">retracted</option>
        </select>

        <input
          type="search"
          placeholder="search…"
          value={q}
          onChange={(e) => setParam('q', e.target.value || null)}
          className="ml-auto w-48 border border-border bg-surface px-2 py-1 text-text placeholder:text-text-muted"
        />
      </section>

      {filtered.length === 0 ? (
        <p className="border border-dashed border-border p-6 text-center text-sm text-text-muted">
          No facts match these filters.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((f) => (
            <FactCard key={f.id} fact={f} />
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Write `app/facts/page.tsx`**

Create `/Users/claude/Projects/project_contagion/app/facts/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase-server';
import { FactsClient } from '@/components/facts/FactsClient';
import { TopBar } from '@/components/ops/TopBar';
import type { Fact, Snapshot } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Knowledge Base — Pathwatch',
  description: 'Verified facts about the 2026 MV Hondius hantavirus outbreak.',
};

export default async function FactsPage() {
  const supabase = createServerClient();
  const [factsRes, snapshotRes] = await Promise.all([
    supabase
      .from('facts')
      .select('*')
      .eq('disease', 'hantavirus')
      .order('category', { ascending: true })
      .order('confidence', { ascending: false, nullsFirst: false }),
    supabase
      .from('snapshots')
      .select('*')
      .eq('disease', 'hantavirus')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const facts = (factsRes.data as Fact[] | null) ?? [];
  const snapshot = (snapshotRes.data as Snapshot | null) ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar snapshot={snapshot} />
      <FactsClient facts={facts} />
    </div>
  );
}
```

- [ ] **Step 3: Add `/facts` link to TopBar**

Open `/Users/claude/Projects/project_contagion/components/ops/TopBar.tsx`. Find the `<span className="text-text-muted">OPS CONSOLE</span>` line. Replace it with:

```tsx
      <span className="text-text-muted">OPS CONSOLE</span>
      <Link
        href="/facts"
        className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-secondary hover:text-text"
      >
        FACTS
      </Link>
```

- [ ] **Step 4: Verify**

```bash
npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 5: Manual smoke**

```bash
./scripts/reset-db.sh > /dev/null 2>&1
(lsof -ti :3000 | xargs kill -9 2>/dev/null || true)
rm -rf .next
nohup npm run dev > /tmp/next-dev.log 2>&1 &
sleep 12
curl -s http://localhost:3000/facts | grep -oE 'KNOWLEDGE BASE|CONFIRMED|Andes orthohantavirus|PATHOGEN|FACTS' | sort -u
pkill -f "next dev" 2>/dev/null
sleep 1
true
```

Expected: prints `Andes orthohantavirus`, `CONFIRMED`, `FACTS`, `KNOWLEDGE BASE`, `PATHOGEN`.

- [ ] **Step 6: Commit**

```bash
git add app/facts components/facts/FactsClient.tsx components/ops/TopBar.tsx
git commit -m "$(cat <<'EOF'
Add /facts page + FactsClient filters + TopBar nav link

RSC fetches all facts for hantavirus, hands to client wrapper.
FactsClient state lives in URL params (?category=, ?verification=,
?q=) so filters are shareable. Sorts by category alphabetical
then confidence desc within. Retracted facts hidden unless
explicitly selected. TopBar gains a FACTS link.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Pipeline runbook

**Files:**
- Create: `docs/runbooks/pipeline.md`

- [ ] **Step 1: Write the runbook**

Create `/Users/claude/Projects/project_contagion/docs/runbooks/pipeline.md`:

````markdown
# Pathwatch Pipeline Runbook

**Audience:** Future Claude instance (or human operator) driving the Cowork session that scrapes, fact-checks, and writes data into the Pathwatch Supabase database.

**Read this at session start before doing any pipeline work.**

## What you are

You ARE the pipeline. There is no scheduled cron, no headless agent — you operate it from a Cowork session running on the Mac mini. Each "cycle" you run = one full scrape → dedupe → process → fact-check → write loop. The dashboard at https://pathwatch-phi.vercel.app reads what you write.

## Connection

| | |
|---|---|
| Supabase URL | `https://wtatysorlkcteleqjzkm.supabase.co` |
| Schema | events, snapshots, country_stats, scrape_log, cases, case_locations, facts |
| Service role key | Supabase dashboard → Settings → API Keys → "Secret key". **Never commit this.** Read it into the session env on each cycle. |
| Realtime | Enabled on events, snapshots, country_stats, cases, case_locations, facts |

## Cycle cadence

| Mode | Frequency | When |
|---|---|---|
| Active | every 15–30 min | normal monitoring |
| Off-hours | every 60 min | midnight–6 AM local |
| Surge | every 5–10 min | new country reports a case, WHO press conference, DON update, or fatality count change |

A "cycle" = the 5 steps below. Aim for ~10–15 min wall-clock per cycle.

## Per-cycle ops

### 1. Scrape

Sources, in order of priority:

| Source | Endpoint / query |
|---|---|
| **WHO DON** | https://www.who.int/emergencies/disease-outbreak-news — read for any new entries since last cycle |
| **CDC** | RSS https://tools.cdc.gov/api/v2/resources/media/rss — filter for hantavirus terms |
| **ECDC** | https://www.ecdc.europa.eu/en — search "hantavirus" |
| **Africa CDC** | https://africacdc.org/ — search "hantavirus" |
| **Google News** | search `"hantavirus 2026"` and `"MV Hondius"` |
| **Reddit** | https://www.reddit.com/r/{worldnews,medicine,epidemiology,health}/search.json?q=hantavirus&sort=new&t=day |
| **BlueSky** | search API for "hantavirus" |
| **X/Twitter** | via Chrome MCP — search `hantavirus OR "hanta virus" OR "MV Hondius" OR "andes virus"`, top 20–30 results since last scrape, 2–5 sec random delays between page loads |
| **Wikipedia** | https://en.wikipedia.org/wiki/MV_Hondius_hantavirus_outbreak — check for substantive edits |

Capture: URL, full text, author/handle, timestamp, engagement counts. Persist raw text in `events.raw_content`.

### 2. Dedupe

For each scraped item:

1. **URL hash exact match**: the DB has a unique partial index on `events.source_url_hash` — duplicate URLs error on insert. If you hit `23505`, the item is already stored.
2. **Semantic similarity** against events from the last 48h. If it's a new source reporting the same story, INSERT a new event with `duplicate_of` = the original event's id. (Allows corroboration counting later.)
3. **Corroboration trigger**: 3+ independent sources reporting the same claim → run a fact-check pass against the `facts` table.

### 3. Process & score

For each unique item:

- **Classify** category from this list: `case_report | policy | research | travel_advisory | mutation | death | containment | speculation`
- **Extract** numeric values where possible: `case_count`, `death_count`, geographic location (country/region/city), lat/lng
- **Geocode** via known centroids when lat/lng missing
- **Score significance** 1–5:
  - **5 (Critical)**: first case in new country, major policy change, significant death-toll increase, WHO emergency declaration
  - **4 (High)**: official government statement, travel advisory, new research findings
  - **3 (Notable)**: case-count update, expert opinion, containment measure
  - **2 (Low)**: local news coverage, useful social-media discussion
  - **1 (Routine)**: general discussion, speculation, reposts of known info
- **Tag** with strain (`andes-virus`), context (`mv-hondius`), and topic (`transmission`, `cfr`, `human-to-human`, etc.)

### 4. Fact-check

For every claim in the new item:

```
Does it match an existing CONFIRMED fact?
├── Yes → score routine (sig 1–2), note corroboration in tags
└── No
    ├── Does it CONTRADICT an existing CONFIRMED fact?
    │   └── Yes → flag, score 3+, tag 'contradicts-known-fact', DO NOT auto-update facts
    └── Is it a NEW factual claim?
        ├── Tier-1 source (WHO/CDC/ECDC/Africa CDC/peer-reviewed)?
        │   → INSERT facts row, status='confirmed', confidence 0.9–1.0
        ├── 2+ independent credible sources?
        │   → INSERT facts row, status='corroborated', confidence 0.7–0.9
        ├── Single credible source?
        │   → INSERT facts row, status='unverified', confidence 0.4–0.7
        └── Single uncredible source (Reddit / random social)?
            → DO NOT create fact yet; only log event with sig 1–2; watch for corroboration
```

Speculation, opinion, analysis → log as event with category `speculation` or `research`. **Never** add to facts.

### 5. Write

For each processed item:

```
INSERT events (with extracted fields)

If fact-check produced a new confirmed/corroborated fact:
  INSERT or UPDATE facts (UNIQUE (disease, title) is idempotent guard)

If case-related (new MVH-### or CH-### or contact dossier):
  UPDATE or INSERT cases (status, dossier append at end)
  INSERT case_locations rows for any new movement

If country-level case count changed:
  UPSERT country_stats (cases, deaths, latest_case_date)

INSERT scrape_log row (source, results_found, events_created, duplicates_skipped, error?, duration_ms)
```

After writing, **every 4th cycle** (or immediately on a sig-5 event):

```
Aggregate fresh totals from country_stats.
Compare to last snapshot.
If material change:
  INSERT snapshots (total_cases, total_deaths, countries_affected, fatality_rate, trend, trend_description, risk_level, key_developments[], ai_analysis)
```

## Source credibility tiers

| Tier | Examples |
|---|---|
| **1 (highest)** | WHO, CDC, ECDC, Africa CDC, national health ministries, peer-reviewed (Lancet, NEJM, Nature, JAMA) |
| **2** | Major wire services (Reuters, AP), established medical journalists, university research labs |
| **3** | Major news outlets (NYT, BBC, Guardian), verified medical professionals on social media |
| **4** | Reddit threads, unverified social media, blogs, Wikipedia (early-signal only, never confirmation) |

## Confidence scoring

| Range | Meaning |
|---|---|
| **0.95–1.0** | WHO/CDC official statement, peer-reviewed data |
| **0.85–0.95** | Multiple Tier 1–2 sources agree |
| **0.70–0.85** | Tier 2 source + corroboration |
| **0.50–0.70** | Single credible source, no contradiction |
| **0.30–0.50** | Unverified but plausible |
| **< 0.30** | Don't store as a fact; events table only |

## Fact maintenance

Every 6–12 hours during active monitoring:

1. Walk all `unverified` facts. Has new evidence emerged? → upgrade or remove.
2. Walk all `corroborated` facts. Has an official source confirmed? → upgrade.
3. Check whether any `confirmed` fact has been contradicted. → mark `disputed`.
4. Update `last_verified_at` on facts that re-confirmed.
5. Refresh the snapshot row with current aggregates.

When you supersede a fact:
- Set old fact's `verification_status='retracted'`
- Set old fact's `superseded_by = <new fact id>`
- INSERT the new fact normally

## Cross-referencing case dossiers

When updating `cases.dossier`, reference confirmed facts by title:

> "Confirmed ANDV via RT-PCR (see fact: *Causative agent identified as Andes orthohantavirus (ANDV)*)"

Never include unverified claims in dossiers. Only `confirmed` or `corroborated`.

## PII rule

**Never write real names to the database.** Use case codes (MVH-001, CH-001) in dossiers and event summaries. If a source mentions a name, anonymize in your write.

## Dossier append format

When updating an existing case dossier, don't rewrite from scratch. Append:

```
[Updated 2026-05-08 14:00 UTC] Swiss authorities confirm patient stable on oxygen support; no ventilation required.
```

## Snapshot AI-analysis style

Write the `ai_analysis` field as if briefing a decision-maker — concise, factual, forward-looking. What changed, what it means, what to watch for. ~3–6 sentences. Same voice as the existing seed snapshot.

## Error handling

| Error | Response |
|---|---|
| Source unreachable | Log error in `scrape_log`, continue to next source. Retry on next cycle. |
| X rate limited | Back off X for 30 min. Continue with other sources. |
| Supabase write fails | Retry once. If still fails, log error and surface in chat. |
| Chrome disconnected | Log error, fall back to non-X sources, alert user to reconnect. |
| Conflicting Tier-1 sources | Mark fact `disputed`. Surface in chat. Don't pick a winner without operator input. |

## Surge triggers

Switch to 5–10 min cycle cadence on:

- New country reports a case
- WHO press briefing or new DON entry
- Death-count change
- Confirmed mutation
- Border closure or major travel advisory change

## Session-end checklist

When you stop a Cowork session:

1. Run one final cycle.
2. Confirm `scrape_log` shows the last cycle's row.
3. Note in chat the most recent `events.created_at` timestamp so the next session knows where to resume.
````

- [ ] **Step 2: Verify**

```bash
ls -la docs/runbooks/pipeline.md
wc -l docs/runbooks/pipeline.md
```

Expected: file exists, ~150-200 lines.

- [ ] **Step 3: Commit**

```bash
git add docs/runbooks/pipeline.md
git commit -m "$(cat <<'EOF'
Add Cowork pipeline runbook

Markdown protocol for the Cowork session that scrapes, fact-
checks, and writes outbreak intel into Supabase. Covers:
connection details, cycle cadence (active/off-hours/surge),
per-cycle ops (scrape → dedupe → process → fact-check → write),
source credibility tiers, confidence scoring rubric, fact
maintenance, PII rule, dossier append format, snapshot AI
voice, error handling, surge triggers, session-end checklist.

Read at session start. Future Claude instances will operate
the pipeline from this runbook.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Smoke test extension + final local verification

**Files:**
- Modify: `tests/dashboard.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Append `/facts` smoke spec**

Open `/Users/claude/Projects/project_contagion/tests/dashboard.spec.ts`. Before the closing of the last test (`OG image generates`), add a new test before it (or after — either works):

```ts
test('/facts renders the knowledge base', async ({ page }) => {
  await page.goto('/facts');
  await expect(page.getByRole('heading', { name: 'KNOWLEDGE BASE' })).toBeVisible();
  await expect(page.getByText(/Andes orthohantavirus/i).first()).toBeVisible();
  await expect(page.getByText('CONFIRMED').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'PATHOGEN' })).toBeVisible();
});
```

- [ ] **Step 2: Run full smoke**

```bash
npm run test:smoke 2>&1 | tail -10
```

Expected: `6 passed`.

- [ ] **Step 3: Run lint + typecheck + build**

```bash
npm run lint && npm run typecheck && npm run build 2>&1 | tail -8
```

Expected: build output includes `/facts` as dynamic route. All exit 0.

- [ ] **Step 4: Update `README.md`**

Open `/Users/claude/Projects/project_contagion/README.md`. In the "Schema overview" section, append after the four-table list:

```markdown
- `cases` + `case_locations` — individual infected persons (anonymized via case_code) and their travel timelines.
- `facts` — verified knowledge base; entries written by the pipeline with verification status + confidence + sources.
```

In the "Notes for non-Docker-Desktop setups" section, just before "## Design", add:

```markdown
## Pipeline runbook

The Cowork session that operates the data pipeline reads `docs/runbooks/pipeline.md` at session start. That document codifies the scrape → dedupe → fact-check → write cycle, source credibility tiers, confidence scoring, and error handling.
```

- [ ] **Step 5: Commit**

```bash
git add tests/dashboard.spec.ts README.md
git commit -m "$(cat <<'EOF'
Add /facts smoke spec + README updates

Sixth Playwright spec asserts /facts renders KNOWLEDGE BASE
heading, the Andes orthohantavirus pathogen seed fact, at least
one CONFIRMED badge, and the PATHOGEN category filter button.
README adds cases/case_locations/facts to the schema overview
and links the new pipeline runbook.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Push to remote + production deploy verify

**Files:** none (operational).

- [ ] **Step 1: Push the new migration to remote**

```bash
echo "Y" | supabase db push 2>&1 | tail -5
```

Expected: applies `20260508120000_facts_schema.sql` to remote. Prints "Finished supabase db push."

- [ ] **Step 2: Verify migration list matches**

```bash
supabase migration list 2>&1 | grep 20260508120000
```

Expected: `20260508120000 | 20260508120000 | …` (Local and Remote both populated).

- [ ] **Step 3: Seed remote facts**

```bash
supabase db query --linked --file supabase/seed-facts.sql 2>&1 | tail -5
```

Expected: `rows: []` and no error. (ON CONFLICT clause makes it idempotent.)

- [ ] **Step 4: Verify remote facts count**

```bash
supabase db query --linked "SELECT count(*) FROM facts" 2>&1 | tail -10
```

Expected: count = 18.

- [ ] **Step 5: Push to GitHub → Vercel auto-deploys**

```bash
git push origin main 2>&1 | tail -3
```

Expected: `main -> main` pushed. Vercel webhook fires within seconds.

- [ ] **Step 6: Wait for Vercel build to complete**

Wait ~90 seconds, then:

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" --max-time 15 https://pathwatch-phi.vercel.app/facts
```

Expected: HTTP 200. (If 404 or 500, the build is still running — wait another 60 seconds and retry.)

- [ ] **Step 7: Smoke production `/facts`**

```bash
curl -s --max-time 15 https://pathwatch-phi.vercel.app/facts | grep -oE 'KNOWLEDGE BASE|Andes orthohantavirus|CONFIRMED|PATHOGEN' | sort -u
```

Expected: prints all four terms.

- [ ] **Step 8: No commit needed**

This task is operational; no local file changes.

---

## Verification (full plan complete)

After Task 7:
- Local: `facts` table exists with 18 rows (`SELECT count(*) FROM facts` returns 18).
- Local: full pgTAP suite green (9 test files).
- Local: `npm run lint` / `typecheck` / `build` / `test:smoke` (6 specs) all pass.
- Remote: migration applied + 18 facts seeded.
- Production: https://pathwatch-phi.vercel.app/facts returns 200 with rendered facts.
- Pipeline runbook lives at `docs/runbooks/pipeline.md`.

## Out of scope (future)

- Sub-project 4: pipeline automation (cron, MCP servers, headless agent harness)
- Editing facts via the UI
- `/fact/[id]` permalinks
- pgvector / semantic search of `content`
- Realtime updates on `/facts`
- Multi-disease facts navigation
- Tags filter UI on /facts
