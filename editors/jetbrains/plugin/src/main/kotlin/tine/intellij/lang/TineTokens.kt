package tine.intellij.lang

import com.intellij.psi.TokenType
import com.intellij.psi.tree.IElementType
import com.intellij.psi.tree.TokenSet

class TineTokenType(debugName: String) : IElementType(debugName, TineLanguage)

object TineTokens {
    @JvmField val COMMENT = TineTokenType("COMMENT")
    @JvmField val TOGGLE = TineTokenType("TOGGLE")          // -- @name, a performance toggle
    @JvmField val STRING = TineTokenType("STRING")
    @JvmField val NUMBER = TineTokenType("NUMBER")
    @JvmField val NOTE = TineTokenType("NOTE")              // c4, f#3, eb
    @JvmField val DEGREE = TineTokenType("DEGREE")          // ^1, ^b3
    @JvmField val CHORD = TineTokenType("CHORD")            // @maj7, @m7b5/e
    @JvmField val KEYWORD = TineTokenType("KEYWORD")
    @JvmField val BUILTIN = TineTokenType("BUILTIN")
    @JvmField val SOUND = TineTokenType("SOUND")            // scales, drums, instruments
    @JvmField val IDENT = TineTokenType("IDENT")
    @JvmField val OPERATOR = TineTokenType("OPERATOR")
    @JvmField val ARROW = TineTokenType("ARROW")
    @JvmField val LPAREN = TineTokenType("(")
    @JvmField val RPAREN = TineTokenType(")")
    @JvmField val LBRACKET = TineTokenType("[")
    @JvmField val RBRACKET = TineTokenType("]")
    @JvmField val LBRACE = TineTokenType("{")
    @JvmField val RBRACE = TineTokenType("}")
    @JvmField val COMMA = TineTokenType(",")
    @JvmField val DOT = TineTokenType(".")

    @JvmField val WHITE_SPACE: IElementType = TokenType.WHITE_SPACE
    @JvmField val BAD_CHARACTER: IElementType = TokenType.BAD_CHARACTER

    @JvmField val COMMENTS = TokenSet.create(COMMENT, TOGGLE)
    @JvmField val STRINGS = TokenSet.create(STRING)
}
