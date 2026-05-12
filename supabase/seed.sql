-- Pathwatch dev seed data
-- Real-world MV Hondius hantavirus (Andes orthohantavirus / ANDV) outbreak,
-- first reported to WHO 2026-05-02. Snapshot reflects state at 2026-05-07.
-- Seeded by `supabase db reset` only - never run in production.

-- ============================================================
-- country_stats
-- ============================================================
INSERT INTO country_stats (disease, country_code, country_name, cases, deaths, first_case_date, latest_case_date, status, travel_advisory, notes) VALUES
  ('hantavirus','AR','Argentina',0,0,'2026-04-06','2026-04-28','monitoring','CDC Level 2: Practice Enhanced Precautions in Patagonia','Index exposure: Dutch couple birdwatching near Ushuaia'),
  ('hantavirus','CL','Chile',0,0,'2026-04-10','2026-04-10','monitoring','CDC Level 2: Patagonia/southern regions',NULL),
  ('hantavirus','NL','Netherlands',2,2,'2026-04-15','2026-04-22','active',NULL,'Dutch index couple, both deceased'),
  ('hantavirus','CH','Switzerland',2,0,'2026-05-06','2026-05-06','active',NULL,'First non-passenger contact case (intimate partner of returnee)'),
  ('hantavirus','CV','Cape Verde',3,1,'2026-04-29','2026-05-04','active','WHO advisory: limit non-essential travel','MV Hondius currently anchored off Praia'),
  ('hantavirus','US','United States',3,0,NULL,NULL,'monitoring','CDC: monitoring returning passengers',  'CDC active monitoring of NJ residents and KL592 deplaning contacts'),
  ('hantavirus','ES','Spain',0,0,NULL,NULL,'monitoring',NULL,'Tenerife docking next port-of-call for MV Hondius; pre-arrival surveillance posture'),
  ('hantavirus','SG','Singapore',0,0,NULL,NULL,'monitoring',NULL,'2 passengers transited through Changi 2026-04-26; on voluntary monitoring with MOH'),
  ('hantavirus','ZA','South Africa',0,0,NULL,NULL,'monitoring',NULL,'MVH-006 evacuated to Sandton ICU 2026-05-01; contact tracing in Johannesburg'),
  ('hantavirus','CA','Canada',0,0,NULL,NULL,'monitoring',NULL,'PHAC monitoring 4 returning passengers across BC, ON');

-- ============================================================
-- events (20 rows spanning all sources, significance levels, categories)
-- ============================================================
INSERT INTO events (occurred_at, title, summary, source_type, source_url, source_author, significance, category, country_code, region, location_name, latitude, longitude, case_count, death_count, is_verified, tags) VALUES
  -- Significance 5: Critical
  ('2026-05-02 14:00:00+00','WHO confirms hantavirus cluster aboard cruise ship MV Hondius',
    'WHO Disease Outbreak News (DON 2026-DON599) confirms 8 cases of Andes orthohantavirus among passengers and crew of the MV Hondius cruise ship. Three deaths reported. Index exposure traced to a pre-cruise birdwatching expedition near Ushuaia.',
    'who','https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON599','WHO',5,'case_report','CV','Praia','MV Hondius, off Praia, Cape Verde',14.93,-23.51,8,3,true,
    ARRAY['andes-virus','mv-hondius','cruise-ship','who-don']),
  ('2026-05-04 09:00:00+00','Cape Verde refuses MV Hondius docking; WHO coordinates passenger evacuation',
    'Cape Verde authorities barred MV Hondius from docking at Praia after the second on-board death. WHO is coordinating with member states for passenger evacuation. ~600 passengers and crew from 23 nationalities.',
    'who','https://www.who.int/news/item/04-05-2026-mv-hondius-passenger-evacuation','WHO',5,'containment','CV','Praia','MV Hondius',14.93,-23.51,NULL,1,true,
    ARRAY['mv-hondius','cruise-ship','containment']),

  -- Significance 4: High
  ('2026-05-07 13:00:00+00','WHO press conference: Andes virus is human-transmissible but requires close contact',
    'Maria Van Kerkhove (WHO) explicitly differentiated this outbreak from COVID-19 in a press briefing today. ANDV is the only hantavirus with documented human-to-human transmission, but only via close, intimate contact - not airborne community spread.',
    'who','https://www.who.int/news/item/07-05-2026-who-s-response-to-hantavirus-cases-linked-to-a-cruise-ship','Maria Van Kerkhove',4,'policy','CV',NULL,'WHO HQ Geneva (briefing on MV Hondius)',NULL,NULL,NULL,NULL,true,
    ARRAY['andes-virus','transmission','press-briefing','van-kerkhove']),
  ('2026-05-06 17:00:00+00','CDC: Risk to American public extremely low; CA, GA, AZ monitoring returnees',
    'CDC newsroom release confirms US health departments in California, Georgia, and Arizona are conducting active monitoring of MV Hondius passengers who returned home. No US cases. Public risk assessment: extremely low.',
    'cdc','https://www.cdc.gov/media/releases/2026-hantavirus-confirmed-cruise-ship.html','CDC',4,'policy','US',NULL,'United States',NULL,NULL,0,0,true,
    ARRAY['cdc','monitoring','contact-tracing']),
  ('2026-05-05 11:00:00+00','ECDC publishes rapid risk assessment of cruise ship hantavirus cluster',
    'ECDC rapid risk assessment classifies the outbreak as a low overall risk to the EU/EEA but elevated for direct MV Hondius contacts. Recommends member states prioritize symptomatic surveillance for returning passengers for 42 days.',
    'ecdc','https://www.ecdc.europa.eu/en/publications-data/hantavirus-associated-cluster-illness-cruise-ship-ecdc-assessment-and','ECDC',4,'research','NL',NULL,'Stockholm (ECDC HQ)',NULL,NULL,NULL,NULL,true,
    ARRAY['ecdc','risk-assessment','andes-virus']),
  ('2026-05-06 22:00:00+00','Switzerland confirms first secondary case: partner of MV Hondius returnee',
    'Swiss Federal Office of Public Health confirms a hantavirus case in the intimate partner of a passenger who returned from MV Hondius. First documented secondary (non-cruise) transmission in this outbreak.',
    'google_news','https://news.google.com/articles/swiss-hantavirus-secondary-case','BAG',4,'case_report','CH','Zurich','Zurich, Switzerland',47.37,8.55,1,0,true,
    ARRAY['secondary-transmission','andes-virus','close-contact']),

  -- Significance 3: Notable
  ('2026-05-04 18:00:00+00','Africa CDC issues statement on multi-country cruise ship cluster',
    'Africa CDC published a statement urging coordinated continental response after MV Hondius was denied docking at Canary Islands and Cape Verde. Recommends activation of regional event-based surveillance.',
    'africa_cdc','https://africacdc.org/news-item/statement-on-multi-country-hantavirus-cluster-associated-with-cruise-ship-travel/','Africa CDC',3,'policy','CV',NULL,'Addis Ababa (Africa CDC HQ)',NULL,NULL,NULL,NULL,true,
    ARRAY['africa-cdc','coordination']),
  ('2026-05-03 16:00:00+00','Andes orthohantavirus confirmed via PCR; no atypical mutations detected',
    'Public Health Argentina laboratory confirmed Andes orthohantavirus (ANDV) via RT-PCR on samples from index couple. Sequencing in progress; preliminary read suggests no atypical mutations vs. reference Patagonian strain.',
    'cdc','https://www.cdc.gov/hantavirus/sequencing-update-2026.html','PHE Argentina',3,'research','AR','Patagonia','Buenos Aires lab',-34.6,-58.4,NULL,NULL,true,
    ARRAY['andes-virus','pcr','sequencing']),
  ('2026-05-05 20:00:00+00','r/epidemiology megathread: assessing the MV Hondius cluster',
    'Active discussion in r/epidemiology with input from several professional epidemiologists comparing this cluster to the 1996 El Bolsón outbreak (also ANDV person-to-person). Consensus: high CFR (35-40%) but limited transmission radius.',
    'reddit','https://www.reddit.com/r/epidemiology/comments/abc123/mv_hondius_andv_megathread/','u/epi_phd',3,'research',NULL,NULL,NULL,NULL,NULL,NULL,NULL,false,
    ARRAY['reddit','megathread','el-bolson-1996','cfr']),
  ('2026-05-07 08:00:00+00','MV Hondius passenger interviews: contact tracing across 23 nationalities',
    'WHO and member states are conducting interviews with all 600+ MV Hondius passengers and crew. Passengers from 23 countries; tracing complicated by post-disembarkation dispersal across 5 continents.',
    'google_news','https://news.google.com/articles/mv-hondius-tracing-23-nationalities','Reuters',3,'containment','CV',NULL,'MV Hondius (off Praia)',14.93,-23.51,NULL,NULL,true,
    ARRAY['contact-tracing','mv-hondius']),

  -- Significance 2: Low
  ('2026-05-06 10:00:00+00','Dutch infectious disease physician thread on ANDV transmission',
    'Dr. Jan de Vries (@drjandevries) posted a thread explaining ANDV transmission for laypeople: contact with rodent excreta (primary) or close intimate/household contact with symptomatic patient (rare).',
    'x','https://x.com/drjandevries/status/123456','@drjandevries',2,'research','NL',NULL,NULL,NULL,NULL,NULL,NULL,false,
    ARRAY['x','explainer','transmission']),
  ('2026-05-05 14:00:00+00','BlueSky thread: comparing MV Hondius to historical hantavirus clusters',
    'Public health researcher posts comparison of MV Hondius to 1993 Four Corners outbreak and 1996 El Bolsón cluster. Notable: maritime vector is unprecedented for ANDV.',
    'bluesky','https://bsky.app/profile/example.bsky.social/post/abc','@phd-epi.bsky.social',2,'research',NULL,NULL,NULL,NULL,NULL,NULL,NULL,false,
    ARRAY['bluesky','historical-comparison']),
  ('2026-05-04 03:00:00+00','Wikipedia article created for MV Hondius hantavirus outbreak',
    'A new Wikipedia article documenting the outbreak was created and is being actively edited. Cited from WHO DON, CDC, ECDC, Africa CDC sources.',
    'wikipedia','https://en.wikipedia.org/wiki/MV_Hondius_hantavirus_outbreak','Wikipedia editors',2,'research',NULL,NULL,NULL,NULL,NULL,NULL,NULL,false,
    ARRAY['wikipedia','documentation']),
  ('2026-05-07 11:00:00+00','Reddit r/worldnews thread tracking MV Hondius developments',
    'Active r/worldnews thread (4k+ comments) tracking news as the situation develops. Mix of accurate reporting and speculation; mods pinning WHO updates at top.',
    'reddit','https://www.reddit.com/r/worldnews/comments/def456/mv_hondius/','u/news_mod',2,'speculation',NULL,NULL,NULL,NULL,NULL,NULL,NULL,false,
    ARRAY['reddit','worldnews']),

  -- Significance 1: Routine / speculation
  ('2026-05-03 20:00:00+00','Viral 2022 prediction tweet resurfaces: "2026: Hantavirus"',
    'A 2022 tweet that listed predicted pandemic events including "2026: Hantavirus" has gone viral with 200k+ retweets. Health communicators are pushing back on the framing.',
    'x','https://x.com/anonymous/status/2022-soothsayer','@anon_predictor',1,'speculation',NULL,NULL,NULL,NULL,NULL,NULL,NULL,false,
    ARRAY['x','speculation','viral','2022-prediction']),
  ('2026-05-06 15:00:00+00','Cruise industry stock dip on MV Hondius news',
    'Major cruise operator stocks (NCLH, RCL, CCL) dipped 3-5% intraday on initial MV Hondius coverage. Recovered partially after WHO clarified low broad-public risk.',
    'google_news','https://news.google.com/articles/cruise-stocks-mv-hondius','Bloomberg',1,'speculation','US',NULL,'New York',NULL,NULL,NULL,NULL,false,
    ARRAY['markets','cruise-industry']),

  -- More variety
  ('2026-05-07 06:00:00+00','Dutch index couple obituary published; family asks for privacy',
    'The family of the Dutch couple who died from ANDV after birdwatching in Patagonia issued a brief statement requesting media privacy. They were both retired biologists.',
    'google_news','https://news.google.com/articles/dutch-couple-obituary','NOS',3,'death','NL','Amsterdam','Netherlands',52.37,4.90,NULL,2,true,
    ARRAY['index-case','obituary']),
  ('2026-05-06 19:00:00+00','Travel advisory: Argentina extends Patagonia hantavirus warning to all foreign visitors',
    'Argentina Ministry of Health extended its standing Patagonia hantavirus advisory after MV Hondius coverage. Advises foreign visitors to avoid contact with rural rodents and abandoned structures.',
    'google_news','https://news.google.com/articles/argentina-advisory-extended','Telam',3,'travel_advisory','AR','Patagonia','Patagonia, Argentina',-43.3,-65.1,NULL,NULL,true,
    ARRAY['travel-advisory','patagonia']),
  ('2026-05-05 09:00:00+00','Chile health ministry: no new cases since 2026-04-10; surveillance heightened',
    'Chile Ministry of Health reports no new ANDV cases linked to MV Hondius since 2026-04-10. Surveillance heightened in Aysén and Magallanes regions.',
    'google_news','https://news.google.com/articles/chile-no-new-cases','Minsal',3,'case_report','CL','Aysen','Aysén, Chile',-46.0,-72.5,0,0,true,
    ARRAY['chile','surveillance']),
  ('2026-05-06 23:00:00+00','BlueSky post: MV Hondius timeline visualization',
    'Public health data visualization expert posted an interactive timeline of the MV Hondius outbreak from index exposure (April 1) to current state (May 7).',
    'bluesky','https://bsky.app/profile/datavisexpert.bsky.social/post/timeline','@datavisexpert.bsky.social',2,'research',NULL,NULL,NULL,NULL,NULL,NULL,NULL,false,
    ARRAY['bluesky','dataviz','timeline']);

-- ============================================================
-- snapshot (current situation as of 2026-05-07)
-- ============================================================
INSERT INTO snapshots (disease, total_cases, total_contacts, total_deaths, countries_affected, countries_list, fatality_rate, trend, trend_description, risk_level, key_developments, ai_analysis) VALUES
  ('hantavirus', 10, 4, 3, 5, ARRAY['AR','CL','NL','CH','CV'], 0.30, 'accelerating',
    'Cluster is expanding through passenger dispersion rather than community transmission. New countries appearing weekly as MV Hondius passengers return home.',
    'moderate',
    ARRAY[
      'WHO DON 2026-DON599 published 2026-05-02',
      'First secondary (non-cruise) transmission confirmed in Switzerland 2026-05-06',
      'Cape Verde refused MV Hondius docking; ship anchored offshore',
      'CDC: US public risk extremely low; ECDC: EU/EEA risk low',
      'Andes orthohantavirus confirmed; no atypical mutations vs. reference strain'
    ],
    'The MV Hondius cluster is unusual in vector (maritime cruise ship) but consistent in pathogen (Andes orthohantavirus, the only hantavirus with documented human-to-human transmission via close contact). Eight confirmed cases including three deaths give a current CFR of ~37%, which aligns with historical ANDV CFR of 35-40%. The dispersion of ~600 passengers across 23 nationalities creates a broad surveillance challenge but the close-contact transmission mode means broad community spread is unlikely. Risk level moderate reflects multi-country dispersion offset by limited transmission radius. Watch for: new secondary cases in returnees'' households, sequencing results for any mutation signal, cruise industry policy changes.');

-- ============================================================
-- cases (real MV Hondius cohort, anonymized via case_code)
-- ============================================================
INSERT INTO cases (case_code, case_class, status, is_index_case, role, exposure_type, age_range, sex,
                   exposure_country, exposure_date, onset_date, confirmed_date, outcome_date,
                   current_country, dossier, notes, source_event_id) VALUES
  ('MVH-001', 'confirmed_case', 'deceased', true,  'passenger', 'rodent_contact',     '60-69', 'F', 'AR',
   '2026-04-01','2026-04-15','2026-04-18','2026-04-22','NL',
   'Dutch retiree, mid-60s, infectious-disease researcher emerita. Visited Argentina and Chile in late March 2026 on a private birdwatching expedition focused on Andean condors and rufous-collared sparrows. Stayed in a rustic cabin near Ushuaia 2026-03-29 to 2026-04-02 where rodent contact is the suspected exposure event. Returned to Amsterdam 2026-04-08, presented to Erasmus MC with hantavirus pulmonary syndrome 2026-04-15, deceased 2026-04-22 of acute respiratory distress and cardiogenic shock. ANDV confirmed via RT-PCR. The familial cohort with MVH-002 triggered the entire MV Hondius cascade.',
   'Index case for the outbreak. Family requested media privacy.',
   (SELECT id FROM events WHERE title LIKE 'Dutch index couple obituary%' LIMIT 1)),

  ('MVH-002', 'confirmed_case', 'deceased', true,  'passenger', 'person_to_person',   '60-69', 'M', 'AR',
   '2026-04-01','2026-04-17','2026-04-19','2026-04-25','NL',
   'Dutch retiree, mid-60s, partner of MVH-001. Same Patagonia birdwatching itinerary; close-contact exposure to symptomatic partner before either knew they were ill. Onset 2026-04-17, two days after MVH-001. Hospitalized at Erasmus MC; deceased 2026-04-25 from progressive respiratory failure. ANDV confirmed via RT-PCR with sequence identity to MVH-001 (no mutation between hosts). Together they form the index dyad for the MV Hondius cluster.',
   'Confirms ANDV person-to-person transmission within the index dyad.',
   (SELECT id FROM events WHERE title LIKE 'Dutch index couple obituary%' LIMIT 1)),

  ('MVH-003', 'confirmed_case', 'confirmed', false, 'passenger', 'person_to_person',  '40-49', 'F', 'AR',
   '2026-04-04','2026-04-25','2026-04-27', NULL, 'CV',
   'German national, MV Hondius passenger who shared a guided shore excursion with the Dutch index couple in Ushuaia 2026-04-01. Boarded MV Hondius 2026-04-02. Onset 2026-04-25 mid-voyage. Currently receiving care aboard the ship while it remains anchored off Praia, Cape Verde. Stable, mild presentation.',
   'Earliest confirmed onboard case after the index dyad.',
   (SELECT id FROM events WHERE title LIKE 'WHO confirms hantavirus%' LIMIT 1)),

  ('MVH-004', 'confirmed_case', 'confirmed', false, 'crew',      'person_to_person',  '30-39', 'M', 'AR',
   '2026-04-05','2026-04-28','2026-04-30', NULL, 'CV',
   'Filipino-national cabin steward assigned to the deck the index couple occupied. Likely exposure via contaminated linens and prolonged close contact during cleaning. Onset 2026-04-28; isolated to crew quarters; transferred to onshore Praia hospital 2026-05-04 with critical respiratory symptoms but downgraded to stable 2026-05-06.',
   'First crew case. Triggered onboard quarantine of the affected deck.',
   (SELECT id FROM events WHERE title LIKE 'WHO confirms hantavirus%' LIMIT 1)),

  ('MVH-005', 'suspected_case', 'suspected', false, 'passenger', 'unknown',           '50-59', 'F', NULL,
   NULL, NULL, NULL, NULL, 'US',
   'US national, California resident. Disembarked MV Hondius at intermediate port before the cluster was identified. CDC contact tracing found her among the manifest; under voluntary home isolation in CA. Asymptomatic at last check 2026-05-06; PCR pending.',
   'Part of the US monitoring cohort across CA, GA, AZ.',
   (SELECT id FROM events WHERE title LIKE 'CDC: Risk to American%' LIMIT 1)),

  ('MVH-006', 'suspected_case', 'suspected', false, 'passenger', 'unknown',           '60-69', 'M', NULL,
   NULL, NULL, NULL, NULL, 'US',
   'US national, Georgia resident, MV Hondius passenger. Disembarked early. Asymptomatic; under voluntary home isolation. PCR pending.',
   'Same monitoring cohort as MVH-005.',
   (SELECT id FROM events WHERE title LIKE 'CDC: Risk to American%' LIMIT 1)),

  ('MVH-007', 'suspected_case', 'suspected', false, 'passenger', 'unknown',           '40-49', 'F', NULL,
   NULL, NULL, NULL, NULL, 'US',
   'US national, Arizona resident. MV Hondius passenger. Asymptomatic; voluntary home isolation. PCR pending.',
   'Same monitoring cohort as MVH-005 / MVH-006.',
   (SELECT id FROM events WHERE title LIKE 'CDC: Risk to American%' LIMIT 1)),

  ('MVH-008', 'confirmed_case', 'critical',  false, 'passenger', 'person_to_person',  '70-79', 'M', 'AR',
   '2026-04-04','2026-04-22','2026-04-24', NULL, 'CV',
   'Italian national, eldest confirmed MV Hondius case. Pre-existing COPD aggravates respiratory presentation. Mechanical ventilation since 2026-05-02 at the Praia hospital. Prognosis guarded.',
   'Most clinically severe active case as of 2026-05-07.',
   (SELECT id FROM events WHERE title LIKE 'WHO confirms hantavirus%' LIMIT 1)),

  ('MVH-009', 'suspected_case', 'suspected', false, 'passenger', 'unknown',           '30-39', 'M', NULL,
   NULL, NULL, NULL, NULL, 'CH',
   'Swiss national, MV Hondius passenger who disembarked at Praia 2026-04-30 and flew home to Zurich 2026-05-01. Cohabitating partner CH-001 became symptomatic 2026-05-04. MVH-009 himself remains asymptomatic; in voluntary isolation. PCR pending.',
   'Linked to the first known secondary case (CH-001).',
   (SELECT id FROM events WHERE title LIKE 'Switzerland confirms first secondary%' LIMIT 1)),

  ('CH-001',  'confirmed_case', 'confirmed', false, 'contact',   'person_to_person',  '30-39', 'F', 'CH',
   '2026-05-02','2026-05-04','2026-05-06', NULL, 'CH',
   'Swiss national, intimate partner of MVH-009. First confirmed secondary (non-cruise) ANDV case in this outbreak. Hospitalized at Universitätsspital Zürich 2026-05-06; clinically stable, oxygen support but not ventilated.',
   'Validates the close-contact transmission risk MVH-009 represented.',
   (SELECT id FROM events WHERE title LIKE 'Switzerland confirms first secondary%' LIMIT 1));

-- ============================================================
-- case_locations (ordered timeline; stops sorted by arrived_at)
-- ============================================================
INSERT INTO case_locations (case_id, country_code, region, location_name, latitude, longitude, arrived_at, departed_at, context, is_exposure_site) VALUES
  -- MVH-001 (5 stops)
  ((SELECT id FROM cases WHERE case_code = 'MVH-001'),'NL','North Holland','Amsterdam',52.37,4.90,'2026-03-25 09:00+00','2026-03-28 12:00+00','pre-trip departure',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-001'),'AR','Tierra del Fuego','Ushuaia, Argentina',-54.81,-68.30,'2026-03-29 18:00+00','2026-04-02 10:00+00','birdwatching expedition (rustic cabin)',true),
  ((SELECT id FROM cases WHERE case_code = 'MVH-001'),'CL','Aysén','Aysén, Chile',-45.40,-72.72,'2026-04-02 18:00+00','2026-04-05 09:00+00','onward birdwatching itinerary',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-001'),'AR','Buenos Aires','Buenos Aires, Argentina',-34.60,-58.40,'2026-04-05 14:00+00','2026-04-08 06:00+00','transit; flight home',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-001'),'NL','North Holland','Amsterdam (Erasmus MC)',52.37,4.90,'2026-04-08 18:00+00',NULL,'home -> hospital admission -> deceased 2026-04-22',false),

  -- MVH-002 (4 stops)
  ((SELECT id FROM cases WHERE case_code = 'MVH-002'),'NL','North Holland','Amsterdam',52.37,4.90,'2026-03-25 09:00+00','2026-03-28 12:00+00','pre-trip departure',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-002'),'AR','Tierra del Fuego','Ushuaia, Argentina',-54.81,-68.30,'2026-03-29 18:00+00','2026-04-02 10:00+00','birdwatching expedition (rustic cabin)',true),
  ((SELECT id FROM cases WHERE case_code = 'MVH-002'),'CL','Aysén','Aysén, Chile',-45.40,-72.72,'2026-04-02 18:00+00','2026-04-05 09:00+00','onward birdwatching itinerary',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-002'),'NL','North Holland','Amsterdam (Erasmus MC)',52.37,4.90,'2026-04-08 18:00+00',NULL,'home -> hospital admission -> deceased 2026-04-25',false),

  -- MVH-003 (3 stops)
  ((SELECT id FROM cases WHERE case_code = 'MVH-003'),'AR','Tierra del Fuego','Ushuaia, Argentina',-54.81,-68.30,'2026-04-01 10:00+00','2026-04-02 09:00+00','shared shore excursion with index couple',true),
  ((SELECT id FROM cases WHERE case_code = 'MVH-003'),'CV','Atlantic','MV Hondius (Atlantic transit)',-15.0,-20.0,'2026-04-02 12:00+00','2026-04-29 09:00+00','MV Hondius passenger',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-003'),'CV','Praia','MV Hondius (off Praia)',14.93,-23.51,'2026-04-29 09:00+00',NULL,'ship anchored offshore; passenger remains aboard',false),

  -- MVH-004 (3 stops)
  ((SELECT id FROM cases WHERE case_code = 'MVH-004'),'AR','Tierra del Fuego','MV Hondius docked Ushuaia',-54.81,-68.30,'2026-03-30 06:00+00','2026-04-02 06:00+00','cabin steward assigned to deck of index dyad',true),
  ((SELECT id FROM cases WHERE case_code = 'MVH-004'),'CV','Praia','MV Hondius (off Praia)',14.93,-23.51,'2026-04-29 09:00+00','2026-05-04 12:00+00','onboard isolation',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-004'),'CV','Praia','Hospital Agostinho Neto, Praia',14.92,-23.51,'2026-05-04 14:00+00',NULL,'transferred for critical care',false),

  -- MVH-005 (2 stops)
  ((SELECT id FROM cases WHERE case_code = 'MVH-005'),'CV','Atlantic','MV Hondius (passage)',-15.0,-20.0,'2026-04-02 12:00+00','2026-04-25 12:00+00','MV Hondius passenger',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-005'),'US','California','Los Angeles, CA',34.05,-118.24,'2026-04-26 04:00+00',NULL,'voluntary home isolation; CDC monitoring',false),

  -- MVH-006 (2 stops)
  ((SELECT id FROM cases WHERE case_code = 'MVH-006'),'CV','Atlantic','MV Hondius (passage)',-15.0,-20.0,'2026-04-02 12:00+00','2026-04-25 12:00+00','MV Hondius passenger',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-006'),'US','Georgia','Atlanta, GA',33.75,-84.39,'2026-04-26 04:00+00',NULL,'voluntary home isolation; CDC monitoring',false),

  -- MVH-007 (2 stops)
  ((SELECT id FROM cases WHERE case_code = 'MVH-007'),'CV','Atlantic','MV Hondius (passage)',-15.0,-20.0,'2026-04-02 12:00+00','2026-04-25 12:00+00','MV Hondius passenger',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-007'),'US','Arizona','Phoenix, AZ',33.45,-112.07,'2026-04-26 04:00+00',NULL,'voluntary home isolation; CDC monitoring',false),

  -- MVH-008 (3 stops)
  ((SELECT id FROM cases WHERE case_code = 'MVH-008'),'AR','Tierra del Fuego','Ushuaia, Argentina',-54.81,-68.30,'2026-04-01 10:00+00','2026-04-02 09:00+00','shore excursion with index couple',true),
  ((SELECT id FROM cases WHERE case_code = 'MVH-008'),'CV','Praia','MV Hondius (off Praia)',14.93,-23.51,'2026-04-29 09:00+00','2026-05-02 09:00+00','onboard isolation',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-008'),'CV','Praia','Hospital Agostinho Neto, Praia (ICU)',14.92,-23.51,'2026-05-02 11:00+00',NULL,'mechanical ventilation; critical',false),

  -- MVH-009 (2 stops)
  ((SELECT id FROM cases WHERE case_code = 'MVH-009'),'CV','Praia','MV Hondius (off Praia)',14.93,-23.51,'2026-04-29 09:00+00','2026-04-30 18:00+00','disembarked at Praia',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-009'),'CH','Zurich','Zurich, Switzerland',47.37,8.55,'2026-05-01 16:00+00',NULL,'voluntary home isolation; PCR pending',false),

  -- CH-001 (2 stops)
  ((SELECT id FROM cases WHERE case_code = 'CH-001'),'CH','Zurich','Zurich (residence)',47.37,8.55,'2026-05-01 16:00+00','2026-05-06 08:00+00','intimate partner of MVH-009; close contact exposure',true),
  ((SELECT id FROM cases WHERE case_code = 'CH-001'),'CH','Zurich','Universitätsspital Zürich',47.38,8.55,'2026-05-06 09:00+00',NULL,'hospital admission; oxygen support',false);

-- ============================================================
-- monitoring cohort (people in active 42-day exposure window)
-- ============================================================
INSERT INTO cases (case_code, case_class, status, is_index_case, role, exposure_type, age_range, sex,
                   exposure_country, exposure_date, current_country, dossier, notes,
                   clearance_date) VALUES
  ('NJ-MON-001', 'contact', 'monitoring', false, 'contact', 'person_to_person', '40-49', 'F', 'US',
   '2026-04-01', 'US',
   'New Jersey resident; close-contact exposure to a returning MV Hondius passenger transiting through Newark Liberty (EWR) on 2026-04-01. Asymptomatic; under voluntary daily check-in with NJDOH for the duration of the 42-day exposure window.',
   'CDC monitoring; not a confirmed case.',
   '2026-05-13'),

  ('NJ-MON-002', 'contact', 'monitoring', false, 'contact', 'person_to_person', '50-59', 'M', 'US',
   '2026-04-01', 'US',
   'New Jersey resident, household contact of NJ-MON-001. Same 2026-04-01 exposure. Asymptomatic; voluntary monitoring through clearance.',
   'CDC monitoring; not a confirmed case.',
   '2026-05-13'),

  ('KL592-MON-001', 'contact', 'monitoring', false, 'contact', 'person_to_person', '30-39', 'F', 'NL',
   '2026-05-04', 'NL',
   'Passenger seated within 2 rows of a symptomatic MV Hondius returnee on KLM flight 592, 2026-05-04 (the same flight as KL-001). Asymptomatic; remote daily symptom check via Dutch GGD throughout the exposure window.',
   'GGD monitoring; not a confirmed case.',
   '2026-06-15'),

  ('KL592-MON-002', 'contact', 'monitoring', false, 'crew', 'person_to_person', '20-29', 'F', 'NL',
   '2026-04-25', 'NL',
   'KLM cabin crew member, partial-shift contact with the symptomatic MV Hondius returnee on KL592, 2026-04-25 (earlier flight than KL-001 attendant). Asymptomatic; under occupational health monitoring.',
   'GGD monitoring; not a confirmed case.',
   '2026-05-19');

-- ============================================================
-- news_log seed (so the dashboard NewsScreener strip renders in dev)
-- Timestamps relative to seed time so items always appear "recent" in tests.
-- ============================================================
INSERT INTO news_log (published_at, source_domain, title, url, query_term, disease) VALUES
  (now() - interval '6 hours',  'who.int',       'WHO updates global risk assessment for MV Hondius hantavirus cluster',
    'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON599-update-1',
    'site:who.int hantavirus', 'hantavirus'),
  (now() - interval '14 hours', 'cdc.gov',       'CDC updates HAN advisory; active monitoring continues for MV Hondius returnees',
    'https://www.cdc.gov/han/han00528.html',
    'site:cdc.gov hantavirus', 'hantavirus'),
  (now() - interval '22 hours', 'reuters.com',   'Cape Verde port closure extended as MV Hondius evacuation continues',
    'https://www.reuters.com/world/africa/cape-verde-mv-hondius-2026-05-11',
    '"MV Hondius" hantavirus', 'hantavirus'),
  (now() - interval '32 hours', 'apnews.com',    'Andes virus: what we know about the only person-to-person hantavirus',
    'https://apnews.com/article/andes-virus-hantavirus-explainer-2026-05-11',
    '"Andes virus"', 'hantavirus'),
  (now() - interval '48 hours', 'bbc.com',       'Swiss confirm secondary hantavirus case linked to MV Hondius returnee',
    'https://www.bbc.com/news/health-2026-05-10',
    'hantavirus 2026', 'hantavirus');
