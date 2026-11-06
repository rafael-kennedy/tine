" Vim syntax file for Tine, a programming language for music
if exists("b:current_syntax") | finish | endif
syn match   tineComment  "--.*$"
syn region  tineString   start=+"+ skip=+\\"+ end=+"+
syn keyword tineKeyword  let voice section form if then else and or not use
syn match tineKeyword "^\s*\zsactive\ze\s\+voice\>"
syn match tineToggle "--\s*@\w\+\s*$"
hi def link tineToggle Label
syn keyword tineDirective tempo meter key seed tuning
syn keyword tineBool     true false silence
syn match   tineDegree   "\^\%(#\|b\)*-\?\d\+"
syn match   tineNote     "\<[A-Ga-g]\%(#\|b\)*\d\?\>"
syn match   tineNumber   "\<\d\+\%(\.\d\+\)\?\%(hz\|c\>\|\\\d\+\)\?"
syn match   tineChord    "@[A-Za-z0-9]\+"
syn match   tinePhraseOp "[|?!_]"
syn match   tineBracket  "[\[\]{}<>]"
syn keyword tineDrum     kick kick2 rim snare clap snare2 hat ohat pedal crash ride china ridebell tamb splash cowbell crash2 ride2 bongo bongo2 conga conga2 shaker clave block tom1 tom2 tom3 tom4 tom5 tom6
syn keyword tineType     major minor dorian phrygian lydian mixolydian aeolian locrian ionian harmonic_minor melodic_minor major_pent minor_pent blues whole_tone chromatic hirajoshi double_harmonic just_major slendro bohlen_pierce keys sine tri saw square pluck bass pad bell organ kit lead
syn match   tineFunction "\<[a-z_][A-Za-z0-9_]*\ze("
syn match   tineMethod   "\.\zs[a-z_][A-Za-z0-9_]*"
hi def link tineComment Comment
hi def link tineString String
hi def link tineKeyword Keyword
hi def link tineDirective PreProc
hi def link tineBool Boolean
hi def link tineDegree Constant
hi def link tineNote Constant
hi def link tineNumber Number
hi def link tineChord Operator
hi def link tinePhraseOp Special
hi def link tineBracket Delimiter
hi def link tineDrum Identifier
hi def link tineType Type
hi def link tineFunction Function
hi def link tineMethod Function
let b:current_syntax = "tine"
