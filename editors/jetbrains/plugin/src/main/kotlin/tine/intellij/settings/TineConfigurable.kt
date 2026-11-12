package tine.intellij.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.ModalityState
import com.intellij.openapi.fileChooser.FileChooserDescriptorFactory
import com.intellij.openapi.options.Configurable
import com.intellij.openapi.ui.TextFieldWithBrowseButton
import com.intellij.ui.components.JBLabel
import com.intellij.util.ui.FormBuilder
import java.io.File
import javax.swing.JButton
import javax.swing.JComponent

class TineConfigurable : Configurable {
    private val path = TextFieldWithBrowseButton()
    private val status = JBLabel()

    override fun getDisplayName() = "Tine"

    override fun createComponent(): JComponent {
        path.addBrowseFolderListener(null, FileChooserDescriptorFactory.createSingleFileNoJarsDescriptor().withTitle("Select the tine Executable"))
        val test = JButton("Test").apply { addActionListener { refresh() } }
        refresh()
        return FormBuilder.createFormBuilder()
            .addLabeledComponent("tine executable:", path)
            .addComponentToRightColumn(JBLabel("Leave empty to find it on PATH or in /Applications/Tine.app."))
            .addComponent(test)
            .addComponent(status)
            .addComponentFillVertically(javax.swing.JPanel(), 0)
            .panel
    }

    private fun refresh() {
        val typed = path.text.trim()
        val exe = if (typed.isNotEmpty()) File(typed).takeIf { it.canExecute() } else TineCli.find()
        if (exe == null) { status.text = if (typed.isNotEmpty()) "Not an executable file." else TineCli.NOT_FOUND; return }
        status.text = "Checking ${exe.path}..."
        ApplicationManager.getApplication().executeOnPooledThread {
            val v = TineCli.version(exe)
            ApplicationManager.getApplication().invokeLater({ status.text = "${exe.path}: $v" }, ModalityState.any())
        }
    }

    override fun isModified() = path.text.trim() != TineSettings.get().state.tinePath
    override fun apply() { TineSettings.get().state.tinePath = path.text.trim() }
    override fun reset() { path.text = TineSettings.get().state.tinePath; refresh() }
}
