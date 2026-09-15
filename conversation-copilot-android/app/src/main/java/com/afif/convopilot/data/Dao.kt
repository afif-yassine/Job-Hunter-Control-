package com.afif.convopilot.data

import androidx.room.*

@Dao interface MemoryDao {
    @Upsert suspend fun upsert(memory:MemoryEntity)
    @Query("SELECT * FROM memories ORDER BY updatedAt DESC") suspend fun all():List<MemoryEntity>
    @Query("SELECT * FROM memories WHERE key = :key LIMIT 1") suspend fun get(key:String):MemoryEntity?
    @Query("DELETE FROM memories WHERE key = :key") suspend fun delete(key:String)
}

@Dao interface NotificationMessageDao {
    @Insert(onConflict=OnConflictStrategy.REPLACE) suspend fun insert(message:NotificationMessageEntity)
    @Query("SELECT * FROM notification_messages WHERE postedAt >= :since ORDER BY postedAt DESC LIMIT :limit") suspend fun recent(since:Long,limit:Int=50):List<NotificationMessageEntity>
    @Query("DELETE FROM notification_messages WHERE postedAt < :before") suspend fun deleteOlderThan(before:Long)
}
