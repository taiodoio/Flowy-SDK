package com.flowy.sdk

import android.app.Activity
import android.app.Application
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Bundle
import android.view.MotionEvent
import android.view.Window

internal class FlowyLifecycleTracker : Application.ActivityLifecycleCallbacks {

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
    override fun onActivityStarted(activity: Activity) {}

    override fun onActivityResumed(activity: Activity) {
        FlowyLogger.logScreenView(activity)

        // Wrapper around the existing Activity window callback to intercept touch events
        val existingCallback = activity.window.callback
        activity.window.callback = object : Window.Callback by existingCallback {
            override fun dispatchTouchEvent(event: MotionEvent): Boolean {
                if (event.action == MotionEvent.ACTION_UP) {
                    val tapX = event.rawX
                    val tapY = event.rawY
                    
                    val rootView = activity.window.decorView.rootView
                    val bitmap = Bitmap.createBitmap(rootView.width, rootView.height, Bitmap.Config.ARGB_8888)
                    val canvas = Canvas(bitmap)
                    rootView.draw(canvas)

                    // Execute asynchronously
                    Thread {
                        FlowyLogger.logVisionInteraction(activity, tapX, tapY, bitmap)
                    }.start()
                }
                return existingCallback.dispatchTouchEvent(event)
            }
        }
    }

    override fun onActivityPaused(activity: Activity) {}

    override fun onActivityStopped(activity: Activity) {
        // Simple heuristic: if activity stops, attempt to upload
        FlowyUploader.triggerUpload()
    }

    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
    override fun onActivityDestroyed(activity: Activity) {}
}
