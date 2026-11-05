;;; tine-mode.el --- Major mode for Tine, a programming language for music -*- lexical-binding: t; -*-
;; Usage: (load "/path/to/tine-mode.el")  then open a .tine file.
;; With eglot (Emacs 29+), M-x eglot connects to `tine lsp' automatically.

(defvar tine-font-lock-keywords
  `(("--.*$" . font-lock-comment-face)
    (,(regexp-opt '("let" "voice" "section" "form" "if" "then" "else" "and" "or" "not" "use") 'words) . font-lock-keyword-face)
    (,(regexp-opt '("tempo" "meter" "key" "seed" "tuning") 'words) . font-lock-preprocessor-face)
    ("\\^\\(#\\|b\\)*-?[0-9]+" . font-lock-constant-face)
    ("\\_<[A-Ga-g]\\(#\\|b\\)*[0-9]?\\_>" . font-lock-constant-face)
    ("@[A-Za-z0-9]+" . font-lock-builtin-face)
    ("\\_<\\(kick\\|snare\\|hat\\|ohat\\|clap\\|rim\\|crash\\|ride\\|cowbell\\|tom[1-6]\\)\\_>" . font-lock-variable-name-face)
    ("\\_<\\([a-z_][A-Za-z0-9_]*\\)(" 1 font-lock-function-name-face)
    ("\\.\\([a-z_][A-Za-z0-9_]*\\)" 1 font-lock-function-name-face)))

(defvar tine-mode-syntax-table
  (let ((st (make-syntax-table)))
    (modify-syntax-entry ?_ "w" st)
    (modify-syntax-entry ?# "w" st)
    (modify-syntax-entry ?- ". 12" st)
    (modify-syntax-entry ?\n ">" st)
    (modify-syntax-entry ?< "(>" st)
    (modify-syntax-entry ?> ")<" st)
    st))

;;;###autoload
(define-derived-mode tine-mode prog-mode "Tine"
  "Major mode for editing Tine music programs."
  :syntax-table tine-mode-syntax-table
  (setq-local comment-start "-- ")
  (setq-local comment-end "")
  (setq-local indent-tabs-mode nil)
  (setq-local tab-width 2)
  (setq-local font-lock-defaults '(tine-font-lock-keywords)))

;;;###autoload
(add-to-list 'auto-mode-alist '("\\.tine\\'" . tine-mode))

(with-eval-after-load 'eglot
  (add-to-list 'eglot-server-programs '(tine-mode "tine" "lsp")))

(defun tine-daw ()
  "Open the Tine DAW on the current file."
  (interactive)
  (start-process "tine-daw" "*tine-daw*" "tine" "daw" (buffer-file-name)))

(provide 'tine-mode)
;;; tine-mode.el ends here
