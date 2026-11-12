package tine.intellij.run

import com.intellij.execution.lineMarker.ExecutorAction
import com.intellij.execution.lineMarker.RunLineMarkerContributor
import com.intellij.icons.AllIcons
import com.intellij.psi.PsiComment
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiWhiteSpace
import com.intellij.psi.util.PsiTreeUtil
import tine.intellij.lang.TineFile

/** A run icon on the first line of code in a .tine file. */
class TineRunLineMarkerContributor : RunLineMarkerContributor() {
    override fun getInfo(element: PsiElement): Info? {
        if (element.firstChild != null) return null
        val file = element.containingFile as? TineFile ?: return null
        var first: PsiElement? = PsiTreeUtil.firstChild(file)
        while (first != null && (first is PsiWhiteSpace || first is PsiComment)) first = PsiTreeUtil.nextLeaf(first)
        if (first != element) return null
        return Info(AllIcons.RunConfigurations.TestState.Run, ExecutorAction.getActions(0), java.util.function.Function { "Run ${file.name}" })
    }
}
