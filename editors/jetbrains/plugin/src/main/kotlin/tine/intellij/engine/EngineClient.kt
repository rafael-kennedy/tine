package tine.intellij.engine

import com.google.gson.Gson
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.io.DataInputStream
import java.io.EOFException
import java.io.File
import java.io.OutputStream
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * The wire to `tine engine`. Plain JDK and Gson, no IntelliJ classes, so it is
 * tested on its own. Requests go out as JSON lines; the engine answers with
 * frames: a type byte, a little-endian length, a payload. Type 1 is JSON,
 * type 2 is audio (a frame count, then 16-bit stereo PCM).
 */
class EngineClient(
    command: List<String>,
    workDir: File? = null,
    private val onNotify: (method: String, params: JsonObject) -> Unit,
    private val onAudio: (pcm: ByteArray, frames: Int) -> Unit,
    private val onExit: (code: Int, stderrTail: String) -> Unit,
) {
    private val process: Process = ProcessBuilder(command).apply { if (workDir != null) directory(workDir) }.start()
    private val out: OutputStream = process.outputStream
    private val pending = ConcurrentHashMap<Int, CompletableFuture<JsonElement>>()
    private val ids = AtomicInteger()
    private val gson = Gson()
    private val stderr = StringBuffer()
    @Volatile var closed = false; private set

    init {
        Thread({ readLoop() }, "tine-engine-reader").apply { isDaemon = true; start() }
        Thread({
            process.errorStream.bufferedReader().forEachLine { line ->
                stderr.append(line).append('\n')
                if (stderr.length > 8000) stderr.delete(0, stderr.length - 4000)
            }
        }, "tine-engine-stderr").apply { isDaemon = true; start() }
    }

    val alive get() = process.isAlive && !closed

    fun request(method: String, params: Any? = null): CompletableFuture<JsonElement> {
        val id = ids.incrementAndGet()
        val f = CompletableFuture<JsonElement>()
        pending[id] = f
        if (!send(JsonObject().apply { addProperty("id", id); addProperty("method", method); add("params", gson.toJsonTree(params ?: emptyMap<String, Any>())) })) {
            pending.remove(id); f.completeExceptionally(IllegalStateException("the engine is not running"))
        }
        return f
    }

    fun notify(method: String, params: Any? = null) {
        send(JsonObject().apply { addProperty("method", method); add("params", gson.toJsonTree(params ?: emptyMap<String, Any>())) })
    }

    private fun send(o: JsonObject): Boolean = synchronized(out) {
        if (closed) return false
        try { out.write((o.toString() + "\n").toByteArray(Charsets.UTF_8)); out.flush(); true }
        catch (_: Exception) { false }
    }

    private fun readLoop() {
        val input = DataInputStream(process.inputStream.buffered(1 shl 16))
        val head = ByteArray(5)
        try {
            while (true) {
                input.readFully(head)
                val len = (head[1].toInt() and 255) or ((head[2].toInt() and 255) shl 8) or
                    ((head[3].toInt() and 255) shl 16) or ((head[4].toInt() and 255) shl 24)
                val payload = ByteArray(len)
                input.readFully(payload)
                when (head[0].toInt()) {
                    1 -> handleJson(String(payload, Charsets.UTF_8))
                    2 -> {
                        val frames = (payload[0].toInt() and 255) or ((payload[1].toInt() and 255) shl 8) or
                            ((payload[2].toInt() and 255) shl 16) or ((payload[3].toInt() and 255) shl 24)
                        onAudio(payload.copyOfRange(4, payload.size), frames)
                    }
                }
            }
        } catch (_: EOFException) {
        } catch (_: Exception) {
        }
        closed = true
        val code = try { process.waitFor() } catch (_: InterruptedException) { -1 }
        for (f in pending.values) f.completeExceptionally(IllegalStateException("the engine stopped"))
        pending.clear()
        onExit(code, stderr.toString().takeLast(2000))
    }

    private fun handleJson(text: String) {
        val o = try { JsonParser.parseString(text).asJsonObject } catch (_: Exception) { return }
        val id = o.get("id")
        if (id != null && !id.isJsonNull) {
            val f = pending.remove(id.asInt) ?: return
            val err = o.get("error")
            if (err != null && !err.isJsonNull) f.completeExceptionally(EngineError(err.asJsonObject.get("message")?.asString ?: "error"))
            else f.complete(o.get("result") ?: com.google.gson.JsonNull.INSTANCE)
            return
        }
        val method = o.get("method")?.asString ?: return
        onNotify(method, o.getAsJsonObject("params") ?: JsonObject())
    }

    fun close() {
        if (closed) return
        try { send(JsonObject().apply { addProperty("method", "shutdown") }) } catch (_: Exception) {}
        closed = true
        try { out.close() } catch (_: Exception) {}
        if (!process.waitFor(500, java.util.concurrent.TimeUnit.MILLISECONDS)) process.destroy()
    }
}

class EngineError(message: String) : RuntimeException(message)
