# How the theory course teaches

This is the research the course leans on, and the rubric every lesson is reviewed against.

## What the research says

**Sound before symbol.** Gordon's Music Learning Theory puts hearing and performing a pattern before naming or reading it, and moves from discrimination (telling two things apart) to inference (making your own musical decisions). Its central idea is *audiation*: hearing music in your head that is not sounding. Imitation without audiation gives correct-looking output without understanding. ([Music Learning Theory in Collegiate Music Education](https://symposium.music.org/volume-31/forum-essays-1752877059/music-learning-theory-in-collegiate-music-education), [Gordon music learning theory](https://en.wikipedia.org/wiki/Gordon_music_learning_theory))

**Jazz is learned like a language.** Solli, Aksdal and Inderberg test Berliner's claim from *Thinking in Jazz* that jazz is learned by aural imitation, like a mother tongue. Their method starts with groove and rhythm, then rhythmic patterns, then pitches. It keeps the body involved (sing, clap), delays analytical labels until the sound is familiar, works harmony by singing roots and chord tones, and ends with personal variation over a groove. ([Learning Jazz Language by Aural Imitation](https://erlingak.folk.ntnu.no/LearningJazzLanguage/LearningJazzLanguage.pdf), [Thinking in Jazz](https://chicagoreference.com/ucp/books/book/chicago/T/bo3697073.html))

**Testing and spacing beat rereading.** Dunlosky and colleagues' review of ten study techniques rates practice testing and distributed practice highest. Rereading, highlighting and summarizing rate low. ([Which Study Strategies Make the Grade?](https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html))

**Worked examples, then fade them.** Novices learn more from studying solved problems than from solving cold, especially when they explain the steps to themselves and see varied examples. As expertise grows the benefit reverses, so support should fade: complete part of a problem, then all of it. ([MIT: worked and faded examples](https://openlearning.mit.edu/mit-faculty/research-based-learning-findings/worked-and-faded-examples), [Worked-example effect](https://en.wikipedia.org/wiki/Worked-example_effect))

**Hear intervals in a key.** Musicians identify intervals more accurately in a melodic context than in isolation. A tonal context gives a modest boost to interval judgments, mostly by setting up which pitches to expect. So ear training should establish a key before asking what an interval or chord is. ([Jackson and Oxenham 2017](https://www.frontiersin.org/articles/10.3389/fpsyg.2017.01753/full), [MTO notes citing Wapnick et al.](https://mtosmt.org/issues/mto.00.6.3/mto.00.6.3.karpinski_notes.html))

**Making music teaches code, and code can teach music.** Sonic Pi research credits creative, live-coded participation and teacher partnerships. ([Sonic Pi scoping study](https://www.repository.cam.ac.uk/handle/1810/263177))

## What that means here

- Every new idea is **heard first** in a Tine example, then named, then defined.
- Examples invite a **specific change with a predicted result**: "change the 3 to a 4 and listen for the darker sound", not "try editing this".
- Each concept goes **worked example, then a partly done example, then a challenge** written from scratch. Later units fade the support faster.
- Quizzes **retrieve earlier lessons** as well as the current one, and mix question types.
- Ear questions **set up a key first** (a tonic or a cadence) before asking about an interval or chord.
- Rhythm and groove come early and stay present. Jazz examples swing and sound like jazz.

## The rubric

A reviewer who did not write the lesson scores each category from 0 to 10. A lesson ships when every category is 10.

| # | Category | A 10 means |
| --- | --- | --- |
| 1 | Accuracy | Every theory claim is correct. Every code example runs and plays what the prose says it plays. No claim a teacher would have to correct. |
| 2 | Sound before symbol | Each new idea is played before it is named. Nothing is defined in the abstract first. |
| 3 | Interactivity | There is a live example for every idea, and most of them suggest a specific edit and what it will do. Long stretches of prose without sound do not occur. |
| 4 | Scaffolding | Worked example, partial example, then a challenge. Steps are small enough for the stated level. Support fades in later units. |
| 5 | Retrieval and spacing | Quizzes test recall, not recognition of a phrase just read. At least one question reaches back to an earlier lesson. |
| 6 | Ear training | Listening questions establish a key or context first, and ask the learner to hear something the lesson taught. |
| 7 | Jazz authenticity | Examples sound idiomatic (swing, voicings, real progressions). The lesson connects the idea to how jazz players use it. |
| 8 | Clarity for the level | Terms are defined at first use. One new idea at a time. A learner at the unit's level can follow without outside help. |
| 9 | Challenge quality | The task is unambiguous. The check accepts every correct answer and its feedback names the specific mistake. The starter fails with a useful message. |
| 10 | Prose | Short, plain sentences. No filler, no clichés, no em-dashes. Nothing said twice. |

## How the review is run

**Chosen: separate reviewer agents, one per unit, after a first pass by the author.** Rafael picked this on the decision card. A reviewer that did not write a lesson catches more than its author does, and that is worth the extra tokens. The loop:

1. The author's pass: a script renders each lesson as a learner meets it (each paragraph; each example with the exact notes it plays; each challenge with what its starter and solution produce and what the check says; each quiz with its listen notes). It flags what a machine can find: runs of prose with no sound, too few examples or suggested edits, no ear question, too few quiz questions. The author fixes those and every accuracy problem found by running the code.
2. Five reviewer agents, one per unit, read the same rendered output plus the source. They run any code they doubt, score the ten categories, and list every point below 10 with the exact fix.
3. The author applies the fixes, runs the tests, and sends the changed lessons back for another review. This repeats until every category is 10.

## The language tutorial (`tine learn`)

The tutorial in `src/web/lessons.ts` teaches the language, not theory, to a different reader: someone who already programs and knows no music vocabulary. The research above still applies, and so does the rubric, with categories 6 and 7 (ear training, jazz authenticity) left out. Five rules follow from that reader:

- **Every music term is defined in the sentence that first uses it**, in one sentence, and where possible in programming terms: a pitch is a number, a scale is a list of offsets, a degree is a 1-based index, a chord quality is a named list of offsets.
- **Every Tine feature is taught before an example relies on it.** That fixes the lesson order: syntax and the dot-call first, functions next, then keys and chords, then chance.
- **The example plays before the paragraph that names what it did.**
- **Examples suggest one specific edit and say what it will do.** Lists of function names belong in the Reference.
- **Every lesson ends with one checked exercise.** Its `alsoRight` and `wrong` lists are run by `tests/lessons.test.ts`: every other correct answer must pass, every listed mistake must be caught, and the answer must pass on 40 seeds. Feedback speaks in note names, not pitch numbers.
