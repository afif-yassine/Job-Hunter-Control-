import { authenticatedClient } from "@/lib/api";
import { parseContent, renderContextFor } from "@/lib/documents";
import { cvToLatex, letterToLatex, type LatexCv } from "@/lib/latex";

/** The document as LaTeX source (.tex), to edit it freely in Overleaf or any LaTeX editor. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const { data: doc } = await auth.supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .single();
  if (!doc) return Response.json({ error: "Document introuvable" }, { status: 404 });
  const ctx = await renderContextFor(auth.supabase, auth.userId, doc);
  const identity = {
    name: ctx.identity?.name || "Prénom NOM",
    city: ctx.identity?.city,
    email: ctx.identity?.email,
    links: ctx.identity?.links ?? [],
  };
  const content = parseContent(doc.content_text) as LatexCv & { letter?: string };
  const source =
    doc.kind === "COVER_LETTER"
      ? letterToLatex(content.letter || "", identity, { company: ctx.company, location: ctx.location })
      : cvToLatex(content, identity);
  const filename = String(doc.filename || "document").replace(/\.pdf$/i, "") + ".tex";
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new Response(source, {
    headers: {
      "content-type": "application/x-tex; charset=utf-8",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
