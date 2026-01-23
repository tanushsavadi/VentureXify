# Contributing to VentureXify

First off — **thank you**. The fact that you're here means you either found a bug, have a cool idea, or just want to help make this thing better. All three are awesome.

## 🐛 Found a Bug?

Happens to the best of us. Here's how to report it:

1. **Check existing issues** first — someone might've beaten you to it
2. **Open a new issue** with:
   - What you expected to happen
   - What actually happened
   - Steps to reproduce (be specific!)
   - Browser version & OS
   - Screenshots if relevant

The more detail, the faster we can squash it.

## 💡 Have an Idea?

Feature requests are welcome! Before diving in:

1. **Open an issue** to discuss it first
2. Explain the problem it solves (not just the solution)
3. Be open to feedback — maybe there's an even better approach

## 🔧 Want to Contribute Code?

Hell yeah. Here's the workflow:

### Setup

```bash
# Fork the repo, then:
git clone https://github.com/YOUR_USERNAME/VentureXify.git
cd VentureXify/venture-x-os
npm install
npm run dev
```

### Making Changes

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/bug-description
   ```

2. **Make your changes** — keep commits atomic and descriptive

3. **Test your changes**:
   ```bash
   npm test
   npm run build
   ```
   Load the extension and manually verify it works.

4. **Push and open a PR**:
   ```bash
   git push origin feature/your-feature-name
   ```

### PR Guidelines

- **Keep it focused** — one feature or fix per PR
- **Write a clear description** — what and why
- **Include screenshots** for UI changes
- **Update docs** if you're changing behavior
- **Be patient** — reviews take time, but we appreciate you

## 📝 Code Style

Nothing crazy:

- TypeScript everywhere (no `any` unless absolutely necessary)
- Prettier for formatting (it runs on save)
- Meaningful variable names > comments
- Small functions > giant functions
- If it's complex, add a comment explaining *why*, not *what*

## 🧪 Testing

We use Vitest. Add tests for:

- New calculators or business logic
- Edge cases you discover
- Bugs you fix (so they don't come back)

Run tests with:
```bash
npm test           # Single run
npm run test:watch # Watch mode
```

## 📂 Where to Put Things

| Type | Location |
|------|----------|
| UI Components | `src/ui/components/` |
| Business Logic | `src/engine/` or `src/lib/` |
| Price Extractors | `src/content/extractors/` |
| Type Definitions | `src/lib/types.ts` or nearby |
| Tests | `src/__tests__/` |

## 🚫 What We Won't Merge

- Anything that phones home user data
- Dependencies we don't need
- Breaking changes without discussion
- Code without any testing strategy

## 🙏 Recognition

Contributors get:
- Credit in the changelog
- My eternal gratitude
- Good karma points (not Capital One miles, sadly)

---

Questions? Open an issue or ping me. Don't be shy — there are no dumb questions, only dumb bugs.
