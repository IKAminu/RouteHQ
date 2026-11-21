import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-routehq-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200, origin?: string) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(origin ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {}),
      "Access-Control-Allow-Headers": "content-type, x-routehq-key",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  },
);

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const origin = request.headers.get("origin") ?? "";
  const apiKey = request.headers.get("x-routehq-key") ?? "";
  if (!/^rh_live_[a-f0-9]{64}$/.test(apiKey)) return json({ error: "Invalid website API key." }, 401, origin || undefined);

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > 16_384) return json({ error: "Submission is too large. Maximum request size is 16 KB." }, 413, origin || undefined);

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 16_384) return json({ error: "Submission is too large. Maximum request size is 16 KB." }, 413, origin || undefined);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "A valid JSON request body is required." }, 400, origin || undefined);
  }

  const submissionId = typeof body.submission_id === "string" ? body.submission_id.trim() : "";
  const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
    ? body.payload as Record<string, unknown>
    : null;
  if (!submissionId || !payload) return json({ error: "submission_id and payload are required." }, 400, origin || undefined);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Website intake is not configured." }, 503, origin || undefined);

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const tokenHash = await sha256(apiKey);
  const { data, error } = await supabase.rpc("ingest_website_lead", {
    _token_hash: tokenHash,
    _origin: origin,
    _external_submission_id: submissionId,
    _payload: payload,
  });

  if (error) {
    const denied = error.code === "42501" || /not allowed|disabled|invalid/i.test(error.message);
    return json({ error: denied ? "Website connection rejected. Check the API key, website origin and agency status." : error.message }, denied ? 403 : 400, origin || undefined);
  }
  return json(data, 200, origin || undefined);
});
