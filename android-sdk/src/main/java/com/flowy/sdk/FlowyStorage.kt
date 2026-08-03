package com.flowy.sdk

import android.content.Context
import android.util.Log
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.io.FileWriter

internal object FlowyStorage {
    private var initialized = false
    private lateinit var sessionFile: File

    fun init(context: Context) {
        if (initialized) return
        val dir = File(context.filesDir, "flowy")
        if (!dir.exists()) {
            dir.mkdirs()
        }
        sessionFile = File(dir, "flowy_session.json")
        initialized = true
        
        // Clear old session for MVP
        if (sessionFile.exists()) {
            sessionFile.delete()
        }
    }

    fun appendEvent(event: FlowyEvent) {
        if (!initialized) return
        try {
            val jsonString = Json.encodeToString(event)
            FileWriter(sessionFile, true).use {
                it.append(jsonString).append("\n")
            }
        } catch (e: Exception) {
            Log.e(Flowy.TAG, "Failed to write event", e)
        }
    }

    fun getSessionEvents(): List<FlowyEvent> {
        if (!initialized || !sessionFile.exists()) return emptyList()
        val events = mutableListOf<FlowyEvent>()
        try {
            sessionFile.forEachLine { line ->
                if (line.isNotBlank()) {
                    events.add(Json.decodeFromString(line))
                }
            }
        } catch (e: Exception) {
            Log.e(Flowy.TAG, "Failed to read events", e)
        }
        return events
    }
    
    fun clearSession() {
        if (sessionFile.exists()) {
            sessionFile.delete()
        }
    }
}
