import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const allowedOrigins = new Set([
  "https://ikaminu.github.io",
  "https://dashboard.dandurgu.l.cd",
  "http://localhost:5173",
]);
const cors = (origin: string) => allowedOrigins.has(origin) ? {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
} : {};
const json = (body: unknown, status = 200, origin = "") => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors(origin) },
});

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") {
    if (!allowedOrigins.has(origin)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  if (!allowedOrigins.has(origin)) return json({ error: "Origin is not allowed." }, 403, origin);

  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401, origin);
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Deletion service is not configured." }, 503, origin);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Your administrator session could not be verified." }, 401, origin);
  const body = await request.json().catch(() => null);
  const requestId = typeof body?.request_id === "string" ? body.request_id : "";
  const confirmationName = typeof body?.confirmation_name === "string" ? body.confirmation_name : "";
  if (!requestId || !confirmationName) return json({ error: "Request ID and exact agency name confirmation are required." }, 400, origin);

  const { data: target, error: beginError } = await userClient.rpc("begin_agency_deletion", {
    _request_id: requestId, _confirmation_name: confirmationName,
  });
  if (beginError) return json({ error: beginError.message }, 403, origin);

  const agencyId = target?.agency_id as string;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const storage = admin.storage.from("routehq-documents");
  const paths: string[] = [];
  const walk = async (prefix: string): Promise<void> => {
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await storage.list(prefix, {
        limit: 100, offset, sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      const entries = data || [];
      for (const entry of entries) {
        const path = prefix + "/" + entry.name;
        if (entry.id === null) await walk(path);
        else paths.push(path);
      }
      if (entries.length < 100) break;
    }
  };

  try {
    await walk(agencyId);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await storage.remove(paths.slice(i, i + 100));
      if (error) throw error;
    }
    const { error: finalizeError } = await userClient.rpc("finalize_agency_deletion", {
      _request_id: requestId, _confirmation_name: confirmationName,
    });
    if (finalizeError) throw finalizeError;
    return json({ success: true, agency_name: target.agency_name, files_removed: paths.length }, 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage cleanup failed.";
    await userClient.rpc("release_agency_deletion", { _request_id: requestId, _error: message });
    return json({ error: "Workspace deletion was stopped. " + message }, 500, origin);
  }
});
