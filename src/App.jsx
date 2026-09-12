import { useMemo, useState } from 'react'
import HUD from './components/HUD'
import StepMap from './components/StepMap'
import Flashcards from './components/Flashcards'
import Quiz from './components/Quiz'
import MatraLab from './components/MatraLab'
import WordMode from './components/WordMode'
import MemoryGame from './components/MemoryGame'
import Challenge from './components/Challenge'
import { useProgress } from './hooks/useProgress'
import { buildStepQuiz, buildReviewQuiz } from './lib/quiz'
import { stepMeta, MATRA_STEP } from './data/steps'

export default function App() {
  const { progress, recordAnswer, finishStep, noteCombo, noteChallenge, reset, dismissMigration } = useProgress()
  // view: { name: 'map' | 'cards' | 'quiz' | 'lab' | 'review' | 'words' | 'memory' | 'challenge', step?, questions? }
  const [view, setView] = useState({ name: 'map' })

  // 一度でも解答した文字のID集合(単語モード/神経衰弱の出題範囲に使う)
  const learnedIds = useMemo(() => new Set(Object.keys(progress.chars)), [progress.chars])

  const goMap = () => setView({ name: 'map' })

  const startStepQuiz = (step) =>
    setView({ name: 'quiz', step, questions: buildStepQuiz(step, progress.chars), key: Date.now() })

  const startReview = () =>
    setView({ name: 'review', questions: buildReviewQuiz(progress.chars), key: Date.now() })

  const handleReset = () => {
    if (window.confirm('学習の進捗をすべて消去します。よろしいですか?')) {
      reset()
      goMap()
    }
  }

  return (
    <div className="app">
      <HUD progress={progress} onHome={goMap} onReset={handleReset} />
      {progress.curriculumMigrated && (
        <div className="migration-banner">
          <span>
            📚 カリキュラムを整理し、Stepはどこからでも自由に選べるようになりました。
            Stepの並びが変わったため、Stepのクリア状況(★)はリセットしています。
            文字ごとの正誤記録とXPはそのまま引き継いでいます。
          </span>
          <button className="btn ghost sm" onClick={dismissMigration}>閉じる</button>
        </div>
      )}
      <main>
        {view.name === 'map' && (
          <StepMap
            progress={progress}
            onSelect={(step) => setView({ name: 'cards', step })}
            onReview={startReview}
            onWords={() => setView({ name: 'words', key: Date.now() })}
            onMemory={() => setView({ name: 'memory', key: Date.now() })}
            onChallenge={() => setView({ name: 'challenge', key: Date.now() })}
          />
        )}

        {view.name === 'words' && (
          <WordMode key={view.key} learnedIds={learnedIds} onBack={goMap} onAnswer={recordAnswer} />
        )}

        {view.name === 'challenge' && (
          <Challenge
            key={view.key}
            learnedIds={learnedIds}
            onBack={goMap}
            onAnswer={recordAnswer}
            best={progress.bestChallenge || 0}
            onRecord={noteChallenge}
          />
        )}

        {view.name === 'memory' && (
          <MemoryGame key={view.key} learnedIds={learnedIds} onBack={goMap} onAnswer={recordAnswer} />
        )}

        {view.name === 'cards' && (
          <Flashcards
            step={view.step}
            onBack={goMap}
            onQuiz={() => startStepQuiz(view.step)}
            onMatraLab={() => setView({ name: 'lab' })}
          />
        )}

        {view.name === 'lab' && (
          <MatraLab onBack={() => setView({ name: 'cards', step: MATRA_STEP })} onQuiz={() => startStepQuiz(MATRA_STEP)} />
        )}

        {view.name === 'quiz' && (
          <Quiz
            key={view.key}
            title={`STEP ${view.step} ${stepMeta(view.step).title}`}
            accent={stepMeta(view.step).color}
            questions={view.questions}
            onAnswer={recordAnswer}
            onFinish={(score, total, combo) => {
              noteCombo(combo)
              return finishStep(view.step, score, total)
            }}
            onBack={goMap}
            onRetry={() => startStepQuiz(view.step)}
          />
        )}

        {view.name === 'review' && (
          <Quiz
            key={view.key}
            title="復習モード(苦手優先)"
            accent="var(--c-review)"
            questions={view.questions}
            onAnswer={recordAnswer}
            onFinish={(score, total, combo) => {
              noteCombo(combo)
              // 復習はStepのクリア記録に影響しないので判定のみ返す
              const rate = total ? score / total : 0
              return { cleared: rate >= 0.8, stars: rate >= 1 ? 3 : rate >= 0.85 ? 2 : rate >= 0.7 ? 1 : 0, rate }
            }}
            onBack={goMap}
            onRetry={startReview}
          />
        )}
      </main>
      <footer className="foot">
        発音は Web Speech API(hi-IN)を使用。非対応環境では <code>/public/audio/</code> の mp3 にフォールバックします。
      </footer>
    </div>
  )
}
