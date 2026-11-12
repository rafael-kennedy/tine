package tine.intellij.lang

import com.intellij.lang.Language
import com.intellij.openapi.fileTypes.LanguageFileType
import com.intellij.openapi.util.IconLoader
import javax.swing.Icon

object TineLanguage : Language("Tine") {
    private fun readResolve(): Any = TineLanguage
}

object TineIcons {
    @JvmField val FILE: Icon = IconLoader.getIcon("/icons/tine.svg", TineIcons::class.java)
}

object TineFileType : LanguageFileType(TineLanguage) {
    override fun getName() = "Tine"
    override fun getDescription() = "Tine music file"
    override fun getDefaultExtension() = "tine"
    override fun getIcon(): Icon = TineIcons.FILE
}
