-- Pathwatch dev seed data
-- Real-world MV Hondius hantavirus (Andes orthohantavirus / ANDV) outbreak,
-- first reported to WHO 2026-05-02. Snapshot reflects state at 2026-05-07.
-- Seeded by `supabase db reset` only - never run in production.

-- ============================================================
-- country_stats
-- ============================================================
INSERT INTO country_stats (disease, country_code, country_name, cases, deaths, first_case_date, latest_case_date, status, travel_advisory, notes) VALUES
  ('hantavirus','AR','Argentina',2,0,'2026-04-06','2026-04-28','monitoring','CDC Level 2: Practice Enhanced Precautions in Patagonia','Index exposure: Dutch couple birdwatching near Ushuaia'),
  ('hantavirus','CL','Chile',1,0,'2026-04-10','2026-04-10','monitoring','CDC Level 2: Patagonia/southern regions',NULL),
  ('hantavirus','NL','Netherlands',2,2,'2026-04-15','2026-04-22','active',NULL,'Dutch index couple, both deceased'),
  ('hantavirus','CH','Switzerland',1,0,'2026-05-06','2026-05-06','active',NULL,'First non-passenger contact case (intimate partner of returnee)'),
  ('hantavirus','CV','Cape Verde',2,1,'2026-04-29','2026-05-04','active','WHO advisory: limit non-essential travel','MV Hondius currently anchored off Praia');

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
INSERT INTO snapshots (disease, total_cases, total_deaths, countries_affected, countries_list, fatality_rate, trend, trend_description, risk_level, key_developments, ai_analysis) VALUES
  ('hantavirus', 8, 3, 5, ARRAY['AR','CL','NL','CH','CV'], 0.375, 'accelerating',
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
