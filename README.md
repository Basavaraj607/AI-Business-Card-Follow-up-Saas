# AI Business Card — Follow-up SaaS

Lightweight React + Vite app to capture business cards, parse contact details with OCR + AI, persist contacts to Supabase, and help automate follow-ups.

**Status:** Work in progress — core capture, parsing, and Supabase integration implemented.

**Key Features**
- Capture via camera or upload images
- OCR using Tesseract.js and client-side image compression
- AI parser to extract name, email, phone, company, and notes
- Auth and storage with Supabase
- React + Vite + Tailwind UI

**Tech stack**
- Frontend: React, Vite, TypeScript
- Storage & Auth: Supabase
- OCR: Tesseract.js
- Forms: react-hook-form
- State & data fetching: @tanstack/react-query

## Quick start

Requirements: Node 18+ and npm (or yarn/pnpm).

1. Install dependencies

```bash
npm install
```

2. Create a local env file `.env.local` in the project root with Supabase keys:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. Run the dev server

```bash
npm run dev
```

4. Open http://localhost:5173

## Available scripts
- `npm run dev` — starts Vite dev server
- `npm run build` — build for production
- `npm run preview` — preview production build
- `npm run lint` — run ESLint

## Environment
This app expects the following environment variables (see `src/lib/supabase.ts`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Contributing
Contributions welcome. Open an issue or submit a PR with concise changes.

## Where to look in the code
- Capture & upload components: `src/components/CardCapture`
- Supabase helpers: `src/lib/supabase.ts`
- AI parsing utilities: `src/utils/ai-parser.ts`

If you'd like, I can further expand the README with deployment steps, env examples, or architecture diagrams.

## Optional Python requirements
The repository includes an optional [requirements.txt](requirements.txt) for users who want to run server-side AI helpers or local model inference. These are not required for the React app to run, but are useful for running Python-based tooling or experiments.

Basic install (recommended in a virtualenv):

```bash
python -m venv .venv
source .venv/bin/activate   # on Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

If you want help adding a small server example that uses these packages (for example, a small OpenAI proxy or local transformer inference), I can scaffold it.
