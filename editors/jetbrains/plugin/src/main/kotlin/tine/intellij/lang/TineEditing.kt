package tine.intellij.lang

import com.intellij.codeInsight.editorActions.SimpleTokenSetQuoteHandler
import com.intellij.codeInsight.template.TemplateActionContext
import com.intellij.codeInsight.template.TemplateContextType
import com.intellij.lang.BracePair
import com.intellij.lang.Commenter
import com.intellij.lang.PairedBraceMatcher
import com.intellij.psi.PsiFile
import com.intellij.psi.tree.IElementType

class TineCommenter : Commenter {
    override fun getLineCommentPrefix() = "-- "
    override fun getBlockCommentPrefix(): String? = null
    override fun getBlockCommentSuffix(): String? = null
    override fun getCommentedBlockCommentPrefix(): String? = null
    override fun getCommentedBlockCommentSuffix(): String? = null
}

class TineBraceMatcher : PairedBraceMatcher {
    override fun getPairs() = arrayOf(
        BracePair(TineTokens.LPAREN, TineTokens.RPAREN, false),
        BracePair(TineTokens.LBRACKET, TineTokens.RBRACKET, false),
        BracePair(TineTokens.LBRACE, TineTokens.RBRACE, true),
    )
    override fun isPairedBracesAllowedBeforeType(lbraceType: IElementType, contextType: IElementType?) = true
    override fun getCodeConstructStart(file: PsiFile?, openingBraceOffset: Int) = openingBraceOffset
}

class TineQuoteHandler : SimpleTokenSetQuoteHandler(TineTokens.STRING)

/** Live templates marked "Tine" apply in .tine files only. */
class TineTemplateContextType : TemplateContextType("Tine") {
    override fun isInContext(context: TemplateActionContext) = context.file.fileType == TineFileType
}
