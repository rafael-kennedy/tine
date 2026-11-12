package tine.intellij.settings

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.configurations.PathEnvironmentVariableUtil
import com.intellij.execution.util.ExecUtil
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.util.SystemInfo
import java.io.File

@Service(Service.Level.APP)
@State(name = "TineSettings", storages = [Storage("tine.xml")])
class TineSettings : PersistentStateComponent<TineSettings.State> {
    class State {
        /** Path to the tine executable. Empty means find it automatically. */
        var tinePath: String = ""
    }

    private var state = State()
    override fun getState() = state
    override fun loadState(s: State) { state = s }

    companion object {
        fun get(): TineSettings = ApplicationManager.getApplication().getService(TineSettings::class.java)
    }
}

/** Finds the tine CLI: the path in Settings, then PATH, then the usual install places. */
object TineCli {
    private fun candidates(): List<String> {
        val home = System.getProperty("user.home")
        return if (SystemInfo.isWindows) listOf(
            "$home\\AppData\\Local\\Programs\\tine\\tine.exe", "$home\\.bun\\bin\\tine.exe", "$home\\bin\\tine.exe",
        ) else listOf(
            // Tine.app from the DMG keeps the CLI in Contents/Helpers
            "/Applications/Tine.app/Contents/Helpers/tine", "$home/Applications/Tine.app/Contents/Helpers/tine",
            "/opt/homebrew/bin/tine", "/usr/local/bin/tine", "$home/.local/bin/tine", "$home/bin/tine", "$home/.bun/bin/tine",
        )
    }

    fun find(): File? {
        val configured = TineSettings.get().state.tinePath.trim()
        if (configured.isNotEmpty()) return File(configured).takeIf { it.canExecute() }
        return PathEnvironmentVariableUtil.findInPath(if (SystemInfo.isWindows) "tine.exe" else "tine")
            ?: candidates().map(::File).firstOrNull { it.canExecute() }
    }

    fun commandLine(vararg args: String): GeneralCommandLine? {
        val exe = find() ?: return null
        return GeneralCommandLine(exe.absolutePath, *args)
            .withCharset(Charsets.UTF_8)
            .withParentEnvironmentType(GeneralCommandLine.ParentEnvironmentType.CONSOLE)
    }

    /** "tine 1.3.1", or an error message. Blocks: call off the UI thread. */
    fun version(exe: File): String = try {
        val out = ExecUtil.execAndGetOutput(GeneralCommandLine(exe.absolutePath, "--version"), 5000)
        if (out.exitCode == 0) out.stdout.trim() else "exited with ${out.exitCode}: ${out.stderr.trim()}"
    } catch (e: Exception) {
        "could not run: ${e.message}"
    }

    const val NOT_FOUND = "The tine command was not found. Install Tine (the DMG puts it in /Applications/Tine.app) " +
        "or set its path in Settings | Languages & Frameworks | Tine."
}
