package tine.intellij.actions

import com.intellij.execution.ProgramRunnerUtil
import com.intellij.execution.RunManager
import com.intellij.execution.executors.DefaultRunExecutor
import com.intellij.ide.actions.CreateFileFromTemplateAction
import com.intellij.ide.actions.CreateFileFromTemplateDialog
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.psi.PsiDirectory
import tine.intellij.lang.TineFileType
import tine.intellij.lang.TineIcons
import tine.intellij.run.TineCommand
import tine.intellij.run.TineRunConfiguration
import tine.intellij.run.TineRunConfigurationType

/** Runs a tine command on the current .tine file through a temporary run configuration. */
abstract class TineCommandAction(private val command: TineCommand) : AnAction() {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT

    private fun tineFile(e: AnActionEvent): VirtualFile? =
        e.getData(CommonDataKeys.VIRTUAL_FILE)?.takeIf { it.fileType == TineFileType }

    override fun update(e: AnActionEvent) {
        val ok = e.project != null && (!command.needsFile || tineFile(e) != null)
        e.presentation.isEnabled = ok
        // In context menus, show the file actions only on .tine files
        if (e.isFromContextMenu) e.presentation.isVisible = ok
    }

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        FileDocumentManager.getInstance().saveAllDocuments()
        run(project, command, tineFile(e))
    }

    companion object {
        fun run(project: Project, command: TineCommand, file: VirtualFile?) {
            val rm = RunManager.getInstance(project)
            val settings = rm.createConfiguration("", TineRunConfigurationType.get().configurationFactories[0])
            val c = settings.configuration as TineRunConfiguration
            c.command = command
            if (file != null && command != TineCommand.LEARN && command != TineCommand.THEORY) c.file = file.path
            settings.name = c.suggestedName()
            rm.setTemporaryConfiguration(settings)
            ProgramRunnerUtil.executeConfiguration(settings, DefaultRunExecutor.getRunExecutorInstance())
        }
    }
}

class TineDawAction : TineCommandAction(TineCommand.DAW)
class TinePlayAction : TineCommandAction(TineCommand.PLAY)
class TineRenderAction : TineCommandAction(TineCommand.RENDER)
class TineMidiAction : TineCommandAction(TineCommand.MIDI)
class TineXmlAction : TineCommandAction(TineCommand.XML)
class TineScoreAction : TineCommandAction(TineCommand.SCORE)
class TineLeadAction : TineCommandAction(TineCommand.LEAD)
class TineChartAction : TineCommandAction(TineCommand.CHART)
class TineCheckAction : TineCommandAction(TineCommand.CHECK)
class TineRollAction : TineCommandAction(TineCommand.ROLL)
class TinePackAction : TineCommandAction(TineCommand.PACK)
class TineLearnAction : TineCommandAction(TineCommand.LEARN)
class TineTheoryAction : TineCommandAction(TineCommand.THEORY)

class NewTineFileAction : CreateFileFromTemplateAction() {
    override fun buildDialog(project: Project, directory: PsiDirectory, builder: CreateFileFromTemplateDialog.Builder) {
        builder.setTitle("New Tine Piece").addKind("Piece", TineIcons.FILE, "Tine Piece")
    }
    override fun getActionName(directory: PsiDirectory?, newName: String, templateName: String?) = "Create Tine piece $newName"
}
