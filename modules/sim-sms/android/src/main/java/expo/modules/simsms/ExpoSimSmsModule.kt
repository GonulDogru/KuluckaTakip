package expo.modules.simsms

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class ExpoSimSmsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoSimSms")

    Function("isAvailable") {
      val context = appContext.reactContext ?: return@Function false
      context.packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY_MESSAGING)
    }

    AsyncFunction("sendSms") { destination: String, body: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve(mapOf("status" to "failed", "code" to "unavailable"))
        return@AsyncFunction
      }
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
        promise.resolve(mapOf("status" to "failed", "code" to "permission_denied"))
        return@AsyncFunction
      }
      if (!context.packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY_MESSAGING)) {
        promise.resolve(mapOf("status" to "failed", "code" to "no_telephony"))
        return@AsyncFunction
      }
      if (!destination.matches(Regex("""\+905\d{9}""")) || body.isBlank()) {
        promise.resolve(mapOf("status" to "failed", "code" to "invalid_message"))
        return@AsyncFunction
      }

      val messageId = UUID.randomUUID().toString()
      val parts = try {
        SmsManager.getDefault().divideMessage(body)
      } catch (_: Exception) {
        promise.resolve(mapOf("status" to "unknown", "code" to "sim_or_radio_unavailable"))
        return@AsyncFunction
      }
      if (parts.isEmpty()) {
        promise.resolve(mapOf("status" to "failed", "code" to "invalid_message"))
        return@AsyncFunction
      }

      SmsSendRegistry.register(messageId, parts.size, promise)
      try {
        val sentIntents = ArrayList<PendingIntent>(parts.size)
        parts.forEachIndexed { index, _ ->
          val callbackIntent = Intent(context, SmsSentReceiver::class.java).apply {
            action = "expo.modules.simsms.SMS_SENT"
            data = Uri.parse("${context.packageName}://sms-sent/$messageId/$index")
            putExtra(SmsSentReceiver.EXTRA_MESSAGE_ID, messageId)
            putExtra(SmsSentReceiver.EXTRA_PART_INDEX, index)
          }
          sentIntents.add(
            PendingIntent.getBroadcast(
              context,
              (messageId.hashCode() * 31 + index) and 0x7fffffff,
              callbackIntent,
              PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
          )
        }

        val manager = SmsManager.getDefault()
        if (parts.size == 1) {
          manager.sendTextMessage(destination, null, body, sentIntents.first(), null)
        } else {
          manager.sendMultipartTextMessage(destination, null, parts, sentIntents, null)
        }
      } catch (_: Exception) {
        SmsSendRegistry.completeUnknown(messageId, "send_result_unavailable")
      }
    }
  }
}

private data class SmsSendSession(
  val promise: Promise,
  val totalParts: Int,
  val timeout: Runnable,
  val partResults: MutableMap<Int, Int> = mutableMapOf()
)

internal object SmsSendRegistry {
  private const val CALLBACK_TIMEOUT_MS = 110_000L
  private val sessions = ConcurrentHashMap<String, SmsSendSession>()
  private val handler = Handler(Looper.getMainLooper())

  fun register(messageId: String, totalParts: Int, promise: Promise) {
    val timeout = Runnable { completeUnknown(messageId, "send_callback_timeout") }
    val session = SmsSendSession(promise, totalParts, timeout)
    sessions[messageId] = session
    handler.postDelayed(timeout, CALLBACK_TIMEOUT_MS)
  }

  fun onPartResult(messageId: String, partIndex: Int, resultCode: Int) {
    val session = sessions[messageId] ?: return
    if (partIndex !in 0 until session.totalParts) return
    var finalResult: Map<String, String>? = null
    synchronized(session) {
      if (session.partResults.containsKey(partIndex)) return
      session.partResults[partIndex] = resultCode
      if (session.partResults.size == session.totalParts) {
        val successfulParts = session.partResults.values.count { it == android.app.Activity.RESULT_OK }
        finalResult = when {
          successfulParts == session.totalParts -> mapOf("status" to "sent", "code" to "radio_accepted")
          successfulParts == 0 -> mapOf("status" to "failed", "code" to "radio_rejected")
          else -> mapOf("status" to "unknown", "code" to "partial_multipart_result")
        }
      }
    }
    finalResult?.let { finish(messageId, session, it) }
  }

  fun completeUnknown(messageId: String, code: String) {
    val session = sessions[messageId] ?: return
    finish(messageId, session, mapOf("status" to "unknown", "code" to code))
  }

  private fun finish(messageId: String, session: SmsSendSession, result: Map<String, String>) {
    if (!sessions.remove(messageId, session)) return
    handler.removeCallbacks(session.timeout)
    session.promise.resolve(result)
  }
}

class SmsSentReceiver : android.content.BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val messageId = intent.getStringExtra(EXTRA_MESSAGE_ID) ?: return
    val partIndex = intent.getIntExtra(EXTRA_PART_INDEX, -1)
    SmsSendRegistry.onPartResult(messageId, partIndex, resultCode)
  }

  companion object {
    const val EXTRA_MESSAGE_ID = "expo.modules.simsms.MESSAGE_ID"
    const val EXTRA_PART_INDEX = "expo.modules.simsms.PART_INDEX"
  }
}
