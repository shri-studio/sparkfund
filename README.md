# ⚡ sparkfund

**The plug-and-play donation widget for developers.**
Razorpay (India/UPI) + PayPal (Global) · Named tiers · Theme presets · Zero dependencies.

> Built by [Shri Studio](https://shri.life) · [Live Demo →](https://shri-studio.github.io/sparkfund/)

![License: MIT](https://img.shields.io/badge/License-MIT-7C3AED.svg)
![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-22c55e)
![jsDelivr](https://img.shields.io/badge/CDN-jsDelivr-orange)
![Works Everywhere](https://img.shields.io/badge/works%20in-HTML%20%7C%20React%20%7C%20Android-3b82f6)

```html
<!-- That's literally all you need -->
<script>
  window.SparkFund = {
    projectName: "My App",
    razorpayKey: "rzp_live_xxxx",
    paypalMe:    "https://paypal.me/yourname",
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/shri-studio/sparkfund@latest/sparkfund.js"></script>
<spark-float></spark-float>
```

---

## Why sparkfund?

| | Ko-fi / BMC | GitHub Sponsors | sparkfund |
|---|---|---|---|
| Platform cut | 5–9% | 0% (but GitHub only) | **0%** |
| UPI support | ❌ | ❌ | **✅ Razorpay** |
| Self-hosted | ❌ | ❌ | **✅ Your CDN** |
| Named tiers | Limited | ❌ | **✅ Fully custom** |
| Android WebView | ❌ | ❌ | **✅** |
| No account needed for donors | ❌ | ❌ | **✅** |
| Works on any website | ✅ | ❌ | **✅** |

---

## ✨ Features

- 🌍 **Auto-detects location** — Indian users see Razorpay + ₹, everyone else sees PayPal + $
- ☕ **Named contribution tiers** — "Buy me a Chai / Lunch / Server bill" — fully customizable
- 🎨 **Theme presets** — 6 built-in themes + custom hex + full CSS variable override
- 🎯 **Goal tracker** — optional progress bar per project
- 🔘 **Two button styles** — floating corner + inline (place anywhere)
- 📱 **Works everywhere** — HTML, React, Vue, Angular, Android WebView, iOS WKWebView
- ♿ **Accessible** — ARIA roles, keyboard nav, Escape to close
- 🪶 **Zero dependencies** — one JS file, no npm, no bundler

---

## 🚀 Quick Start

### 1. Get your keys

- **Razorpay** (Indian contributors): Sign up free at [razorpay.com](https://razorpay.com) → Dashboard → API Keys
- **PayPal** (Global): Create your link at [paypal.me](https://paypal.me)

### 2. Add to any project

```html
<script>
  window.SparkFund = {
    projectName:    "My App",
    projectTagline: "Keep this free 🙏",
    razorpayKey:    "rzp_live_xxxxxxxxxxxx",
    paypalMe:       "https://paypal.me/yourname",
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/shri-studio/sparkfund@latest/sparkfund.js"></script>

<spark-button></spark-button>   <!-- inline button -->
<spark-float></spark-float>     <!-- floating bottom-right -->
```

---

## ☕ Named Tiers

The killer feature. Instead of generic amounts, give each tier a personality:

```js
window.SparkFund = {
  // ...
  tiers: [
    { emoji: "☕", label: "Chai",       amountINR: 100,  amountUSD: 2  },
    { emoji: "🍱", label: "Lunch",      amountINR: 500,  amountUSD: 10 },
    { emoji: "🖥️", label: "Server",     amountINR: 1000, amountUSD: 20 },
    { emoji: "🚀", label: "Rocket",     amountINR: 2000, amountUSD: 50 },
  ],
};
```

Or make it fit your project:

```js
// For a recipe app
tiers: [
  { emoji: "🧂", label: "Seasoning", amountINR: 99,   amountUSD: 1  },
  { emoji: "🍳", label: "Breakfast", amountINR: 499,  amountUSD: 5  },
  { emoji: "🍽️", label: "Dinner",    amountINR: 999,  amountUSD: 15 },
  { emoji: "👨‍🍳", label: "Chef's Table", amountINR: 2499, amountUSD: 49 },
]

// For a dev tool
tiers: [
  { emoji: "🐛", label: "Bug fix",   amountINR: 100,  amountUSD: 2  },
  { emoji: "⚡", label: "Feature",   amountINR: 500,  amountUSD: 10 },
  { emoji: "🏗️", label: "Refactor",  amountINR: 1000, amountUSD: 25 },
  { emoji: "🏆", label: "Sponsor",   amountINR: 5000, amountUSD: 99 },
]
```

---

## 🎨 Theming

### Level 1 — Preset themes (zero config)

```js
window.SparkFund = {
  theme: "purple",  // purple | green | ocean | rose | amber | dark
};
```

### Level 2 — Custom accent color

```js
window.SparkFund = {
  accentColor: "#e11d48",  // any hex — overrides theme preset
};
```

### Level 3 — Full CSS variable override (advanced)

```js
window.SparkFund = {
  cssVars: {
    "--sf-accent":      "#e11d48",
    "--sf-accent-soft": "#ffe4e6",
    "--sf-radius":      "8px",      // sharp corners
    "--sf-font":        "'Inter', sans-serif",
  },
};
```

---

## ⚙️ Full Configuration Reference

```js
window.SparkFund = {
  // ── Required ────────────────────────────────
  projectName:    "My App",
  razorpayKey:    "rzp_live_xxxx",
  paypalMe:       "https://paypal.me/yourname",

  // ── Identity ────────────────────────────────
  projectTagline: "Keep this free 🙏",

  // ── Tiers ───────────────────────────────────
  tiers: [
    { emoji: "☕", label: "Chai",   amountINR: 100,  amountUSD: 2  },
    { emoji: "🍱", label: "Lunch",  amountINR: 500,  amountUSD: 10 },
    { emoji: "🖥️", label: "Server", amountINR: 1000, amountUSD: 20 },
    { emoji: "🚀", label: "Rocket", amountINR: 2000, amountUSD: 50 },
  ],

  // ── Goal bar (set to 0 to hide) ─────────────
  goalINR:     50000,
  raisedINR:   12500,
  goalUSD:     500,
  raisedUSD:   125,

  // ── Theming ─────────────────────────────────
  theme:       "purple",   // preset name
  accentColor: "",         // overrides theme if set
  cssVars:     {},         // fine-grained CSS var overrides

  // ── Labels ──────────────────────────────────
  floatLabel:  "Support this project",
  inlineLabel: "♥ Contribute",
};
```

---

## ⚛️ React / Next.js

```jsx
import { useEffect } from 'react';

export function SparkFundSetup() {
  useEffect(() => {
    window.SparkFund = {
      projectName: "My React App",
      razorpayKey: process.env.NEXT_PUBLIC_RAZORPAY_KEY,
      paypalMe:    "https://paypal.me/yourname",
    };
    if (document.querySelector('[data-sparkfund]')) return;
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/gh/shri-studio/sparkfund@latest/sparkfund.js';
    s.setAttribute('data-sparkfund', '1');
    document.body.appendChild(s);
  }, []);
  return null;
}

// Trigger programmatically
<button onClick={() => window.SparkFund?.open()}>Support this project</button>
```

---

## 🤖 Android WebView

```kotlin
webView.settings.apply {
    javaScriptEnabled = true
    domStorageEnabled = true
}
// Handle PayPal links in external browser
webView.webViewClient = object : WebViewClient() {
    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
        if (url?.contains("paypal") == true) {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            return true
        }
        return false
    }
}
```

---

## 🌐 Programmatic API

```js
window.SparkFund.open();   // open the widget
window.SparkFund.close();  // close it
```

---

## 📦 CDN

Once the repo is public, use via jsDelivr — no setup needed:

```
Latest:  https://cdn.jsdelivr.net/gh/shri-studio/sparkfund@latest/sparkfund.js
Pinned:  https://cdn.jsdelivr.net/gh/shri-studio/sparkfund@v2.0.0/sparkfund.js
```

---

## 🗂️ File Structure

```
sparkfund/
├── sparkfund.js        ← the widget (host this)
├── demo/index.html     ← live demo (GitHub Pages)
├── docs/
│   ├── react-example.jsx
│   └── android-webview.md
├── README.md
└── LICENSE
```

---

## 🤝 Contributing

PRs welcome! Roadmap:
- [ ] Dark mode support
- [ ] Stripe (for supported countries)
- [ ] Thank-you email via EmailJS
- [ ] Goal sync via simple API/webhook
- [ ] More payment methods (Google Pay, Paytm, Apple Pay)
- [ ] `<spark-goal>` standalone progress bar component

---

## 👨‍💻 Built by

[Shri Studio](https://shri.life) — building tools for indie developers.

---

## 📄 License

MIT — free for personal and commercial use.

---

*If sparkfund saved you time, consider starring ⭐ the repo — it helps others find it!*
 
