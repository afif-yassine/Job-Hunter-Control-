package com.afif.convopilot.ai

import android.graphics.BitmapFactory
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

object OcrEngine {
    private val recognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }
    suspend fun read(file: File): String {
        val bitmap = BitmapFactory.decodeFile(file.absolutePath) ?: return ""
        return suspendCancellableCoroutine { c ->
            recognizer.process(InputImage.fromBitmap(bitmap, 0))
                .addOnSuccessListener { c.resume(it.text) }
                .addOnFailureListener { c.resumeWithException(it) }
        }
    }
}
