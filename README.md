# AI POC ROI Evaluator

A structured decision instrument for evaluating whether an AI proof-of-concept will deliver the ROI its vendor promises. Evidence-backed, Monte Carlo, DTRM-aligned.

Built on:
- **Gradwell** — AI ROI Formula
- **Laney** — Adoption Function (Infonomics)
- **Agidee** — Digital Transformation Resilience Model (ITPM · ADD · DDC · Structural Optionality)

---

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploying to Vercel

### One-click

1. Push this project to a GitHub repository.
2. Go to https://vercel.com/new and import the repository.
3. Vercel auto-detects Next.js. Accept the defaults and deploy.

### Via CLI

```bash
npm install -g vercel
vercel
```

The first `vercel` run prompts you through project setup. Subsequent deployments are a single command. `vercel --prod` deploys to production.

No environment variables are required. No external services. The entire tool runs client-side.

## Customising

### Adding a custom domain

Once deployed, go to the project in the Vercel dashboard → Settings → Domains. Add the domain and follow the DNS instructions. Propagation is usually under 5 minutes.

### Analytics

To enable Vercel Analytics, install the package and add the component:

```bash
npm install @vercel/analytics
```

Then in `app/layout.jsx`:

```jsx
import { Analytics } from '@vercel/analytics/react';

// inside <body>, alongside {children}:
<Analytics />
```

### Branding

The component lives in `components/AIROIEvaluator.jsx`. The colour palette is defined at the top of the file (search for `const C = {`). The tool name appears in:
- `app/layout.jsx` (browser tab, search metadata)
- The header block inside the component

## Structure

```
app/
  layout.jsx      Root layout — fonts, metadata
  page.jsx        Single route rendering the evaluator
  globals.css     Tailwind directives + custom utilities
components/
  AIROIEvaluator.jsx   The tool itself (~5000 lines)
tailwind.config.js     Content paths, font CSS variables
next.config.js         Next.js configuration (minimal)
```

The entire tool is one React component in one file. This is intentional — it matches how it was developed as an interactive artifact — and can be split into modules later if maintenance requires it.

## Dependencies

- **next** 14 — framework
- **react** / **react-dom** 18 — UI
- **recharts** — chart rendering (used in a few views; most charts are hand-rolled SVG)

No backend. No database. No auth. All computation runs in the browser.
