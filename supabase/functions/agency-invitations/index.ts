import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ROUTEHQ_APP_ORIGIN") ?? "https://app.routehq.cc.cd",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const newToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]!));

async function sendInvitationEmail(invitation: Record<string, string>, token: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("ROUTEHQ_FROM_EMAIL");
  if (!apiKey || !from) throw new Error("Invitation email is not configured. Add RESEND_API_KEY and ROUTEHQ_FROM_EMAIL to the Supabase Edge Function secrets.");
  const appUrl = (Deno.env.get("ROUTEHQ_APP_URL") ?? "https://app.routehq.cc.cd").replace(/\/$/, "");
  const link = `${appUrl}/?invite=${encodeURIComponent(token)}`;
  const agency = escapeHtml(invitation.agency_name);
  const role = escapeHtml(invitation.role_name);
  const to = invitation.invited_email;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171717;line-height:1.6">
      <div style="padding:28px 0;border-bottom:1px solid #e5e5e5;font-size:22px;font-weight:700">RouteHQ</div>
      <div style="padding:32px 0">
        <p>You have been invited to join <strong>${agency}</strong> on RouteHQ.</p>
        <p>Your assigned role is <strong>${role}</strong>. Accept the invitation using the button below. The link expires in seven days and can only be used with this email address.</p>
        <p style="margin:28px 0"><a href="${link}" style="background:#f97316;color:#fff;padding:13px 22px;border-radius:8px;text-decoration:none;font-weight:600">Accept invitation</a></p>
        <p style="font-size:13px;color:#737373">If the button does not work, copy this link into your browser:<br><a href="${link}">${link}</a></p>
        <p style="font-size:13px;color:#737373">If you were not expecting this invitation, you can ignore this email.</p>
      </div>
      <div style="border-top:1px solid #e5e5e5;padding:18px 0;font-size:12px;color:#737373">RouteHQ · Travel agency operations</div>
    </div>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: [to], subject: `You're invited to join ${invitation.agency_name} on RouteHQ`, html,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email provider rejected the message (${response.status}): ${detail.slice(0, 500)}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "Supabase function configuration is incomplete" }, 500);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Your session is invalid. Sign in again." }, 401);
    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError || aal?.currentLevel !== "aal2") return json({ error: "Complete two-step verification before managing team invitations." }, 403);

    const body = await req.json();
    const action = String(body.action ?? "");
    if (action === "cancel") {
      const { error } = await supabase.rpc("revoke_agency_invitation", { _invitation_id: body.invitation_id });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action !== "invite" && action !== "resend") return json({ error: "Unsupported invitation action" }, 400);
    const token = newToken();
    const tokenHash = await hashToken(token);
    let invitation: Record<string, string> | null = null;

    if (action === "invite") {
      const { data, error } = await supabase.rpc("create_agency_invitation", {
        _invited_email: body.email,
        _role_id: body.role_id,
        _token_hash: tokenHash,
      });
      if (error) return json({ error: error.message }, 400);
      invitation = data as Record<string, string>;
    } else {
      const { data, error } = await supabase.rpc("rotate_agency_invitation", {
        _invitation_id: body.invitation_id,
        _token_hash: tokenHash,
      });
      if (error) return json({ error: error.message }, 400);
      invitation = data as Record<string, string>;
    }

    try {
      await sendInvitationEmail(invitation, token);
    } catch (emailError) {
      if (action === "invite" && invitation?.id) {
        await supabase.rpc("revoke_agency_invitation", { _invitation_id: invitation.id });
      }
      return json({ error: emailError instanceof Error ? emailError.message : "Invitation email could not be sent." }, 502);
    }
    return json({ success: true, invitation: { id: invitation.id, invited_email: invitation.invited_email, expires_at: invitation.expires_at } });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invitation request failed." }, 500);
  }
});
