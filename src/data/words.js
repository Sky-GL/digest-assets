import data from './words.json'
import { charById } from './steps'

export const ALL_WORDS = data.words

/** 構成文字を文字オブジェクトの配列にして返す(未知IDは除外) */
export const charsOfWord = (word) => word.chars.map(charById).filter(Boolean)

/**
 * その単語が「今の実力で読めるか」= 構成文字がすべて learnedIds に含まれるか。
 * learnedIds は一度でも解答した文字のID集合。
 */
export const isReadable = (word, learnedIds) => word.chars.every((id) => learnedIds.has(id))

/**
 * 出題する単語を選ぶ。読める単語を優先し、足りなければやさしい順に補充する。
 */
export const pickWords = (learnedIds, count = 10) => {
  const readable = ALL_WORDS.filter((w) => isReadable(w, learnedIds))
  const rest = ALL_WORDS.filter((w) => !isReadable(w, learnedIds)).sort((a, b) => a.level - b.level)
  const pool = [...shuffle(readable), ...rest]
  return pool.slice(0, count)
}

export const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
