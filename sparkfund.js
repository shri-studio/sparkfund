(function () {
  'use strict';

  const THEMES = {
    purple: { accent:'#7C3AED', soft:'#ede9fe', text:'#5b21b6' },
    green:  { accent:'#059669', soft:'#d1fae5', text:'#065f46' },
    ocean:  { accent:'#0284c7', soft:'#e0f2fe', text:'#075985' },
    rose:   { accent:'#e11d48', soft:'#ffe4e6', text:'#9f1239' },
    amber:  { accent:'#d97706', soft:'#fef3c7', text:'#92400e' },
    dark:   { accent:'#18181b', soft:'#f4f4f5', text:'#09090b' },
  };

  const DEFAULT_TIERS = [
    { emoji:'☕', label:'Chai',   amountINR:100,  amountUSD:2  },
    { emoji:'🍱', label:'Lunch',  amountINR:500,  amountUSD:10 },
    { emoji:'🖥️', label:'Server', amountINR:1000, amountUSD:20 },
    { emoji:'🚀', label:'Rocket', amountINR:2000, amountUSD:50 },
  ];

  const DEFAULTS = {
    projectName:'Support My Work', projectTagline:'Your contribution keeps this alive',
    projectUrl:window.location.href, razorpayKey:'', paypalMe:'',
    tiers:DEFAULT_TIERS, goalINR:0,raisedINR:0,goalUSD:0,raisedUSD:0,
    supabase:null, jsonbin:null, emailjs:null,
    theme:'purple', accentColor:'', darkMode:'auto', cssVars:{},
    confetti:true, shareSheet:true,
    floatLabel:'Support this project', inlineLabel:'♥ Contribute',
  };

  const CFG = Object.assign({}, DEFAULTS, window.SparkFund || {});
  const TC  = !CFG.accentColor && THEMES[CFG.theme] ? THEMES[CFG.theme] : null;
  const ACCENT      = CFG.accentColor || (TC ? TC.accent : THEMES.purple.accent);
  const ACCENT_SOFT = TC ? TC.soft : ACCENT + '18';

  const S = {
    isIndia:true, isDark:false, tierIdx:1, customAmt:'',
    method:null, overlay:null, raisedINR:CFG.raisedINR, raisedUSD:CFG.raisedUSD,
    supporters:[], screen:'main', lastTier:null, lastAmt:0,
    contributorName:'', contributorEmail:'',
  };

  /* DARK MODE */
  function initDark() {
    if (CFG.darkMode==='dark') { S.isDark=true; return; }
    if (CFG.darkMode==='light') { S.isDark=false; return; }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    S.isDark = mq.matches;
    mq.addEventListener('change', e => {
      S.isDark=e.matches;
      if(S.overlay) S.overlay.classList.toggle('sf-dark',S.isDark);
      refresh();
    });
  }

  /* GEO */
  async function detectLocation() {
    const loc = (navigator.language||'').toLowerCase();
    if (loc==='en-in'||loc.startsWith('hi')) { S.isIndia=true; return; }
    try {
      const r = await fetch('https://ipapi.co/json/',{signal:AbortSignal.timeout(3000)});
      S.isIndia = (await r.json()).country_code === 'IN';
    } catch {
      S.isIndia = /Asia\/(Kolkata|Calcutta)/.test(Intl.DateTimeFormat().resolvedOptions().timeZone||'');
    }
  }

  /* GOAL SYNC */
  async function syncGoal() {
    if (CFG.supabase) {
      try {
        const {url,anonKey,table,projectId} = CFG.supabase;
        const r = await fetch(`${url}/rest/v1/${table}?project_id=eq.${projectId}&select=raised_inr,raised_usd`,
          {headers:{apikey:anonKey,Authorization:`Bearer ${anonKey}`}});
        const d = await r.json();
        if (d[0]) { S.raisedINR=d[0].raised_inr||0; S.raisedUSD=d[0].raised_usd||0; }
      } catch(e){console.warn('[sparkfund] Supabase sync failed',e);}
    } else if (CFG.jsonbin) {
      try {
        const {binId,apiKey} = CFG.jsonbin;
        const r = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`,{headers:{'X-Master-Key':apiKey}});
        const d = (await r.json()).record;
        if (d) { S.raisedINR=d.raisedINR||0; S.raisedUSD=d.raisedUSD||0; S.supporters=d.supporters||[]; }
      } catch(e){console.warn('[sparkfund] JSONbin sync failed',e);}
    }
  }

  async function pushUpdate(amtINR, amtUSD, sup) {
    S.raisedINR+=amtINR; S.raisedUSD+=amtUSD;
    if (sup) { S.supporters.unshift(sup); if(S.supporters.length>50) S.supporters=S.supporters.slice(0,50); }
    if (CFG.supabase) {
      try {
        const {url,anonKey,table,projectId} = CFG.supabase;
        await fetch(`${url}/rest/v1/${table}?project_id=eq.${projectId}`,{
          method:'PATCH',
          headers:{apikey:anonKey,Authorization:`Bearer ${anonKey}`,'Content-Type':'application/json',Prefer:'return=minimal'},
          body:JSON.stringify({raised_inr:S.raisedINR,raised_usd:S.raisedUSD}),
        });
      } catch(e){console.warn('[sparkfund] push failed',e);}
    } else if (CFG.jsonbin) {
      try {
        const {binId,apiKey} = CFG.jsonbin;
        await fetch(`https://api.jsonbin.io/v3/b/${binId}`,{
          method:'PUT',
          headers:{'Content-Type':'application/json','X-Master-Key':apiKey},
          body:JSON.stringify({raisedINR:S.raisedINR,raisedUSD:S.raisedUSD,supporters:S.supporters}),
        });
      } catch(e){console.warn('[sparkfund] push failed',e);}
    }
  }

  /* EMAILJS */
  async function sendEmail(email,name,amount,tier) {
    if (!CFG.emailjs||!email) return;
    try {
      if (!window.emailjs) {
        await new Promise((res,rej)=>{
          const s=document.createElement('script');
          s.src='https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
          s.onload=res;s.onerror=rej;document.head.appendChild(s);
        });
        window.emailjs.init({publicKey:CFG.emailjs.publicKey});
      }
      await window.emailjs.send(CFG.emailjs.serviceId,CFG.emailjs.templateId,{
        to_email:email,to_name:name||'Friend',project_name:CFG.projectName,
        amount,tier_label:tier?`${tier.emoji} ${tier.label}`:'Custom',
        project_url:CFG.projectUrl,
      });
    } catch(e){console.warn('[sparkfund] EmailJS failed',e);}
  }

  /* CONFETTI */
  function fireConfetti() {
    const c=document.createElement('canvas');
    c.style.cssText='position:fixed;inset:0;z-index:2147483647;pointer-events:none;width:100%;height:100%';
    c.width=window.innerWidth; c.height=window.innerHeight;
    document.body.appendChild(c);
    const ctx=c.getContext('2d');
    const colors=[ACCENT,'#fbbf24','#34d399','#f87171','#60a5fa','#a78bfa','#fb923c'];
    const ps=Array.from({length:120},()=>({
      x:Math.random()*c.width, y:-10-Math.random()*80,
      r:4+Math.random()*5, d:2+Math.random()*3,
      color:colors[Math.floor(Math.random()*colors.length)],
      ta:0, ts:0.07+Math.random()*0.05,
      shape:Math.random()>.5?'rect':'circle',
    }));
    let f=0;
    const draw=()=>{
      ctx.clearRect(0,0,c.width,c.height);
      ps.forEach(p=>{
        ctx.beginPath(); ctx.fillStyle=p.color;
        if(p.shape==='rect'){
          ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.ta);
          ctx.fillRect(-p.r,-p.r/2,p.r*2,p.r);ctx.restore();
        } else { ctx.arc(p.x,p.y,p.r,0,2*Math.PI);ctx.fill(); }
        p.y+=p.d; p.ta+=p.ts; p.x+=Math.sin(p.ta)*1.5;
      });
      if(++f<180) requestAnimationFrame(draw); else c.remove();
    };
    requestAnimationFrame(draw);
  }

  /* HELPERS */
  const sym=()=>S.isIndia?'₹':'$';
  const ta=t=>S.isIndia?t.amountINR:t.amountUSD;
  const fmt=(n,ind)=>ind?`₹${Number(n).toLocaleString('en-IN')}`:`$${Number(n).toLocaleString('en-US')}`;
  function effAmt(){
    if(S.customAmt&&!isNaN(parseFloat(S.customAmt))) return parseFloat(S.customAmt);
    if(S.tierIdx!==null&&CFG.tiers[S.tierIdx]) return ta(CFG.tiers[S.tierIdx]);
    return null;
  }

  /* CSS */
  const CSS=`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
    .sf-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.6);
      display:flex;align-items:center;justify-content:center;padding:1rem;
      opacity:0;pointer-events:none;transition:opacity .22s;
      font-family:'DM Sans','Segoe UI',system-ui,sans-serif;}
    .sf-overlay.sf-open{opacity:1;pointer-events:all;}
    .sf-modal{background:#ffffff;color:#111827;border-radius:var(--sf-radius);
      width:100%;max-width:430px;padding:1.75rem;position:relative;max-height:92vh;overflow-y:auto;
      box-shadow:0 32px 80px rgba(0,0,0,.22);border:1px solid #e4e4e7;
      transform:translateY(24px) scale(.96);transition:transform .28s cubic-bezier(.34,1.56,.64,1);}
    .sf-overlay.sf-open .sf-modal{transform:none;}
    .sf-close,.sf-dark-toggle{position:absolute;top:1rem;background:#f3f4f6;border:none;
      border-radius:50%;width:30px;height:30px;cursor:pointer;color:#71717a;
      display:flex;align-items:center;justify-content:center;font-size:15px;transition:background .15s;}
    .sf-close{right:1rem;} .sf-dark-toggle{right:3.25rem;}
    .sf-close:hover,.sf-dark-toggle:hover{background:var(--sf-border);}
    .sf-head{margin-bottom:1.25rem;padding-right:5rem;}
    .sf-title{font-size:19px;font-weight:700;color:#111827;margin:0 0 3px;}
    .sf-sub{font-size:13px;color:#71717a;margin:0;}
    .sf-goal{margin-bottom:1.25rem;}
    .sf-goal-row{display:flex;justify-content:space-between;margin-bottom:5px;}
    .sf-goal-label{font-size:12px;color:#71717a;}
    .sf-goal-pct{font-size:12px;font-weight:700;color:var(--sf-accent);}
    .sf-goal-track{height:7px;background:#f3f4f6;border-radius:99px;overflow:hidden;}
    .sf-goal-fill{height:100%;border-radius:99px;background:var(--sf-accent);transition:width .7s;}
    .sf-loc{display:flex;align-items:center;gap:6px;margin-bottom:1.1rem;}
    .sf-loc-flag{font-size:17px;} .sf-loc-txt{font-size:13px;color:#71717a;flex:1;}
    .sf-loc-sw{font-size:12px;font-weight:700;color:var(--sf-accent);cursor:pointer;text-decoration:underline;}
    .sf-tiers{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:1rem;}
    .sf-tier{border:1.5px solid #e4e4e7;border-radius:12px;padding:12px 10px;
      cursor:pointer;background:#ffffff;text-align:center;transition:all .15s;position:relative;}
    .sf-tier:hover,.sf-tier.active{border-color:var(--sf-accent);}
    .sf-tier.active{background:var(--sf-accent-soft);}
    .sf-tier-emoji{font-size:22px;display:block;margin-bottom:4px;line-height:1;}
    .sf-tier-label{font-size:13px;font-weight:700;color:#111827;display:block;margin-bottom:2px;}
    .sf-tier-amt{font-size:12px;color:var(--sf-accent);font-weight:600;}
    .sf-popular{position:absolute;top:-9px;left:50%;transform:translateX(-50%);
      background:var(--sf-accent);color:#fff;font-size:9px;font-weight:700;
      border-radius:99px;padding:2px 8px;white-space:nowrap;}
    .sf-custom-row{display:flex;align-items:flex-start;gap:8px;margin-bottom:1rem;}
    .sf-sym{font-size:16px;font-weight:700;color:#111827;margin-top:10px;}
    .sf-custom-wrap{flex:1;}
    .sf-custom{width:100%;border:1.5px solid #e4e4e7;border-radius:10px;
      padding:10px 12px;font-size:15px;color:#111827;background:#ffffff;
      outline:none;font-family:inherit;transition:border-color .15s;}
    .sf-custom:focus{border-color:var(--sf-accent);}
    .sf-custom-hint{font-size:11px;color:#a1a1aa;margin-top:4px;display:block;}
    .sf-contributor{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:1rem;}
    .sf-field{display:flex;flex-direction:column;gap:3px;}
    .sf-field label{font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:.05em;}
    .sf-input{border:1.5px solid #e4e4e7;border-radius:9px;padding:9px 11px;
      font-size:13px;color:#111827;background:#ffffff;outline:none;font-family:inherit;transition:border-color .15s;}
    .sf-input:focus{border-color:var(--sf-accent);}
    .sf-input::placeholder,.sf-custom::placeholder{color:#a1a1aa;}
    .sf-pay-label{font-size:11px;font-weight:700;text-transform:uppercase;
      letter-spacing:.08em;color:#a1a1aa;margin-bottom:8px;}
    .sf-pay-opts{display:flex;flex-direction:column;gap:8px;margin-bottom:1.4rem;}
    .sf-pay-opt{display:flex;align-items:center;gap:12px;border:1.5px solid #e4e4e7;
      border-radius:12px;padding:11px 13px;cursor:pointer;background:#ffffff;transition:all .15s;}
    .sf-pay-opt:hover,.sf-pay-opt.active{border-color:var(--sf-accent);}
    .sf-pay-opt.active{background:var(--sf-accent-soft);}
    .sf-pay-icon{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;
      justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;color:#fff;}
    .sf-pay-info{flex:1;}
    .sf-pay-name{font-size:14px;font-weight:700;color:#111827;margin:0 0 1px;}
    .sf-pay-desc{font-size:11px;color:#71717a;margin:0;}
    .sf-pay-badge{font-size:10px;font-weight:700;border-radius:5px;padding:2px 7px;flex-shrink:0;}
    .sf-radio{width:17px;height:17px;border-radius:50%;border:2px solid #d4d4d8;flex-shrink:0;transition:all .15s;}
    .sf-pay-opt.active .sf-radio{border-color:var(--sf-accent);background:var(--sf-accent);box-shadow:inset 0 0 0 3px #ffffff;}
    .sf-cta{width:100%;padding:13px;border:none;border-radius:11px;font-size:15px;font-weight:700;
      cursor:pointer;color:#fff;background:var(--sf-accent);transition:opacity .15s,transform .1s;
      margin-bottom:10px;font-family:inherit;}
    .sf-cta:hover{opacity:.9;} .sf-cta:active{transform:scale(.99);}
    .sf-cta:disabled{opacity:.4;cursor:not-allowed;}
    .sf-footer-note{display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;color:#a1a1aa;}
    .sf-footer-note a{color:var(--sf-accent);font-weight:600;text-decoration:none;}
    .sf-footer-note a:hover{text-decoration:underline;}
    .sf-success{text-align:center;padding:.5rem 0;}
    .sf-success-icon{font-size:52px;display:block;margin-bottom:1rem;animation:sf-pop .4s cubic-bezier(.34,1.56,.64,1);}
    .sf-success-title{font-size:22px;font-weight:700;color:#111827;margin-bottom:.5rem;}
    .sf-success-sub{font-size:14px;color:#71717a;margin-bottom:1.5rem;line-height:1.6;}
    .sf-success-amount{display:inline-block;background:var(--sf-accent-soft);color:var(--sf-accent);
      font-size:18px;font-weight:700;border-radius:10px;padding:8px 20px;margin-bottom:1.5rem;}
    .sf-share-label{font-size:11px;font-weight:700;text-transform:uppercase;
      letter-spacing:.08em;color:#a1a1aa;margin-bottom:10px;}
    .sf-share-btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:1.5rem;}
    .sf-share-btn{display:flex;align-items:center;gap:6px;border:1.5px solid #e4e4e7;
      background:#ffffff;color:#111827;border-radius:9px;padding:8px 14px;
      font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;}
    .sf-share-btn:hover{border-color:var(--sf-accent);color:var(--sf-accent);}
    .sf-share-btn.copied{border-color:var(--sf-accent);color:var(--sf-accent);background:var(--sf-accent-soft);}
    .sf-success-close{width:100%;padding:11px;border:1.5px solid #e4e4e7;border-radius:10px;
      background:transparent;color:#71717a;font-size:14px;font-weight:600;
      cursor:pointer;font-family:inherit;transition:all .15s;}
    .sf-success-close:hover{border-color:var(--sf-accent);color:var(--sf-accent);}
    .sf-wall{font-family:'DM Sans','Segoe UI',system-ui,sans-serif;}
    .sf-wall-title{font-size:13px;font-weight:700;color:#71717a;
      text-transform:uppercase;letter-spacing:.06em;margin-bottom:.75rem;}
    .sf-wall-list{display:flex;flex-wrap:wrap;gap:8px;}
    .sf-wall-item{display:flex;align-items:center;gap:7px;background:#f9fafb;
      border:1px solid #e4e4e7;border-radius:20px;padding:5px 12px 5px 5px;font-size:13px;}
    .sf-wall-avatar{width:26px;height:26px;border-radius:50%;background:var(--sf-accent);color:#fff;
      font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    .sf-wall-name{font-weight:600;color:#111827;} .sf-wall-tier{font-size:15px;}
    .sf-wall-empty{font-size:13px;color:#a1a1aa;font-style:italic;}
    .sf-float-btn{position:fixed;bottom:24px;right:24px;z-index:2147483646;display:flex;
      align-items:center;gap:8px;background:var(--sf-accent);color:#fff;border:none;
      border-radius:50px;padding:13px 22px;font-size:14px;font-weight:700;cursor:pointer;
      box-shadow:0 4px 24px rgba(0,0,0,.18);font-family:'DM Sans','Segoe UI',system-ui,sans-serif;
      transition:transform .2s,box-shadow .2s;}
    .sf-float-btn:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,.22);}
    .sf-inline-btn{display:inline-flex;align-items:center;gap:7px;background:var(--sf-accent);
      color:#fff;border:none;border-radius:var(--sf-radius-sm);padding:10px 18px;font-size:14px;
      font-weight:700;cursor:pointer;font-family:'DM Sans','Segoe UI',system-ui,sans-serif;transition:opacity .15s,transform .1s;}
    .sf-inline-btn:hover{opacity:.88;} .sf-inline-btn:active{transform:scale(.98);}
    @keyframes sf-pop{from{transform:scale(.5)}to{transform:scale(1)}}
    @keyframes sf-toast{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
    .sf-overlay.sf-dark .sf-modal{background:#18181b;color:#fafafa;}
    .sf-overlay.sf-dark .sf-title{color:#fafafa;}
    .sf-overlay.sf-dark .sf-sub{color:#a1a1aa;}
    .sf-overlay.sf-dark .sf-tier{background:#27272a;border-color:#3f3f46;}
    .sf-overlay.sf-dark .sf-tier-label{color:#fafafa;}
    .sf-overlay.sf-dark .sf-custom{background:#27272a;border-color:#3f3f46;color:#fafafa;}
    .sf-overlay.sf-dark .sf-input{background:#27272a;border-color:#3f3f46;color:#fafafa;}
    .sf-overlay.sf-dark .sf-pay-opt{background:#27272a;border-color:#3f3f46;}
    .sf-overlay.sf-dark .sf-pay-name{color:#fafafa;}
    .sf-overlay.sf-dark .sf-pay-desc{color:#a1a1aa;}
    .sf-overlay.sf-dark .sf-close,.sf-overlay.sf-dark .sf-dark-toggle{background:#3f3f46;color:#a1a1aa;}
    .sf-overlay.sf-dark .sf-goal-track{background:#3f3f46;}
    .sf-overlay.sf-dark .sf-loc-txt{color:#a1a1aa;}
    .sf-overlay.sf-dark .sf-goal-label{color:#a1a1aa;}
    .sf-overlay.sf-dark .sf-success-title{color:#fafafa;}
    .sf-overlay.sf-dark .sf-success-sub{color:#a1a1aa;}
    .sf-overlay.sf-dark .sf-share-btn{background:#27272a;border-color:#3f3f46;color:#fafafa;}
    .sf-overlay.sf-dark .sf-success-close{border-color:#3f3f46;color:#a1a1aa;}
    .sf-overlay.sf-dark .sf-radio{border-color:#52525b;}
    .sf-overlay.sf-dark .sf-pay-opt.active .sf-radio{box-shadow:inset 0 0 0 3px #18181b;}
  `;

  /* RENDER MAIN */
  function renderMain() {
    const ind=S.isIndia, goal=ind?CFG.goalINR:CFG.goalUSD, raised=ind?S.raisedINR:S.raisedUSD;
    const pct=goal>0?Math.min(100,Math.round((raised/goal)*100)):0;
    const eff=effAmt(), method=S.method||(ind?'razorpay':'paypal');
    const tier=S.tierIdx!==null?CFG.tiers[S.tierIdx]:null;
    const tLabel=tier?`${tier.emoji} ${tier.label}`:'Custom';
    const ctaTxt=eff?(method==='razorpay'?`Send ${fmt(eff,true)} · ${tLabel} via Razorpay →`:`Send ${fmt(eff,false)} · ${tLabel} via PayPal →`):'Select a tier to continue';
    const goalHTML=goal>0?`<div class="sf-goal"><div class="sf-goal-row"><span class="sf-goal-label">${fmt(raised,ind)} raised of ${fmt(goal,ind)}</span><span class="sf-goal-pct">${pct}%</span></div><div class="sf-goal-track"><div class="sf-goal-fill" style="width:${pct}%"></div></div></div>`:'';
    const tiersHTML=CFG.tiers.map((t,i)=>`<div class="sf-tier${S.tierIdx===i?' active':''}" data-tier="${i}">${i===1?'<span class="sf-popular">POPULAR</span>':''}<span class="sf-tier-emoji">${t.emoji}</span><span class="sf-tier-label">${t.label}</span><span class="sf-tier-amt">${sym()}${ta(t).toLocaleString()}</span></div>`).join('');
    const payHTML=ind?`<div class="sf-pay-opt${method==='razorpay'?' active':''}" data-method="razorpay"><div class="sf-pay-icon" style="background:#3395FF">Rz</div><div class="sf-pay-info"><p class="sf-pay-name">Razorpay</p><p class="sf-pay-desc">UPI · Cards · Netbanking · Wallets</p></div><span class="sf-pay-badge" style="background:#dcfce7;color:#15803d">India</span><div class="sf-radio"></div></div>`:`<div class="sf-pay-opt${method==='paypal'?' active':''}" data-method="paypal"><div class="sf-pay-icon" style="background:#003087">PP</div><div class="sf-pay-info"><p class="sf-pay-name">PayPal</p><p class="sf-pay-desc">Cards · PayPal balance · International</p></div><span class="sf-pay-badge" style="background:#dbeafe;color:#1d4ed8">Global</span><div class="sf-radio"></div></div>`;
    return `<button class="sf-dark-toggle" id="sf-dark-toggle">${S.isDark?'☀️':'🌙'}</button>
      <button class="sf-close" id="sf-close">✕</button>
      <div class="sf-head"><h2 class="sf-title">${CFG.projectName}</h2><p class="sf-sub">${CFG.projectTagline}</p></div>
      ${goalHTML}
      <div class="sf-loc"><span class="sf-loc-flag">${ind?'🇮🇳':'🌍'}</span><span class="sf-loc-txt">${ind?'Contributing from India':'Contributing globally'}</span><span class="sf-loc-sw" id="sf-sw">Switch to ${ind?'global ($)':'India (₹)'}</span></div>
      <div class="sf-tiers">${tiersHTML}</div>
      <div class="sf-custom-row"><span class="sf-sym">${sym()}</span><div class="sf-custom-wrap"><input class="sf-custom" id="sf-custom" type="number" min="1" placeholder="Custom amount" value="${S.customAmt}"/><span class="sf-custom-hint">Or enter any amount you like</span></div></div>
      <div class="sf-contributor"><div class="sf-field"><label>Your name</label><input class="sf-input" id="sf-name" type="text" placeholder="Optional" value="${S.contributorName}"/></div><div class="sf-field"><label>Email (for receipt)</label><input class="sf-input" id="sf-email" type="email" placeholder="Optional" value="${S.contributorEmail}"/></div></div>
      <p class="sf-pay-label">Pay via</p>
      <div class="sf-pay-opts">${payHTML}</div>
      <button class="sf-cta" id="sf-cta"${!eff?' disabled':''}>${ctaTxt}</button>
      <div class="sf-footer-note">Secure · 0% platform fee · <a href="https://shri.life" target="_blank" rel="noopener">powered by shri.life</a></div>`;
  }

  /* RENDER SUCCESS */
  function renderSuccess() {
    const tier=S.lastTier, ind=S.isIndia, amount=fmt(S.lastAmt,ind);
    const text=encodeURIComponent(`I just supported ${CFG.projectName} ${tier?tier.emoji:'♥'} — check it out! ${CFG.projectUrl}`);
    return `<button class="sf-close" id="sf-close">✕</button>
      <div class="sf-success">
        <span class="sf-success-icon">${tier?tier.emoji:'🎉'}</span>
        <div class="sf-success-title">Thank you${S.contributorName?', '+S.contributorName:''}!</div>
        <div class="sf-success-sub">Your ${tier?tier.label:'contribution'} keeps <strong>${CFG.projectName}</strong> alive. You're awesome.</div>
        <div class="sf-success-amount">${amount}${tier?' · '+tier.emoji+' '+tier.label:''}</div>
        ${CFG.shareSheet?`<p class="sf-share-label">Spread the word</p>
        <div class="sf-share-btns">
          <button class="sf-share-btn" id="sf-share-x"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>Share on X</button>
          <button class="sf-share-btn" id="sf-share-wa"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.528 5.858L.057 23.5l5.797-1.521A11.938 11.938 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.659-.498-5.191-1.369l-.373-.221-3.861 1.013 1.033-3.762-.241-.389A9.936 9.936 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>WhatsApp</button>
          <button class="sf-share-btn" id="sf-share-copy">🔗 Copy link</button>
        </div>`:''}
        <button class="sf-success-close" id="sf-close">Done</button>
      </div>`;
  }

  /* BIND */
  function bind() {
    const o=S.overlay; if(!o) return;
    o.onclick=e=>{if(e.target===o)close();};
    const $=sel=>o.querySelector(sel);
    $('#sf-close')&&($('#sf-close').onclick=close);
    if(S.screen==='success'){
      const url=CFG.projectUrl;
      const text=encodeURIComponent(`I just supported ${CFG.projectName} ♥ — check it out! ${url}`);
      $('#sf-share-x')&&($('#sf-share-x').onclick=()=>window.open(`https://x.com/intent/tweet?text=${text}`,'_blank'));
      $('#sf-share-wa')&&($('#sf-share-wa').onclick=()=>window.open(`https://wa.me/?text=${text}`,'_blank'));
      $('#sf-share-copy')&&($('#sf-share-copy').onclick=()=>{
        navigator.clipboard.writeText(url).then(()=>{const b=$('#sf-share-copy');if(b){b.textContent='✓ Copied!';b.classList.add('copied');}});
      });
      return;
    }
    $('#sf-dark-toggle')&&($('#sf-dark-toggle').onclick=()=>{S.isDark=!S.isDark;S.overlay.classList.toggle('sf-dark',S.isDark);refresh();});
    $('#sf-sw')&&($('#sf-sw').onclick=()=>{S.isIndia=!S.isIndia;S.tierIdx=1;S.customAmt='';S.method=S.isIndia?'razorpay':'paypal';refresh();});
    o.querySelectorAll('.sf-tier').forEach(el=>{el.onclick=()=>{S.tierIdx=parseInt(el.dataset.tier);S.customAmt='';refresh();};});
    const ci=$('#sf-custom');if(ci)ci.oninput=()=>{S.customAmt=ci.value;S.tierIdx=null;updateCTA();};
    const ni=$('#sf-name');if(ni)ni.oninput=()=>{S.contributorName=ni.value;};
    const ei=$('#sf-email');if(ei)ei.oninput=()=>{S.contributorEmail=ei.value;};
    o.querySelectorAll('.sf-pay-opt').forEach(el=>{el.onclick=()=>{S.method=el.dataset.method;refresh();};});
    const cta=$('#sf-cta');if(cta)cta.onclick=()=>{const eff=effAmt();if(!eff)return;(S.method||(S.isIndia?'razorpay':'paypal'))==='razorpay'?payRazorpay(eff):payPayPal(eff);};
  }

  function updateCTA(){
    const cta=S.overlay&&S.overlay.querySelector('#sf-cta');if(!cta)return;
    const eff=effAmt(),method=S.method||(S.isIndia?'razorpay':'paypal');
    const tier=S.tierIdx!==null?CFG.tiers[S.tierIdx]:null;
    const label=tier?`${tier.emoji} ${tier.label}`:'Custom';
    cta.disabled=!eff;
    cta.textContent=eff?(method==='razorpay'?`Send ${fmt(eff,true)} · ${label} via Razorpay →`:`Send ${fmt(eff,false)} · ${label} via PayPal →`):'Select a tier to continue';
  }

  function refresh(){const inner=S.overlay&&S.overlay.querySelector('#sf-inner');if(!inner)return;inner.innerHTML=S.screen==='success'?renderSuccess():renderMain();bind();}

  function open(){S.screen='main';S.tierIdx=1;S.customAmt='';S.method=S.isIndia?'razorpay':'paypal';refresh();S.overlay.classList.add('sf-open');document.body.style.overflow='hidden';}
  function close(){S.overlay.classList.remove('sf-open');document.body.style.overflow='';setTimeout(()=>{S.screen='main';},300);}

  function onSuccess(amount,tier){
    S.lastAmt=amount;S.lastTier=tier;S.screen='success';refresh();
    if(CFG.confetti)fireConfetti();
    const sup=S.contributorName?{name:S.contributorName,tier,date:new Date().toISOString()}:null;
    pushUpdate(S.isIndia?amount:0,S.isIndia?0:amount,sup);
    sendEmail(S.contributorEmail,S.contributorName,fmt(amount,S.isIndia),tier);
    updateWalls();
  }

  function payRazorpay(amount){
    if(!CFG.razorpayKey){alert('Set razorpayKey in window.SparkFund');return;}
    const tier=S.tierIdx!==null?CFG.tiers[S.tierIdx]:null;
    const go=()=>new window.Razorpay({
      key:CFG.razorpayKey,amount:Math.round(amount*100),currency:'INR',name:CFG.projectName,
      description:tier?`${tier.emoji} ${tier.label}`:'Custom contribution',theme:{color:ACCENT},
      prefill:{name:S.contributorName,email:S.contributorEmail},
      handler:()=>onSuccess(amount,tier),
    }).open();
    if(window.Razorpay){go();return;}
    const s=document.createElement('script');s.src='https://checkout.razorpay.com/v1/checkout.js';s.onload=go;document.head.appendChild(s);
  }

  function payPayPal(amount){
    if(!CFG.paypalMe){alert('Set paypalMe in window.SparkFund');return;}
    const tier=S.tierIdx!==null?CFG.tiers[S.tierIdx]:null;
    window.open(`${CFG.paypalMe}/${amount}USD`,'_blank');
    onSuccess(amount,tier);
  }

  function renderWall(el){
    const list=S.supporters.slice(0,20);
    el.innerHTML=`<div class="sf-wall-title">Recent supporters</div><div class="sf-wall-list">${list.length===0?'<span class="sf-wall-empty">Be the first to contribute!</span>':list.map(s=>`<div class="sf-wall-item"><div class="sf-wall-avatar">${(s.name||'?')[0].toUpperCase()}</div><span class="sf-wall-name">${s.name}</span>${s.tier?`<span class="sf-wall-tier">${s.tier.emoji}</span>`:''}</div>`).join('')}</div>`;
  }
  function updateWalls(){document.querySelectorAll('spark-wall').forEach(el=>renderWall(el));}

  function init(){
    initDark();
    const vars=Object.assign({'--sf-accent':ACCENT,'--sf-accent-soft':ACCENT_SOFT,'--sf-radius':'16px','--sf-radius-sm':'10px'},CFG.cssVars);
    const style=document.createElement('style');
    style.textContent=`:root{${Object.entries(vars).map(([k,v])=>`${k}:${v}`).join(';')}}\n${CSS}`;
    document.head.appendChild(style);
    const ov=document.createElement('div');ov.className='sf-overlay';
    ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
    ov.innerHTML='<div id="sf-inner"></div>';document.body.appendChild(ov);S.overlay=ov;
    if(S.isDark) ov.classList.add('sf-dark');
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ov.classList.contains('sf-open'))close();});
    Promise.all([detectLocation(),syncGoal()]).then(()=>{S.method=S.isIndia?'razorpay':'paypal';updateWalls();});
    if(!customElements.get('spark-button'))customElements.define('spark-button',class extends HTMLElement{connectedCallback(){const b=document.createElement('button');b.className='sf-inline-btn';b.textContent=this.getAttribute('label')||CFG.inlineLabel;b.onclick=open;this.appendChild(b);}});
    if(!customElements.get('spark-float'))customElements.define('spark-float',class extends HTMLElement{connectedCallback(){const b=document.createElement('button');b.className='sf-float-btn';b.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/></svg>${this.getAttribute('label')||CFG.floatLabel}`;b.onclick=open;this.appendChild(b);}});
    if(!customElements.get('spark-wall'))customElements.define('spark-wall',class extends HTMLElement{connectedCallback(){this.className='sf-wall';renderWall(this);}});
    window.SparkFund=window.SparkFund||{};
    window.SparkFund.open=open;window.SparkFund.close=close;
    window.SparkFund.reload=()=>syncGoal().then(updateWalls);
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();