package com.afif.convopilot.services

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import com.afif.convopilot.MainActivity
import com.afif.convopilot.ProjectionPermissionActivity

class ConvoTileService : TileService() {
    override fun onStartListening() { super.onStartListening(); updateTile() }
    override fun onClick() {
        super.onClick()
        val active = prefs().getBoolean(CaptureService.KEY_ACTIVE, false)
        if (active) {
            startService(Intent(this, CaptureService::class.java).setAction(CaptureService.ACTION_STOP))
            prefs().edit().putBoolean(CaptureService.KEY_ACTIVE,false).apply(); updateTile(); return
        }
        val target = if (android.provider.Settings.canDrawOverlays(this)) Intent(this, ProjectionPermissionActivity::class.java) else Intent(this, MainActivity::class.java)
        target.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (Build.VERSION.SDK_INT >= 34) {
            startActivityAndCollapse(PendingIntent.getActivity(this,44,target,PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
        } else {
            @Suppress("DEPRECATION") startActivityAndCollapse(target)
        }
    }
    private fun updateTile() {
        val active=prefs().getBoolean(CaptureService.KEY_ACTIVE,false)
        qsTile?.state=if(active) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        if(Build.VERSION.SDK_INT>=29) qsTile?.subtitle=if(active) "Live" else "Tap to start"
        qsTile?.updateTile()
    }
    private fun prefs()=getSharedPreferences(CaptureService.PREFS, Context.MODE_PRIVATE)
}
