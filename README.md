# 💳 VentureXify

> Your AI copilot for squeezing every last cent of value from your Capital One Venture X card.

**Ever stared at a flight booking wondering "Should I book direct? Use the portal? Transfer points?"** Yeah, me too. That's why I built this.

---

## What is this?

VentureXify is a Chrome extension that acts as your personal travel rewards strategist. It watches while you browse flights and hotels, then tells you the smartest way to pay—in plain English.

No spreadsheets. No mental math. No second-guessing.

### The Problem

The Venture X is a phenomenal card, but maximizing it is... complicated:
- **5x on portal** sounds great, but you lose airline elite status credits
- **Travel Eraser** gives you 1¢/mile (meh), but it's dead simple  
- **Transfer partners** can get 2-3¢/mile, but require research and luck
- **The $300 travel credit** has weird rules about what counts

Most people leave hundreds of dollars on the table because the math is tedious.

### The Solution

VentureXify does the math for you, in real-time:

```
📊 Portal Booking: $450 → 2,250 miles ($38.25 value)
🎯 Direct Booking: $423 + 846 miles ($14.38 value)
✅ Verdict: Book direct. You save $27, plus elite credits.
```

It's like having a points-obsessed friend who actually does the math.

---

## ✨ Features

| Feature | What it does |
|---------|--------------|
| **🔍 Live Price Comparison** | Detects prices on Google Flights, airline sites, and the Capital One portal |
| **🧮 Smart Calculator** | Factors in your personal miles valuation and status preferences |
| **🗑️ Travel Eraser Tracker** | Don't let that 90-day window sneak up on you |
| **📈 ROI Dashboard** | Are you actually beating the $395 annual fee? Find out. |
| **💬 Ask Anything** | Chat with an AI that knows Venture X inside and out |

---

## 🚀 Quick Start

```bash
# Clone it
git clone https://github.com/tanushsavadi/VentureXify.git
cd VentureXify/venture-x-os

# Install dependencies
npm install

# Build it
npm run build

# Load the dist/ folder as an unpacked extension in Chrome
```

Then:
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select the `dist` folder
4. Start browsing flights!

---

## 🛠️ Tech Stack

Built with modern tools because life's too short for webpack configs:

- **React 18** + **TypeScript** — Type-safe UI
- **Vite** — Blazing fast builds
- **Tailwind CSS** — Utility-first styling  
- **Zustand** — Lightweight state management
- **Framer Motion** — Smooth animations
- **Chrome Extension Manifest V3** — Future-proof

---

## 📁 Project Structure

```
VentureXify/
├── venture-x-os/           # Main extension code
│   ├── src/
│   │   ├── ai/             # LLM integration & prompts
│   │   ├── background/     # Service worker
│   │   ├── content/        # Price extraction scripts
│   │   ├── engine/         # Decision logic & calculations
│   │   ├── lib/            # Shared utilities
│   │   └── ui/             # React components
│   ├── supabase/           # Edge functions & migrations
│   └── docs/               # Technical documentation
├── .github/                # CI/CD & templates
└── README.md               # You are here
```

---

## 🔒 Privacy First

**Your data never leaves your device.**

- All calculations happen locally
- No bank logins required
- No transaction scraping
- Chrome's storage API keeps your preferences safe and synced

---

## 🎯 Roadmap

What's cooking:

- [ ] Browser extension for Firefox
- [ ] Mobile companion app
- [ ] Multi-card support (Sapphire, Platinum, etc.)
- [ ] Transfer partner sweet spot alerts
- [ ] Community-sourced redemption wins

---

## 🤝 Contributing

Found a bug? Have an idea? PRs welcome!

Check out [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## ⚠️ Disclaimer

This project is **not affiliated with Capital One**. It's an independent tool built by a cardholder, for cardholders.

Card benefits change. Always verify current terms at [capitalone.com](https://www.capitalone.com).

---

## 📄 License

MIT License — do whatever you want, just don't blame me if things break.

---

<p align="center">
  <strong>Built with ☕ and mild obsession over credit card points</strong>
</p>
