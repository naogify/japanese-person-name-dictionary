// 生成物の健全性テスト（語そのものは書かず、件数・形式・出典ファイルの有無だけを見る）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadDictionary, fold } from '../src/index.mjs';

const { surnames, givenNames } = loadDictionary();
const meta = JSON.parse(fs.readFileSync(new URL('../data/sources.json', import.meta.url), 'utf-8'));

test('辞書の件数が出典の記録と合う', () => {
  assert.equal(surnames.size, meta.total.surnames);
  assert.equal(givenNames.size, meta.total.givenNames);
  assert.ok(surnames.size > 10000 && givenNames.size > 20000);
  // Mozc の人名（姓・名）が取り込まれている
  const mozc = meta.sources.find((s) => s.id === 'mozc');
  assert.ok(mozc.counts.surnames > 90000 && mozc.counts.givenNames > 40000);
});

test('全語が畳み込み済みで、漢字・かなだけでできている', () => {
  const re = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆ヶー]+$/u;
  for (const w of [...surnames, ...givenNames]) {
    assert.equal(fold(w), w);
    assert.match(w, re);
  }
});

test('fold は異体字を代表字に寄せ、全角英数を半角にする', () => {
  assert.equal(fold('髙'), '高');
  assert.equal(fold('Ａ１'), 'A1');
  // 姓名の区切りの全角スペースは保つ
  assert.equal(fold('髙　Ａ'), '高\u3000A');
});

test('出典ごとにライセンス全文のファイルがある', () => {
  for (const s of meta.sources) {
    // 出典が複数の条項を持つとき（Mozc）は licenseFiles の全部が要る
    for (const f of s.licenseFiles) assert.ok(fs.existsSync(new URL(`../${f}`, import.meta.url)), `${s.id}: ${f}`);
  }
});

test('出典ごとの語リストがあり、その和集合が統合版と一致する', () => {
  const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf-8').split('\n').filter(Boolean);
  for (const [file, set] of [['surnames.txt', surnames], ['given-names.txt', givenNames]]) {
    const union = new Set();
    for (const s of meta.sources) {
      const words = read(`data/by-source/${s.id}/${file}`);
      assert.equal(words.length, s.counts[file === 'surnames.txt' ? 'surnames' : 'givenNames'], s.id);
      for (const w of words) union.add(w);
    }
    assert.equal(union.size, set.size);
  }
});
