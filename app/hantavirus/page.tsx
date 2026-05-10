import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { TopBar } from '@/components/ops/TopBar';
import type { Snapshot, ThreatAssessment } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Hantavirus: Andes Virus (ANDV) Disease Overview, FAQ & 2026 Outbreak',
  description:
    'Comprehensive guide to hantavirus and Andes orthohantavirus (ANDV) — symptoms, transmission, diagnosis, treatment, FAQ, and the 2026 MV Hondius outbreak. The only hantavirus species with documented person-to-person transmission.',
  alternates: { canonical: '/hantavirus' },
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

export default async function HantavirusPage() {
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
      '@type': 'MedicalCondition',
      name: 'Hantavirus Cardiopulmonary Syndrome (Andes virus)',
      alternateName: ['HCPS', 'HPS', 'ANDV infection', 'Andes orthohantavirus disease'],
      code: { '@type': 'MedicalCode', code: 'B33.4', codingSystem: 'ICD-10' },
      cause: {
        '@type': 'MedicalCause',
        name: 'Andes orthohantavirus (ANDV)',
      },
      epidemiology:
        'ANDV is endemic to southern Argentina and Chile and is the only hantavirus species with documented person-to-person transmission, requiring close and prolonged contact. Reservoir host is the long-tailed pygmy rice rat (Oligoryzomys longicaudatus). Case fatality rate ranges 30-50%. Reproduction number (R0) below 1.',
      signOrSymptom: [
        { '@type': 'MedicalSignOrSymptom', name: 'Fever' },
        { '@type': 'MedicalSignOrSymptom', name: 'Severe muscle aches (myalgias)' },
        { '@type': 'MedicalSignOrSymptom', name: 'Headache' },
        { '@type': 'MedicalSignOrSymptom', name: 'Gastrointestinal symptoms' },
        { '@type': 'MedicalSignOrSymptom', name: 'Pulmonary edema' },
        { '@type': 'MedicalSignOrSymptom', name: 'Acute respiratory distress syndrome' },
        { '@type': 'MedicalSignOrSymptom', name: 'Cardiogenic shock' },
      ],
      possibleTreatment: [
        {
          '@type': 'MedicalTherapy',
          name: 'Supportive intensive care',
          description:
            'No specific antiviral works. Treatment is supportive: hemodynamic monitoring, careful fluid management, mechanical ventilation when needed.',
        },
        {
          '@type': 'MedicalTherapy',
          name: 'Extracorporeal Membrane Oxygenation (ECMO)',
          description:
            'ECMO is the most effective intervention for severe HCPS. Achieves up to 80% survival when started before cardiovascular collapse.',
        },
      ],
      typicalTest: {
        '@type': 'MedicalTest',
        name: 'RT-PCR and IgM/IgG serology',
        description:
          'RT-PCR on serum can detect ANDV RNA 5-15 days before symptom onset or antibody detection. IgM and IgG antibodies appear by approximately day 10 after symptom onset.',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Hantavirus: Andes Virus (ANDV) Disease Overview',
      description:
        'Comprehensive guide to hantavirus and Andes orthohantavirus (ANDV) — symptoms, transmission, diagnosis, treatment, and the 2026 MV Hondius outbreak.',
      author: { '@type': 'Organization', name: 'Pathwatch' },
      publisher: { '@type': 'Organization', name: 'Pathwatch' },
      datePublished: '2026-05-10',
      dateModified: new Date().toISOString().slice(0, 10),
      mainEntityOfPage: 'https://hantavirustracer.com/hantavirus',
    },
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
        { '@type': 'ListItem', position: 2, name: 'Hantavirus', item: 'https://hantavirustracer.com/hantavirus' },
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
          <span>Hantavirus</span>
        </nav>

        <h1 className="mb-3 text-3xl font-bold text-text">Hantavirus &amp; Andes Virus (ANDV)</h1>
        <p className="mb-8 leading-relaxed">
          A comprehensive overview of the disease behind the{' '}
          <Link href="/" className="text-accent hover:underline">2026 MV Hondius outbreak</Link>.
          Source-cited content drawn from our{' '}
          <Link href="/facts" className="text-accent hover:underline">verified knowledge base</Link>.
        </p>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold text-text">What is hantavirus?</h2>
          <p className="mb-3 leading-relaxed">
            Hantavirus is a family of negative-sense RNA viruses (family <em>Hantaviridae</em>,
            order <em>Bunyavirales</em>) carried by rodents. Two clinical syndromes can result
            from human infection:
          </p>
          <ul className="mb-3 ml-6 list-disc space-y-1 leading-relaxed">
            <li>
              <strong>Hantavirus Cardiopulmonary Syndrome (HCPS / HPS)</strong> — caused by New
              World hantaviruses (Andes, Sin Nombre). Affects primarily the lungs and heart.
            </li>
            <li>
              <strong>Hemorrhagic Fever with Renal Syndrome (HFRS)</strong> — caused by Old World
              hantaviruses (Hantaan, Dobrava, Seoul, Puumala). Affects primarily the kidneys.
            </li>
          </ul>
          <p className="leading-relaxed">
            The 2026 MV Hondius outbreak involves <strong>Andes orthohantavirus (ANDV)</strong>,
            a New World hantavirus endemic to southern Argentina and Chile, first isolated in
            1995 in Chile. ANDV is the only hantavirus species with documented person-to-person
            transmission.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold text-text">How it spreads</h2>
          <h3 className="mb-2 text-base font-semibold text-text">Rodent-to-human (primary route)</h3>
          <p className="mb-4 leading-relaxed">
            Inhalation of aerosolized rodent urine, feces, or saliva in enclosed spaces — barns,
            cabins, abandoned buildings, landfills. The reservoir host for ANDV is the
            long-tailed pygmy rice rat (<em>Oligoryzomys longicaudatus</em>), endemic to southern
            Argentina and Chile. Rodents are asymptomatic carriers. Aerosolized virus can survive
            up to 2 weeks in cool, dark conditions but is rapidly inactivated by sunlight,
            bleach, and 70% ethanol.
          </p>
          <h3 className="mb-2 text-base font-semibold text-text">Person-to-person (ANDV only)</h3>
          <p className="mb-3 leading-relaxed">
            Person-to-person transmission requires <strong>close and prolonged contact</strong>:
            shared enclosed living spaces, bedside care, or sustained face-to-face exposure to
            respiratory secretions. Casual or brief contact is insufficient. A KLM flight
            attendant had 45 minutes of direct contact with a symptomatic MV Hondius patient
            (MVH-002) on flight KL592 and tested negative — WHO confirmed the brief encounter did
            not result in transmission.
          </p>
          <p className="leading-relaxed">
            Person-to-person transmission was first proven in the 1996 El Bolsón outbreak, when
            three physicians developed HPS 27–28 days after treating the index patient. Peak
            infectiousness occurs at symptom onset during the prodromal phase, when viral load
            peaks and patients may appear to have only mild flu.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold text-text">Symptoms &amp; clinical course</h2>
          <p className="mb-3 leading-relaxed">
            Incubation ranges <strong>9 to 40 days</strong> (median ~18 days). The disease
            progresses in three phases:
          </p>
          <ol className="mb-3 ml-6 list-decimal space-y-2 leading-relaxed">
            <li>
              <strong>Prodromal (1–5 days)</strong> — fever, chills, severe muscle aches,
              headache, malaise, gastrointestinal symptoms (nausea, vomiting, abdominal pain,
              diarrhea). Clinically indistinguishable from flu.
            </li>
            <li>
              <strong>Cardiopulmonary</strong> — rapid onset (often within hours) of shortness of
              breath, fluid in the lungs (pulmonary edema), low blood pressure, cardiogenic
              shock. This is the lethal phase.
            </li>
            <li>
              <strong>Convalescent or terminal</strong> — survivors typically recover fully but
              can have persistent dyspnea for 1–2 years. Long-term follow-up recommended for
              kidney function, blood pressure, and cardiovascular risk.
            </li>
          </ol>
          <p className="leading-relaxed">
            Higher severity is associated with age 60+, pre-existing hypertension, diabetes,
            smoking history, higher viral load at presentation, and concurrent liver injury.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold text-text">Diagnosis</h2>
          <p className="leading-relaxed">
            <strong>RT-PCR on serum</strong> can detect ANDV RNA 5–15 days before symptom onset
            or antibody detection — critical for early diagnosis in exposed contacts. IgM and
            IgG antibodies appear by approximately day 10 after symptom onset; IgM persists for
            months, IgG often for years. Diagnosis combines clinical presentation, exposure
            history, and laboratory confirmation.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold text-text">Treatment</h2>
          <p className="mb-3 leading-relaxed">
            <strong>No specific antiviral works against hantavirus.</strong> Ribavirin showed no
            significant mortality reduction in meta-analysis (RR 0.99, 95% CI 0.60-1.61) and is
            not recommended.
          </p>
          <p className="mb-3 leading-relaxed">
            Treatment is supportive: intensive hemodynamic monitoring, aggressive fluid
            management (avoiding overload, which worsens pulmonary edema), mechanical
            ventilation when needed.
          </p>
          <p className="leading-relaxed">
            <strong>ECMO</strong> (extracorporeal membrane oxygenation) is the most effective
            intervention for severe HCPS. ECMO acts as a heart-lung bypass while the body clears
            the infection and achieves <strong>up to 80% survival</strong> when started before
            cardiovascular collapse. Without ECMO, case fatality is 30–50%.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold text-text">Vaccine status</h2>
          <p className="leading-relaxed">
            <strong>No licensed hantavirus vaccine exists anywhere in the world.</strong> The
            most advanced candidate is a DNA vaccine developed at the US Army Medical Research
            Institute of Infectious Diseases (USAMRIID), which has completed Phase 1 trials.
            Moderna has a preclinical mRNA collaboration with USAMRIID and Korea University but
            it is years from human availability. ANDV-specific candidates are in early-phase
            trials in Argentina and Chile.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold text-text">Why ANDV is different</h2>
          <p className="leading-relaxed">
            The molecular basis for ANDV&apos;s person-to-person transmission remains unknown.
            Compared to Sin Nombre virus (SNV), ANDV produces higher mucosal viral burdens, is
            uniformly lethal in Syrian hamster models (SNV is not), and more effectively
            interferes with interferon signaling. The combination is what makes ANDV the only
            hantavirus with documented person-to-person transmission.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold text-text">Past outbreaks</h2>
          <ul className="ml-6 list-disc space-y-3 leading-relaxed">
            <li>
              <strong>El Bolsón, Argentina (1996)</strong> — 18 cases. The outbreak that first
              proved person-to-person transmission, after three physicians developed HPS 27–28
              days after treating the index patient. Self-limited.
            </li>
            <li>
              <strong>Epuyén, Argentina (2018–2019)</strong> — 36 cases, 11 deaths. Published in
              NEJM. Demonstrated superspreader dynamics: Patient #1 infected 5 people in 90
              minutes at a birthday party (1–4 foot distances). Self-limited despite the
              superspreader event.
            </li>
            <li>
              <strong>MV Hondius, multi-country (2026)</strong> — the current outbreak. Likely
              index couple exposed at Ushuaia landfill in Argentina; cluster spread among
              passengers and crew during the cruise voyage. As of early May 2026, three deaths
              and active monitoring across 10+ countries.{' '}
              <Link href="/" className="text-accent hover:underline">See the live tracker</Link>.
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold text-text">Pandemic risk</h2>
          <p className="mb-3 leading-relaxed">
            The reproduction number (R0) for ANDV person-to-person transmission is estimated{' '}
            <strong>below 1</strong> (around 0.7 for the MV Hondius cluster) — meaning each case
            infects fewer than one other person on average. Without sustained R0 above 1, an
            outbreak burns out rather than expands. WHO assesses global risk as LOW. CDC
            classifies the outbreak as Level 3 emergency activation (the lowest tier).
          </p>
          <p className="leading-relaxed">
            Both prior ANDV outbreaks (1996 El Bolsón, 2018 Epuyén) self-limited. The MV Hondius
            cluster is being managed with the same posture: surveillance, contact tracing, and
            isolation rather than mass quarantine. See the{' '}
            <a href="#faq" className="text-accent hover:underline">FAQ below</a> for common
            questions about pandemic risk.
          </p>
        </section>

        <section id="faq" className="mb-10 scroll-mt-12">
          <h2 className="mb-3 text-xl font-semibold text-text">Common questions</h2>
          <p className="mb-6 leading-relaxed">
            Frequently asked questions about hantavirus and the MV Hondius outbreak. Each answer
            is drawn from the verified facts in our{' '}
            <Link href="/facts" className="text-accent hover:underline">knowledge base</Link>{' '}
            and current data on the{' '}
            <Link href="/" className="text-accent hover:underline">live tracker</Link>.
          </p>
          <div className="space-y-6">
            {FAQ.map(({ q, a }, i) => (
              <article key={i}>
                <h3 className="mb-2 text-base font-semibold text-text">{q}</h3>
                <p className="leading-relaxed">{a}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-12 border-t border-border pt-6 text-sm">
          <p className="mb-2 text-text-muted">
            For the live outbreak picture see the{' '}
            <Link href="/" className="text-accent hover:underline">main dashboard</Link>.
            For the verified-fact knowledge base see{' '}
            <Link href="/facts" className="text-accent hover:underline">/facts</Link>.
          </p>
          <p className="text-text-muted">
            Sourced from WHO, CDC, ECDC, peer-reviewed publications (NEJM, Lancet, JAMA), and
            primary government statements. Each fact in the underlying knowledge base carries
            its own source attribution.
          </p>
        </div>
      </main>
    </div>
  );
}
