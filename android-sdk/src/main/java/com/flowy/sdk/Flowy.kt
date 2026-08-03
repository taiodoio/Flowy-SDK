package com.flowy.sdk

import android.app.Application
import android.util.Log

object Flowy {
    internal const val TAG = "FlowySDK"
    
    internal var apiKey: String? = null
    internal var options: FlowyOptions = FlowyOptions()
    private var isConfigured = false

    fun configure(application: Application, apiKey: String, options: FlowyOptions = FlowyOptions()) {
        if (isConfigured) {
            Log.w(TAG, "Flowy is already configured.")
            return
        }
        
        this.apiKey = apiKey
        this.options = options
        
        // Initialize Logger, Storage, Uploader
        FlowyStorage.init(application)
        FlowyLogger.init()
        
        // Register Lifecycle callbacks for screen tracking and window interception
        application.registerActivityLifecycleCallbacks(FlowyLifecycleTracker())
        
        isConfigured = true
        Log.i(TAG, "Flowy AI-Powered Auto-Capture configured successfully.")
    }
}
