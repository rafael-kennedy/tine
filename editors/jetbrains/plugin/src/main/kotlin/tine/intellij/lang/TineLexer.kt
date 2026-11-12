package tine.intellij.lang

import com.intellij.lexer.LexerBase
import com.intellij.psi.tree.IElementType

/**
 * A highlighting lexer that mirrors src/core/lexer.ts closely enough to color
 * every token. It never fails: anything the real lexer rejects becomes
 * BAD_CHARACTER here, and the language server reports the actual error.
 * It keeps no state between tokens, so the IDE can restart it anywhere.
 */
class TineLexer : LexerBase() {
    private var buf: CharSequence = ""
    private var end = 0
    private var tokStart = 0
    private var tokEnd = 0
    private var type: IElementType? = null

    override fun start(buffer: CharSequence, startOffset: Int, endOffset: Int, initialState: Int) {
        buf = buffer; end = endOffset; tokEnd = startOffset; advance()
    }

    override fun getState() = 0
    override fun getTokenType() = type
    override fun getTokenStart() = tokStart
    override fun getTokenEnd() = tokEnd
    override fun getBufferSequence() = buf
    override fun getBufferEnd() = end

    private fun at(i: Int): Char = if (i in 0 until end) buf[i] else '\u0000'
    private fun startsWith(s: String, i: Int) = i + s.length <= end && (s.indices).all { buf[i + it] == s[it] }

    override fun advance() {
        tokStart = tokEnd
        if (tokStart >= end) { type = null; return }
        val (t, e) = scan(tokStart)
        type = t; tokEnd = maxOf(e, tokStart + 1)
    }

    private fun scan(s: Int): Pair<IElementType, Int> {
        val c = at(s)
        var i = s
        if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
            while (at(i) == ' ' || at(i) == '\t' || at(i) == '\n' || at(i) == '\r') i++
            return TineTokens.WHITE_SPACE to i
        }
        if (startsWith("--", i)) {
            while (i < end && at(i) != '\n') i++
            val text = buf.subSequence(s, i).toString()
            return (if (TOGGLE_RE.matches(text)) TineTokens.TOGGLE else TineTokens.COMMENT) to i
        }
        if (c == '"') {
            i++
            while (i < end && at(i) != '"' && at(i) != '\n') i += if (at(i) == '\\' && at(i + 1) != '\n') 2 else 1
            if (at(i) == '"') i++
            return TineTokens.STRING to minOf(i, end)
        }
        val prev = at(s - 1)
        if (dig(c) || (c == '.' && dig(at(s + 1)) && !isId(prev) && prev != ')' && prev != ']')) {
            while (dig(at(i))) i++
            if (at(i) == '.' && dig(at(i + 1))) { i++; while (dig(at(i))) i++ }
            if (at(i) == 'e' && (dig(at(i + 1)) || at(i + 1) == '-')) { i++; if (at(i) == '-') i++; while (dig(at(i))) i++ }
            when {
                startsWith("hz", i) && !isId(at(i + 2)) -> i += 2
                at(i) == 'c' && !isId(at(i + 1)) -> i += 1
                at(i) == '\\' && dig(at(i + 1)) -> { i++; while (dig(at(i))) i++ }
            }
            return TineTokens.NUMBER to i
        }
        if (c == '^') {
            i++
            while (at(i) == '#' || at(i) == 'b') i++
            if (at(i) == '-') i++
            if (!dig(at(i))) return TineTokens.BAD_CHARACTER to s + 1
            while (dig(at(i))) i++
            return TineTokens.DEGREE to i
        }
        if (c == '@') {
            val m = CHORD_RE.find(buf.subSequence(s + 1, end))
            return TineTokens.CHORD to (s + 1 + (m?.value?.length ?: 0))
        }
        if (isIdStart(c)) {
            while (i < end && isId(at(i))) i++
            val w = buf.subSequence(s, i).toString()
            val t = when {
                w == "_" -> TineTokens.OPERATOR
                NOTE_RE.matches(w) -> TineTokens.NOTE
                '#' in w -> TineTokens.BAD_CHARACTER
                w in TineWords.keywords -> TineTokens.KEYWORD
                w in TineWords.builtins -> TineTokens.BUILTIN
                w in TineWords.sounds -> TineTokens.SOUND
                else -> TineTokens.IDENT
            }
            return t to i
        }
        if (startsWith("=>", i)) return TineTokens.ARROW to i + 2
        for (op in OPS) if (startsWith(op, i)) return TineTokens.OPERATOR to i + op.length
        return when (c) {
            '(' -> TineTokens.LPAREN; ')' -> TineTokens.RPAREN
            '[' -> TineTokens.LBRACKET; ']' -> TineTokens.RBRACKET
            '{' -> TineTokens.LBRACE; '}' -> TineTokens.RBRACE
            ',' -> TineTokens.COMMA; '.' -> TineTokens.DOT
            else -> TineTokens.BAD_CHARACTER
        } to i + 1
    }

    companion object {
        private val NOTE_RE = Regex("^[A-Ga-g](?:#|b)*\\d?$")
        private val CHORD_RE = Regex("^[A-Za-z0-9#+]+(?:/[A-Ga-g](?:#|b)?\\d?(?![A-Za-z0-9_#]))?")
        private val TOGGLE_RE = Regex("^--\\s*@[A-Za-z0-9_]+\\s*$")
        private val OPS = listOf("==", "!=", "<=", ">=", "**", "..", "+", "-", "*", "/", "%", "=", "<", ">", ":", "?", "|", "!", "_")
        private fun isIdStart(c: Char) = c in 'A'..'Z' || c in 'a'..'z' || c == '_'
        private fun isId(c: Char) = isIdStart(c) || dig(c) || c == '#'
        private fun dig(c: Char) = c in '0'..'9'
    }
}
