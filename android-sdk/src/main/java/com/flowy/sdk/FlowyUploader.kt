package com.flowy.sdk

import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

internal object FlowyUploader {
    private val client = OkHttpClient()

    fun triggerUpload() {
        val events = FlowyStorage.getSessionEvents()
        if (events.isEmpty()) return

        val apiKey = Flowy.apiKey
        if (apiKey == null) {
            Log.e(Flowy.TAG, "API Key is missing. Cannot upload session.")
            return
        }

        // Ideally, we'd serialize the entire array of events
        val jsonMediaType = "application/json; charset=utf-8".toMediaType()
        val jsonPayload = kotlinx.serialization.json.Json.encodeToString(events)

        val request = Request.Builder()
            .url(Flowy.options.uploadUrl)
            .addHeader("Authorization", "Bearer $apiKey")
            .post(jsonPayload.toRequestBody(jsonMediaType))
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: java.io.IOException) {
                Log.e(Flowy.TAG, "Upload failed", e)
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                if (response.isSuccessful) {
                    Log.i(Flowy.TAG, "Session uploaded successfully.")
                    FlowyStorage.clearSession()
                } else {
                    Log.e(Flowy.TAG, "Upload failed with status: ${response.code}")
                }
            }
        })
    }
}
