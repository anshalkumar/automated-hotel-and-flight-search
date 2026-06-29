import React from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BedDouble,
  Bot,
  Camera,
  CheckCircle2,
  IndianRupee,
  Loader2,
  Plane,
  Play,
  ShieldCheck,
  Sparkles,
  XCircle,
  MapPin,
  Calendar,
  Users,
  Home,
  Globe,
  ChevronRight,
  Terminal,
  FileText
} from "lucide-react";
import "./styles.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

function App() {
  const [form, setForm] = React.useState({
    searchType: "flights",
    source: "",
    destination: "",
    departureDate: "",
    returnDate: "",
    checkIn: "",
    checkOut: "",
    adults: 1,
    rooms: 1,
    headless: false
  });
  const [health, setHealth] = React.useState(null);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then((response) => response.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false, geminiConfigured: false }));
  }, []);

  const updateForm = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const runAgent = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/agent/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(form))
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorObj = new Error(data.error?.message || "Automation failed");
        errorObj.issues = data.error?.details?.issues || [];
        throw errorObj;
      }

      setResult(data);
    } catch (runError) {
      setError({
        message: runError.message || "Automation failed",
        issues: runError.issues || []
      });
    } finally {
      setLoading(false);
    }
  };

  const isFlights = form.searchType === "flights";
  const isHotels = form.searchType === "hotels";
  const isDummy = form.searchType === "dummy";
  const isShadcn = form.searchType === "shadcn";

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Assignment 04</p>
            <h1>Smart Flight/Hotel Search Assistant</h1>
          </div>
          <StatusPill health={health} />
        </header>

        <div className="layout">
          <section className="panel control-panel">
            <div className="panel-heading">
              <Bot size={22} />
              <div>
                <h2>Travel Search</h2>
                <p>Enter your preferred route or stay details and let the agent search real websites.</p>
              </div>
            </div>

            <form onSubmit={runAgent} className="agent-form">
              <div className="segmented-control">
                <label className={isFlights ? "active" : ""}>
                  <input
                    type="radio"
                    name="searchType"
                    value="flights"
                    checked={isFlights}
                    onChange={updateForm}
                  />
                  <Plane size={17} />
                  Flights
                </label>
                <label className={isHotels ? "active" : ""}>
                  <input
                    type="radio"
                    name="searchType"
                    value="hotels"
                    checked={isHotels}
                    onChange={updateForm}
                  />
                  <BedDouble size={17} />
                  Hotels
                </label>
                <label className={isDummy ? "active" : ""}>
                  <input
                    type="radio"
                    name="searchType"
                    value="dummy"
                    checked={isDummy}
                    onChange={updateForm}
                  />
                  <Bot size={17} />
                  Dummy
                </label>
                <label className={isShadcn ? "active" : ""}>
                  <input
                    type="radio"
                    name="searchType"
                    value="shadcn"
                    checked={isShadcn}
                    onChange={updateForm}
                  />
                  <Bot size={17} />
                  Shadcn
                </label>
              </div>

              {isFlights && <FlightInputs form={form} updateForm={updateForm} />}
              {isHotels && <HotelInputs form={form} updateForm={updateForm} />}
              {isDummy && <DummyInputs form={form} updateForm={updateForm} />}
              {isShadcn && <ShadcnInputs form={form} updateForm={updateForm} />}

              {!isShadcn && (
                <div className="two-column">
                  <label>
                    Adults
                    <div className="input-icon-wrapper">
                      <Users className="input-icon" size={16} />
                      <input min="1" max="9" name="adults" type="number" value={form.adults} onChange={updateForm} />
                    </div>
                  </label>
                  {isHotels && (
                    <label>
                      Rooms
                      <div className="input-icon-wrapper">
                        <Home className="input-icon" size={16} />
                        <input min="1" max="8" name="rooms" type="number" value={form.rooms} onChange={updateForm} />
                      </div>
                    </label>
                  )}
                </div>
              )}

              <label className="checkbox-row">
                <input type="checkbox" name="headless" checked={form.headless} onChange={updateForm} />
                Run browser in headless mode
              </label>

              <button type="submit" disabled={loading}>
                {loading ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
                {loading ? "Searching..." : `Search ${isFlights ? "Flights" : isHotels ? "Hotels" : isDummy ? "Dummy Site" : "Shadcn Form"}`}
              </button>
            </form>

            <div className="security-note">
              <ShieldCheck size={18} />
              <span>Gemini API keys stay on the backend in environment variables.</span>
            </div>
          </section>

          <section className="panel result-panel">
            <div className="panel-heading">
              <Activity size={22} />
              <div>
                <h2>Agent Output</h2>
                <p>Recommendations, extracted travel options, screenshots, and action logs.</p>
              </div>
            </div>

            {loading && <LoadingState />}
            {error && <ErrorState error={error} />}
            {!loading && !error && !result && <EmptyState text="No search yet. Enter your travel details to begin." />}
            {result && <RunResult result={result} />}
          </section>
        </div>
      </section>
    </main>
  );
}

function FlightInputs({ form, updateForm }) {
  return (
    <>
      <div className="two-column">
        <label>
          Source city or airport code
          <div className="input-icon-wrapper">
            <MapPin className="input-icon" size={16} />
            <input name="source" value={form.source} onChange={updateForm} placeholder="Example: Delhi or DEL" required />
          </div>
        </label>
        <label>
          Destination city or airport code
          <div className="input-icon-wrapper">
            <MapPin className="input-icon" size={16} />
            <input
              name="destination"
              value={form.destination}
              onChange={updateForm}
              placeholder="Example: Mumbai or BOM"
              required
            />
          </div>
        </label>
      </div>
      <div className="two-column">
        <label>
          Departure date
          <div className="input-icon-wrapper">
            <Calendar className="input-icon" size={16} />
            <input name="departureDate" type="date" value={form.departureDate} onChange={updateForm} required />
          </div>
        </label>
        <label>
          Return date optional
          <div className="input-icon-wrapper">
            <Calendar className="input-icon" size={16} />
            <input name="returnDate" type="date" value={form.returnDate} onChange={updateForm} />
          </div>
        </label>
      </div>
    </>
  );
}

function HotelInputs({ form, updateForm }) {
  return (
    <>
      <label>
        Destination
        <div className="input-icon-wrapper">
          <Globe className="input-icon" size={16} />
          <input
            name="destination"
            value={form.destination}
            onChange={updateForm}
            placeholder="Example: Goa, Jaipur, Bengaluru"
            required
          />
        </div>
      </label>
      <div className="two-column">
        <label>
          Check-in
          <div className="input-icon-wrapper">
            <Calendar className="input-icon" size={16} />
            <input name="checkIn" type="date" value={form.checkIn} onChange={updateForm} required />
          </div>
        </label>
        <label>
          Check-out
          <div className="input-icon-wrapper">
            <Calendar className="input-icon" size={16} />
            <input name="checkOut" type="date" value={form.checkOut} onChange={updateForm} required />
          </div>
        </label>
      </div>
    </>
  );
}

function DummyInputs({ form, updateForm }) {
  return (
    <div className="two-column">
      <label>
        Departure City
        <div className="input-icon-wrapper">
          <MapPin className="input-icon" size={16} />
          <select name="source" value={form.source} onChange={updateForm} required>
            <option value="">Select departure</option>
            <option value="Paris">Paris</option>
            <option value="Philadelphia">Philadelphia</option>
            <option value="Boston">Boston</option>
            <option value="Portland">Portland</option>
            <option value="San Diego">San Diego</option>
            <option value="Mexico City">Mexico City</option>
            <option value="São Paolo">São Paolo</option>
          </select>
        </div>
      </label>
      <label>
        Destination City
        <div className="input-icon-wrapper">
          <MapPin className="input-icon" size={16} />
          <select name="destination" value={form.destination} onChange={updateForm} required>
            <option value="">Select destination</option>
            <option value="Rome">Rome</option>
            <option value="London">London</option>
            <option value="Berlin">Berlin</option>
            <option value="New York">New York</option>
            <option value="Dublin">Dublin</option>
            <option value="Cairo">Cairo</option>
          </select>
        </div>
      </label>
    </div>
  );
}

function ShadcnInputs({ form, updateForm }) {
  return (
    <>
      <label>
        Name / Username
        <div className="input-icon-wrapper">
          <Users className="input-icon" size={16} />
          <input
            name="source"
            value={form.source}
            onChange={updateForm}
            placeholder="Example: John Doe"
            required
          />
        </div>
      </label>
      <label>
        Description / Bio
        <div className="input-icon-wrapper textarea-icon-wrapper">
          <FileText className="input-icon" size={16} />
          <textarea
            name="destination"
            value={form.destination}
            onChange={updateForm}
            placeholder="Example: This is a test description filled in by the automation agent."
            required
            rows={3}
            style={{ resize: "none" }}
          />
        </div>
      </label>
    </>
  );
}

function StatusPill({ health }) {
  if (!health) {
    return <span className="status-pill neutral">Checking backend</span>;
  }

  return (
    <span className={`status-pill ${health.ok ? "ok" : "bad"}`}>
      {health.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      {health.ok ? "Backend online" : "Backend offline"}
      {health.geminiConfigured ? " + Gemini" : " + local fallback"}
    </span>
  );
}

function LoadingState() {
  const [step, setStep] = React.useState(0);
  const steps = [
    "Launching secure browser instance...",
    "Navigating to travel booking site...",
    "Processing cookies and dialogs...",
    "Applying search criteria (destination, dates)...",
    "Fetching search results dynamically...",
    "Extracting details (pricing, ratings)...",
    "Running Gemini optimization models..."
  ];

  React.useEffect(() => {
    const timer = setInterval(() => {
      setStep((current) => (current + 1) % steps.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="loading-state">
      <div className="loader-radar">
        <div className="radar-circle circle-1"></div>
        <div className="radar-circle circle-2"></div>
        <div className="radar-circle circle-3"></div>
        <Bot className="radar-icon" size={32} />
      </div>
      <p className="loading-title">Agent Searching Live Site</p>
      <p className="loading-step">{steps[step]}</p>
      <span className="loading-subtext">This process runs real-time automation and might take up to a minute.</span>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}

function ErrorState({ error }) {
  return (
    <div className="error-state" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <XCircle size={20} style={{ flexShrink: 0 }} />
        <span style={{ fontWeight: 700 }}>{error.message}</span>
      </div>
      {error.issues && error.issues.length > 0 && (
        <ul style={{ margin: "4px 0 0 32px", padding: 0, listStyle: "disc", fontSize: "0.85rem", lineHeight: "1.4" }}>
          {error.issues.map((issue, idx) => (
            <li key={idx}>
              <strong style={{ textTransform: "capitalize" }}>{issue.path}:</strong> {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RunResult({ result }) {
  return (
    <div className="run-result">
      <div className="success-banner">
        <CheckCircle2 size={20} />
        Search completed on {result.searchType === "flights" ? "Skyscanner India" : result.searchType === "hotels" ? "Booking.com" : "BlazeDemo"}.
      </div>

      <Recommendation recommendation={result.recommendation} />

      <section>
        <h3>Extracted Results</h3>
        <div className="result-list">
          {result.results.length ? (
            result.results.map((item) => <ResultCard key={item.id} item={item} />)
          ) : (
            <EmptyState text="No structured results were extracted. Check the screenshot for possible captcha or layout changes." />
          )}
        </div>
      </section>

      <section>
        <h3>Automation Screenshots</h3>
        <div className="screenshots">
          {result.screenshots.map((shot) => {
            const label = shot.fileName
              .split("-")
              .slice(1)
              .join(" ")
              .replace(".png", "")
              .replace(/_/g, " ");
            return (
              <a key={shot.fileName} href={`${API_BASE_URL}${shot.url}`} target="_blank" rel="noreferrer" className="screenshot-card">
                <div className="screenshot-thumbnail">
                  <Camera size={22} />
                </div>
                <div className="screenshot-info">
                  <span className="screenshot-label">{label || "screenshot"}</span>
                  <span className="screenshot-filename">{shot.fileName.substring(13)}</span>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      <section>
        <h3>Logs</h3>
        <div className="log-list">
          {result.logs.map((log) => (
            <div className={`log-row ${log.level}`} key={`${log.timestamp}-${log.message}`}>
              <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
              <strong>{log.level}</strong>
              <p>{log.message}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Recommendation({ recommendation }) {
  return (
    <section className="recommendation">
      <div className="recommendation-heading">
        <Sparkles size={18} />
        <h3>Gemini Recommendation</h3>
      </div>
      <dl>
        <div>
          <dt>Cheapest</dt>
          <dd>{recommendation?.cheapest || "Not available"}</dd>
        </div>
        <div>
          <dt>Best Rated</dt>
          <dd>{recommendation?.bestRated || "Not available"}</dd>
        </div>
        <div>
          <dt>Recommended</dt>
          <dd>{recommendation?.recommended || "Not available"}</dd>
        </div>
      </dl>
      <p>{recommendation?.summary}</p>
    </section>
  );
}

function ResultCard({ item }) {
  return (
    <article className="travel-card">
      <h4>{item.title}</h4>
      <div className="travel-meta">
        {item.price && (
          <span>
            <IndianRupee size={15} />
            {item.price}
          </span>
        )}
        {item.rating && <span>Rating {item.rating}</span>}
        {item.timeRange && <span>{item.timeRange}</span>}
      </div>
      <p>{item.rawText}</p>
    </article>
  );
}

function buildPayload(form) {
  if (form.searchType === "flights") {
    return {
      searchType: "flights",
      source: form.source,
      destination: form.destination,
      departureDate: form.departureDate,
      returnDate: form.returnDate || undefined,
      adults: Number(form.adults),
      headless: form.headless
    };
  } else if (form.searchType === "hotels") {
    return {
      searchType: "hotels",
      destination: form.destination,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      adults: Number(form.adults),
      rooms: Number(form.rooms),
      headless: form.headless
    };
  } else if (form.searchType === "shadcn") {
    return {
      searchType: "shadcn",
      source: form.source,
      destination: form.destination,
      headless: form.headless
    };
  }

  return {
    searchType: "dummy",
    source: form.source,
    destination: form.destination,
    headless: form.headless
  };
}

createRoot(document.getElementById("root")).render(<App />);
