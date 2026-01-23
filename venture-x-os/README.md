# VentureXify

A premium Chrome extension for Capital One Venture X cardholders to maximize travel booking value and manage card perks.

![VentureXify](public/icons/icon128.svg)

## Features

### 🚀 Portal vs Direct Comparison
- Compare booking prices between direct booking and Capital One Travel portal
- Calculate points earned with each option
- Factor in status earning preferences
- Get clear recommendations with break-even analysis

### 🧹 Travel Eraser Queue
- Track travel purchases eligible for the 90-day eraser window
- Import transactions via CSV
- Get expiry reminders before items expire
- Mark items as erased or ineligible

### 🏷️ Price Match & Price Drop Protection
- Check eligibility for Capital One Travel price match
- Generate claim kit with support script
- Track flight price drop protection windows

### 💎 Redemption Decision Helper
- Compare Travel Eraser vs Transfer Partners vs Portal booking
- Personalized recommendations based on your miles valuation
- Track target CPM for transfers

### 📊 Perks & ROI Tracker
- VentureXify Score (0-100) based on benefit utilization
- Track $300 travel credit usage
- Monitor lounge visits
- Calculate renewal ROI

## Installation

### Development

1. **Clone the repository**
   ```bash
   cd venture-x-os
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder

### Development Mode with Hot Reload

```bash
npm run dev
```

This will watch for changes and rebuild automatically. You'll need to reload the extension in Chrome after changes.

## Project Structure

```
venturexify/
├── manifest.json          # Chrome extension manifest (v3)
├── package.json          # Dependencies and scripts
├── vite.config.ts        # Vite bundler configuration
├── tailwind.config.js    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
├── public/
│   └── icons/            # Extension icons
├── src/
│   ├── background/       # Service worker (background script)
│   │   └── index.ts
│   ├── content/          # Content scripts for price extraction
│   │   ├── index.ts
│   │   └── widget.css
│   ├── lib/              # Shared utilities and logic
│   │   ├── types.ts      # TypeScript type definitions
│   │   ├── storage.ts    # Chrome storage wrapper
│   │   ├── calculators.ts # Business logic calculators
│   │   ├── csvParser.ts  # CSV import functionality
│   │   └── shareCard.ts  # Share card generation
│   ├── ui/
│   │   ├── components/   # Reusable React components
│   │   │   ├── DecisionCard.tsx
│   │   │   ├── PortalDirectCalculator.tsx
│   │   │   ├── EraserQueue.tsx
│   │   │   ├── PerksTab.tsx
│   │   │   ├── Onboarding.tsx
│   │   │   └── Settings.tsx
│   │   ├── sidepanel/    # Main side panel app
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── index.html
│   │   ├── popup/        # Extension popup
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── index.html
│   │   └── styles/       # Global styles
│   │       └── globals.css
│   └── __tests__/        # Test files
│       └── calculators.test.ts
└── dist/                 # Built extension (generated)
```

## Supported Sites

The extension currently supports price detection on:

- **Google Flights** - google.com/travel/*
- **Delta** - delta.com
- **United** - united.com
- **American Airlines** - aa.com
- **Marriott** - marriott.com
- **Hilton** - hilton.com
- **Expedia** - expedia.com
- **Capital One Travel** - travel.capitalone.com

## Permissions

The extension requests minimal permissions:

- `storage` - Save your preferences and decision history locally
- `sidePanel` - Display the main app interface
- `alarms` - Schedule expiry reminders
- `notifications` - Send reminder notifications
- `activeTab` - Access the current tab for price detection
- `host_permissions` - Limited to supported travel sites only

## Privacy

**Your data stays on your device.**

- All preferences and history are stored locally using Chrome's storage APIs
- No data is sent to any external servers
- No bank login required
- No account scraping or automation

## Configuration

### Miles Valuation

Default: **1.7¢ per mile**

Adjust based on how you value Capital One miles:
- Conservative (1.0¢): Cash out value
- Average (1.7¢): Typical transfer redemption
- Optimistic (2.5¢+): Premium transfer sweet spots

### Status Consideration

Enable if you care about:
- Airline elite status qualifying miles/segments
- Hotel elite night credits
- Partner program status

This adds ~$15 value to direct bookings when comparing.

## Development

### Running Tests

```bash
npm test
```

### Type Checking

```bash
npm run lint
```

### Building for Production

```bash
npm run build
```

## Technical Details

### Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast bundler with HMR
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Animations
- **Zustand** - State management (if needed)
- **date-fns** - Date utilities
- **PapaParse** - CSV parsing

### Chrome Extension APIs Used

- `chrome.storage.sync` - User preferences (synced across devices)
- `chrome.storage.local` - Decision history and data
- `chrome.storage.session` - Temporary tab data
- `chrome.sidePanel` - Main app interface
- `chrome.alarms` - Scheduled reminders
- `chrome.notifications` - User notifications
- `chrome.tabs` - Tab communication
- `chrome.contextMenus` - Right-click menu

## Venture X Card Benefits Reference

| Benefit | Value | Notes |
|---------|-------|-------|
| Annual Fee | $395 | |
| Travel Credit | $300 | Resets annually |
| Portal Multiplier | 5x | Capital One Travel bookings |
| Base Multiplier | 2x | All other purchases |
| Global Entry Credit | $100 | Every 4 years |
| Priority Pass | Unlimited | + 2 guests per visit |
| Eraser Window | 90 days | From purchase date |
| Eraser Value | 1¢/mile | Minimum 5,000 miles |

## Contributing

This is a personal project, but suggestions and bug reports are welcome!

## Disclaimer

This extension is not affiliated with, endorsed by, or connected to Capital One. It is an independent tool created to help cardholders track and optimize their benefits.

All card benefit information is based on publicly available terms and conditions. Always verify current terms directly with Capital One.

## License

MIT License - see LICENSE file for details.

---

**Made with ❤️ for Capital One Venture X cardholders**
