package com.afif.convopilot.ai

import kotlinx.serialization.Serializable

@Serializable data class UnderstandResult(val contactName:String="Unknown",val platform:String="Unknown",val relationship:String="Unknown",val tone:String="Neutral",val summary:String="",val facts:List<String> = emptyList(),val currentSituation:String="")
@Serializable data class ReplyResult(val replies:List<String> = emptyList(),val updatedSummary:String?=null,val newFacts:List<String> = emptyList(),val currentSituation:String?=null)
@Serializable data class StartResult(val openers:List<String> = emptyList())
