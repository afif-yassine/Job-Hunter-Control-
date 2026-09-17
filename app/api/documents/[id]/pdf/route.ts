import { authenticatedClient } from "@/lib/api";
import { renderDocumentPdf } from "@/lib/pdf";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const { data: doc } = await auth.supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .single();
  if (!doc)
    return Response.json({ error: "Document not found" }, { status: 404 });
  const bytes = await renderDocumentPdf(doc);
  return new Response(bytes, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename=\"${doc.filename}\"`,
      "cache-control": "private, no-store",
    },
  });
}
