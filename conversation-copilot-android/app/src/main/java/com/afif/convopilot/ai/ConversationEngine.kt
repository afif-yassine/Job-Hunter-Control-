package com.afif.convopilot.ai

import android.content.Context
import com.afif.convopilot.data.AppDatabase
import com.afif.convopilot.data.MemoryEntity
import com.afif.convopilot.util.ContextMerger
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

object ConversationEngine {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun understand(context: Context, paths: List<String>): UnderstandResult {
        val merged = ContextMerger.merge(paths.map { OcrEngine.read(File(it)) })
        require(merged.isNotBlank()) { "No readable text found" }
        val prompt = """
            Analyze this OCR conversation factually. Never invent hidden messages or intentions.
            Return JSON exactly: {"contactName":"","platform":"","relationship":"","tone":"","summary":"","facts":[],"currentSituation":""}
            OCR:\n$merged
        """.trimIndent()
        val result = GeminiClient.decode<UnderstandResult>(GeminiClient.generateJson(prompt))
        AppDatabase.get(context).memoryDao().upsert(MemoryEntity(
            key = "${result.platform.lowercase()}::${result.contactName.lowercase()}",
            displayName = result.contactName.ifBlank { "Unknown" }, platform = result.platform,
            relationship = result.relationship, tone = result.tone, summary = result.summary,
            factsJson = json.encodeToString(result.facts), currentSituation = result.currentSituation
        ))
        return result
    }

    suspend fun reply(context: Context, screenPath: String, tone: String): ReplyResult {
        val text = OcrEngine.read(File(screenPath)); require(text.isNotBlank()) { "No readable text found" }
        val db = AppDatabase.get(context)
        val memory = db.memoryDao().all().firstOrNull { text.contains(it.displayName, true) }
        val notifications = db.notificationDao().recent(System.currentTimeMillis() - 3L*24*60*60*1000, 20)
            .filter { memory == null || it.title.contains(memory.displayName, true) }
            .joinToString("\n") { "${it.title}: ${it.text}" }
        val mem = memory?.let { "Summary: ${it.summary}\nFacts:${it.factsJson}\nNow:${it.currentSituation}" } ?: "No stored memory."
        val prompt = """
            Generate 3 natural concise replies. Style: $tone. Do not pressure, manipulate or invent facts.
            MEMORY:\n$mem
            RECENT NOTIFICATIONS:\n$notifications
            CURRENT OCR:\n$text
            Return JSON exactly: {"replies":["","",""],"updatedSummary":null,"newFacts":[],"currentSituation":null}
        """.trimIndent()
        val result = GeminiClient.decode<ReplyResult>(GeminiClient.generateJson(prompt))
        if (memory != null) db.memoryDao().upsert(memory.copy(
            summary = result.updatedSummary?.ifBlank { null } ?: memory.summary,
            currentSituation = result.currentSituation?.ifBlank { null } ?: memory.currentSituation,
            updatedAt = System.currentTimeMillis()
        ))
        return result
    }

    suspend fun start(context: Context, screenPath: String, tone: String): StartResult {
        val text = OcrEngine.read(File(screenPath)); require(text.isNotBlank()) { "No readable profile text found" }
        return GeminiClient.decode(GeminiClient.generateJson(
            "Create 3 natural first messages based only on visible details. Style: $tone. Return JSON {\"openers\":[\"\",\"\",\"\"]}. OCR:\n$text"
        ))
    }
}
