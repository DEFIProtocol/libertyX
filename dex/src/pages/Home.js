import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home() {
  const navigate = useNavigate();

  const stats = useMemo(() => ([
    { label: 'Chains', value: '6', detail: 'EVM + Solana ready' },
    { label: 'Data Feeds', value: '3', detail: 'Binance, Coinbase, RapidAPI' },
    { label: 'Price Ticks', value: 'Live', detail: 'Streaming market updates' },
    { label: 'Features', value: '20+', detail: 'Swap, charts, watchlist, admin' }
  ]), []);

  const pillars = useMemo(() => ([
    {
      title: 'Data Management',
      body: 'Token metadata, chain addresses, and watchlists are stored in Postgres JSONB for flexible, evolving schemas. Context providers keep UI state consistent across pages.'
    },
    {
      title: 'User Experience',
      body: 'A responsive layout, chain-aware routing, and clean accessibility patterns deliver a premium trading feel on mobile and desktop.'
    },
    {
      title: 'Price Charting',
      body: 'Market pricing blends exchange feeds with RapidAPI data, plus TradingView and custom charts for historical context and quick decisioning.'
    },
    {
      title: 'Trading & Swap',
      body: '1inch Fusion SDK powers quotes, order submission, and status polling with chain-specific RPC routing and safe parameter handling.'
    },
    {
      title: 'Security & Trust',
      body: 'Wallet sign-in with chain-scoped signatures, network-aware prompts, and watchlist updates with optimistic UI for snappy feedback.'
    },
    {
      title: 'Admin Operations',
      body: 'Admin tooling includes user management, token curation, and chain support, enabling quick ops without redeploying the frontend.'
    }
  ]), []);

  const workflow = useMemo(() => ([
    'Wallet connects and verifies per chain',
    'Token universe loads with chain filtering',
    'Price engines stream to UI contexts',
    'Swap pipeline runs quote -> submit -> status',
    'User watchlist persists in JSONB'
  ]), []);

  const stack = useMemo(() => ([
    'React + React Router',
    'Wagmi + Wallet Signatures',
    'Postgres + JSONB',
    'Node/Express APIs',
    '1inch Fusion SDK',
    'WebSocket price streams'
  ]), []);

  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-grid">
          <div className="hero-copy">
            <div className="hero-badge">Portfolio Build • LibertyX</div>
            <h1>Multi-chain trading intelligence with real-time execution.</h1>
            <p>
              LibertyX is a full-stack crypto experience that unifies price discovery, chain-aware swaps,
              and personalized watchlists. Built for speed, reliability, and presentation-worthy polish.
            </p>
            <div className="hero-actions">
              <button className="hero-primary" onClick={() => navigate('/tokens')}>
                Explore Tokens
              </button>
              <button className="hero-secondary" onClick={() => navigate('/swap')}>
                Start a Swap
              </button>
            </div>
            <div className="hero-meta">
              <span>Realtime feeds</span>
              <span>Chain-aware UX</span>
              <span>Portfolio-grade UI</span>
            </div>
          </div>
          <div className="hero-panel">
            <div className="hero-card">
              <div className="hero-card-header">
                <div>
                  <p className="hero-card-eyebrow">System Overview</p>
                  <h3>End-to-end product depth</h3>
                </div>
                <span className="hero-card-chip">Live</span>
              </div>
              <div className="hero-card-grid">
                {stats.map((item) => (
                  <div key={item.label} className="hero-stat">
                    <div className="hero-stat-value">{item.value}</div>
                    <div className="hero-stat-label">{item.label}</div>
                    <div className="hero-stat-detail">{item.detail}</div>
                  </div>
                ))}
              </div>
              <div className="hero-card-footer">
                <span>Data sources normalized and cached</span>
                <span>UI contexts hydrated on load</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>What makes LibertyX portfolio-ready</h2>
          <p>Every surface area is built to demonstrate production thinking across data, UX, and scale.</p>
        </div>
        <div className="pillar-grid">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="pillar-card">
              <h3>{pillar.title}</h3>
              <p>{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section workflow">
        <div className="section-header">
          <h2>Operational workflow</h2>
          <p>From wallet connection to trade fulfillment, every step is mapped and observable.</p>
        </div>
        <div className="workflow-grid">
          {workflow.map((step, index) => (
            <div key={step} className="workflow-step">
              <div className="workflow-index">0{index + 1}</div>
              <p>{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section showcase">
        <div className="showcase-grid">
          <div className="showcase-card">
            <h3>Interface systems</h3>
            <p>
              Modular components power token tables, detail pages, and admin tooling. Themes adapt to
              light and dark modes with consistent spacing and density.
            </p>
            <div className="showcase-tags">
              <span>Adaptive layouts</span>
              <span>Chain toggles</span>
              <span>Context-driven state</span>
            </div>
          </div>
          <div className="showcase-card">
            <h3>Analytics & charting</h3>
            <p>
              Market charts combine custom time-series rendering with TradingView embeds for a
              professional-grade research experience.
            </p>
            <div className="showcase-tags">
              <span>Historical data</span>
              <span>Streaming prices</span>
              <span>Price change alerts</span>
            </div>
          </div>
          <div className="showcase-card">
            <h3>Data integrity</h3>
            <p>
              JSONB schemas preserve user preferences, chain addresses, and watchlists without brittle
              migrations. Backend routes normalize and validate all inputs.
            </p>
            <div className="showcase-tags">
              <span>Postgres JSONB</span>
              <span>API validation</span>
              <span>Optimistic UX</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section profile">
        <div className="profile-card">
          <div className="profile-content">
            <h2>Built by</h2>
            <p>
              This space is reserved for a personal intro, mission statement, or design philosophy.
              Add your story, your role, and what you are looking for next.
            </p>
            <div className="profile-actions">
              <button className="hero-secondary" onClick={() => navigate('/account')}>
                See User Flows
              </button>
            </div>
          </div>
          <div className="profile-photo">
            {/*
            <img
              src={require('../assets/your-photo.jpg')}
              alt="Your portrait"
              className="profile-image"
            />
            */}
            <div className="profile-placeholder">Your photo here</div>
          </div>
        </div>
      </section>

      <section className="section stack">
        <div className="section-header">
          <h2>Technology stack</h2>
          <p>Built for scale, clarity, and hiring-manager-friendly architecture decisions.</p>
        </div>
        <div className="stack-grid">
          {stack.map((item) => (
            <div key={item} className="stack-pill">{item}</div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Home;