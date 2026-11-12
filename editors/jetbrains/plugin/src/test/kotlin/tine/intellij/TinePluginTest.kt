package tine.intellij

import com.intellij.codeInsight.template.impl.TemplateSettings
import com.intellij.openapi.actionSystem.IdeActions
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import tine.intellij.lang.TineFileType
import tine.intellij.run.TineCommand
import tine.intellij.run.TineRunConfiguration
import tine.intellij.run.TineRunConfigurationType

class TinePluginTest : BasePlatformTestCase() {
    fun testFileTypeAndComment() {
        myFixture.configureByText("piece.tine", "voice a = [c e g]<caret>")
        assertEquals(TineFileType, myFixture.file.fileType)
        myFixture.performEditorAction(IdeActions.ACTION_COMMENT_LINE)
        myFixture.checkResult("-- voice a = [c e g]")
    }

    fun testBracesPair() {
        myFixture.configureByText("piece.tine", "voice a = <caret>")
        myFixture.type("[")
        myFixture.checkResult("voice a = [<caret>]")
    }

    fun testLiveTemplatesLoaded() {
        val t = TemplateSettings.getInstance().getTemplate("fast", "Tine functions")
        assertNotNull("Tine functions templates missing", t)
        assertTrue(t!!.description!!.contains("fast(p, n)"))
        assertNotNull(TemplateSettings.getInstance().getTemplate("piece", "Tine statements"))
    }

    fun testLiveTemplateExpandsInTineFilesOnly() {
        myFixture.configureByText("piece.tine", "voice a = [c e g].fast<caret>")
        myFixture.performEditorAction(IdeActions.ACTION_EXPAND_LIVE_TEMPLATE_BY_TAB)
        assertTrue(myFixture.editor.document.text, myFixture.editor.document.text.startsWith("voice a = [c e g].fast(n)"))
        myFixture.configureByText("notes.txt", "fast<caret>")
        myFixture.performEditorAction(IdeActions.ACTION_EXPAND_LIVE_TEMPLATE_BY_TAB)
        assertFalse(myFixture.editor.document.text.contains("fast("))
    }

    fun testRunConfigurationFromFile() {
        val file = myFixture.configureByText("groove.tine", "tempo 96").virtualFile
        val c = TineRunConfiguration(project, TineRunConfigurationType.get().configurationFactories[0], "x")
        c.file = file.path; c.command = TineCommand.SCORE
        assertEquals("groove.tine (score)", c.suggestedName())
        assertEquals(TineCommand.SCORE, c.command)
    }
}
