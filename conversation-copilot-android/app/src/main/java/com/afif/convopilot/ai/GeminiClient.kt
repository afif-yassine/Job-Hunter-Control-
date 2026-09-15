package com.afif.convopilot.ai

import com.afif.convopilot.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

object GeminiClient {
    private val json = Json { ignoreUnknownKeys = true }
    private val client = OkHttpClient()

    suspend fun generateJson(prompt: String): String = withContext(Dispatchers.IO) {
        require(BuildConfig.GEMINI_API_KEY.isNotBlank()) { "Missing GEMINI_API_KEY in .env" }
        val body = buildJsonObject {
            put("contents", buildJsonArray { add(buildJsonObject { put("parts", buildJsonArray { add(buildJsonObject { put("text", prompt) }) }) }) })
            put("generationConfig", buildJsonObject { put("temperature", 0.45); put("responseMimeType", "application/json") })
        }.toString()
        val request = Request.Builder()
            .url("https://generativelanguage.googleapis.com/v1beta/models/${BuildConfig.GEMINI_MODEL}:generateContent?key=${BuildConfig.GEMINI_API_KEY}")
            .post(body.toRequestBody("application/json".toMediaType()))
            .build()
        client.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            check(response.isSuccessful) { "Gemini ${response.code}: $raw" }
            json.parseToJsonElement(raw).jsonObject["candidates"]!!.jsonArray.first().jsonObject["content"]!!.jsonObject["parts"]!!.jsonArray.first().jsonObject["text"]!!.jsonPrimitive.content
        }
    }

    inline fun <reified T> decode(raw: String): T = json.decodeFromString(raw)
}
