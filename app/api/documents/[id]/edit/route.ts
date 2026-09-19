import { z } from "zod";
import { authenticatedClient } from "@/lib/api";
import { cvSchema, letterSchema, versionedFilename } from "@/lib/documents";

const input = z.object({ content: z.unknown() });

/**
 * Manual edit. A draft is edited in place; an approved / uploaded document is
 * never rewritten: the edit becomes a new draft version.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const body = input.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Contenu invalide" }, { status: 400 });
  const { id } = await params;
  const { supabase, userId } = auth;

  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (!doc) return Response.json({ error: "Document introuvable" }, { status: 404 });

  const schema = doc.kind === "COVER_LETTER" ? letterSchema : cvSchema;
  const content = schema.safeParse(body.data.content);
  if (!content.success)
    return Response.json(
      { error: `Contenu invalide : ${content.error.issues[0]?.message ?? "format"}` },
      { status: 400 },
    );

  const text = JSON.stringify(content.data);
  if (!doc.approved && !doc.storage_path) {
    const { data, error } = await supabase
      .from("documents")
      .update({ content_text: text })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ document: data, newVersion: false });
  }

  const version = (Number(doc.version) || 1) + 1;
  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      job_id: doc.job_id,
      kind: doc.kind,
      filename: versionedFilename(doc.filename, version),
      mime_type: doc.mime_type || "application/pdf",
      content_text: text,
      generation_prompt: "manual-edit",
      approved: false,
      version,
      based_on_document_id: doc.id,
    })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ document: data, newVersion: true });
}
