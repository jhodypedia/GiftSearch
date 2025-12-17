import { NextResponse } from "next/server";

const DEFAULT_QUERY =
  '"jup.ag/gift" OR url:"jup.ag/gift" OR ("Jupiter Mobile" (gift OR QR OR code))';

function isLikelyBearerToken(t) {
  // Bearer token X biasanya panjang; ini hanya validasi ringan
  return typeof t === "string" && t.trim().length >= 40;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = body?.token?.trim();
    const query = (body?.query || DEFAULT_QUERY).trim();
    const since_id = body?.since_id ? String(body.since_id) : null;
    const max_results = Math.min(Math.max(Number(body?.max_results || 20), 10), 100);

    if (!isLikelyBearerToken(token)) {
      return NextResponse.json(
        { ok: false, error: "Bearer token tidak valid / terlalu pendek." },
        { status: 400 }
      );
    }

    // X API v2 Recent Search
    const url = new URL("https://api.x.com/2/tweets/search/recent");
    url.searchParams.set("query", query);
    url.searchParams.set("max_results", String(max_results));
    url.searchParams.set("tweet.fields", "created_at,author_id,public_metrics,entities");
    url.searchParams.set("expansions", "author_id");
    url.searchParams.set("user.fields", "username,name,profile_image_url");
    if (since_id) url.searchParams.set("since_id", since_id);

    const r = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      },
      // hindari cache di edge
      cache: "no-store"
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      // X biasanya kirim errors/details
      return NextResponse.json(
        {
          ok: false,
          status: r.status,
          error:
            data?.title ||
            data?.detail ||
            data?.error ||
            "Request ke X API gagal.",
          raw: data
        },
        { status: 200 }
      );
    }

    const tweets = data?.data || [];
    const users = data?.includes?.users || [];
    const userById = {};
    for (const u of users) userById[u.id] = u;

    const normalized = tweets.map((t) => {
      const u = userById[t.author_id] || null;
      const urls = (t.entities?.urls || [])
        .map((x) => x.expanded_url)
        .filter(Boolean);
      const giftLinks = urls.filter((u) => u.includes("jup.ag/gift"));

      return {
        id: t.id,
        created_at: t.created_at,
        text: t.text,
        metrics: t.public_metrics || {},
        author: u
          ? {
              id: u.id,
              username: u.username,
              name: u.name,
              profile_image_url: u.profile_image_url
            }
          : null,
        giftLinks,
        xUrl: u?.username ? `https://x.com/${u.username}/status/${t.id}` : null
      };
    });

    // since_id terbaru (untuk polling)
    const newestId = tweets.length
      ? tweets.reduce((max, t) => (BigInt(t.id) > BigInt(max) ? t.id : max), tweets[0].id)
      : since_id;

    return NextResponse.json({
      ok: true,
      query,
      count: normalized.length,
      since_id: newestId,
      results: normalized
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
