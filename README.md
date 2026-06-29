# Assignment 04 - Smart Flight/Hotel Search Assistant

This project is a smart travel browser automation agent built with a separated frontend and backend.

- Frontend: React + Vite
- Backend: Node.js + Express
- Browser automation: Playwright
- AI assistance: Gemini API, kept on the backend only

The agent searches real travel websites using user-provided input:

- Flights: Skyscanner India
- Hotels: Booking.com

It opens a browser, enters travel details, starts the search, scrolls result pages, extracts visible options, captures screenshots, and asks Gemini to summarize cheapest, best-rated, and recommended options.

## Folder Structure

```text
.
├── backend
│   ├── src
│   │   ├── agent
│   │   ├── services
│   │   └── utils
│   └── screenshots
├── frontend
│   └── src
└── docs
```

## API Key Safety

Do not put API keys in frontend code.

The Gemini API key is read only by the backend from `backend/.env`. The real `.env` file is ignored by Git. Use `backend/.env.example` as a template.

## Setup

1. Install the root development dependency:

```bash
npm install
```

2. Install backend and frontend dependencies:

```bash
npm run install:all
```

3. Install Playwright browsers:

```bash
npx playwright install --with-deps
```

4. Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

5. Add your free Gemini API key inside `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

The project still works without Gemini by using local field matching heuristics.

## Run The Project

Start both frontend and backend:

```bash
npm run dev
```

Then open:

```text
http://localhost:5173
```

Backend API:

```text
http://localhost:5001
```

## Run Agent From Terminal

```bash
npm run agent --prefix backend
```

## Main Backend Endpoints

- `GET /api/health` checks backend and Gemini configuration status.
- `POST /api/agent/run` starts the automation agent.
- `GET /screenshots/:fileName` serves screenshots captured during runs.

Example request:

```json
{
  "searchType": "flights",
  "source": "DEL",
  "destination": "BOM",
  "departureDate": "2026-07-10",
  "returnDate": "2026-07-15",
  "adults": 1,
  "headless": false
}
```

Hotel request:

```json
{
  "searchType": "hotels",
  "destination": "Goa",
  "checkIn": "2026-07-10",
  "checkOut": "2026-07-12",
  "adults": 2,
  "rooms": 1,
  "headless": false
}
```

## Required Agent Tools Implemented

- `open_browser`
- `navigate_to_url`
- `take_screenshot`
- `click_on_screen(x, y)`
- `send_keys`
- `scroll`
- `double_click`
- `extract_results`

These are implemented in `backend/src/agent/browserTools.js`.

## Notes For Viva

During demonstration, run the browser in non-headless mode so the evaluator can see Playwright opening Skyscanner India or Booking.com, typing inputs, clicking search, scrolling, and extracting results.

Real travel sites can change layout, show consent popups, or block automation. The agent includes selector, label, placeholder, text, coordinate, scrolling, and URL fallback strategies to improve reliability.

For flights, airport codes such as `DEL`, `BOM`, `BLR`, and `MAA` are usually more reliable than long city names.
