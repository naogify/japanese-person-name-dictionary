// ============================================================================
// src/index.mjs
// ----------------------------------------------------------------------------
// 姓名辞書（data/*.txt）を Set として読み出す。判定は japanese-person-name-detector の
// createDetector({ surnames, givenNames }) に渡す。辞書は畳み込み済み（NFKC＋異体字）なので、
// 判定対象の文字列も fold() を通してから渡すこと。
// ============================================================================
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export { fold } from '../scripts/fold.mjs';

/** 姓辞書ファイルの絶対パス */
export const SURNAMES_PATH = fileURLToPath(new URL('../data/surnames.txt', import.meta.url));
/** 名辞書ファイルの絶対パス */
export const GIVEN_NAMES_PATH = fileURLToPath(new URL('../data/given-names.txt', import.meta.url));

/**
 * 1行1語のテキストファイルを Set に読む。
 * @param {string} file ファイルパス
 * @returns {Set<string>} 語の集合
 */
function readSet(file) {
  return new Set(fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean));
}

/**
 * 姓・名の辞書を読み込む。
 * @returns {{surnames: Set<string>, givenNames: Set<string>}} 畳み込み済みの語の集合
 */
export function loadDictionary() {
  return { surnames: readSet(SURNAMES_PATH), givenNames: readSet(GIVEN_NAMES_PATH) };
}
