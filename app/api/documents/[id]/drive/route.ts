import { Readable } from "node:stream";
import { google } from "googleapis";
import { authenticatedClient } from "@/lib/api";
import { renderContextFor } from "@/lib/documents";
import { renderDocumentPdf } from "@/lib/pdf";
function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(
      raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"),
    );
  } catch {
    return null;
  }
}
export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const account = credentials();
  if (!account)
    return Response.json(
      { error: "Google Drive service account is not configured" },
      { status: 503 },
    );
  const { id } = await params;
  const { data: doc } = await auth.supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .single();
  if (!doc)
    return Response.json({ error: "Document not found" }, { status: 404 });
  if (!doc.approved)
    return Response.json(
      { error: "Approve the document before Drive upload" },
      { status: 409 },
    );
  const folder =
    doc.kind === "COVER_LETTER"
      ? process.env.GOOGLE_DRIVE_LETTERS_FOLDER_ID
      : process.env.GOOGLE_DRIVE_CVS_FOLDER_ID;
  if (!folder)
    return Response.json(
      { error: "Drive destination folder is not configured" },
      { status: 503 },
    );
  const client = new google.auth.GoogleAuth({
    credentials: account,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  const drive = google.drive({ version: "v3", auth: client });
  const pdf = await renderDocumentPdf(
    doc,
    await renderContextFor(auth.supabase, auth.userId, doc),
  );
  const created = await drive.files.create({
    requestBody: {
      name: doc.filename,
      parents: [folder],
      mimeType: "application/pdf",
    },
    media: { mimeType: "application/pdf", body: Readable.from(pdf) },
    fields: "id,name,webViewLink",
  });
  if (!created.data.id)
    return Response.json({ error: "Drive upload failed" }, { status: 502 });
  const link =
    created.data.webViewLink ||
    `https://drive.google.com/file/d/${created.data.id}/view`;
  await auth.supabase
    .from("documents")
    .update({ storage_path: link })
    .eq("id", id)
    .eq("user_id", auth.userId);
  await auth.supabase
    .from("audit_events")
    .insert({
      user_id: auth.userId,
      entity_type: "document",
      entity_id: id,
      action: "UPLOADED_TO_DRIVE",
      details: { driveFileId: created.data.id },
    });
  await auth.supabase.from("notifications").insert({
    user_id: auth.userId,
    notification_type: "DRIVE_UPLOAD",
    title: `${doc.filename} ajouté à Drive`,
    message: "Le PDF approuvé est disponible dans le dossier Drive prévu.",
    action_url: link,
    delivery_channels: ["dashboard"],
  });
  return Response.json({
    id: created.data.id,
    name: created.data.name,
    url: link,
  });
}
