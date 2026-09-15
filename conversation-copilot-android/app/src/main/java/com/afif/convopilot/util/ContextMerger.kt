package com.afif.convopilot.util

object ContextMerger {
    fun merge(blocks:List<String>):String {
        val cleaned=blocks.map{normalize(it)}.filter{it.isNotBlank()}; if(cleaned.isEmpty()) return ""
        var merged=cleaned.first().lines().filter{it.isNotBlank()}
        for(block in cleaned.drop(1)){ val next=block.lines().filter{it.isNotBlank()}; val overlap=largestOverlap(merged,next); merged=merged+next.drop(overlap) }
        return merged.joinToString("\n")
    }
    private fun largestOverlap(a:List<String>,b:List<String>):Int { val max=minOf(a.size,b.size,12); for(size in max downTo 1){ if(a.takeLast(size).map(::key)==b.take(size).map(::key)) return size }; return 0 }
    private fun normalize(text:String)=text.replace("\r","").lines().map{it.trim()}.filter{it.isNotBlank()}.joinToString("\n")
    private fun key(s:String)=s.lowercase().replace(Regex("[^\\p{L}\\p{N}]+"),"")
}
