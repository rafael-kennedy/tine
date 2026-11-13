package tine.intellij.run

import com.intellij.execution.lineMarker.ExecutorAction
import com.intellij.execution.lineMarker.RunLineMarkerContributor
import com.intellij.icons.AllIcons
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.Separator
import com.intellij.psi.PsiComment
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiWhiteSpace
import com.intellij.psi.util.PsiTreeUtil
import tine.intellij.lang.TineFile

/** A play icon on the first line of code in a .tine file. */
class TineRunLineMarkerContributor : RunLineMarkerContributor() {
    override fun getInfo(element: PsiElement): Info? {
        if (element.firstChild != null) return null
        val file = element.containingFile as? TineFile ?: return null
        var first: PsiElement? = PsiTreeUtil.firstChild(file)
        while (first != null && (first is PsiWhiteSpace || first is PsiComment)) first = PsiTreeUtil.nextLeaf(first)
        if (first != element) return null
        // first: play here in the IDE; then the run configurations (DAW, render, ...)
        val play = ActionManager.getInstance().getAction("Tine.Engine.Evaluate")
        val actions = listOfNotNull(play, Separator.getInstance()).toTypedArray() + ExecutorAction.getActions(0)
        return Info(AllIcons.RunConfigurations.TestState.Run, actions, java.util.function.Function { "Play ${file.name}" })
    }
}
