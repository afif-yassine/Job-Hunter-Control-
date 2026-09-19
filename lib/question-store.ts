import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyQuestion,
  matchOption,
  reuseAnswer,
  type IncomingQuestion,
  type StoredAnswer,
} from "@/lib/questions";

type Row = Record<string, unknown>;

/** True when Postgres/PostgREST complains about a column that does not exist yet
 *  (the SQL migration has not been applied). We then fall back to the old shape. */
function isMissingColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /column .* (does not exist|of relation)|could not find the .* column/i.test(
      error.message || "",
    )
  );
}

export async function loadRememberedAnswers(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, StoredAnswer>> {
  const { data, error } = await supabase
    .from("profile_answers")
    .select("question_key,answer,expires_at")
    .eq("user_id", userId);
  const map = new Map<string, StoredAnswer>();
  if (error || !data) return map; // table not created yet → nothing remembered
  for (const row of data as StoredAnswer[]) map.set(row.question_key, row);
  return map;
}

export type QueueResult = {
  asked: number;
  autoAnswered: number;
  duplicates: number;
  /** The questions the user still has to answer. */
  pending: IncomingQuestion[];
};

/**
 * Adds questions to an application while avoiding every kind of repetition:
 *  - a question already present on this application is not added twice,
 *  - a question whose answer is remembered is answered automatically,
 *  - only new / expired / offer-specific questions block the application.
 */
export async function queueQuestions(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
  items: IncomingQuestion[],
): Promise<QueueResult> {
  const result: QueueResult = {
    asked: 0,
    autoAnswered: 0,
    duplicates: 0,
    pending: [],
  };
  if (!items.length) return result;

  const [remembered, existing] = await Promise.all([
    loadRememberedAnswers(supabase, userId),
    supabase
      .from("application_questions")
      .select("question,category")
      .eq("application_id", applicationId)
      .eq("user_id", userId),
  ]);
  const seen = new Set<string>(
    ((existing.data || []) as Row[]).map(
      (q) =>
        classifyQuestion({
          question: String(q.question || ""),
          category: String(q.category || ""),
        }).key,
    ),
  );

  const full: Row[] = [];
  const legacy: Row[] = [];
  for (const item of items) {
    const spec = classifyQuestion(item);
    if (seen.has(spec.key)) {
      result.duplicates += 1;
      continue;
    }
    seen.add(spec.key);
    const reused = reuseAnswer(spec, remembered.get(spec.key));
    const base = {
      user_id: userId,
      application_id: applicationId,
      question: item.question,
      category: item.category || "UNSPECIFIED",
      blocking: reused === null,
      approved: reused !== null,
      answer: reused,
    };
    legacy.push(base);
    full.push({
      ...base,
      question_key: spec.key,
      answer_type: spec.type,
      options: spec.options ?? null,
      auto_answered: reused !== null,
      answered_at: reused !== null ? new Date().toISOString() : null,
    });
    if (reused === null) {
      result.asked += 1;
      result.pending.push(item);
    } else result.autoAnswered += 1;
  }
  if (!full.length) return result;

  let { error } = await supabase.from("application_questions").insert(full);
  if (isMissingColumn(error)) {
    ({ error } = await supabase.from("application_questions").insert(legacy));
  }
  if (error) throw new Error(error.message);
  return result;
}

export type AnswerInput = {
  answer: string;
  remember: boolean;
  expires_at?: string | null;
};

export type AnswerOutcome =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      key: string;
      remembered: boolean;
      propagated: number;
      warning: string | null;
    };

/**
 * Saves an answer, optionally remembers it, and applies it to every other
 * open question that means the same thing (in any application).
 */
export async function answerQuestion(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: AnswerInput,
): Promise<AnswerOutcome> {
  const { data: question } = await supabase
    .from("application_questions")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (!question) return { ok: false, status: 404, error: "Question introuvable." };

  const spec = classifyQuestion({
    question: question.question,
    category: question.category,
    options: (question.options as string[] | null) ?? undefined,
    key: question.question_key,
  });
  const { answer, remember } = input;
  const expiresAt =
    spec.expires && input.expires_at ? new Date(input.expires_at).toISOString() : null;
  const now = new Date().toISOString();

  async function saveAnswer(rowId: string, value: string, auto: boolean) {
    const patch = {
      answer: value,
      approved: true,
      blocking: false,
      question_key: spec.key,
      answer_type: spec.type,
      auto_answered: auto,
      answered_at: now,
    };
    let { error } = await supabase
      .from("application_questions")
      .update(patch)
      .eq("id", rowId)
      .eq("user_id", userId);
    if (isMissingColumn(error)) {
      ({ error } = await supabase
        .from("application_questions")
        .update({ answer: value, approved: true, blocking: false })
        .eq("id", rowId)
        .eq("user_id", userId));
    }
    return error;
  }

  const error = await saveAnswer(id, answer, false);
  if (error) return { ok: false, status: 400, error: error.message };

  let propagated = 0;
  let remembered = false;
  let warning: string | null = null;

  if (remember && spec.type !== "ack") {
    const { error: memError } = await supabase.from("profile_answers").upsert(
      {
        user_id: userId,
        question_key: spec.key,
        label: spec.label,
        category: question.category,
        answer_type: spec.type,
        answer,
        sensitive: Boolean(spec.sensitive),
        expires_at: expiresAt,
        source_question: question.question,
        updated_at: now,
      },
      { onConflict: "user_id,question_key" },
    );
    if (memError) {
      // Most likely the SQL migration has not been applied yet.
      warning =
        "Réponse enregistrée, mais impossible de la mémoriser : applique la migration Supabase profile_answers.";
    } else {
      remembered = true;
      const { data: open } = await supabase
        .from("application_questions")
        .select("*")
        .eq("user_id", userId)
        .eq("approved", false)
        .neq("id", id);
      for (const row of (open || []) as {
        id: string;
        question: string;
        category: string | null;
        options?: string[] | null;
        question_key?: string | null;
      }[]) {
        const other = classifyQuestion({
          question: row.question,
          category: row.category,
          options: row.options ?? undefined,
          key: row.question_key,
        });
        if (other.key !== spec.key) continue;
        let value: string | null = answer;
        if (other.options?.length && !other.allowOther)
          value = matchOption(answer, other.options, !other.sensitive);
        if (value === null) continue; // the other form offers different choices
        if (!(await saveAnswer(row.id, value, true))) propagated += 1;
      }
    }
  }

  await supabase.from("audit_events").insert({
    user_id: userId,
    entity_type: "application_question",
    entity_id: id,
    action: "ANSWERED",
    details: { key: spec.key, remembered, propagated },
  });
  return { ok: true, key: spec.key, remembered, propagated, warning };
}

export { isMissingColumn };
