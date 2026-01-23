# Security Policy

## 🔒 Our Commitment

VentureXify is designed with privacy as a core principle. We don't want your financial data — seriously.

### What We Collect

**Nothing.** Zero. Zilch. Nada.

- No account credentials
- No transaction data  
- No personal information
- No analytics or tracking

All your data stays in Chrome's local storage, on your device, under your control.

## 🛡️ Supported Versions

We actively maintain security updates for:

| Version | Supported |
|---------|-----------|
| 2.x     | ✅ Yes    |
| 1.x     | ❌ No     |

Always update to the latest version.

## 🚨 Reporting a Vulnerability

Found a security issue? **Please don't open a public issue.**

Instead:

1. **Email directly**: [security contact - add your email here]
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional but appreciated)

### What to Expect

- **Response within 48 hours** acknowledging your report
- **Assessment within 7 days** with severity evaluation
- **Fix timeline** communicated based on severity:
  - Critical: ASAP (24-72 hours)
  - High: Within 7 days
  - Medium/Low: Next scheduled release

### Safe Harbor

If you're reporting in good faith:
- We won't pursue legal action
- We'll credit you in the fix (unless you prefer anonymity)
- We'll keep you updated on the resolution

## 🔐 Security Best Practices (For Users)

1. **Only install from trusted sources** — GitHub releases or Chrome Web Store (when available)
2. **Review permissions** — We only ask for what we need
3. **Keep Chrome updated** — Browser security matters
4. **Don't fork and add sketchy dependencies** — If you're self-hosting, audit your changes

## 🏗️ Security Architecture

### Data Flow

```
[Travel Sites] → Content Script (DOM reading only)
       ↓
   Background Service Worker
       ↓  
   Local Chrome Storage ← No external calls
       ↓
   Side Panel UI
```

### What Content Scripts Access

- **Read-only DOM access** on supported travel sites
- Price elements, flight details, hotel info
- **No form interactions** — we never fill or submit anything
- **No credential access** — we can't see login fields

### Permissions Explained

| Permission | Why We Need It |
|------------|----------------|
| `storage` | Save your preferences locally |
| `sidePanel` | Display the main interface |
| `activeTab` | Read prices from the current page |
| `alarms` | Schedule eraser expiry reminders |
| `notifications` | Alert you before things expire |
| `scripting` | Inject price extraction on supported sites |

### What We Don't Do

- ❌ Make network requests to external servers
- ❌ Access cookies or session data  
- ❌ Read/write to forms
- ❌ Execute remote code
- ❌ Track user behavior

## 🔄 Dependency Security

We keep dependencies minimal and audited:

```bash
npm audit  # Run this to check for vulnerabilities
```

Dependencies are reviewed before upgrades. No surprise packages.

---

**Questions about our security practices?** Open an issue (for general questions) or contact directly (for sensitive matters).
