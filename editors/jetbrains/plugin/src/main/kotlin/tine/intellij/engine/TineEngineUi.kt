package tine.intellij.engine

import com.intellij.codeInsight.hint.HintManager
import com.intellij.icons.AllIcons
import com.intellij.lang.annotation.AnnotationHolder
import com.intellij.lang.annotation.ExternalAnnotator
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.openapi.actionSystem.ActionPromoter
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.actionSystem.DataContext
import com.intellij.openapi.actionSystem.Presentation
import com.intellij.openapi.actionSystem.ex.CustomComponentAction
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.HighlighterTargetArea
import com.intellij.openapi.editor.markup.TextAttributes
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.util.TextRange
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory
import com.intellij.psi.PsiFile
import com.intellij.ui.JBColor
import com.intellij.ui.components.JBLabel
import com.intellij.util.ui.JBUI
import tine.intellij.lang.TineFileType
import java.awt.Font
import java.util.Locale
import javax.swing.JComponent
import javax.swing.Timer

// ---------- helpers ----------

private fun tineFile(e: AnActionEvent): VirtualFile? {
    e.getData(CommonDataKeys.VIRTUAL_FILE)?.takeIf { it.fileType == TineFileType }?.let { return it }
    val project = e.project ?: return null
    return FileEditorManager.getInstance(project).selectedFiles.firstOrNull { it.fileType == TineFileType }
}

private fun pooled(f: () -> Unit) = ApplicationManager.getApplication().executeOnPooledThread(f)

/** The transport shows once the project has a Tine file open, or music is playing. */
private fun relevant(project: Project?): Boolean {
    project ?: return false
    if (project.getServiceIfCreated(TineEngine::class.java)?.state?.running == true) return true
    return FileEditorManager.getInstance(project).openFiles.any { it.fileType == TineFileType }
}

/** "12.3" for bar 12, beat 3. */
fun positionText(bar: Double, beats: Int): String =
    "${kotlin.math.floor(bar).toInt() + 1}.${kotlin.math.floor((bar - kotlin.math.floor(bar)) * beats).toInt() + 1}"

/** Every Tine performance action, so the promoter can put them first in Tine files. */
interface TineEngineAction

// ---------- actions ----------

/** Cmd+Enter: hear the code as it is in the editor, at the next bar. Starts playing if stopped. */
class TineEvaluateAction : AnAction(), DumbAware, TineEngineAction {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT
    override fun update(e: AnActionEvent) { e.presentation.isEnabledAndVisible = tineFile(e) != null }
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val file = tineFile(e) ?: return
        pooled { TineEngine.get(project).evaluate(file) }
    }
}

/** Cmd+Shift+Enter: hear this file on its own, even when it is a part of a bigger piece. */
class TineAuditionAction : AnAction(), DumbAware, TineEngineAction {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT
    override fun update(e: AnActionEvent) { e.presentation.isEnabledAndVisible = tineFile(e) != null }
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val file = tineFile(e) ?: return
        pooled { TineEngine.get(project).auditionAlone(file) }
    }
}

class TinePlayStopAction : AnAction(), DumbAware, TineEngineAction {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT
    override fun update(e: AnActionEvent) {
        val project = e.project
        val playing = project?.getServiceIfCreated(TineEngine::class.java)?.state?.playing == true
        e.presentation.isVisible = relevant(project)
        e.presentation.isEnabled = playing || tineFile(e) != null
        e.presentation.icon = if (playing) AllIcons.Actions.Suspend else AllIcons.Actions.Execute
        e.presentation.text = if (playing) "Stop" else "Play"
        e.presentation.description = if (playing) "Stop the music (tails ring out)" else "Play this piece in the IDE"
    }
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val file = tineFile(e)
        pooled { TineEngine.get(project).togglePlay(file) }
    }
}

/** Cmd+. : stop. */
class TineStopAction : AnAction(), DumbAware, TineEngineAction {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT
    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project?.getServiceIfCreated(TineEngine::class.java)?.state?.playing == true
    }
    override fun actionPerformed(e: AnActionEvent) { e.project?.let { p -> pooled { TineEngine.get(p).stop() } } }
}

/** Cycles when new code takes over: at the bar line, on the beat, or at once. */
class TineQuantizeAction : AnAction(), DumbAware, TineEngineAction {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT
    override fun update(e: AnActionEvent) {
        val q = e.project?.getServiceIfCreated(TineEngine::class.java)?.state?.quantize ?: "bar"
        e.presentation.isVisible = relevant(e.project)
        e.presentation.text = "Swap: $q"
        e.presentation.description = "When Cmd+Enter takes effect: next bar, next beat, or now. Click to change."
    }
    override fun actionPerformed(e: AnActionEvent) {
        val engine = TineEngine.get(e.project ?: return)
        val next = when (engine.state.quantize) { "bar" -> "beat"; "beat" -> "now"; else -> "bar" }
        pooled { engine.setQuantize(next) }
    }
}

/** Bar.beat, tempo, section, and whether new code is waiting for the bar. */
class TinePositionAction : AnAction(), CustomComponentAction, DumbAware {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT
    override fun actionPerformed(e: AnActionEvent) {}
    override fun update(e: AnActionEvent) {
        e.presentation.isVisible = relevant(e.project)
        e.presentation.putClientProperty(PROJECT, e.project)
    }

    companion object { private val PROJECT = com.intellij.openapi.util.Key.create<Project>("tine.position.project") }

    override fun createCustomComponent(presentation: Presentation, place: String): JComponent {
        val label = JBLabel("1.1").apply {
            border = JBUI.Borders.empty(0, 6)
            font = Font(Font.MONOSPACED, Font.PLAIN, font.size)
        }
        // the label redraws itself from the engine 20 times a second
        val timer = Timer(50) {
            val project = presentation.getClientProperty(PROJECT)
            val engine = project?.getServiceIfCreated(TineEngine::class.java)
            val s = engine?.state
            if (s == null) { label.text = "1.1"; return@Timer }
            val pos = positionText(engine.heardBar(), s.meter.first)
            val tempo = String.format(Locale.ROOT, "%.0f", s.tempo)
            label.text = buildString {
                append(pos); append("  ").append(tempo).append(" bpm")
                if (s.section != null) append("  ").append(s.section)
                if (s.pending) append("  ⏳")
            }
            label.foreground = when {
                s.pending -> JBColor.ORANGE
                s.playing -> JBColor.foreground()
                else -> JBColor.GRAY
            }
            label.toolTipText = buildString {
                append(if (s.playing) "Playing" else "Stopped")
                if (s.main != null) append(" ").append(s.main!!.substringAfterLast('/'))
                if (s.pending) append(". New code waits for the next ${s.quantize}")
                if (engine.underruns > 0) append(". ${engine.underruns} late blocks")
            }
        }
        timer.start()
        label.addHierarchyListener { if (!label.isShowing) timer.stop() else if (!timer.isRunning) timer.start() }
        return label
    }
}

/** In a Tine file, Cmd+Enter and Cmd+. are Tine's, ahead of the IDE's own bindings. */
class TineActionPromoter : ActionPromoter {
    override fun promote(actions: List<AnAction>, context: DataContext): List<AnAction> {
        val file = CommonDataKeys.VIRTUAL_FILE.getData(context) ?: return emptyList()
        if (file.fileType != TineFileType) return emptyList()
        return actions.filter { it is TineEngineAction }
    }
}

// ---------- editor feedback ----------

/** Errors that only happen while the music plays, from the engine, in the file they belong to. */
class TineEngineAnnotator : ExternalAnnotator<PsiFile, List<EngineProblem>>() {
    override fun collectInformation(file: PsiFile): PsiFile = file
    override fun doAnnotate(file: PsiFile): List<EngineProblem> {
        val path = file.virtualFile?.path ?: return emptyList()
        return file.project.getServiceIfCreated(TineEngine::class.java)?.runtimeProblems(path) ?: emptyList()
    }
    override fun apply(file: PsiFile, problems: List<EngineProblem>, holder: AnnotationHolder) {
        val doc = file.viewProvider.document ?: return
        for (p in problems) {
            if (p.line >= doc.lineCount) continue
            val start = (doc.getLineStartOffset(p.line) + p.col).coerceAtMost(doc.getLineEndOffset(p.line))
            val endLine = p.endLine.coerceAtMost(doc.lineCount - 1)
            var end = (doc.getLineStartOffset(endLine) + p.endCol).coerceAtMost(doc.textLength)
            if (end <= start) end = doc.getLineEndOffset(p.line)
            holder.newAnnotation(HighlightSeverity.WARNING, p.message + (p.hint?.let { "\n$it" } ?: ""))
                .range(TextRange(start, maxOf(end, start)))
                .tooltip("${p.message}${p.hint?.let { "<br>$it" } ?: ""}<br><i>This voice keeps playing its last good version.</i>")
                .create()
        }
    }
}

/**
 * Wires the engine to the editors of a project: typing in an active voice,
 * a flash when new code lands on the bar, a hint when code was refused.
 */
class TineEngineStartup : ProjectActivity {
    override suspend fun execute(project: Project) {
        val disposable = Disposer.newDisposable("Tine engine editors")
        Disposer.register(TineEngine.get(project), disposable)
        EditorFactory.getInstance().eventMulticaster.addDocumentListener(object : DocumentListener {
            override fun documentChanged(event: DocumentEvent) {
                project.getServiceIfCreated(TineEngine::class.java)?.documentChanged(event.document)
            }
        }, disposable)
        project.messageBus.connect(disposable).subscribe(TineEngineListener.TOPIC, object : TineEngineListener {
            override fun swapped(bar: Int) = flash(project)
            override fun refused(problems: List<EngineProblem>) {
                val editor = FileEditorManager.getInstance(project).selectedTextEditor ?: return
                val first = problems.first()
                val here = com.intellij.openapi.fileEditor.FileDocumentManager.getInstance().getFile(editor.document)?.path
                val where = if (here == first.file) "line ${first.line + 1}" else "${first.file.substringAfterLast('/')} line ${first.line + 1}"
                val playing = TineEngine.get(project).state.playing
                HintManager.getInstance().showErrorHint(editor,
                    "$where: ${first.message}" + (if (playing) "\nThe last good version keeps playing." else ""))
            }
        })
    }

    /** A short wash over each open file of the piece as new code takes over. */
    private fun flash(project: Project) {
        val engine = TineEngine.get(project)
        val attrs = TextAttributes().apply { backgroundColor = JBColor(0xFFF3C4, 0x3D3A28) }
        for (editor in EditorFactory.getInstance().allEditors) {
            if (editor.project != project) continue
            val vf = com.intellij.openapi.fileEditor.FileDocumentManager.getInstance().getFile(editor.document) ?: continue
            if (vf.path !in engine.state.files) continue
            val h = editor.markupModel.addRangeHighlighter(0, editor.document.textLength, HighlighterLayer.SELECTION - 1, attrs, HighlighterTargetArea.EXACT_RANGE)
            Timer(180) { if (h.isValid) editor.markupModel.removeHighlighter(h) }.apply { isRepeats = false; start() }
        }
    }
}

// ---------- status bar ----------

class TineStatusWidgetFactory : StatusBarWidgetFactory {
    override fun getId() = "Tine.Transport"
    override fun getDisplayName() = "Tine Transport"
    override fun isAvailable(project: Project) = true
    override fun createWidget(project: Project): StatusBarWidget = TineStatusWidget(project)
}

private class TineStatusWidget(private val project: Project) : StatusBarWidget, StatusBarWidget.TextPresentation {
    private var bar: StatusBar? = null
    private val timer = Timer(100) { bar?.updateWidget(ID()) }
    override fun ID() = "Tine.Transport"
    override fun install(statusBar: StatusBar) { bar = statusBar; timer.start() }
    override fun dispose() { timer.stop(); bar = null }
    override fun getPresentation() = this
    override fun getAlignment() = 0f
    override fun getTooltipText() = "Tine: bar.beat and section"
    override fun getText(): String {
        val engine = project.getServiceIfCreated(TineEngine::class.java) ?: return ""
        val s = engine.state
        if (!s.playing) return ""
        return "♪ " + positionText(engine.heardBar(), s.meter.first) + (s.section?.let { "  $it" } ?: "")
    }
}
