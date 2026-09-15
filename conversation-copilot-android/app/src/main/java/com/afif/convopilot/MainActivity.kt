package com.afif.convopilot

import android.Manifest
import android.app.StatusBarManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.NotificationManagerCompat
import com.afif.convopilot.services.CaptureService
import com.afif.convopilot.services.ConvoTileService

class MainActivity:ComponentActivity(){ override fun onCreate(savedInstanceState:Bundle?){ super.onCreate(savedInstanceState); setContent{Screen()} } }

@Composable private fun Screen(){
    val c=LocalContext.current
    var refresh by remember{ mutableIntStateOf(0) }
    val launcher=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()){refresh++}
    val overlay=Settings.canDrawOverlays(c)
    val listener=NotificationManagerCompat.getEnabledListenerPackages(c).contains(c.packageName)
    val active=c.getSharedPreferences(CaptureService.PREFS,Context.MODE_PRIVATE).getBoolean(CaptureService.KEY_ACTIVE,false)
    val bg=Color(0xFF090A0F); val violet=Color(0xFF8B6CFF); val blue=Color(0xFF4A8DFF); val card=Color(0xFF171923)
    MaterialTheme(colorScheme=darkColorScheme(primary=violet,secondary=blue,background=bg,surface=card)){
        Column(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF19132F),bg))).padding(20.dp),verticalArrangement=Arrangement.spacedBy(14.dp)){
            Row(verticalAlignment=Alignment.CenterVertically){
                Box(Modifier.size(52.dp).clip(RoundedCornerShape(18.dp)).background(Brush.linearGradient(listOf(violet,blue))),contentAlignment=Alignment.Center){Icon(Icons.Rounded.AutoAwesome,null,tint=Color.White)}
                Spacer(Modifier.width(12.dp)); Column{Text("ConvoPilot",fontSize=28.sp,fontWeight=FontWeight.Black);Text("One tap. Full context. Better replies.",color=Color(0xFF9EA0B4),fontSize=12.sp)}
            }
            Card(colors=CardDefaults.cardColors(containerColor=Color(0xFF1A1D2B)),shape=RoundedCornerShape(26.dp)){Column(Modifier.padding(20.dp)){Text(if(active)"LIVE CONTEXT ON" else "YOUR AI ABOVE EVERY CHAT",color=if(active)Color(0xFF64D99B) else violet,fontWeight=FontWeight.Bold);Spacer(Modifier.height(8.dp));Text(if(active)"Return to your chat. The floating AI button is ready." else "No Tinder API. No WhatsApp login. You decide when the AI sees the screen.",fontSize=19.sp,fontWeight=FontWeight.Bold);Spacer(Modifier.height(8.dp));Text("UNDERSTAND · REPLY · START",color=Color.White.copy(alpha=.7f),fontSize=12.sp)}}
            SetupCard("Floating copilot",if(overlay)"Ready" else "Required for the AI bubble",overlay){c.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${c.packageName}")))}
            SetupCard("Message context",if(listener)"Notification context enabled" else "Optional: use new message notifications",listener){c.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))}
            if(Build.VERSION.SDK_INT>=33) SetupCard("Live session notification","Android foreground notification",c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==android.content.pm.PackageManager.PERMISSION_GRANTED){launcher.launch(Manifest.permission.POST_NOTIFICATIONS)}
            SetupCard("Quick Settings tile",if(active)"Live now" else "Put ConvoPilot next to Wi‑Fi/Bluetooth",active){requestTile(c)}
            SetupCard("Gemini",if(BuildConfig.GEMINI_API_KEY.isNotBlank())"gemini-2.5-flash-lite configured" else "Add GEMINI_API_KEY to .env",BuildConfig.GEMINI_API_KEY.isNotBlank(),null)
            Card(colors=CardDefaults.cardColors(containerColor=card),shape=RoundedCornerShape(22.dp)){Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){Text("HOW IT WORKS",color=violet,fontWeight=FontWeight.Bold,fontSize=11.sp);Text("1. Open Tinder / WhatsApp / Instagram\n2. Pull Quick Settings → ConvoPilot\n3. Accept screen-sharing consent\n4. Tap AI → UNDERSTAND / REPLY / START\n5. UNDERSTAND: Capture → scroll → Capture → Finish",fontSize=13.sp,lineHeight=19.sp)}}
        }
    }
}

@Composable private fun SetupCard(title:String,sub:String,done:Boolean,action:(()->Unit)?){Card(colors=CardDefaults.cardColors(containerColor=Color(0xFF171923)),shape=RoundedCornerShape(20.dp)){Row(Modifier.fillMaxWidth().padding(16.dp),verticalAlignment=Alignment.CenterVertically){Column(Modifier.weight(1f)){Text(title,fontWeight=FontWeight.Bold);Text(sub,color=Color(0xFF9EA0B4),fontSize=12.sp)}; if(done) Text("✓",color=Color(0xFF64D99B),fontSize=20.sp) else if(action!=null) TextButton(onClick=action){Text("ENABLE",fontSize=11.sp)}}}}

private fun requestTile(c:Context){ if(Build.VERSION.SDK_INT>=33){c.getSystemService(StatusBarManager::class.java).requestAddTileService(ComponentName(c,ConvoTileService::class.java),"ConvoPilot",Icon.createWithResource(c,R.drawable.ic_tile),c.mainExecutor){}} else c.startActivity(Intent(Settings.ACTION_SETTINGS)) }
