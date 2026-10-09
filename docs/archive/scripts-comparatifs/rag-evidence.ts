import { createHash } from 'node:crypto';

/** Retrieval building block; not yet connected to the production generation pipeline. */
export type VectorSpace = { model: string; dimension: number; version: string };
export type EvidenceChunk = {
  id: string;
  userId: string;
  sourceId: string;
  sourceVersion: string;
  verified: boolean;
  text: string;
  vector: number[];
  space: VectorSpace;
};

function checkVector(vector: number[], space: VectorSpace) {
  if (!Number.isInteger(space.dimension) || space.dimension < 1 || !space.model.trim() || !space.version.trim())
    throw new Error('Invalid vector space');
  if (vector.length !== space.dimension || vector.some(n => !Number.isFinite(n)) || !vector.some(n => n !== 0))
    throw new Error('Invalid evidence vector');
  const squaredNorm = vector.reduce((sum, n) => sum + n * n, 0);
  if (!Number.isFinite(squaredNorm) || squaredNorm <= 0) throw new Error('Invalid vector norm');
}

export function evidenceCacheKey(chunk: Pick<EvidenceChunk, 'userId' | 'sourceId' | 'sourceVersion' | 'text' | 'space'>) {
  return createHash('sha256').update(JSON.stringify([chunk.userId, chunk.sourceId, chunk.sourceVersion, chunk.text, chunk.space.model, chunk.space.dimension, chunk.space.version, 'document'])).digest('hex');
}

/** The server must supply authenticated userId; database RLS remains mandatory. */
export function retrieveEvidence(args: { userId: string; query: number[]; space: VectorSpace; chunks: EvidenceChunk[]; limit?: number }) {
  if (!args.userId.trim()) throw new Error('Authenticated owner required');
  checkVector(args.query, args.space);
  const limit = args.limit ?? 4;
  if (!Number.isInteger(limit) || limit < 1 || limit > 12) throw new Error('Invalid evidence limit');
  const eligible = args.chunks.filter(c => c.userId === args.userId && c.verified);
  const ids = new Set<string>();
  for (const c of eligible) {
    if (!c.id.trim() || !c.sourceId.trim() || !c.sourceVersion.trim() || !c.text.trim() || ids.has(c.id))
      throw new Error('Invalid or duplicate evidence source');
    ids.add(c.id);
    if (c.space.model !== args.space.model || c.space.dimension !== args.space.dimension || c.space.version !== args.space.version)
      throw new Error('Incompatible embedding model or version');
    checkVector(c.vector, c.space);
  }
  const norm = (v: number[]) => Math.sqrt(v.reduce((s, n) => s + n * n, 0));
  const queryNorm = norm(args.query);
  return eligible.map(c => ({
    ...c,
    similarity: c.vector.reduce((s, n, i) => s + n * args.query[i], 0) / (norm(c.vector) * queryNorm),
  })).sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id)).slice(0, limit);
}

/** Valid citations prove provenance, not the semantic truth of a reformulated claim. */
export function validEvidenceReferences(ids: string[], selected: Pick<EvidenceChunk, 'id'>[]) {
  const allowed = new Set(selected.map(c => c.id));
  return ids.length > 0 && ids.every(id => allowed.has(id));
}
