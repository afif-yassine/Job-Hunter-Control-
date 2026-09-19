import { z } from "zod";
import { authenticatedClient } from "@/lib/api";
import { cvSchema, letterSchema, renderContextFor } from "@/lib/documents";
import { renderContentPdf, renderDocumentPdf } from "@/lib/pdf";

async function loadDocument(
  auth: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string },
  id: string,
) {
  const { data } = await auth.supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .single();
  return data;
}

function pdfResponse(bytes: Buffer, filename: string) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const doc = await loadDocument(auth, id);
  if (!doc)
    return Response.json({ error: "Document not found" }, { status: 404 });
  const ctx = await renderContextFor(auth.supabase, auth.userId, doc);
  return pdfResponse(await renderDocumentPdf(doc, ctx), doc.filename);
}

const preview = z.object({ content: z.unknown() });

/** Live preview: renders unsaved edits (text + design) without storing anything. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const body = preview.safeParse(await req.json().catch(() => null));
  if (!body.success)
    return Response.json({ error: "Contenu invalide" }, { status: 400 });
  const { id } = await params;
  const doc = await loadDocument(auth, id);
  if (!doc)
    return Response.json({ error: "Document introuvable" }, { status: 404 });
  const schema = doc.kind === "COVER_LETTER" ? letterSchema : cvSchema;
  const content = schema.safeParse(body.data.content);
  if (!content.success)
    return Response.json(
      { error: `Contenu invalide : ${content.error.issues[0]?.message ?? "format"}` },
      { status: 400 },
    );
  const ctx = await renderContextFor(auth.supabase, auth.userId, doc);
  const bytes = await renderContentPdf({ kind: doc.kind, content: content.data, ctx });
  return pdfResponse(bytes, doc.filename);
}
