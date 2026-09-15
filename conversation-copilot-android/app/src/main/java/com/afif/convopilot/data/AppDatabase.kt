package com.afif.convopilot.data

import android.content.Context
import androidx.room.*

@Database(entities=[MemoryEntity::class,NotificationMessageEntity::class],version=1,exportSchema=false)
abstract class AppDatabase:RoomDatabase(){
    abstract fun memoryDao():MemoryDao
    abstract fun notificationDao():NotificationMessageDao
    companion object { @Volatile private var INSTANCE:AppDatabase?=null
        fun get(context:Context):AppDatabase=INSTANCE?: synchronized(this){ INSTANCE?:Room.databaseBuilder(context.applicationContext,AppDatabase::class.java,"convopilot.db").build().also{INSTANCE=it} }
    }
}
