package tine.intellij.lang

import com.intellij.extapi.psi.ASTWrapperPsiElement
import com.intellij.extapi.psi.PsiFileBase
import com.intellij.lang.ASTNode
import com.intellij.lang.ParserDefinition
import com.intellij.lang.PsiBuilder
import com.intellij.lang.PsiParser
import com.intellij.openapi.project.Project
import com.intellij.psi.FileViewProvider
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.tree.IElementType
import com.intellij.psi.tree.IFileElementType
import com.intellij.psi.tree.TokenSet

class TineFile(viewProvider: FileViewProvider) : PsiFileBase(viewProvider, TineLanguage) {
    override fun getFileType() = TineFileType
    override fun toString() = "Tine file"
}

/**
 * The PSI tree is flat on purpose: one file node holding the tokens. Structure,
 * errors and meaning come from the language server, which runs the real parser,
 * so there is only one Tine grammar to maintain.
 */
class TineParserDefinition : ParserDefinition {
    override fun createLexer(project: Project?) = TineLexer()
    override fun getCommentTokens(): TokenSet = TineTokens.COMMENTS
    override fun getStringLiteralElements(): TokenSet = TineTokens.STRINGS
    override fun getWhitespaceTokens(): TokenSet = TokenSet.WHITE_SPACE
    override fun getFileNodeType(): IFileElementType = FILE
    override fun createFile(viewProvider: FileViewProvider): PsiFile = TineFile(viewProvider)
    override fun createElement(node: ASTNode): PsiElement = ASTWrapperPsiElement(node)
    override fun createParser(project: Project?): PsiParser = PsiParser { root: IElementType, builder: PsiBuilder ->
        val mark = builder.mark()
        while (!builder.eof()) builder.advanceLexer()
        mark.done(root)
        builder.treeBuilt
    }

    companion object {
        @JvmField val FILE = IFileElementType(TineLanguage)
    }
}
