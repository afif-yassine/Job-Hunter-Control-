package com.afif.convopilot.services

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.afif.convopilot.R
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.atomic.AtomicBoolean

class CaptureService : Service() {
    private var projection: MediaProjection? = null
    private var display: VirtualDisplay? = null
    private var reader: ImageReader? = null
    private val pending = AtomicBoolean(false)

    override fun onCreate() { super.onCreate(); createChannel() }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when(intent?.action) {
            ACTION_STOP -> { stopSelf(); return START_NOT_STICKY }
            ACTION_CAPTURE -> { pending.set(true); return START_STICKY }
        }
        if (projection == null) {
            val code = intent?.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED) ?: Activity.RESULT_CANCELED
            val data: Intent? = if(Build.VERSION.SDK_INT>=33) intent?.getParcelableExtra(EXTRA_RESULT_DATA,Intent::class.java) else @Suppress("DEPRECATION") intent?.getParcelableExtra(EXTRA_RESULT_DATA)
            if(code!=Activity.RESULT_OK || data==null){ stopSelf(); return START_NOT_STICKY }
            startFg(); startProjection(code,data)
            getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putBoolean(KEY_ACTIVE,true).apply()
            startService(Intent(this,OverlayService::class.java))
        }
        return START_STICKY
    }

    private fun startFg(){
        val n=NotificationCompat.Builder(this,CHANNEL_ID).setSmallIcon(R.drawable.ic_tile).setContentTitle("ConvoPilot").setContentText("Live context active").setOngoing(true).build()
        if(Build.VERSION.SDK_INT>=29) startForeground(2301,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION) else startForeground(2301,n)
    }

    private fun startProjection(code:Int,data:Intent){
        val manager=getSystemService(MediaProjectionManager::class.java)
        projection=manager.getMediaProjection(code,data).also { it.registerCallback(object:MediaProjection.Callback(){override fun onStop(){stopSelf()}},null) }
        val m=resources.displayMetrics; val w=m.widthPixels; val h=m.heightPixels
        reader=ImageReader.newInstance(w,h,PixelFormat.RGBA_8888,3).apply {
            setOnImageAvailableListener({ r ->
                val image=r.acquireLatestImage() ?: return@setOnImageAvailableListener
                try {
                    if(!pending.compareAndSet(true,false)) return@setOnImageAvailableListener
                    val p=image.planes[0]; val rowPadding=p.rowStride-p.pixelStride*w
                    val paddedW=w+rowPadding/p.pixelStride
                    val padded=Bitmap.createBitmap(paddedW,h,Bitmap.Config.ARGB_8888)
                    padded.copyPixelsFromBuffer(p.buffer)
                    val crop=Bitmap.createBitmap(padded,0,0,w,h); padded.recycle()
                    val dir=File(filesDir,"context_captures").apply{mkdirs()}; val file=File(dir,"capture_${System.currentTimeMillis()}.jpg")
                    FileOutputStream(file).use{crop.compress(Bitmap.CompressFormat.JPEG,88,it)}; crop.recycle()
                    sendBroadcast(Intent(ACTION_CAPTURED).setPackage(packageName).putExtra(EXTRA_CAPTURE_PATH,file.absolutePath))
                } finally { image.close() }
            },null)
        }
        display=projection?.createVirtualDisplay("ConvoPilot",w,h,m.densityDpi,DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,reader?.surface,null,null)
    }

    private fun createChannel(){ if(Build.VERSION.SDK_INT>=26) getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel(CHANNEL_ID,"Live context",NotificationManager.IMPORTANCE_LOW)) }

    override fun onDestroy(){
        getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putBoolean(KEY_ACTIVE,false).apply()
        stopService(Intent(this,OverlayService::class.java)); display?.release(); reader?.close(); projection?.stop(); super.onDestroy()
    }
    override fun onBind(intent:Intent?):IBinder?=null

    companion object {
        const val ACTION_CAPTURE="com.afif.convopilot.CAPTURE"; const val ACTION_CAPTURED="com.afif.convopilot.CAPTURED"; const val ACTION_STOP="com.afif.convopilot.STOP"
        const val EXTRA_CAPTURE_PATH="capture_path"; const val EXTRA_RESULT_CODE="result_code"; const val EXTRA_RESULT_DATA="result_data"
        const val PREFS="convopilot_state"; const val KEY_ACTIVE="capture_active"; private const val CHANNEL_ID="convopilot_capture"
    }
}
