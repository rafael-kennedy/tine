package tine.intellij.lsp

import com.intellij.execution.ExecutionException
import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Key
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.platform.lsp.api.LspServerSupportProvider
import com.intellij.platform.lsp.api.ProjectWideLspServerDescriptor
import com.intellij.notification.NotificationAction
import tine.intellij.lang.TineFileType
import tine.intellij.settings.TineCli
import tine.intellij.settings.TineConfigurable

/**
 * Completion, hover docs, signature help, diagnostics, go to definition,
 * outline, formatting and semantic highlighting all come from `tine lsp`,
 * the same server the VS Code extension and every other editor use.
 */
class TineLspServerSupportProvider : LspServerSupportProvider {
    override fun fileOpened(project: Project, file: VirtualFile, serverStarter: LspServerSupportProvider.LspServerStarter) {
        if (file.fileType != TineFileType) return
        if (TineCli.find() == null) { warnOnce(project); return }
        serverStarter.ensureServerStarted(TineLspServerDescriptor(project))
    }

    private fun warnOnce(project: Project) {
        if (project.getUserData(WARNED) == true) return
        project.putUserData(WARNED, true)
        NotificationGroupManager.getInstance().getNotificationGroup("Tine")
            .createNotification("Tine: completion and error checking are off", TineCli.NOT_FOUND, NotificationType.WARNING)
            .addAction(NotificationAction.createSimpleExpiring("Set path...") {
                ShowSettingsUtil.getInstance().showSettingsDialog(project, TineConfigurable::class.java)
            })
            .notify(project)
    }

    companion object { private val WARNED = Key.create<Boolean>("tine.lsp.warned") }
}

private class TineLspServerDescriptor(project: Project) : ProjectWideLspServerDescriptor(project, "Tine") {
    override fun isSupportedFile(file: VirtualFile) = file.fileType == TineFileType
    override fun createCommandLine(): GeneralCommandLine = TineCli.commandLine("lsp") ?: throw ExecutionException(TineCli.NOT_FOUND)
}
