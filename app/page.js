"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_QUERY =
  '"jup.ag/gift" OR url:"jup.ag/gift" OR ("Jupiter Mobile" (gift OR QR OR code))';

function cn(...arr) {
  return arr.filter(Boolean).join(" ");
}

export default function Page() {
  const [token, setToken] = useState("");
  const [remember, setRemember] = useState(true);

  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [intervalSec, setIntervalSec] = useState(20);

  const [sinceId, setSinceId] = useState(null);
  const [running, setRunning] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);

  const timerRef = useRef(null);

  // load token from localStorage (opsional)
  useEffect(() => {
    const saved = localStorage.getItem("x_bearer_token");
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (!remember) return;
    if (!token) return;
    localStorage.setItem("x_bearer_token", token);
  }, [token, remember]);

  useEffect(() => {
    if (!remember) {
      localStorage.removeItem("x_bearer_token");
    }
  }, [remember]);

  const canRun = useMemo(() => token.trim().length >= 40, [token]);

  async function runOnce({ reset = false } = {}) {
    setErr("");
    setLoading(true);
    try {
      const payload = {
        token: token.trim(),
        query: query.trim(),
        max_results: 20,
        since_id: reset ? null : sinceId
      };

      const r = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await r.json();

      if (!data.ok) {
        setErr(data.error || "Gagal memanggil X API.");
        setLoading(false);
        return;
      }

      if (data.since_id) setSinceId(data.since_id);

      const newResults = data.results || [];
      if (newResults.length) {
        // prepend baru, dedupe by id
        setItems((prev) => {
          const map = new Map(prev.map((x) => [x.id, x]));
          for (const it of newResults) map.set(it.id, it);
          // sort desc by id (baru di atas)
          const merged = Array.from(map.values()).sort((a, b) =>
            BigInt(a.id) > BigInt(b.id) ? -1 : 1
          );
          return merged;
        });
      }
    } catch (e) {
      setErr(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  function start() {
    if (!canRun) {
      setErr("Masukkan Bearer token yang valid dulu.");
      return;
    }
    setRunning(true);
  }

  function stop() {
    setRunning(false);
  }

  // polling loop
  useEffect(() => {
    if (!running) return;

    // fire immediately
    runOnce();

    timerRef.current = setInterval(() => {
      runOnce();
    }, Math.max(10, Number(intervalSec || 20)) * 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, intervalSec]);

  return (
    <main className="shell">
      <header className="top">
        <div className="brand">
          <div className="dot" />
          <div>
            <div className="title">JUP Gift Finder</div>
            <div className="subtitle">X (Twitter) watcher • minimal UI • responsive</div>
          </div>
        </div>

        <div className="actions">
          {!running ? (
            <button className="btn primary" onClick={start} disabled={!canRun}>
              Start
            </button>
          ) : (
            <button className="btn" onClick={stop}>
              Stop
            </button>
          )}
          <button
            className="btn"
            onClick={() => {
              setItems([]);
              setSinceId(null);
              runOnce({ reset: true });
            }}
            disabled={!canRun || loading}
            title="Clear results + refresh"
          >
            Refresh
          </button>
        </div>
      </header>

      <section className="grid">
        <div className="panel">
          <div className="panelTitle">Credentials</div>
          <label className="label">X Bearer Token</label>
          <textarea
            className="input mono"
            placeholder="Paste Bearer token..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            rows={4}
          />
          <div className="row">
            <label className="check">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember on this device</span>
            </label>
            <div className={cn("pill", canRun ? "ok" : "bad")}>
              {canRun ? "Token looks OK" : "Token required"}
            </div>
          </div>

          <div className="hr" />

          <div className="panelTitle">Search</div>
          <label className="label">Query</label>
          <textarea
            className="input mono"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
          />

          <div className="row">
            <div className="field">
              <div className="label">Polling (seconds)</div>
              <input
                className="input mono"
                type="number"
                min={10}
                value={intervalSec}
                onChange={(e) => setIntervalSec(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <div className="label">since_id</div>
              <input className="input mono" value={sinceId || ""} readOnly />
            </div>
          </div>

          {err ? <div className="alert">{err}</div> : null}

          <div className="hint">
            Tip: pilih tab “Latest” di X itu cepat, tapi bot ini akan tarik otomatis
            tweet terbaru yang match query.
          </div>
        </div>

        <div className="panel">
          <div className="panelTitle">
            Results <span className="muted">({items.length})</span>
          </div>

          <div className="list">
            {items.length === 0 ? (
              <div className="empty">
                {loading ? "Loading..." : "Belum ada hasil. Tekan Start."}
              </div>
            ) : (
              items.map((it) => (
                <article key={it.id} className="card">
                  <div className="cardTop">
                    <div className="author">
                      <div className="avatar">
                        {it.author?.profile_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.author.profile_image_url} alt="" />
                        ) : null}
                      </div>
                      <div>
                        <div className="name">
                          {it.author?.name || "Unknown"}
                          {it.author?.username ? (
                            <span className="muted"> @{it.author.username}</span>
                          ) : null}
                        </div>
                        <div className="muted small">
                          {it.created_at ? new Date(it.created_at).toLocaleString() : ""}
                        </div>
                      </div>
                    </div>

                    {it.xUrl ? (
                      <a className="btn tiny" href={it.xUrl} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : null}
                  </div>

                  <div className="text mono">{it.text}</div>

                  {it.giftLinks?.length ? (
                    <div className="links">
                      {it.giftLinks.map((l) => (
                        <a
                          key={l}
                          className="link mono"
                          href={l}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {l}
                        </a>
                      ))}
                    </div>
                  ) : null}

                  <div className="meta">
                    <span className="muted small">
                      ♥ {it.metrics?.like_count ?? 0} · ↻ {it.metrics?.retweet_count ?? 0} ·
                      💬 {it.metrics?.reply_count ?? 0}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <footer className="foot">
        <span className="muted">
          Build for personal use. Jangan share bearer token ke orang lain.
        </span>
      </footer>
    </main>
  );
                                }
