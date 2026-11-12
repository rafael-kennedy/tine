package tine.intellij.lang

// Word lists generated from the Tine sources by scripts/gen-jetbrains.ts.
object TineWords {
    private fun load(name: String): Set<String> =
        TineWords::class.java.getResourceAsStream("/tine/$name.txt")
            ?.bufferedReader()?.readLines()?.map { it.trim() }?.filter { it.isNotEmpty() }?.toSet()
            ?: emptySet()

    val keywords = load("keywords") + setOf("silence", "active")
    val builtins = load("builtins")
    val sounds = load("scales") + load("drums") + load("instruments")
    val version: String = load("version").firstOrNull() ?: "?"
}
