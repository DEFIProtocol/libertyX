import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import './Home.css';

function Home() {
  const navigate = useNavigate();
   const [activeTab, setActiveTab] = useState('about');
  const { themeLight } = useTheme(); // Add this line

  // Personal stats (reframed to be recruiter-facing)
  const personalStats = useMemo(() => ([
    { 
      label: 'Experience', 
      value: '5+ Years', 
      detail: 'Self-directed full system builds from architecture to deployment' 
    },
    { 
      label: 'Primary Focus', 
      value: 'Full-Stack JavaScript', 
      detail: 'Production React apps with real-time state + API integration' 
    },
    { 
      label: 'Backend & Data', 
      value: 'Node • Postgres • Python', 
      detail: 'REST APIs • JSONB schemas • Data normalization pipelines' 
    },
    { 
      label: 'Blockchain Infra', 
      value: 'Multi-Chain Execution', 
      detail: '1inch Fusion • Infura RPC • Wallet connectivity via Wagmi' 
    }
  ]), []);

  // Project stats
  const projectStats = useMemo(() => ([
    { 
      label: 'Chains Supported', 
      value: '6+', 
      detail: 'Ethereum, BSC, Arbitrum, Polygon, Avalanche (+Solana WIP)' 
    },
    { 
      label: 'Price Feeds Integrated', 
      value: '3', 
      detail: 'Coinbase WS • Binance WS • Coinranking REST' 
    },
    { 
      label: 'Order Routing', 
      value: '1inch Fusion', 
      detail: 'Quote generation • Execution • Status polling pipeline' 
    },
    { 
      label: 'Admin Control Layer', 
      value: 'Full Coverage', 
      detail: 'Token registry • Swap enablement • Chain management' 
    }
  ]), []);

  const pillars = useMemo(() => ([
    {
      title: 'Dynamic Token Registry',
      body: 'Designed an admin-controlled token registry integrating 1inch liquidity references, Postgres persistence, Coinranking validation, and JSON failover to ensure listing integrity and runtime flexibility.'
    },
    {
      title: 'Real-Time Pricing Engine',
      body: 'Architected WebSocket ingestion pipelines from Coinbase and Binance, normalized alongside Coinranking REST data server-side, and hydrated into React contexts for consistent UI rendering.'
    },
    {
      title: 'Swap Execution Layer',
      body: 'Integrated 1inch Fusion SDK for quote generation, order submission, and execution monitoring. Implemented chain-aware routing with Wagmi + Infura RPC nodes for wallet connectivity.'
    },
    {
      title: 'User Interface Architecture',
      body: 'Built a responsive, chain-aware interface with live pricing, swap modal flows, and intuitive routing — engineered to resemble a deployable exchange, not a demo.'
    },
    {
      title: 'Operational Admin System',
      body: 'Developed a full admin dashboard enabling token management, market cap validation, swap control toggles, and supported chain configuration without frontend redeploys.'
    }
  ]), []);

  const engineeringChallenges = useMemo(() => ([
    'Normalized inconsistent pricing formats across WebSocket and REST providers',
    'Handled chain-specific routing edge cases across 6+ EVM networks',
    'Designed admin override controls without requiring frontend redeployment',
    'Built resilient fallback logic for token and pricing data integrity'
  ]), []);

  const workflow = useMemo(() => ([
    'Wallet connection via Wagmi + Infura RPC',
    'Supported chain validation and routing configuration',
    'Token universe compiled from Postgres + 1inch + Coinranking',
    'Real-time price streams hydrate application state',
    'Swap execution pipeline: Quote → Submit → Monitor → Confirm',
  ]), []);

  const stackGroups = useMemo(() => ([
  {
    category: 'Languages',
    items: [
      { name: 'JavaScript/TypeScript', level: 90 },
      { name: 'Python', level: 80 },
      { name: 'Java', level: 50 },
      { name: 'Solidity', level: 60 }
    ]
  },
  {
    category: 'Databases',
    items: [
      { name: 'PostgreSQL', level: 80 },
      { name: 'MongoDB', level: 70 },
      { name: 'SQL', level: 80 }
    ]
  },
  {
    category: 'Frontend',
    items: ['React', 'CSS', 'HTML5', 'Wagmi']
  },
  {
    category: 'Backend & APIs',
    items: ['Node.js', 'Express', 'REST', 'WebSockets']
  },
  {
    category: 'Blockchain',
    items: ['1inch Fusion SDK', 'Infura RPC', 'EVM', 'Web3']
  },
  {
    category: 'Infrastructure',
    items: ['Linux VM', 'Postgres', 'CLI', 'Git']
  }
]), []);

  return (
    <div className="home-page">
      {/* TAB NAVIGATION - Horizontal tabs */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'about' ? 'active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          <span className="tab-icon">👤</span>
          About Me
        </button>
        <button 
          className={`tab-button ${activeTab === 'project' ? 'active' : ''}`}
          onClick={() => setActiveTab('project')}
        >
          <span className="tab-icon">🚀</span>
          LibertyX Project
        </button>
      </div>

      {/* ABOUT ME TAB CONTENT */}
      {activeTab === 'about' && (
        <div className="tab-content">
          {/* HERO SECTION */}
          <section className="section profile">
            <div className="profile-card">
              <div className="profile-photo">
                <img
                  src={require('./photos/PersonalPhoto.jpg')}
                  alt="Beau A."
                  className="profile-image"
                />
              </div>
              <div className="profile-content">
                <div className="hero-badge" style={{ marginBottom: '12px' }}>
                  Full-Stack Developer • Blockchain Infrastructure • Systems Builder
                </div>
                <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(2.3rem, 3vw, 3.6rem)', margin: '0 0 8px 0' }}>
                  Beau Allgood
                </h1>
                <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Full-stack developer specializing in production-grade blockchain systems and real-time trading infrastructure. 
                  I design and ship end-to-end architectures — from data ingestion and normalization to execution and admin control layers. 
                  Father of two, wrestling coach, relentless builder.
                </p>
                <div className="hero-actions">
                  <button className="hero-primary" onClick={() => navigate('/tokens')}>
                    Launch The DEX
                  </button>
                  <button className="hero-secondary" onClick={() => setActiveTab('project')}>
                    View Project Details
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* QUICK SNAPSHOT */}
          <section className="section">
            <div className="section-header">
              <h2>Technical Snapshot</h2>
              <p>Architecture-focused • Production-minded • Self-directed</p>
            </div>
            <div className="hero-card" style={{ marginBottom: '24px' }}>
              <div className="hero-card-header">
                <div>
                  <p className="hero-card-eyebrow">Open to Work</p>
                  <h3>Core Profile</h3>
                </div>
              </div>
              <div className="hero-card-grid">
                {personalStats.map((item) => (
                  <div key={item.label} className="hero-stat">
                    <div className="hero-stat-value">{item.value}</div>
                    <div className="hero-stat-label">{item.label}</div>
                    <div className="hero-stat-detail">{item.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* STACK + EXPERIENCE */}
<div className="stack-experience-grid">
  {/* TECH STACK */}
  {/* TECH STACK - Two Column Layout */}
<section className="section stack">
  <div className="section-header">
    <h2>Technical Stack</h2>
    <p className="stack-tagline">Full-Stack Foundation • Blockchain-Ready • Production-Focused</p>
  </div>
  
  <div className="stack-two-column">
    {/* LEFT COLUMN - Languages & Databases */}
    <div className="stack-left-column">
      {/* Languages with skill bars */}
      {stackGroups.filter(g => g.category === 'Languages').map((group) => (
        <div key={group.category} className="skill-category">
          <h3 className="skill-category-title">{group.category}</h3>
          <div className="skills-container">
            {group.items.map((item) => (
              <div key={item.name} className="skill-item">
                <div className="skill-header">
                  <span className="skill-name">{item.name}</span>
                  <span className="skill-percentage">{item.level}%</span>
                </div>
                <div className="skill-bar-bg">
                  <div 
                    className="skill-bar-fill" 
                    style={{ width: `${item.level}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Databases with skill bars */}
      {stackGroups.filter(g => g.category === 'Databases').map((group) => (
        <div key={group.category} className="skill-category">
          <h3 className="skill-category-title">{group.category}</h3>
          <div className="skills-container">
            {group.items.map((item) => (
              <div key={item.name} className="skill-item">
                <div className="skill-header">
                  <span className="skill-name">{item.name}</span>
                  <span className="skill-percentage">{item.level}%</span>
                </div>
                <div className="skill-bar-bg">
                  <div 
                    className="skill-bar-fill" 
                    style={{ width: `${item.level}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>

    {/* RIGHT COLUMN - Other Categories */}
    <div className="stack-right-column">
      <div className="other-categories-grid">
        {stackGroups.filter(g => g.category !== 'Languages' && g.category !== 'Databases').map((group) => (
          <div key={group.category} className="other-category">
            <h3 className="other-category-title">{group.category}</h3>
            <div className="stack-grid">
              {group.items.map((item) => (
                <div key={item} className="stack-pill">{item}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
</section>
            {/* WORK EXPERIENCE */}
            <section className="section profile">
              <div className="section-header">
                <h2>Work Experience</h2>
                <p>Operational roles demonstrating discipline, leadership, and technical reliability.</p>
              </div>
              <div className="profile-card" style={{ padding: '24px', marginTop: '8px' }}>
                <div className="profile-content" style={{ width: '100%' }}>
                  <div className="experience-item">
                    <h3>Amazon Delivery Driver — Route Masters</h3>
                    <p className="date-range">10/2024 – Present</p>
                    <p>
                      Promoted to lead driver within 3 months based on performance metrics and reliability. 
                      Contributed to platinum-tier quality and safety scores through disciplined route execution 
                      and operational consistency.
                    </p>
                  </div>
                  <div className="experience-item">
                    <h3>Durable Medical Equipment Technician</h3>
                    <p className="date-range">09/2023 – 10/2024</p>
                    <p>
                      Maintained and repaired oxygen concentrators, hospital beds, and mobility devices. 
                      Provided in-home technical troubleshooting and remote diagnostics while rotating 24/7 on-call. 
                      Ensured equipment safety, compliance, and patient instruction accuracy.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* PROJECT TAB CONTENT */}
      {/* PROJECT TAB CONTENT */}
{activeTab === 'project' && (
  <div className="tab-content">
    {/* FLAGSHIP PROJECT HEADER */}
    <section id="project-showcase" className="section">
      <div className="section-header">
        <h2>LibertyX Multi-Chain DEX</h2>
        <p>
          LibertyX is a fully architected decentralized exchange built as a production-grade system — 
          integrating real-time pricing feeds, dynamic token management, multi-chain execution routing, 
          and a complete admin control layer.
        </p>
      </div>

      <div className="hero-card" style={{ marginBottom: '24px' }}>
        <div className="hero-card-header">
          <div>
            <p className="hero-card-eyebrow">Project Overview</p>
            <h3>Production Architecture</h3>
          </div>
          <span className="hero-card-chip">Live Demo</span>
        </div>
        <div className="hero-card-grid">
          {projectStats.map((item) => (
            <div key={item.label} className="hero-stat">
              <div className="hero-stat-value">{item.value}</div>
              <div className="hero-stat-label">{item.label}</div>
              <div className="hero-stat-detail">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURED PAGES SECTION */}
      <div className="featured-pages-section">
        <h3 className="featured-pages-title">Key Platform Features</h3>
        
        <div className="featured-pages-grid">
          {/* ADMIN DASHBOARD CARD */}
          <div className="featured-page-card">
            <div className="featured-page-image">
              <img 
  src={!themeLight 
    ? require('./photos/AdminDashboardDark.png') 
    : require('./photos/AdminDashboardLight.png')
  }
  alt="Admin Dashboard"
  className="featured-image"
/>
            </div>
            <div className="featured-page-content">
              <h4>Admin Dashboard</h4>
              <div className="admin-password-note">
                <span className="password-label">Demo Access:</span>
                <span className="password-value">admin123</span>
              </div>
              <ul className="feature-list">
                <li>Token management system - Add/remove tokens, set liquidity sources</li>
                <li>User management - View and manage platform users</li>
                <li>Pricing management - Configure price feeds and update intervals</li>
                <li>System-wide controls and monitoring</li>
              </ul>
              <button className="feature-page-button" onClick={() => navigate('/admin')}>
                Access Admin Panel
              </button>
            </div>
          </div>

          {/* ACCOUNT SETTINGS CARD */}
          <div className="featured-page-card">
            <div className="featured-page-image">
              <img 
  src={!themeLight 
    ? require('./photos/AccountSettingsDark.png') 
    : require('./photos/AccountSettingsLight.png')
  }
  alt="Account Settings"
  className="featured-image"
/>
            </div>
            <div className="featured-page-content">
              <h4>Account Settings</h4>
              <ul className="feature-list">
                <li>Personalized account preferences and display settings</li>
                <li>Default slippage tolerance configuration</li>
                <li>Transaction deadline preferences</li>
                <li>Theme and interface customization</li>
                <li>Connected wallet management</li>
              </ul>
              <button className="feature-page-button" onClick={() => navigate('/account')}>
                Configure Settings
              </button>
            </div>
          </div>

          {/* WATCHLIST CARD */}
          <div className="featured-page-card">
            <div className="featured-page-image">
             <img 
  src={!themeLight 
    ? require('./photos/WatchlistDark.png') 
    : require('./photos/WatchlistLight.png')
  }
  alt="Watchlist"
  className="featured-image"
/>
            </div>
            <div className="featured-page-content">
              <h4>Token Watchlist</h4>
              <ul className="feature-list">
                <li>Save favorite tokens to personal watchlist</li>
                <li>Persistent storage in Postgres database</li>
                <li>Real-time price tracking for watched tokens</li>
                <li>Quick access to swap interface for saved tokens</li>
                <li>Cross-session persistence - your watchlist follows you</li>
              </ul>
              <button className="feature-page-button" onClick={() => navigate('/watchlist')}>
                View Watchlist
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SYSTEM ARCHITECTURE PILLARS */}
      <div className="pillar-grid" style={{ marginTop: '48px' }}>
        {pillars.map((pillar) => (
          <article key={pillar.title} className="pillar-card">
            <h3>{pillar.title}</h3>
            <p>{pillar.body}</p>
          </article>
        ))}
      </div>

      {/* SYSTEM WORKFLOW */}
      <section className="section workflow" style={{ marginTop: '32px' }}>
        <div className="section-header">
          <h2>System Architecture & Data Flow</h2>
          <p>From wallet connection to trade confirmation, every stage is observable and controlled.</p>
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

      {/* CTA */}
      {/* CTA - Centered */}
<section className="section cta-section">
  <div className="cta-card">
    <h2>Explore the Codebase</h2>
    <p>
      The entire system was designed with production standards in mind. 
      Review the live demo, explore the swap engine, or connect to discuss 
      architecture, blockchain infrastructure, or full-stack opportunities.
    </p>
    <div className="cta-actions">
      <button className="hero-primary" onClick={() => navigate('/swap')}>
        Try the Swap
      </button>
      <button className="hero-secondary" onClick={() => window.open('https://github.com/yourusername', '_blank')}>
        View GitHub
      </button>
    </div>
  </div>
</section>
    </section>
  </div>
)}
    </div>
  );
}

export default Home;