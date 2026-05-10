import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { TopBar } from '@/components/ops/TopBar';
import type { Snapshot, ThreatAssessment } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Hantavirus FAQ — Symptoms, Spread, MV Hondius Outbreak',
  description:
    'Plain-English answers about hantavirus and the 2026 MV Hondius outbreak: how it spreads, symptoms, fatality rate, vaccine status, treatment, and pandemic risk.',
  alternates: { canonical: '/faq' },
};

const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is hantavirus?',
    a: 'Hantavirus is a family of viruses carried by rodents that can cause serious illness in humans. The strain in the 2026 MV Hondius outbreak is Andes orthohantavirus (ANDV) — a New World hantavirus endemic to southern Argentina and Chile, and the only hantavirus species known to spread between humans (in rare circumstances of close, prolonged contact). ANDV causes Hantavirus Cardiopulmonary Syndrome (HCPS), which affects the lungs and heart.',
  },
  {
    q: 'How does hantavirus spread?',
    a: 'The primary route is inhalation of aerosolized rodent urine, feces, or saliva in enclosed spaces — barns, cabins, abandoned buildings, landfills. The reservoir host for ANDV is the long-tailed pygmy rice rat (Oligoryzomys longicaudatus). For ANDV specifically, person-to-person spread is also documented, but it requires close and prolonged contact: shared living spaces, bedside care of severely symptomatic patients, or sustained face-to-face interaction. Casual or brief contact is not sufficient.',
  },
  {
    q: 'Is hantavirus airborne?',
    a: 'No, hantavirus is not airborne in the way measles or COVID-19 are. It cannot float through ventilation systems or infect people across a room from a single cough. Transmission requires either direct exposure to fresh rodent excreta in enclosed spaces, or close and prolonged contact with an infected person. A KLM flight attendant had 45 minutes of direct contact with a symptomatic MV Hondius patient (MVH-002) on flight KL592 and tested negative — WHO confirmed the brief encounter did not result in transmission.',
  },
  {
    q: 'Can hantavirus spread from person to person?',
    a: 'Only Andes virus (ANDV) — the strain in the MV Hondius outbreak — has documented person-to-person transmission, and only under specific conditions: close and prolonged contact with a symptomatic patient. Other hantaviruses (Sin Nombre, Hantaan, Seoul, Puumala, Dobrava) have no documented human-to-human spread. Person-to-person transmission was first proven in the 1996 El Bolsón outbreak in Argentina.',
  },
  {
    q: 'What is the MV Hondius hantavirus outbreak?',
    a: 'A cluster of hantavirus infections aboard the Dutch-flagged cruise ship MV Hondius, identified in April 2026. The likely index couple was exposed during a birdwatching excursion at Ushuaia landfill in Argentina before boarding the ship on April 1. The cluster spread among passengers and crew during the voyage. As of early May 2026 it includes confirmed and suspected cases in the Netherlands, Germany, Switzerland, the UK, Spain, Saint Helena, and the United States, with three deaths reported. The ship arrived in Tenerife on May 10 for managed disembarkation.',
  },
  {
    q: 'How deadly is hantavirus (case fatality rate)?',
    a: 'The case fatality rate for ANDV historically ranges from 30% to 50% — among the deadliest infectious diseases when contracted. The MV Hondius cluster currently shows 3 deaths from approximately 9 cases (about 33%). Death typically results from massive pulmonary edema and cardiogenic shock within 24–48 hours of severe respiratory symptoms developing. Survival is highest with early ECMO (extracorporeal membrane oxygenation) — up to 80% survival when started before cardiovascular collapse.',
  },
  {
    q: 'Is there a vaccine for hantavirus?',
    a: 'No licensed hantavirus vaccine exists anywhere in the world. The most advanced candidate is a DNA vaccine developed at the US Army Medical Research Institute of Infectious Diseases (USAMRIID), which has completed Phase 1 trials. Moderna has a preclinical mRNA collaboration with USAMRIID and Korea University but it is years from human availability. ANDV-specific candidates are in early-phase trials in Argentina and Chile.',
  },
  {
    q: "What's the treatment for hantavirus?",
    a: 'No specific antiviral works against hantavirus. Ribavirin showed no significant mortality reduction in meta-analysis and is not recommended. Treatment is purely supportive — intensive hemodynamic monitoring, careful fluid management, mechanical ventilation when needed. The most effective intervention for severe HCPS is ECMO (extracorporeal membrane oxygenation), which acts as a heart-lung bypass while the body clears the infection. ECMO achieves about 80% survival when started early, before full cardiovascular collapse.',
  },
  {
    q: 'How long is the hantavirus incubation period?',
    a: 'Incubation ranges from 9 to 40 days, with a median of about 18 days. This long and variable window is why public-health authorities (WHO, ECDC) recommend a 42-day surveillance period for contacts of confirmed cases. The MV Hondius outbreak response plans use the 42-day window for monitoring exposed passengers and crew.',
  },
  {
    q: 'What are the symptoms of hantavirus?',
    a: 'Hantavirus illness progresses in three phases. Phase 1 (prodromal, 1–5 days): fever, chills, severe muscle aches, headache, and gastrointestinal symptoms — clinically indistinguishable from flu. Phase 2 (cardiopulmonary): rapid onset of shortness of breath, fluid in the lungs, low blood pressure, and risk of cardiogenic shock. Phase 3 (convalescent or terminal). The transition from Phase 1 to Phase 2 can be rapid — within hours — making early recognition critical.',
  },
  {
    q: 'Could the MV Hondius outbreak become a pandemic?',
    a: 'Public-health authorities currently rate this as low likelihood. The reproduction number (R0) for ANDV person-to-person transmission is estimated below 1 (around 0.7 for the MV Hondius cluster), meaning each case infects fewer than one other person on average — outbreaks burn out rather than expand. WHO assesses global risk as LOW. CDC classifies the outbreak as Level 3 emergency activation (the lowest tier). Past ANDV outbreaks (1996 El Bolsón with 18 cases, 2018 Epuyén with 36 cases) both self-limited without sustained spread.',
  },
  {
    q: 'What past hantavirus outbreaks have occurred?',
    a: 'Two notable ANDV outbreaks predating MV Hondius. (1) El Bolsón, Argentina, 1996: 18 cases — the first outbreak to prove human-to-human transmission, with three physicians infected by their index patient. (2) Epuyén, Argentina, 2018–2019: 36 cases and 11 deaths, published in NEJM, demonstrating superspreader dynamics — Patient #1 infected 5 people in 90 minutes at a birthday party. Both outbreaks self-limited without sustained spread, consistent with R0 below 1.',
  },
  {
    q: 'Who is at highest risk for severe hantavirus disease?',
    a: 'Risk factors for severe HCPS include age 60+, pre-existing hypertension, diabetes, smoking history, higher viral load at presentation, and concurrent liver injury. American Indian women aged 40–64 have the highest demographic risk for hantavirus exposure historically. For the MV Hondius cluster, the index cases were a Dutch couple in their late 60s.',
  },
];

export default async function FaqPage() {
  noStore();
  const supabase = createServerClient();
  const [snapshotRes, threatRes] = await Promise.all([
    supabase
      .from('snapshots')
      .select('*')
      .eq('disease', 'hantavirus')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('threat_assessments')
      .select('*')
      .eq('disease', 'hantavirus')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const snapshot = (snapshotRes.data as Snapshot | null) ?? null;
  const threat = (threatRes.data as ThreatAssessment | null) ?? null;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Pathwatch', item: 'https://hantavirustracer.com/' },
        { '@type': 'ListItem', position: 2, name: 'FAQ', item: 'https://hantavirustracer.com/faq' },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar snapshot={snapshot} threat={threat} monitoringCount={0} caseCount={0} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto w-full max-w-[760px] px-6 py-10 text-text-secondary">
        <nav className="mb-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
          <Link href="/" className="hover:text-text">Pathwatch</Link>
          <span className="mx-2">›</span>
          <span>FAQ</span>
        </nav>
        <h1 className="mb-3 text-3xl font-bold text-text">Hantavirus FAQ</h1>
        <p className="mb-8 leading-relaxed">
          Common questions about hantavirus, Andes virus (ANDV), and the 2026 MV Hondius outbreak.
          Answers are drawn from the verified facts in our{' '}
          <Link href="/facts" className="text-accent hover:underline">knowledge base</Link>{' '}
          and current outbreak data on the{' '}
          <Link href="/" className="text-accent hover:underline">live tracker</Link>.
        </p>

        <div className="space-y-8">
          {FAQ.map(({ q, a }, i) => (
            <article key={i}>
              <h2 className="mb-2 text-lg font-semibold text-text">{q}</h2>
              <p className="leading-relaxed">{a}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-6 text-sm">
          <p className="mb-2 text-text-muted">
            For the live outbreak picture — case counts, country-by-country status, threat
            assessment — see the{' '}
            <Link href="/" className="text-accent hover:underline">main dashboard</Link>.
          </p>
          <p className="text-text-muted">
            For the verified-fact knowledge base see{' '}
            <Link href="/facts" className="text-accent hover:underline">/facts</Link>.
            For an in-depth disease overview see{' '}
            <Link href="/hantavirus" className="text-accent hover:underline">/hantavirus</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
