package tine.intellij

import com.intellij.psi.tree.IElementType
import junit.framework.TestCase
import tine.intellij.lang.TineLexer
import tine.intellij.lang.TineTokens
import java.io.File

class TineLexerTest : TestCase() {
    private fun lex(text: String): List<Triple<IElementType, Int, Int>> {
        val l = TineLexer(); l.start(text, 0, text.length, 0)
        val out = mutableListOf<Triple<IElementType, Int, Int>>()
        while (l.tokenType != null) { out += Triple(l.tokenType!!, l.tokenStart, l.tokenEnd); l.advance() }
        return out
    }

    private fun types(text: String) = lex(text).filter { it.first != TineTokens.WHITE_SPACE }.map { text.substring(it.second, it.third) to it.first }

    fun testTokenClasses() {
        val t = types("voice melody = <c4@maj7/e ^b3 .5 25c 5\\31 440hz>.fast(2).inst(pluck) -- @lead")
        val expect = listOf(
            "voice" to TineTokens.KEYWORD, "melody" to TineTokens.IDENT, "=" to TineTokens.OPERATOR, "<" to TineTokens.OPERATOR,
            "c4" to TineTokens.NOTE, "@maj7/e" to TineTokens.CHORD, "^b3" to TineTokens.DEGREE, ".5" to TineTokens.NUMBER,
            "25c" to TineTokens.NUMBER, "5\\31" to TineTokens.NUMBER, "440hz" to TineTokens.NUMBER, ">" to TineTokens.OPERATOR,
            "." to TineTokens.DOT, "fast" to TineTokens.BUILTIN, "(" to TineTokens.LPAREN, "2" to TineTokens.NUMBER,
            ")" to TineTokens.RPAREN, "." to TineTokens.DOT, "inst" to TineTokens.BUILTIN, "(" to TineTokens.LPAREN,
            "pluck" to TineTokens.SOUND, ")" to TineTokens.RPAREN, "-- @lead" to TineTokens.TOGGLE,
        )
        assertEquals(expect, t)
    }

    fun testCommentsStringsAndArrows() {
        assertEquals(
            listOf("let" to TineTokens.KEYWORD, "grow" to TineTokens.IDENT, "=" to TineTokens.OPERATOR, "x" to TineTokens.IDENT,
                "=>" to TineTokens.ARROW, "\"a \\\" b\"" to TineTokens.STRING, "-- note" to TineTokens.COMMENT),
            types("let grow = x => \"a \\\" b\" -- note"),
        )
    }

    /** Every example piece lexes without gaps, and restarting at any token gives the same tokens. */
    fun testExamplesAreCoveredAndRestartable() {
        val dir = File("../../../examples")
        val files = dir.listFiles { f -> f.extension == "tine" }.orEmpty()
        assertTrue("no examples found in ${dir.absolutePath}", files.isNotEmpty())
        for (f in files) {
            val text = f.readText()
            val all = lex(text)
            var pos = 0
            for ((_, s, e) in all) { assertEquals("gap in ${f.name}", pos, s); pos = e }
            assertEquals(text.length, pos)
            assertFalse("bad character in ${f.name}", all.any { it.first == TineTokens.BAD_CHARACTER })
            for ((i, tok) in all.withIndex()) {
                val l = TineLexer(); l.start(text, tok.second, text.length, 0)
                assertEquals("restart at ${tok.second} in ${f.name}", all[i].first, l.tokenType)
                assertEquals("restart at ${tok.second} in ${f.name}", all[i].third, l.tokenEnd)
            }
        }
    }
}
