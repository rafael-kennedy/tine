package tine.intellij.run

import com.intellij.execution.ExecutionException
import com.intellij.execution.Executor
import com.intellij.execution.actions.ConfigurationContext
import com.intellij.execution.actions.LazyRunConfigurationProducer
import com.intellij.execution.configurations.*
import com.intellij.execution.filters.RegexpFilter
import com.intellij.execution.process.KillableColoredProcessHandler
import com.intellij.execution.process.ProcessListener
import com.intellij.execution.process.ProcessEvent
import com.intellij.execution.process.ProcessHandler
import com.intellij.execution.process.ProcessTerminatedListener
import com.intellij.execution.runners.ExecutionEnvironment
import com.intellij.ide.BrowserUtil
import com.intellij.openapi.options.SettingsEditor
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.NotNullLazyValue
import com.intellij.openapi.util.Ref
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.psi.PsiElement
import tine.intellij.lang.TineFileType
import tine.intellij.lang.TineIcons
import tine.intellij.settings.TineCli
import java.io.File

/** A tine subcommand as the run configuration offers it. */
enum class TineCommand(val id: String, val label: String, val needsFile: Boolean = true, val output: String? = null, val opensInBrowser: Boolean = false) {
    DAW("daw", "Open in DAW (live)", needsFile = false),
    PLAY("play", "Play"),
    RENDER("render", "Render WAV", output = ".wav"),
    MIDI("midi", "Export MIDI", output = ".mid"),
    XML("xml", "Export MusicXML", output = ".musicxml"),
    SCORE("score", "Score", output = ".score.html", opensInBrowser = true),
    LEAD("lead", "Lead sheet", output = ".lead.html", opensInBrowser = true),
    CHART("chart", "Chord chart", output = ".chart.html", opensInBrowser = true),
    CHECK("check", "Check"),
    ROLL("roll", "Piano roll"),
    PACK("pack", "Pack as HTML player", output = ".html", opensInBrowser = true),
    DIRT("dirt", "Play through SuperDirt"),
    REPL("repl", "REPL", needsFile = false),
    LEARN("learn", "Open the tutorial", needsFile = false),
    THEORY("theory", "Open the theory course", needsFile = false);

    override fun toString() = label

    companion object {
        fun of(id: String) = entries.firstOrNull { it.id == id } ?: DAW
    }
}

class TineRunConfigurationType : ConfigurationTypeBase(
    ID, "Tine", "Run a Tine piece: DAW, play, render, export", NotNullLazyValue.createValue { TineIcons.FILE },
) {
    init {
        addFactory(object : ConfigurationFactory(this) {
            override fun getId() = ID
            override fun createTemplateConfiguration(project: Project): RunConfiguration = TineRunConfiguration(project, this, "Tine")
            override fun getOptionsClass() = TineRunOptions::class.java
        })
    }

    companion object {
        const val ID = "TineRunConfiguration"
        fun get(): TineRunConfigurationType = ConfigurationTypeUtil.findConfigurationType(TineRunConfigurationType::class.java)
    }
}

class TineRunOptions : LocatableRunConfigurationOptions() {
    private val fileProp = string("").provideDelegate(this, "file")
    private val commandProp = string("daw").provideDelegate(this, "command")
    private val argsProp = string("").provideDelegate(this, "args")

    var file: String
        get() = fileProp.getValue(this) ?: ""
        set(v) { fileProp.setValue(this, v) }
    var command: String
        get() = commandProp.getValue(this) ?: "daw"
        set(v) { commandProp.setValue(this, v) }
    var args: String
        get() = argsProp.getValue(this) ?: ""
        set(v) { argsProp.setValue(this, v) }
}

class TineRunConfiguration(project: Project, factory: ConfigurationFactory, name: String) :
    LocatableConfigurationBase<TineRunOptions>(project, factory, name) {

    private val opts get() = options as TineRunOptions
    var file: String
        get() = opts.file
        set(v) { opts.file = v }
    var command: TineCommand
        get() = TineCommand.of(opts.command)
        set(v) { opts.command = v.id }
    var args: String
        get() = opts.args
        set(v) { opts.args = v }

    override fun getConfigurationEditor(): SettingsEditor<out RunConfiguration> = TineRunSettingsEditor(project)

    override fun suggestedName(): String =
        if (file.isBlank()) command.label else "${File(file).name} (${command.label.lowercase()})"

    override fun checkConfiguration() {
        if (TineCli.find() == null) throw RuntimeConfigurationError(TineCli.NOT_FOUND)
        if (command.needsFile && file.isBlank()) throw RuntimeConfigurationError("Choose a .tine file.")
        if (file.isNotBlank() && !File(file).isFile) throw RuntimeConfigurationError("$file does not exist.")
    }

    override fun getState(executor: Executor, environment: ExecutionEnvironment): RunProfileState {
        val state = object : CommandLineState(environment) {
            override fun startProcess(): ProcessHandler {
                val argv = buildList {
                    add(command.id)
                    if (file.isNotBlank() && command != TineCommand.LEARN && command != TineCommand.THEORY) add(file)
                    addAll(com.intellij.util.execution.ParametersListUtil.parse(args))
                }
                val cl = TineCli.commandLine(*argv.toTypedArray()) ?: throw ExecutionException(TineCli.NOT_FOUND)
                File(file).parentFile?.takeIf { file.isNotBlank() && it.isDirectory }?.let { cl.withWorkDirectory(it) }
                    ?: project.basePath?.let { cl.withWorkDirectory(it) }
                val handler = KillableColoredProcessHandler(cl)
                ProcessTerminatedListener.attach(handler)
                handler.addProcessListener(object : ProcessListener {
                    override fun processTerminated(event: ProcessEvent) = onFinished(event.exitCode)
                })
                return handler
            }
        }
        // Make "--> piece.tine:4:12" in error messages clickable.
        state.addConsoleFilters(RegexpFilter(project, "--> \$FILE_PATH\$:\$LINE\$:\$COLUMN\$"))
        return state
    }

    private fun onFinished(exitCode: Int) {
        val ext = command.output ?: return
        if (exitCode != 0 || file.isBlank()) return
        val custom = Regex("(?:^|\\s)-o\\s+(\\S+)").find(args)?.groupValues?.get(1)
        val out = custom?.let { File(it).let { f -> if (f.isAbsolute) f else File(File(file).parentFile, it) } }
            ?: File(File(file).parentFile, File(file).nameWithoutExtension + ext)
        LocalFileSystem.getInstance().refreshIoFiles(listOf(out), true, false, null)
        if (command.opensInBrowser && out.isFile && out.extension == "html") BrowserUtil.browse(out)
    }
}

/** Right-click a .tine file, or the gutter icon, and Run opens it in the DAW. */
class TineRunConfigurationProducer : LazyRunConfigurationProducer<TineRunConfiguration>() {
    override fun getConfigurationFactory(): ConfigurationFactory = TineRunConfigurationType.get().configurationFactories[0]

    override fun setupConfigurationFromContext(configuration: TineRunConfiguration, context: ConfigurationContext, sourceElement: Ref<PsiElement>): Boolean {
        val vf = context.location?.virtualFile ?: return false
        if (vf.fileType != TineFileType) return false
        configuration.file = vf.path
        configuration.command = TineCommand.DAW
        configuration.setGeneratedName()
        return true
    }

    override fun isConfigurationFromContext(configuration: TineRunConfiguration, context: ConfigurationContext): Boolean {
        val vf = context.location?.virtualFile ?: return false
        return configuration.file == vf.path && configuration.command == TineCommand.DAW && configuration.args.isBlank()
    }
}
