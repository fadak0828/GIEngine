import React from 'react';
import './landing.css';

const FEATURES = [
  {
    icon: '🔍',
    title: 'Case-first editor',
    body: 'Plan acts, cases, scenes, hotspots, and puzzle logic in one visual layout.',
  },
  {
    icon: '✨',
    title: 'Quick Create and AI interview',
    body: 'Start from one sentence or a guided interview. Get a draft case structure, then edit every detail before release.',
  },
  {
    icon: '🧩',
    title: 'Puzzle and word management',
    body: 'Design fill-in templates, map answer keys, and manage vocabulary with connection visibility across scenes.',
  },
  {
    icon: '⚡',
    title: 'Instant runtime preview and export',
    body: 'Test flow in-editor and export a standalone HTML build for fast sharing and playtesting.',
  },
];

const STEPS = [
  { num: '01', title: 'Draft the case', body: 'Seed the premise with Quick Create or AI interview.' },
  { num: '02', title: 'Shape the scenes', body: 'Edit layers, hotspots, and transitions.' },
  { num: '03', title: 'Wire the deduction', body: 'Configure words, clues, and puzzle answers.' },
  { num: '04', title: 'Validate and ship', body: 'Preview, fix issues, export to HTML.' },
];

const AUDIENCE = [
  'Indie studios building story-driven deduction titles.',
  'Narrative designers prototyping interactive mystery cases.',
  'Educators and creators making investigation-based learning games.',
];

const FAQ = [
  {
    q: 'Is this only for AI-generated content?',
    a: 'No. AI is optional. You can author everything manually and use AI only when it speeds up ideation.',
  },
  {
    q: 'Can I export without a game engine install?',
    a: 'Yes. GIEngine exports to standalone HTML for direct sharing and playtesting.',
  },
  {
    q: 'Can teams collaborate with existing source control?',
    a: 'Yes. Projects can be managed in standard repository workflows.',
  },
  {
    q: 'What type of games is GIEngine best for?',
    a: 'Deduction and investigation games where clue structure, scene flow, and puzzle logic are central.',
  },
];

export function LandingPage(): React.ReactElement {
  return (
    <div className="lp-root">
      {/* ── Nav ── */}
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <a href="/" className="lp-logo" aria-label="GIEngine home">
            <span className="lp-logo-mark">GI</span>
            <span className="lp-logo-word">Engine</span>
          </a>
          <nav className="lp-nav-links" aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#workflow">Workflow</a>
            <a href="#faq">FAQ</a>
          </nav>
          <a href="/editor" className="lp-btn lp-btn-primary lp-btn-sm">
            Open Editor
          </a>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="lp-hero" aria-labelledby="hero-heading">
          <div className="lp-section-inner lp-hero-inner">
            <p className="lp-eyebrow">Mystery game authoring platform</p>
            <h1 id="hero-heading" className="lp-display">
              Build deduction games faster,<br />
              <em>without losing authorship.</em>
            </h1>
            <p className="lp-hero-sub">
              GIEngine is a mystery-game authoring platform for teams building
              Golden&nbsp;Idol style experiences. Generate your first case with AI,
              refine every scene by hand, and ship as a standalone HTML build.
            </p>
            <div className="lp-hero-cta">
              <a href="/editor" className="lp-btn lp-btn-primary lp-btn-lg">
                Start Building for Free
              </a>
              <a href="#workflow" className="lp-btn lp-btn-ghost lp-btn-lg">
                Watch 3-Minute Demo
              </a>
            </div>
            <p className="lp-microtrust">
              From first clue to final export in one workflow.
            </p>
          </div>
        </section>

        {/* ── Problem → Value ── */}
        <section className="lp-problem" aria-labelledby="problem-heading">
          <div className="lp-section-inner">
            <h2 id="problem-heading" className="lp-h2">
              Most tools can build games.<br />Few can build mysteries.
            </h2>
            <p className="lp-body-lg">
              General-purpose engines are powerful but slow for deduction game design.
              GIEngine gives you puzzle-first structures, hotspot-based scene authoring,
              and narrative tooling built for clue discovery, inference, and reveal pacing.
            </p>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="lp-features" aria-labelledby="features-heading">
          <div className="lp-section-inner">
            <h2 id="features-heading" className="lp-h2 lp-centered">
              Everything a mystery designer needs
            </h2>
            <div className="lp-features-grid">
              {FEATURES.map((f) => (
                <article key={f.title} className="lp-feature-card">
                  <span className="lp-feature-icon" role="img" aria-hidden="true">
                    {f.icon}
                  </span>
                  <h3 className="lp-feature-title">{f.title}</h3>
                  <p className="lp-feature-body">{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Workflow ── */}
        <section id="workflow" className="lp-workflow" aria-labelledby="workflow-heading">
          <div className="lp-section-inner">
            <h2 id="workflow-heading" className="lp-h2 lp-centered">
              A workflow built for mystery design velocity.
            </h2>
            <ol className="lp-steps" aria-label="Design workflow steps">
              {STEPS.map((s) => (
                <li key={s.num} className="lp-step">
                  <span className="lp-step-num" aria-hidden="true">{s.num}</span>
                  <div className="lp-step-content">
                    <h3 className="lp-step-title">{s.title}</h3>
                    <p className="lp-step-body">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Audience ── */}
        <section className="lp-audience" aria-labelledby="audience-heading">
          <div className="lp-section-inner lp-audience-inner">
            <h2 id="audience-heading" className="lp-h2">
              Built for small teams shipping narrative puzzle games.
            </h2>
            <ul className="lp-audience-list" role="list">
              {AUDIENCE.map((item) => (
                <li key={item} className="lp-audience-item">
                  <span className="lp-check-icon" aria-hidden="true">▸</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Social Proof ── */}
        <section className="lp-social" aria-labelledby="social-heading">
          <div className="lp-section-inner lp-centered">
            <h2 id="social-heading" className="lp-h2">
              Used by teams who care about clue logic and narrative pacing.
            </h2>
            <blockquote className="lp-quote">
              <p>
                "GIEngine cut our case authoring time from days to hours
                while keeping full creative control."
              </p>
              <footer>— Early access team</footer>
            </blockquote>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="lp-final-cta" aria-labelledby="cta-heading">
          <div className="lp-section-inner lp-centered">
            <h2 id="cta-heading" className="lp-display lp-display-md">
              Ship your next mystery case this week.
            </h2>
            <p className="lp-hero-sub">
              Start with AI support, finish with designer control, and publish
              playable builds without engine overhead.
            </p>
            <div className="lp-hero-cta">
              <a href="/editor" className="lp-btn lp-btn-primary lp-btn-lg">
                Open the Editor
              </a>
              <a href="/examples" className="lp-btn lp-btn-ghost lp-btn-lg">
                See Sample Project
              </a>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="lp-faq" aria-labelledby="faq-heading">
          <div className="lp-section-inner">
            <h2 id="faq-heading" className="lp-h2 lp-centered">
              Frequently asked questions
            </h2>
            <dl className="lp-faq-list">
              {FAQ.map((item) => (
                <div key={item.q} className="lp-faq-item">
                  <dt className="lp-faq-q">{item.q}</dt>
                  <dd className="lp-faq-a">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="lp-footer" role="contentinfo">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <span className="lp-logo-mark">GI</span>
            <span className="lp-logo-word">Engine</span>
            <p className="lp-footer-tagline">
              Mystery game authoring platform
            </p>
          </div>
          <nav className="lp-footer-links" aria-label="Footer navigation">
            <a href="/editor">Editor</a>
            <a href="/examples">Examples</a>
            <a href="https://github.com/gi-engine" target="_blank" rel="noopener noreferrer">GitHub</a>
          </nav>
          <div className="lp-footer-copy">
            <p>© 2026 GIEngine. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
