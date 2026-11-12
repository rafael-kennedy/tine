package tine.intellij.lang

import com.intellij.openapi.editor.DefaultLanguageHighlighterColors as D
import com.intellij.openapi.editor.HighlighterColors
import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.editor.colors.TextAttributesKey.createTextAttributesKey
import com.intellij.openapi.fileTypes.SyntaxHighlighter
import com.intellij.openapi.fileTypes.SyntaxHighlighterBase
import com.intellij.openapi.fileTypes.SyntaxHighlighterFactory
import com.intellij.openapi.options.colors.AttributesDescriptor
import com.intellij.openapi.options.colors.ColorDescriptor
import com.intellij.openapi.options.colors.ColorSettingsPage
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.psi.tree.IElementType

object TineColors {
    @JvmField val KEYWORD = createTextAttributesKey("TINE_KEYWORD", D.KEYWORD)
    @JvmField val BUILTIN = createTextAttributesKey("TINE_BUILTIN", D.STATIC_METHOD)
    @JvmField val SOUND = createTextAttributesKey("TINE_SOUND", D.STATIC_FIELD)
    @JvmField val NOTE = createTextAttributesKey("TINE_NOTE", D.CONSTANT)
    @JvmField val DEGREE = createTextAttributesKey("TINE_DEGREE", D.CONSTANT)
    @JvmField val CHORD = createTextAttributesKey("TINE_CHORD", D.METADATA)
    @JvmField val NUMBER = createTextAttributesKey("TINE_NUMBER", D.NUMBER)
    @JvmField val STRING = createTextAttributesKey("TINE_STRING", D.STRING)
    @JvmField val COMMENT = createTextAttributesKey("TINE_COMMENT", D.LINE_COMMENT)
    @JvmField val TOGGLE = createTextAttributesKey("TINE_TOGGLE", D.DOC_COMMENT_TAG)
    @JvmField val IDENT = createTextAttributesKey("TINE_IDENT", D.IDENTIFIER)
    @JvmField val OPERATOR = createTextAttributesKey("TINE_OPERATOR", D.OPERATION_SIGN)
    @JvmField val PARENS = createTextAttributesKey("TINE_PARENS", D.PARENTHESES)
    @JvmField val BRACKETS = createTextAttributesKey("TINE_BRACKETS", D.BRACKETS)
    @JvmField val BRACES = createTextAttributesKey("TINE_BRACES", D.BRACES)
    @JvmField val COMMA = createTextAttributesKey("TINE_COMMA", D.COMMA)
    @JvmField val DOT = createTextAttributesKey("TINE_DOT", D.DOT)
    @JvmField val BAD = createTextAttributesKey("TINE_BAD_CHARACTER", HighlighterColors.BAD_CHARACTER)
}

class TineSyntaxHighlighter : SyntaxHighlighterBase() {
    override fun getHighlightingLexer() = TineLexer()

    override fun getTokenHighlights(t: IElementType?): Array<TextAttributesKey> = pack(MAP[t])

    companion object {
        private val MAP: Map<IElementType, TextAttributesKey> = with(TineTokens) {
            mapOf(
                KEYWORD to TineColors.KEYWORD, BUILTIN to TineColors.BUILTIN, SOUND to TineColors.SOUND,
                NOTE to TineColors.NOTE, DEGREE to TineColors.DEGREE, CHORD to TineColors.CHORD,
                NUMBER to TineColors.NUMBER, STRING to TineColors.STRING, COMMENT to TineColors.COMMENT,
                TOGGLE to TineColors.TOGGLE, IDENT to TineColors.IDENT, OPERATOR to TineColors.OPERATOR,
                ARROW to TineColors.OPERATOR, LPAREN to TineColors.PARENS, RPAREN to TineColors.PARENS,
                LBRACKET to TineColors.BRACKETS, RBRACKET to TineColors.BRACKETS,
                LBRACE to TineColors.BRACES, RBRACE to TineColors.BRACES,
                COMMA to TineColors.COMMA, DOT to TineColors.DOT, BAD_CHARACTER to TineColors.BAD,
            )
        }
    }
}

class TineSyntaxHighlighterFactory : SyntaxHighlighterFactory() {
    override fun getSyntaxHighlighter(project: Project?, virtualFile: VirtualFile?): SyntaxHighlighter = TineSyntaxHighlighter()
}

class TineColorSettingsPage : ColorSettingsPage {
    override fun getIcon() = TineIcons.FILE
    override fun getHighlighter(): SyntaxHighlighter = TineSyntaxHighlighter()
    override fun getDisplayName() = "Tine"
    override fun getAdditionalHighlightingTagToDescriptorMap(): Map<String, TextAttributesKey>? = null
    override fun getColorDescriptors(): Array<ColorDescriptor> = ColorDescriptor.EMPTY_ARRAY
    override fun getAttributeDescriptors() = arrayOf(
        AttributesDescriptor("Keyword", TineColors.KEYWORD),
        AttributesDescriptor("Built-in function", TineColors.BUILTIN),
        AttributesDescriptor("Scale, drum or instrument", TineColors.SOUND),
        AttributesDescriptor("Note", TineColors.NOTE),
        AttributesDescriptor("Scale degree", TineColors.DEGREE),
        AttributesDescriptor("Chord symbol", TineColors.CHORD),
        AttributesDescriptor("Number", TineColors.NUMBER),
        AttributesDescriptor("String", TineColors.STRING),
        AttributesDescriptor("Comment", TineColors.COMMENT),
        AttributesDescriptor("Performance toggle (-- @name)", TineColors.TOGGLE),
        AttributesDescriptor("Name", TineColors.IDENT),
        AttributesDescriptor("Operator", TineColors.OPERATOR),
        AttributesDescriptor("Braces and operators//Parentheses", TineColors.PARENS),
        AttributesDescriptor("Braces and operators//Brackets (sequence)", TineColors.BRACKETS),
        AttributesDescriptor("Braces and operators//Braces (stack)", TineColors.BRACES),
        AttributesDescriptor("Braces and operators//Comma", TineColors.COMMA),
        AttributesDescriptor("Braces and operators//Dot", TineColors.DOT),
        AttributesDescriptor("Bad character", TineColors.BAD),
    )

    override fun getDemoText() = """
        -- a groove in D dorian
        tempo 96
        key d dorian
        seed 7

        let fill(p) = p.fast(2).vel(.8)

        voice drums = {[kick . . kick . . snare .] [hat*8].vel([.9 .5])}.every(4, fill)
        voice bass  = [^1 . ^1 ^5 . ^4 _ ^b3].octave(-2).inst(bass)
        voice keys  = <^1@7 ^4@7 c4@maj7/e g3@m7b5>.strum.vel(.55)
        voice lead  = [d5 f#4 a4 25c].inst(pluck).pan(-0.3)  -- @lead
        voice pad   = changes("Dm7 G7 | Cmaj7").inst(pad)
    """.trimIndent()
}
