package com.afif.convopilot.services

import android.app.Service
import android.content.*
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.*
import android.widget.*
import com.afif.convopilot.ai.*
import kotlinx.coroutines.*
import java.io.File

class OverlayService:Service(){
    private lateinit var wm:WindowManager; private lateinit var root:LinearLayout; private lateinit var panel:LinearLayout; private lateinit var bubble:TextView
    private val scope=CoroutineScope(SupervisorJob()+Dispatchers.Main.immediate)
    private val screens=mutableListOf<String>(); private var pending:Pending?=null; private var lastPath:String?=null; private var lastTone="Natural"

    private val receiver=object:BroadcastReceiver(){override fun onReceive(c:Context?,i:Intent?){val path=i?.getStringExtra(CaptureService.EXTRA_CAPTURE_PATH)?:return; when(val p=pending){is Pending.Reply->{pending=null;lastPath=path;lastTone=p.tone;reply(path,p.tone)};is Pending.Start->{pending=null;lastPath=path;lastTone=p.tone;start(path,p.tone)};null->{screens+=path;understandUi("${screens.size} screen(s) captured ✓")}}}}

    override fun onCreate(){super.onCreate(); if(!Settings.canDrawOverlays(this)){stopSelf();return}; wm=getSystemService(WINDOW_SERVICE) as WindowManager; buildOverlay(); val f=IntentFilter(CaptureService.ACTION_CAPTURED); if(Build.VERSION.SDK_INT>=33) registerReceiver(receiver,f,RECEIVER_NOT_EXPORTED) else @Suppress("DEPRECATION") registerReceiver(receiver,f)}

    private fun buildOverlay(){
        root=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;gravity=Gravity.END}
        panel=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;visibility=View.GONE;setPadding(dp(14),dp(14),dp(14),dp(14));background=round(0xF01A1B24.toInt(),22)}
        bubble=TextView(this).apply{text="AI";textSize=15f;setTextColor(Color.WHITE);gravity=Gravity.CENTER;typeface=android.graphics.Typeface.DEFAULT_BOLD;background=GradientDrawable(GradientDrawable.Orientation.TL_BR,intArrayOf(0xFF8B6CFF.toInt(),0xFF4A8DFF.toInt())).apply{shape=GradientDrawable.OVAL};setOnClickListener{if(panel.visibility==View.VISIBLE)panel.visibility=View.GONE else menu()}}
        root.addView(panel,LinearLayout.LayoutParams(dp(300),LinearLayout.LayoutParams.WRAP_CONTENT));root.addView(bubble,LinearLayout.LayoutParams(dp(58),dp(58)).apply{gravity=Gravity.END;topMargin=dp(8)})
        val lp=WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT,WindowManager.LayoutParams.WRAP_CONTENT,WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,android.graphics.PixelFormat.TRANSLUCENT).apply{gravity=Gravity.TOP or Gravity.END;x=dp(12);y=dp(180)};wm.addView(root,lp)
    }

    private fun menu(){panel.removeAllViews();panel.visibility=View.VISIBLE;header("CONVOPILOT","Context on demand");button("🧠  UNDERSTAND"){screens.forEach{runCatching{File(it).delete()}};screens.clear();understandUi("Scroll the chat and capture useful positions")};button("💬  REPLY"){tones(true)};button("✨  START"){tones(false)};ghost("Close"){panel.visibility=View.GONE}}
    private fun understandUi(msg:String){panel.removeAllViews();panel.visibility=View.VISIBLE;header("LIVE UNDERSTAND",msg);button("📸  Capture screen"){capture()};ghost("↶ Undo last"){screens.removeLastOrNull()?.let{runCatching{File(it).delete()}};understandUi("${screens.size} screen(s) captured")};button("✓  Finish understanding"){if(screens.isEmpty())understandUi("Capture at least one screen") else finishUnderstand()};ghost("Cancel"){menu()}}
    private fun finishUnderstand(){loading("Understanding conversation…");val copy=screens.toList();scope.launch{runCatching{withContext(Dispatchers.IO){ConversationEngine.understand(applicationContext,copy)}}.onSuccess{panel.removeAllViews();header("MEMORY SAVED ✓",it.contactName);body("${it.platform} · ${it.relationship}\n\n${it.summary}\n\nNow: ${it.currentSituation}");button("💬 Reply now"){tones(true)};ghost("Done"){panel.visibility=View.GONE}}.onFailure{error(it.message?:"Failed")}}}
    private fun tones(reply:Boolean){panel.removeAllViews();panel.visibility=View.VISIBLE;header(if(reply)"REPLY" else "START","Choose a style");listOf("Natural","Funny","Flirty","Confident","Sweet","Cold","Professional").forEach{tone->button(tone){pending=if(reply)Pending.Reply(tone) else Pending.Start(tone);loading("Capturing current screen…");capture()}};ghost("Back"){menu()}}
    private fun reply(path:String,tone:String){loading("Writing 3 $tone replies…");scope.launch{runCatching{withContext(Dispatchers.IO){ConversationEngine.reply(applicationContext,path,tone)}}.onSuccess{result("$tone REPLY",it.replies,true)}.onFailure{error(it.message?:"Failed")}}}
    private fun start(path:String,tone:String){loading("Creating openers…");scope.launch{runCatching{withContext(Dispatchers.IO){ConversationEngine.start(applicationContext,path,tone)}}.onSuccess{result("$tone START",it.openers,false)}.onFailure{error(it.message?:"Failed")}}}
    private fun result(title:String,items:List<String>,reply:Boolean){panel.removeAllViews();header(title,"Tap one to copy");items.take(3).forEachIndexed{idx,s->suggest("${idx+1}. $s",s)};button("↻ Regenerate"){lastPath?.let{if(reply)reply(it,lastTone) else start(it,lastTone)}};ghost("Change tone"){tones(reply)};ghost("Done"){panel.visibility=View.GONE}}
    private fun capture(){root.visibility=View.INVISIBLE;scope.launch{delay(180);startService(Intent(this@OverlayService,CaptureService::class.java).setAction(CaptureService.ACTION_CAPTURE));delay(550);root.visibility=View.VISIBLE}}
    private fun loading(t:String){panel.removeAllViews();panel.visibility=View.VISIBLE;header("WORKING",t);panel.addView(ProgressBar(this),LinearLayout.LayoutParams(dp(42),dp(42)).apply{gravity=Gravity.CENTER_HORIZONTAL})}
    private fun error(t:String){panel.removeAllViews();header("COULDN'T COMPLETE",t.take(240));button("Back"){menu()}}
    private fun header(a:String,b:String){panel.addView(TextView(this).apply{text=a;textSize=12f;setTextColor(0xFF9C8CFF.toInt());typeface=android.graphics.Typeface.DEFAULT_BOLD});panel.addView(TextView(this).apply{text=b;textSize=14f;setTextColor(Color.WHITE);setPadding(0,dp(5),0,dp(12))})}
    private fun body(t:String){panel.addView(TextView(this).apply{text=t;textSize=13f;setTextColor(0xFFD9D9E4.toInt());setPadding(0,0,0,dp(10))})}
    private fun button(t:String,click:()->Unit){panel.addView(TextView(this).apply{text=t;textSize=14f;setTextColor(Color.WHITE);gravity=Gravity.CENTER_VERTICAL;setPadding(dp(14),0,dp(14),0);background=round(0xFF2B2D3B.toInt(),15);setOnClickListener{click()}},LinearLayout.LayoutParams(-1,dp(48)).apply{bottomMargin=dp(8)})}
    private fun ghost(t:String,click:()->Unit){panel.addView(TextView(this).apply{text=t;textSize=13f;setTextColor(0xFFA7A8BA.toInt());gravity=Gravity.CENTER;setOnClickListener{click()}},LinearLayout.LayoutParams(-1,dp(40)))}
    private fun suggest(label:String,value:String){panel.addView(TextView(this).apply{text=label;textSize=14f;setTextColor(Color.WHITE);setPadding(dp(14),dp(12),dp(14),dp(12));background=round(0xFF242633.toInt(),15);setOnClickListener{(getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager).setPrimaryClip(android.content.ClipData.newPlainText("ConvoPilot",value));Toast.makeText(this@OverlayService,"Copied ✓",Toast.LENGTH_SHORT).show()}},LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=dp(8)})}
    private fun round(color:Int,r:Int)=GradientDrawable().apply{setColor(color);cornerRadius=dp(r).toFloat();setStroke(dp(1),0x22FFFFFF)}
    private fun dp(v:Int)=(v*resources.displayMetrics.density).toInt()
    override fun onDestroy(){runCatching{unregisterReceiver(receiver)};if(::root.isInitialized)runCatching{wm.removeView(root)};scope.cancel();super.onDestroy()};override fun onBind(i:Intent?):IBinder?=null
    private sealed class Pending{data class Reply(val tone:String):Pending();data class Start(val tone:String):Pending()}
}
