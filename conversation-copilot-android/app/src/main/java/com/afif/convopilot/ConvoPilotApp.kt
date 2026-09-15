package com.afif.convopilot

import android.app.Application
import com.afif.convopilot.data.AppDatabase

class ConvoPilotApp : Application() {
    val database: AppDatabase by lazy { AppDatabase.get(this) }
}
