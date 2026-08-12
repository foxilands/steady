package com.foxilands.steadytimernotification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CHANNEL_ID = "timer-progress"
private const val NOTIFICATION_ID = 6001

class SteadyTimerNotificationModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("SteadyTimerNotification")

    AsyncFunction("showCountdownAsync") { endTimeMs: Double, durationMinutes: Int ->
      showCountdown(endTimeMs.toLong(), durationMinutes)
    }

    AsyncFunction<Unit>("dismissAsync") {
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }
  }

  private fun showCountdown(endTimeMs: Long, durationMinutes: Int) {
    val remainingMs = endTimeMs - System.currentTimeMillis()

    if (remainingMs <= 0) {
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
      return
    }

    ensureChannel()

    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(
        context,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    val iconId = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
      .takeIf { it != 0 }
      ?: context.applicationInfo.icon

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(iconId)
      .setContentTitle("Pouch Timer Active ⏱️")
      .setContentText("Time remaining")
      .setSubText("${durationMinutes} min limit")
      .setWhen(endTimeMs)
      .setShowWhen(true)
      .setUsesChronometer(true)
      .setOngoing(true)
      .setAutoCancel(false)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setTimeoutAfter(remainingMs)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      builder.setChronometerCountDown(true)
    }

    contentIntent?.let(builder::setContentIntent)

    NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build())
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val notificationManager =
      context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    if (notificationManager.getNotificationChannel(CHANNEL_ID) == null) {
      notificationManager.createNotificationChannel(
        NotificationChannel(
          CHANNEL_ID,
          "Active Pouch Timer",
          NotificationManager.IMPORTANCE_LOW
        ).apply {
          description = "Shows the live time remaining for an active pouch timer"
          setSound(null, null)
          enableVibration(false)
          setShowBadge(false)
        }
      )
    }
  }
}
