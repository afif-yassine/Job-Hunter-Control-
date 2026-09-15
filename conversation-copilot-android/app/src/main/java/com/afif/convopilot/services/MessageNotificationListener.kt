package com.afif.convopilot.services

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.afif.convopilot.data.AppDatabase
import com.afif.convopilot.data.NotificationMessageEntity
import kotlinx.coroutines.*

class MessageNotificationListener : NotificationListenerService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        if (sbn.packageName !in supportedPackages) return
        val e = sbn.notification.extras
        val title = (e.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE) ?: e.getCharSequence(Notification.EXTRA_TITLE))?.toString()?.trim().orEmpty()
        val text = (e.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: e.getCharSequence(Notification.EXTRA_TEXT))?.toString()?.trim().orEmpty()
        if (title.isBlank() || text.isBlank()) return
        scope.launch {
            val dao = AppDatabase.get(applicationContext).notificationDao()
            dao.insert(NotificationMessageEntity(packageName=sbn.packageName,title=title,text=text,postedAt=sbn.postTime))
            dao.deleteOlderThan(System.currentTimeMillis() - 14L*24*60*60*1000)
        }
    }
    companion object {
        private val supportedPackages = setOf(
            "com.whatsapp","com.whatsapp.w4b","com.instagram.android","com.tinder","com.bumble.app","co.hinge.app","com.linkedin.android","com.facebook.orca","com.snapchat.android","com.zhiliaoapp.musically","org.telegram.messenger","com.discord"
        )
    }
}
