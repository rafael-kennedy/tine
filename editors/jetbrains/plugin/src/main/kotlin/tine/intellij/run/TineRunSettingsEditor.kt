package tine.intellij.run

import com.intellij.openapi.fileChooser.FileChooserDescriptorFactory
import com.intellij.openapi.options.SettingsEditor
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.ComboBox
import com.intellij.openapi.ui.TextFieldWithBrowseButton
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import javax.swing.JComponent

class TineRunSettingsEditor(project: Project) : SettingsEditor<TineRunConfiguration>() {
    private val command = ComboBox(TineCommand.entries.toTypedArray())
    private val file = TextFieldWithBrowseButton().apply {
        addBrowseFolderListener(project, FileChooserDescriptorFactory.createSingleFileDescriptor("tine").withTitle("Choose a Tine Piece"))
    }
    private val args = JBTextField()

    override fun resetEditorFrom(c: TineRunConfiguration) {
        command.selectedItem = c.command
        file.text = c.file
        args.text = c.args
    }

    override fun applyEditorTo(c: TineRunConfiguration) {
        c.command = command.selectedItem as? TineCommand ?: TineCommand.DAW
        c.file = file.text.trim()
        c.args = args.text.trim()
    }

    override fun createEditor(): JComponent = FormBuilder.createFormBuilder()
        .addLabeledComponent("Command:", command)
        .addLabeledComponent("File:", file)
        .addLabeledComponent("Arguments:", args)
        .addComponentToRightColumn(JBLabel("For example --bars 16, --seed 42, -o out.wav, --a4 --jazz"))
        .panel
}
