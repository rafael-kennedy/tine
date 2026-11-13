package tine.intellij.engine

import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import javax.sound.sampled.AudioFormat
import javax.sound.sampled.AudioSystem
import javax.sound.sampled.SourceDataLine

/** Where audio goes. The real one is a Java Sound line; tests use a fake. */
interface AudioSink {
    /** Opens the device. Returns its buffer size in frames. */
    fun open(sampleRate: Int): Int
    /** Blocks until the device has room: this is what paces the engine. */
    fun write(pcm: ByteArray)
    /** Frames written but not yet heard. */
    fun queued(): Int
    fun close()
}

class JavaSoundSink : AudioSink {
    private var line: SourceDataLine? = null
    private var bytes = 0
    override fun open(sampleRate: Int): Int {
        val format = AudioFormat(sampleRate.toFloat(), 16, 2, true, false)
        val l = AudioSystem.getSourceDataLine(format)
        // about 70 ms of device buffer: small enough to feel live, big enough not to crackle
        l.open(format, (sampleRate * 0.07).toInt() * 4)
        l.start()
        line = l; bytes = l.bufferSize
        return bytes / 4
    }
    override fun write(pcm: ByteArray) { line?.write(pcm, 0, pcm.size) }
    override fun queued(): Int = line?.let { (bytes - it.available()) / 4 } ?: 0
    override fun close() { line?.let { try { it.stop(); it.flush(); it.close() } catch (_: Exception) {} }; line = null }
}

/**
 * Pulls audio from the engine and plays it. The engine renders only what is
 * asked for, so the sound card sets the pace and nothing drifts. A few blocks
 * are kept in flight so a slow block (a big chord of pads) does not crackle.
 *
 * If the device fails (unplugged, sleep), the line is reopened after a pause;
 * the engine keeps its place, so the music picks up where the clock is.
 */
class AudioOut(
    private val pull: (frames: Int) -> Unit,
    private val sampleRate: Int = 44100,
    private val sink: () -> AudioSink = { JavaSoundSink() },
    private val block: Int = 512,
    private val inFlightBlocks: Int = 6,
    private val onProblem: (String) -> Unit = {},
) {
    private val queue = LinkedBlockingQueue<ByteArray>()
    @Volatile private var running = false
    // blocks asked of the engine, and blocks handed to the device; the gap is
    // what is in flight or queued here, and is kept small so the engine stays
    // only a few blocks ahead of the speaker
    @Volatile private var requested = 0
    @Volatile private var played = 0
    private var thread: Thread? = null

    /** Engine frames handed to the device so far. */
    @Volatile var framesWritten = 0L; private set
    /** Frames the device still holds: what is written but not yet heard. */
    @Volatile var deviceQueued = 0; private set
    /** Blocks that arrived after the device had already run dry. */
    @Volatile var underruns = 0; private set

    val isRunning get() = running
    /** Blocks asked for and not yet played. */
    val inFlight get() = requested - played

    /** Called by the engine client for each audio frame. */
    fun accept(pcm: ByteArray, frames: Int) { queue.offer(pcm) }

    fun start() {
        if (running) return
        running = true
        thread = Thread({ loop() }, "tine-audio-out").apply { isDaemon = true; priority = Thread.MAX_PRIORITY; start() }
    }

    fun stop() {
        running = false
        thread?.interrupt()
        thread = null
    }

    private fun loop() {
        var failures = 0
        while (running) {
            val s = sink()
            try {
                s.open(sampleRate)
                failures = 0
                while (running) {
                    while (requested - played < inFlightBlocks) { requested++; pull(block) }
                    val pcm = queue.poll(250, TimeUnit.MILLISECONDS) ?: continue
                    if (s.queued() == 0 && framesWritten > 0) underruns++
                    s.write(pcm)
                    played++
                    framesWritten += pcm.size / 4
                    deviceQueued = s.queued()
                }
            } catch (_: InterruptedException) {
                break
            } catch (e: Exception) {
                failures++
                onProblem("audio output: ${e.message ?: e.javaClass.simpleName}")
                try { Thread.sleep(minOf(5000L, 250L * failures)) } catch (_: InterruptedException) { break }
            } finally {
                s.close()
            }
        }
        // blocks still on their way are played first on the next start: they continue the same timeline
        requested = played + queue.size
    }
}
