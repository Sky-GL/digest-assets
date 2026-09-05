import { useState } from 'react'
import HUD from './components/HUD'
import StepMap from './components/StepMap'
import Flashcards from './components/Flashcards'
import Quiz from './components/Quiz'
import MatraLab from './components/MatraLab'
import { useProgress } from './hooks/useProgress'
import { buildStepQuiz, buildReviewQuiz } from './lib/quiz'
import { stepMeta } from './data/steps'

export default function App() {
  const { progress, recordAnswer, finishStep, noteCombo, reset } = useProgress()
  // view: { name: 'map' | 'cards' | 'quiz' | 'lab' | 'review', step?, questions? }
  const [view, setView] = useState({ name: 'map' })

  const goMap = () => setView({ name: 'map' })

  const startStepQuiz = (step) =>
    setView({ name: 'quiz', step, questions: buildStepQuiz(step, progress.chars), key: Date.now() })

  const startReview = () =>
    setView({ name: 'review', questions: buildReviewQuiz(progress.unlockedStep, progress.chars), key: Date.now() })

  const handleReset = () => {
    if (window.confirm('学習の進捗をすべて消去します。よろしいですか?')) {
      reset()
      goMap()
    }
  }

  return (
    <div className="app">
      <HUD progress={progress} onHome={goMap} onReset={handleReset} />
      <main>
        {view.name === 'map' && (
          <StepMap
            progress={progress}
            onSelect={(step) => setView({ name: 'cards', step })}
            onReview={startReview}
          />
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
          <MatraLab onBack={() => setView({ name: 'cards', step: 12 })} onQuiz={() => startStepQuiz(12)} />
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
            accent="#f472b6"
            questions={view.questions}
            onAnswer={recordAnswer}
            onFinish={(score, total, combo) => {
              noteCombo(combo)
              // 復習はアンロックに影響しないので判定のみ返す
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
