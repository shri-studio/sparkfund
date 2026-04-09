/**
 * ╔═══════════════════════════════════════════════════════╗
 * ║              sparkfund.js  v2.0                       ║
 * ║   Plug-and-play donation widget for any platform      ║
 * ║                                                       ║
 * ║   Razorpay (India/UPI) + PayPal (Global)              ║
 * ║   Named tiers · Theme presets · Zero dependencies     ║
 * ║                                                       ║
 * ║   by Shri Studio · https://shri.life                  ║
 * ║   github.com/shri-studio/sparkfund                    ║
 * ║   License: MIT                                        ║
 * ╚═══════════════════════════════════════════════════════╝
 *
 * ── QUICK START ──────────────────────────────────────────
 *
 *  <script>
 *    window.SparkFund = {
 *      projectName: "My App",
 *      razorpayKey: "rzp_live_xxxx",
 *      paypalMe:    "https://paypal.me/yourname",
 *    };
 *  </script>
 *  <script src="https://cdn.jsdelivr.net/gh/shri-studio/sparkfund@latest/sparkfund.js"></script>
 *
 *  <spark-button></spark-button>   <!-- inline button -->
 *  <spark-float></spark-float>     <!-- floating button -->
 *
 * ── FULL CONFIG ──────────────────────────────────────────
 *
 *  window.SparkFund = {
 *    // Required
 *    projectName:    "My App",
 *    razorpayKey:    "rzp_live_xxxx",
 *    paypalMe:       "https://paypal.me/yourname",
 *
 *    // Optional — identity
 *    projectTagline: "Keep this free 🙏",
 *
 *    // Optional — named tiers (defaults shown below)
 *    tiers: [
 *      { emoji: "☕", label: "Chai",       amountINR: 100,  amountUSD: 2  },
 *      { emoji: "🍱", label: "Lunch",      amountINR: 500,  amountUSD: 10 },
 *      { emoji: "🖥️", label: "Server",     amountINR: 1000, amountUSD: 20 },
 *      { emoji: "🚀", label: "Rocket",     amountINR: 2000, amountUSD: 50 },
 *    ],
 *
 *    // Optional — goal bar
 *    goalINR:     50000,
 *    raisedINR:   12500,
 *    goalUSD:     500,
 *    raisedUSD:   125,
 *
 *    // Optional — theming (pick ONE approach)
 *    theme:       "purple",   // preset: purple|green|ocean|rose|amber|dark
 *    accentColor: "#7C3AED",  // OR custom hex (overrides theme)
 *
 *    // Optional — CSS variable overrides (advanced)
 *    cssVars: {
 *      "--sf-accent":      "#7C3AED",
 *      "--sf-accent-soft": "#ede9fe",
 *      "--sf-radius":      "14px",
 *      "--sf-font":        "'Inter', sans-serif",
 *    },
 *
 *    // Optional — button labels
 *    floatLabel:  "Support this project",
 *    inlineLabel: "♥ Contribute",
 *  };
 */

(function () {
  'use strict';

  // ── THEME PRESETS ─────────────────────────────────────────
  const THEMES = {
    purple: { accent: '#7C3AED', soft: '#ede9fe', text: '#5b21b6' },
    green:  { accent: '#059669', soft: '#d1fae5', text: '#065f46' },
    ocean:  { accent: '#0284c7', soft: '#e0f2fe', text: '#075985' },
    rose:   { accent: '#e11d48', soft: '#ffe4e6', text: '#9f1239' },
    amber:  { accent: '#d97706', soft: '#fef3c7', text: '#92400e' },
    dark:   { accent: '#18181b', soft: '#f4f4f5', text: '#09090b' },
  };

  // ── DEFAULT TIERS ─────────────────────────────────────────
  const DEFAULT_TIERS = [
    { emoji: '☕', label: 'Chai',   amountINR: 100,  amountUSD: 2  },
    { emoji: '🍱', label: 'Lunch',  amountINR: 500,  amountUSD: 10 },
    { emoji: '🖥️', label: 'Server', amountINR: 1000, amountUSD: 20 },
    { emoji: '🚀', label: 'Rocket', amountINR: 2000, amountUSD: 50 },
  ];

  // ── DEFAULTS ──────────────────────────────────────────────
  const DEFAULTS = {
    projectName:    'Support My Work',
    projectTagline: 'Your contribution keeps this alive',
    razorpayKey:    '',
    paypalMe:       '',
    tiers:          DEFAULT_TIERS,
    goalINR:        0, raisedINR: 0,
    goalUSD:        0, raisedUSD: 0,
    theme:          'purple',
    accentColor:    '',
    cssVars:        {},
    floatLabel:     'Support this project',
    inlineLabel:    '♥ Contribute',
  };

  const CFG = Object.assign({}, DEFAULTS, window.SparkFund || {});

  // Resolve theme
  const themeKey    = CFG.accentColor ? null : (CFG.theme || 'purple');
  const themeColors = themeKey && THEMES[themeKey] ? THEMES[themeKey] : null;
  const ACCENT      = CFG.accentColor || (themeColors ? themeColors.accent : THEMES.purple.accent);
  const ACCENT_SOFT = themeColors ? themeColors.soft : `${ACCENT}18`;
  const ACCENT_TEXT = themeColors ? themeColors.text : ACCENT;

  // ── STATE ─────────────────────────────────────────────────
  const S = {
    isIndia:  true,
    detected: false,
    tierIdx:  1,       // selected tier index (null = custom)
    customAmt: '',
    method:   null,
    overlay:  null,
  };

  // ── GEO DETECT ────────────────────────────────────────────
  async function detectLocation() {
    const locale = (navigator.language || '').toLowerCase();
    if (locale === 'en-in' || locale.startsWith('hi')) {
      S.isIndia = true; S.detected = true; return;
    }
    try {
      const r = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
      const d = await r.json();
      S.isIndia = d.country_code === 'IN';
    } catch {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      S.isIndia = /Asia\/(Kolkata|Calcutta)/.test(tz);
    }
    S.detected = true;
  }

  // ── HELPERS ───────────────────────────────────────────────
  const sym    = () => S.isIndia ? '₹' : '$';
  const tierAmt = t => S.isIndia ? t.amountINR : t.amountUSD;
  const fmt    = (n, ind) => ind
    ? `₹${Number(n).toLocaleString('en-IN')}`
    : `$${Number(n).toLocaleString('en-US')}`;

  function effAmt() {
    if (S.customAmt && !isNaN(parseFloat(S.customAmt))) return parseFloat(S.customAmt);
    if (S.tierIdx !== null && CFG.tiers[S.tierIdx]) return tierAmt(CFG.tiers[S.tierIdx]);
    return null;
  }

  // ── CSS ───────────────────────────────────────────────────
  const BASE_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

    .sf-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.6);
      display:flex;align-items:center;justify-content:center;padding:1rem;
      opacity:0;pointer-events:none;transition:opacity .22s ease;
      font-family:'DM Sans','Segoe UI',system-ui,sans-serif;}
    .sf-overlay.sf-open{opacity:1;pointer-events:all;}
    .sf-modal{background:#fff;border-radius:var(--sf-radius);width:100%;max-width:430px;
      padding:1.75rem;box-shadow:0 32px 80px rgba(0,0,0,.2);position:relative;
      max-height:92vh;overflow-y:auto;
      transform:translateY(24px) scale(.96);
      transition:transform .28s cubic-bezier(.34,1.56,.64,1);}
    .sf-overlay.sf-open .sf-modal{transform:none;}

    .sf-close{position:absolute;top:1rem;right:1rem;background:#f4f4f5;border:none;
      border-radius:50%;width:30px;height:30px;cursor:pointer;color:#71717a;
      display:flex;align-items:center;justify-content:center;font-size:15px;transition:background .15s;}
    .sf-close:hover{background:#e4e4e7;}

    .sf-head{margin-bottom:1.25rem;padding-right:2rem;}
    .sf-title{font-size:19px;font-weight:700;color:#111;margin:0 0 3px;}
    .sf-sub{font-size:13px;color:#71717a;margin:0;}

    .sf-goal{margin-bottom:1.25rem;}
    .sf-goal-row{display:flex;justify-content:space-between;margin-bottom:5px;}
    .sf-goal-label{font-size:12px;color:#71717a;}
    .sf-goal-pct{font-size:12px;font-weight:700;color:var(--sf-accent);}
    .sf-goal-track{height:7px;background:#f4f4f5;border-radius:99px;overflow:hidden;}
    .sf-goal-fill{height:100%;border-radius:99px;background:var(--sf-accent);transition:width .7s ease;}

    .sf-loc{display:flex;align-items:center;gap:6px;margin-bottom:1.1rem;}
    .sf-loc-flag{font-size:17px;}
    .sf-loc-txt{font-size:13px;color:#71717a;flex:1;}
    .sf-loc-sw{font-size:12px;font-weight:700;color:var(--sf-accent);cursor:pointer;text-decoration:underline;}

    /* TIERS */
    .sf-tiers{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:1rem;}
    .sf-tier{border:1.5px solid #e4e4e7;border-radius:12px;padding:12px 10px;
      cursor:pointer;background:#fff;text-align:center;transition:all .15s;position:relative;}
    .sf-tier:hover{border-color:var(--sf-accent);}
    .sf-tier.active{border-color:var(--sf-accent);background:var(--sf-accent-soft);}
    .sf-tier-emoji{font-size:22px;display:block;margin-bottom:4px;line-height:1;}
    .sf-tier-label{font-size:13px;font-weight:700;color:#111;display:block;margin-bottom:2px;}
    .sf-tier-amt{font-size:12px;color:var(--sf-accent);font-weight:600;}
    .sf-tier.active .sf-tier-amt{font-weight:700;}
    .sf-popular{position:absolute;top:-9px;left:50%;transform:translateX(-50%);
      background:var(--sf-accent);color:#fff;font-size:9px;font-weight:700;
      border-radius:99px;padding:2px 8px;white-space:nowrap;letter-spacing:.04em;}

    .sf-custom-row{display:flex;align-items:center;gap:8px;margin-bottom:1.25rem;}
    .sf-sym{font-size:16px;font-weight:700;color:#374151;}
    .sf-custom{flex:1;border:1.5px solid #e4e4e7;border-radius:10px;padding:10px 12px;
      font-size:15px;color:#111;outline:none;font-family:inherit;transition:border-color .15s;}
    .sf-custom:focus{border-color:var(--sf-accent);}
    .sf-custom-label{font-size:11px;color:#a1a1aa;margin-top:4px;display:block;}

    .sf-pay-label{font-size:11px;font-weight:700;text-transform:uppercase;
      letter-spacing:.08em;color:#a1a1aa;margin-bottom:8px;}
    .sf-pay-opts{display:flex;flex-direction:column;gap:8px;margin-bottom:1.4rem;}
    .sf-pay-opt{display:flex;align-items:center;gap:12px;border:1.5px solid #e4e4e7;
      border-radius:12px;padding:11px 13px;cursor:pointer;background:#fff;transition:all .15s;}
    .sf-pay-opt:hover,.sf-pay-opt.active{border-color:var(--sf-accent);}
    .sf-pay-opt.active{background:var(--sf-accent-soft);}
    .sf-pay-icon{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;
      justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;color:#fff;}
    .sf-pay-info{flex:1;}
    .sf-pay-name{font-size:14px;font-weight:700;color:#111;margin:0 0 1px;}
    .sf-pay-desc{font-size:11px;color:#71717a;margin:0;}
    .sf-pay-badge{font-size:10px;font-weight:700;border-radius:5px;padding:2px 7px;flex-shrink:0;}
    .sf-radio{width:17px;height:17px;border-radius:50%;border:2px solid #d4d4d8;flex-shrink:0;transition:all .15s;}
    .sf-pay-opt.active .sf-radio{border-color:var(--sf-accent);background:var(--sf-accent);box-shadow:inset 0 0 0 3px #fff;}

    .sf-cta{width:100%;padding:13px;border:none;border-radius:11px;font-size:15px;
      font-weight:700;cursor:pointer;color:#fff;background:var(--sf-accent);
      transition:opacity .15s,transform .1s;margin-bottom:10px;font-family:inherit;}
    .sf-cta:hover{opacity:.9;}
    .sf-cta:active{transform:scale(.99);}
    .sf-cta:disabled{opacity:.4;cursor:not-allowed;}

    .sf-footer-note{display:flex;align-items:center;justify-content:center;gap:6px;
      font-size:11px;color:#a1a1aa;margin-top:2px;}
    .sf-footer-note a{color:var(--sf-accent);font-weight:600;text-decoration:none;}
    .sf-footer-note a:hover{text-decoration:underline;}

    /* TRIGGER BUTTONS */
    .sf-float-btn{position:fixed;bottom:24px;right:24px;z-index:2147483646;
      display:flex;align-items:center;gap:8px;background:var(--sf-accent);color:#fff;
      border:none;border-radius:50px;padding:13px 22px;font-size:14px;font-weight:700;
      cursor:pointer;box-shadow:0 4px 24px rgba(0,0,0,.18);
      font-family:'DM Sans','Segoe UI',system-ui,sans-serif;
      transition:transform .2s,box-shadow .2s;}
    .sf-float-btn:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,.22);}
    .sf-inline-btn{display:inline-flex;align-items:center;gap:7px;background:var(--sf-accent);
      color:#fff;border:none;border-radius:var(--sf-radius-sm);padding:10px 18px;
      font-size:14px;font-weight:700;cursor:pointer;
      font-family:'DM Sans','Segoe UI',system-ui,sans-serif;transition:opacity .15s,transform .1s;}
    .sf-inline-btn:hover{opacity:.88;}
    .sf-inline-btn:active{transform:scale(.98);}

    @keyframes sf-toast{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  `;

  // ── RENDER ────────────────────────────────────────────────
  function renderModal() {
    const ind    = S.isIndia;
    const goal   = ind ? CFG.goalINR   : CFG.goalUSD;
    const raised = ind ? CFG.raisedINR : CFG.raisedUSD;
    const pct    = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
    const eff    = effAmt();
    const method = S.method || (ind ? 'razorpay' : 'paypal');

    // CTA text
    let ctaTxt = 'Select a tier to continue';
    if (eff) {
      const tierLabel = S.tierIdx !== null && CFG.tiers[S.tierIdx]
        ? `${CFG.tiers[S.tierIdx].emoji} ${CFG.tiers[S.tierIdx].label}`
        : 'Custom';
      ctaTxt = method === 'razorpay'
        ? `Send ${fmt(eff, true)} · ${tierLabel} via Razorpay →`
        : `Send ${fmt(eff, false)} · ${tierLabel} via PayPal →`;
    }

    // Goal bar
    const goalHTML = goal > 0 ? `
      <div class="sf-goal">
        <div class="sf-goal-row">
          <span class="sf-goal-label">${fmt(raised, ind)} raised of ${fmt(goal, ind)} goal</span>
          <span class="sf-goal-pct">${pct}%</span>
        </div>
        <div class="sf-goal-track"><div class="sf-goal-fill" style="width:${pct}%"></div></div>
      </div>` : '';

    // Tier cards
    const tiersHTML = CFG.tiers.map((t, i) => `
      <div class="sf-tier${S.tierIdx === i ? ' active' : ''}" data-tier="${i}">
        ${i === 1 ? '<span class="sf-popular">POPULAR</span>' : ''}
        <span class="sf-tier-emoji">${t.emoji}</span>
        <span class="sf-tier-label">${t.label}</span>
        <span class="sf-tier-amt">${sym()}${tierAmt(t).toLocaleString()}</span>
      </div>`).join('');

    // Custom label hint
    const customHint = S.tierIdx === null && S.customAmt
      ? `<span class="sf-custom-label">Custom amount · enter anything you like</span>`
      : `<span class="sf-custom-label">Or enter a custom amount</span>`;

    // Payment options
    const payHTML = ind ? `
      <div class="sf-pay-opt${method === 'razorpay' ? ' active' : ''}" data-method="razorpay">
        <div class="sf-pay-icon" style="background:#3395FF">Rz</div>
        <div class="sf-pay-info">
          <p class="sf-pay-name">Razorpay</p>
          <p class="sf-pay-desc">UPI · Cards · Netbanking · Wallets</p>
        </div>
        <span class="sf-pay-badge" style="background:#dcfce7;color:#15803d">India</span>
        <div class="sf-radio"></div>
      </div>` : `
      <div class="sf-pay-opt${method === 'paypal' ? ' active' : ''}" data-method="paypal">
        <div class="sf-pay-icon" style="background:#003087">PP</div>
        <div class="sf-pay-info">
          <p class="sf-pay-name">PayPal</p>
          <p class="sf-pay-desc">Cards · PayPal balance · International</p>
        </div>
        <span class="sf-pay-badge" style="background:#dbeafe;color:#1d4ed8">Global</span>
        <div class="sf-radio"></div>
      </div>`;

    return `
      <div class="sf-modal">
        <button class="sf-close" id="sf-close" aria-label="Close">✕</button>
        <div class="sf-head">
          <h2 class="sf-title">${CFG.projectName}</h2>
          <p class="sf-sub">${CFG.projectTagline}</p>
        </div>
        ${goalHTML}
        <div class="sf-loc">
          <span class="sf-loc-flag">${ind ? '🇮🇳' : '🌍'}</span>
          <span class="sf-loc-txt">${ind ? 'Contributing from India' : 'Contributing globally'}</span>
          <span class="sf-loc-sw" id="sf-sw">Switch to ${ind ? 'global ($)' : 'India (₹)'}</span>
        </div>
        <div class="sf-tiers">${tiersHTML}</div>
        <div class="sf-custom-row">
          <span class="sf-sym">${sym()}</span>
          <div style="flex:1">
            <input class="sf-custom" id="sf-custom" type="number" min="1"
              placeholder="Custom amount" value="${S.customAmt}" />
            ${customHint}
          </div>
        </div>
        <p class="sf-pay-label">Pay via</p>
        <div class="sf-pay-opts">${payHTML}</div>
        <button class="sf-cta" id="sf-cta"${!eff ? ' disabled' : ''}>${ctaTxt}</button>
        <div class="sf-footer-note">
          Secure · 0% platform fee ·
          <a href="https://shri.life" target="_blank" rel="noopener">powered by shri.life</a>
        </div>
      </div>`;
  }

  // ── BIND EVENTS ───────────────────────────────────────────
  function bind() {
    const o = S.overlay;
    if (!o) return;
    o.onclick = e => { if (e.target === o) close(); };

    const $ = sel => o.querySelector(sel);

    const closeBtn = $('#sf-close');
    if (closeBtn) closeBtn.onclick = close;

    o.querySelectorAll('.sf-tier').forEach(el => {
      el.onclick = () => {
        S.tierIdx  = parseInt(el.dataset.tier);
        S.customAmt = '';
        refresh();
      };
    });

    const ci = $('#sf-custom');
    if (ci) {
      ci.oninput = () => {
        S.customAmt = ci.value;
        S.tierIdx   = null;
        updateCTA();
      };
    }

    o.querySelectorAll('.sf-pay-opt').forEach(el => {
      el.onclick = () => { S.method = el.dataset.method; refresh(); };
    });

    const sw = $('#sf-sw');
    if (sw) sw.onclick = () => {
      S.isIndia   = !S.isIndia;
      S.tierIdx   = 1;
      S.customAmt = '';
      S.method    = S.isIndia ? 'razorpay' : 'paypal';
      refresh();
    };

    const cta = $('#sf-cta');
    if (cta) cta.onclick = () => {
      const eff = effAmt();
      if (!eff) return;
      const m = S.method || (S.isIndia ? 'razorpay' : 'paypal');
      m === 'razorpay' ? payRazorpay(eff) : payPayPal(eff);
    };
  }

  function updateCTA() {
    const cta = S.overlay && S.overlay.querySelector('#sf-cta');
    if (!cta) return;
    const eff    = effAmt();
    const method = S.method || (S.isIndia ? 'razorpay' : 'paypal');
    const tier   = S.tierIdx !== null && CFG.tiers[S.tierIdx];
    const label  = tier ? `${tier.emoji} ${tier.label}` : 'Custom';
    cta.disabled    = !eff;
    cta.textContent = eff
      ? (method === 'razorpay'
          ? `Send ${fmt(eff, true)} · ${label} via Razorpay →`
          : `Send ${fmt(eff, false)} · ${label} via PayPal →`)
      : 'Select a tier to continue';
  }

  function refresh() {
    const inner = S.overlay && S.overlay.querySelector('#sf-inner');
    if (inner) { inner.innerHTML = renderModal(); bind(); }
  }

  // ── OPEN / CLOSE ──────────────────────────────────────────
  function open() {
    S.tierIdx   = 1;
    S.customAmt = '';
    S.method    = S.isIndia ? 'razorpay' : 'paypal';
    refresh();
    S.overlay.classList.add('sf-open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    S.overlay.classList.remove('sf-open');
    document.body.style.overflow = '';
  }

  // ── PAYMENTS ──────────────────────────────────────────────
  function payRazorpay(amount) {
    if (!CFG.razorpayKey) {
      alert('Razorpay key not configured. Set razorpayKey in window.SparkFund.'); return;
    }
    const go = () => {
      new window.Razorpay({
        key:         CFG.razorpayKey,
        amount:      Math.round(amount * 100),
        currency:    'INR',
        name:        CFG.projectName,
        description: S.tierIdx !== null && CFG.tiers[S.tierIdx]
          ? `${CFG.tiers[S.tierIdx].emoji} ${CFG.tiers[S.tierIdx].label}`
          : 'Custom contribution',
        theme: { color: ACCENT },
        handler: () => { close(); toast('Thank you! Your spark keeps this alive 🙏'); },
      }).open();
    };
    if (window.Razorpay) { go(); return; }
    const s   = document.createElement('script');
    s.src     = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload  = go;
    document.head.appendChild(s);
  }

  function payPayPal(amount) {
    if (!CFG.paypalMe) {
      alert('PayPal link not configured. Set paypalMe in window.SparkFund.'); return;
    }
    window.open(`${CFG.paypalMe}/${amount}USD`, '_blank');
    close();
  }

  function toast(msg) {
    const t       = document.createElement('div');
    t.style.cssText =
      'position:fixed;bottom:80px;right:24px;z-index:2147483647;' +
      'background:#18181b;color:#fff;padding:12px 20px;border-radius:12px;' +
      'font-family:"DM Sans",system-ui,sans-serif;font-size:14px;font-weight:600;' +
      'box-shadow:0 8px 32px rgba(0,0,0,.25);animation:sf-toast .3s ease;max-width:280px;';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // ── INIT ──────────────────────────────────────────────────
  function init() {
    // Inject CSS vars + base styles
    const cssVarBlock = Object.entries(
      Object.assign({
        '--sf-accent':      ACCENT,
        '--sf-accent-soft': ACCENT_SOFT,
        '--sf-accent-text': ACCENT_TEXT,
        '--sf-radius':      '16px',
        '--sf-radius-sm':   '10px',
        '--sf-font':        "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      }, CFG.cssVars)
    ).map(([k, v]) => `${k}:${v}`).join(';');

    const style       = document.createElement('style');
    style.textContent = `:root{${cssVarBlock}}\n${BASE_CSS}`;
    document.head.appendChild(style);

    // Overlay
    const ov       = document.createElement('div');
    ov.className   = 'sf-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', `${CFG.projectName} — donation`);
    ov.innerHTML   = '<div id="sf-inner"></div>';
    document.body.appendChild(ov);
    S.overlay = ov;

    // Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && ov.classList.contains('sf-open')) close();
    });

    // Geo detect
    detectLocation().then(() => {
      S.method = S.isIndia ? 'razorpay' : 'paypal';
    });

    // Custom elements
    if (!customElements.get('spark-button')) {
      customElements.define('spark-button', class extends HTMLElement {
        connectedCallback() {
          const b       = document.createElement('button');
          b.className   = 'sf-inline-btn';
          b.textContent = this.getAttribute('label') || CFG.inlineLabel;
          b.onclick     = open;
          this.appendChild(b);
        }
      });
    }

    if (!customElements.get('spark-float')) {
      customElements.define('spark-float', class extends HTMLElement {
        connectedCallback() {
          const b     = document.createElement('button');
          b.className = 'sf-float-btn';
          b.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191
            5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447
            5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136
            8.625-11 14.402z"/></svg>${this.getAttribute('label') || CFG.floatLabel}`;
          b.setAttribute('aria-label', 'Open donation widget');
          b.onclick = open;
          this.appendChild(b);
        }
      });
    }

    // Public API
    window.SparkFund        = window.SparkFund || {};
    window.SparkFund.open   = open;
    window.SparkFund.close  = close;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
