package com.afif.convopilot.util
import org.junit.Assert.assertEquals
import org.junit.Test
class ContextMergerTest { @Test fun mergesOverlappingScreens(){ assertEquals("A\nB\nC\nD\nE\nF\nG",ContextMerger.merge(listOf("A\nB\nC\nD","C\nD\nE\nF","E\nF\nG"))) } }
