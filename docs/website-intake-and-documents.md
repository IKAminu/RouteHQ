# Website intake and document uploads

## Connect an agency website

Platform administrators open **Website intake** in the RouteHQ Platform Control Centre.

For each active agency:

1. Enter the full HTTPS website URL.
2. Enter the exact HTTPS origin that sends the form submission (for example, `https://agency.example`, without a path or trailing slash).
3. Select **Connect website**. RouteHQ generates a one-time API key.
4. Copy the key immediately and hand it to the website developer. The raw key is never stored in the database and cannot be recovered later. Rotating the key invalidates the previous one.
5. The developer sends form submissions from the website's server-side handler to the Edge Function.

Endpoint:

`https://viohesitrhrtkulcdnqk.supabase.co/functions/v1/website-intake`

Headers:

- `Content-Type: application/json`
- `x-routehq-key: rh_live_...`
- `Origin: https://agency.example`

Example body:

```json
{
  "submission_id": "website-form-unique-id",
  "payload": {
    "full_name": "Amina Example",
    "email": "amina@example.com",
    "phone": "+234...",
    "interest": "Umrah",
    "message": "Please contact me"
  }
}
```

Use a unique, stable `submission_id` per website form submission. Re-sending the same ID returns the original lead instead of creating a duplicate. The endpoint creates a new lead in the correct agency workspace, and the normal agency RLS policies continue to protect it.

**Do not put the API key in browser JavaScript, a public HTML form, or a VITE environment variable.** Keep it in the website's server environment. The website server should explicitly send the configured `Origin` header because server-to-server HTTP requests do not always add one automatically.

Current intake fields: full name (required), email or phone (at least one required), interest/service, and message/notes. The current pipeline creates leads only. It does not OCR website form submissions.

## Documents

The Documents page accepts PDF, JPEG, PNG and WebP files up to 25 MB. Uploads use the private `routehq-documents` bucket.

Each new file is linked to exactly one owner:

- Passport, visa, photograph, ticket and other travel documents -> a traveller.
- Payment receipt, transfer evidence, invoice and refund evidence -> a payment.

Storage paths are scoped to the agency UUID and the owner record UUID. Download links are signed and short-lived. Database and Storage RLS policies enforce the agency's document permissions.

OCR fields are present as placeholders (`ocr_status` and `ocr_result`), but no OCR provider is connected. No passport or payment receipt text is extracted yet. The files can be processed later after an OCR provider and review workflow are selected.

## Migrations and deployment

- `supabase/migrations/20261121184847_website_intake_and_document_uploads.sql`
- `supabase/migrations/20261121184932_secure_website_lead_ingestion_and_document_owners.sql`
- `supabase/migrations/20261121185000_platform_user_activity_gauge.sql`
- `supabase/functions/website-intake/index.ts`

The website-intake Edge Function is deployed to the RouteHQ Supabase project. Deploying the frontend does not deploy or rotate the API key.
