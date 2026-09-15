package com.afif.convopilot.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName="memories")
data class MemoryEntity(@PrimaryKey val key:String,val displayName:String,val platform:String,val relationship:String,val tone:String,val summary:String,val factsJson:String,val currentSituation:String,val updatedAt:Long=System.currentTimeMillis())

@Entity(tableName="notification_messages")
data class NotificationMessageEntity(@PrimaryKey(autoGenerate=true) val id:Long=0,val packageName:String,val title:String,val text:String,val postedAt:Long)
