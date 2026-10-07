// ============================================================================
// scripts/build.mjs
// ----------------------------------------------------------------------------
// 姓・名の辞書を各出典から組み立てる。
//   node scripts/build.mjs            .cache/ に無い出典を取得して data/ を生成
//   node scripts/build.mjs --offline  取得せず .cache/ と data/wikidata/ だけで生成（再現確認用）
// 出力: data/surnames.txt, data/given-names.txt（1行1語・畳み込み済み・重複なし）, data/sources.json
// 出典: Mozc OSS 辞書 / SudachiDict（core・notcore）/ UniDic small（SudachiDict small_lex.csv）/ mecab-ipadic 2.7.0 Noun.name.csv / Wikidata
// 出力: data/by-source/<出典>/ に出典ごとの語リスト、data/ に統合版
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fold } from './fold.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache');
const DATA = path.join(ROOT, 'data');
const OFFLINE = process.argv.includes('--offline');

/** 取得元の固定情報（版・URL・sha256） */
const SUDACHI = {
  version: '20260723',
  base: 'https://d2ej7fkh96fzlu.cloudfront.net/sudachidict-raw/20260723/',
  /** zip ごとの sha256（small = UniDic 由来、core / notcore = NEologd 等を含む部分） */
  files: {
    small: 'b578ac9545899783d5d7e30d5d78d5d9dcf40b36965d4af0663ec2eb041c1093',
    core: 'a2b39e1572adab08a649b1390b134517adc55f1d733c59358b113298788bf31c',
    notcore: 'a15edc5193b42acfebdc220825d8c7edf0059bf950169d09bcdf6c426a81ecd1',
  },
};
const IPADIC = {
  version: '2.7.0-20070801',
  url: 'https://sourceforge.net/projects/mecab/files/mecab-ipadic/2.7.0-20070801/mecab-ipadic-2.7.0-20070801.tar.gz/download',
  sha256: 'b62f527d881c504576baed9c6ef6561554658b175ce6ae0096a60307e49e3523',
};
/** Mozc OSS 辞書（コミット SHA で固定。ファイルごとの sha256 も固定） */
const MOZC = {
  commit: '60fe4012e5eaa26805dbbb8e5548cbe6db4aaf98',
  base: 'https://raw.githubusercontent.com/google/mozc/60fe4012e5eaa26805dbbb8e5548cbe6db4aaf98/src/data/dictionary_oss/',
  files: {
    'id.def': '07a05a268c3783b7e02b36e4aa591555a2dd19a1f3c93891576740761c154f2d',
    'dictionary00.txt': '9e07ce292932c4fff327ed8cb06274c09acca556bd8bdf7c7ef1f6173eae3b61',
    'dictionary01.txt': '836fd5fd8399510de0d8ef7b33be913cca6bbaee7b712cc8045fba03f4c75a89',
    'dictionary02.txt': '93943858d0cfd092b849a78def6901eaf228177e1ac5663544e865a3a1e45a9e',
    'dictionary03.txt': 'cb9f1b0b4a7550d682d86244a021cd17e0b15366328819e69135b5f183a1a24b',
    'dictionary04.txt': '9fdc4e3948d03463de13ab5782adffbc11dd06e934cb80138c5920029cd3d2f6',
    'dictionary05.txt': '199e3b0f050b691823ae7ba943090d437f51af6436b27c5f3dc69cafa12000e4',
    'dictionary06.txt': 'b95b14f7770ae2a824bc8e9fad8b03c1bc45c504f93a36554b8b56daa0368d2a',
    'dictionary07.txt': '7f53649b529d4c8c495d3a8dd9c4d489dfe7696080f7423107ff01331174be48',
    'dictionary08.txt': '50a31bb5fc1646721b00be371a5695dffab1292bda143e1e59cc70cbbdd8643f',
    'dictionary09.txt': '4e5fcd4cbfbf11395166a37b506f547fc54d20edc0884f5184ecd3fc705f0d9a',
  },
};
const SPARQL = 'https://query.wikidata.org/sparql';

/** 辞書に入れてよい語: 漢字・ひらがな・カタカナ・々〆ヶー だけ（記号・英数字・空白を含む語は姓名形に当たらないので捨てる） */
const WORD_RE = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆ヶー]+$/u;

/**
 * ファイルの sha256 を返す。
 * @param {string} file ファイルパス
 * @returns {string} 16進文字列
 */
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/**
 * URL を取得して .cache に保存する（既にあれば取得しない）。sha256 が合わなければ例外。
 * @param {{url: string, sha256: string}} spec 取得元
 * @param {string} dest 保存先
 */
async function fetchPinned(spec, dest) {
  if (!fs.existsSync(dest)) {
    if (OFFLINE) throw new Error(`--offline だが ${dest} が無い`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const res = await fetch(spec.url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`${spec.url}: ${res.status}`);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  }
  // 取得物が固定版であることを確かめる
  if (sha256(dest) !== spec.sha256) throw new Error(`${dest} の sha256 が固定値と違う`);
}

/**
 * CSV 1行を単純にカンマで割る（小さな辞書CSVは引用符を使わない前提。人名行だけを見る）。
 * @param {string} line CSV の1行
 * @returns {string[]} 列
 */
const cols = (line) => line.split(',');

/**
 * SudachiDict の語彙 CSV（small / core / notcore）から品詞「名詞,固有名詞,人名,姓/名」の表記を抜く。
 * @param {string[]} names 読む CSV の名前（'small' | 'core' | 'notcore'）
 * @returns {Promise<{surnames: string[], givenNames: string[]}>}
 */
async function readSudachiLex(names) {
  const out = { surnames: [], givenNames: [] };
  for (const name of names) {
    const zip = path.join(CACHE, 'sudachi', `${name}_lex.zip`);
    await fetchPinned({ url: `${SUDACHI.base}${name}_lex.zip`, sha256: SUDACHI.files[name] }, zip);
    // unzip の標準出力へ展開して読む（巨大なので maxBuffer を広げる）
    const csv = execFileSync('unzip', ['-p', zip, `${name}_lex.csv`], { maxBuffer: 1 << 30 }).toString('utf-8');
    for (const line of csv.split('\n')) {
      const c = cols(line);
      if (c[5] !== '名詞' || c[6] !== '固有名詞' || c[7] !== '人名') continue;
      if (c[8] === '姓') out.surnames.push(c[0]);
      else if (c[8] === '名') out.givenNames.push(c[0]);
    }
  }
  return out;
}

/**
 * mecab-ipadic の Noun.name.csv（EUC-JP）から姓・名の表記を抜く。
 * @returns {Promise<{surnames: string[], givenNames: string[]}>}
 */
async function readIpadic() {
  const tgz = path.join(CACHE, 'ipadic', 'mecab-ipadic-2.7.0-20070801.tar.gz');
  await fetchPinned(IPADIC, tgz);
  const buf = execFileSync('tar', ['xzOf', tgz, 'mecab-ipadic-2.7.0-20070801/Noun.name.csv'], { maxBuffer: 1 << 28 });
  const text = new TextDecoder('euc-jp').decode(buf);
  const out = { surnames: [], givenNames: [] };
  for (const line of text.split('\n')) {
    const c = cols(line);
    if (c[4] !== '名詞' || c[5] !== '固有名詞' || c[6] !== '人名') continue;
    if (c[7] === '姓') out.surnames.push(c[0]);
    else if (c[7] === '名') out.givenNames.push(c[0]);
  }
  return out;
}

/**
 * Mozc OSS 辞書（dictionary00〜09.txt）から人名の姓・名の表記を抜く。
 * 列は「読み TAB 左文脈ID TAB 右文脈ID TAB コスト TAB 表記」。左文脈 ID が id.def で
 * 「名詞,固有名詞,人名,姓」「名詞,固有名詞,人名,名」になっている行を拾う（ID 番号は版で変わるので id.def から引く）。
 * @returns {Promise<{surnames: string[], givenNames: string[]}>}
 */
async function readMozc() {
  const dir = path.join(CACHE, 'mozc', MOZC.commit);
  for (const [name, hash] of Object.entries(MOZC.files)) {
    await fetchPinned({ url: MOZC.base + name, sha256: hash }, path.join(dir, name));
  }
  // id.def（「ID 品詞,…」）から姓・名の ID を引く
  const ids = { surname: null, given: null };
  for (const line of fs.readFileSync(path.join(dir, 'id.def'), 'utf-8').split('\n')) {
    const [id, pos] = line.split(' ');
    if (pos === '名詞,固有名詞,人名,姓,*,*,*') ids.surname = id;
    if (pos === '名詞,固有名詞,人名,名,*,*,*') ids.given = id;
  }
  if (!ids.surname || !ids.given) throw new Error('id.def に姓・名の品詞 ID が無い');
  const out = { surnames: [], givenNames: [] };
  for (const name of Object.keys(MOZC.files).filter((n) => n.startsWith('dictionary'))) {
    for (const line of fs.readFileSync(path.join(dir, name), 'utf-8').split('\n')) {
      const c = line.split('\t');
      if (c[1] === ids.surname) out.surnames.push(c[4]);
      else if (c[1] === ids.given) out.givenNames.push(c[4]);
    }
  }
  return out;
}

/**
 * SPARQL を実行して日本語ラベルの一覧を返す。結果は data/wikidata/ にスナップショットとして保存し、
 * --offline のときはそれを読む（Wikidata は日々変わるので再現性のためコミットする）。
 * @param {string} name queries/ のファイル名（拡張子なし）と data/wikidata/ のファイル名
 * @returns {Promise<string[]>} ラベルの配列
 */
async function readWikidata(name) {
  const snap = path.join(DATA, 'wikidata', `${name}.txt`);
  if (OFFLINE) return fs.readFileSync(snap, 'utf-8').split('\n').filter(Boolean);
  const query = fs.readFileSync(path.join(ROOT, 'scripts', 'queries', `wikidata-${name}.rq`), 'utf-8');
  const res = await fetch(`${SPARQL}?query=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'japanese-person-name-dictionary-build/0.1' },
  });
  if (!res.ok) throw new Error(`Wikidata ${name}: ${res.status}`);
  const json = await res.json();
  const labels = [...new Set(json.results.bindings.map((b) => b.label.value))].sort();
  fs.mkdirSync(path.dirname(snap), { recursive: true });
  fs.writeFileSync(snap, labels.join('\n') + '\n');
  return labels;
}

/**
 * 語の配列を畳み込み・フィルタ・重複除去して集合にする。
 * @param {string[]} words 生の見出し語
 * @returns {Set<string>} 畳み込み済みの語
 */
function normalizeAll(words) {
  const set = new Set();
  for (const w of words) {
    const f = fold(w.trim());
    if (WORD_RE.test(f)) set.add(f);
  }
  return set;
}

const unidic = await readSudachiLex(['small']);
const sudachi = await readSudachiLex(['core', 'notcore']);
const ipadic = await readIpadic();
const mozc = await readMozc();
const wd = { surnames: await readWikidata('surnames'), givenNames: await readWikidata('given-names') };

// 出典ごとの集合（件数の記録用）と、その和集合
const per = {
  'unidic-small': { surnames: normalizeAll(unidic.surnames), givenNames: normalizeAll(unidic.givenNames) },
  sudachi: { surnames: normalizeAll(sudachi.surnames), givenNames: normalizeAll(sudachi.givenNames) },
  ipadic: { surnames: normalizeAll(ipadic.surnames), givenNames: normalizeAll(ipadic.givenNames) },
  mozc: { surnames: normalizeAll(mozc.surnames), givenNames: normalizeAll(mozc.givenNames) },
  wikidata: { surnames: normalizeAll(wd.surnames), givenNames: normalizeAll(wd.givenNames) },
};
const union = (key) => new Set(Object.values(per).flatMap((p) => [...p[key]]));
const surnames = union('surnames');
const givenNames = union('givenNames');

fs.mkdirSync(DATA, { recursive: true });
/** 並び順を固定して1行1語で書く（再現確認で差分が出ないように） */
const write = (file, set) => fs.writeFileSync(path.join(DATA, file), [...set].sort().join('\n') + '\n');
write('surnames.txt', surnames);
write('given-names.txt', givenNames);
// 出典ごとの語リスト（どの語がどの出典か追える。1 出典だけ外して統合版を作り直せる）
for (const [id, p] of Object.entries(per)) {
  fs.mkdirSync(path.join(DATA, 'by-source', id), { recursive: true });
  write(path.join('by-source', id, 'surnames.txt'), p.surnames);
  write(path.join('by-source', id, 'given-names.txt'), p.givenNames);
}

const today = new Date().toISOString().slice(0, 10);
const meta = {
  generatedAt: today,
  note: '件数は畳み込み・フィルタ・重複除去のあと。語そのものはここに載せない',
  sources: [
    { id: 'mozc', description: 'Mozc OSS 辞書 dictionary00〜09.txt の 名詞,固有名詞,人名,姓/名（左文脈 ID を id.def から引く）',
      license: 'Google の3条項BSD ＋ NAIST/ICOT 条項 ＋ 沖縄辞書（パブリックドメイン）',
      version: MOZC.commit, url: MOZC.base, sha256: MOZC.files, fetchedAt: today,
      licenseFiles: ['LICENSES/Mozc-LICENSE.txt'] },
    { id: 'sudachi', description: 'SudachiDict core_lex.csv・notcore_lex.csv の 名詞,固有名詞,人名,姓/名（small は unidic-small として別掲）',
      license: 'Apache-2.0（Works Applications）。NEologd（Apache-2.0）等を含む（LEGAL 参照）',
      version: SUDACHI.version, url: SUDACHI.base, sha256: { 'core_lex.zip': SUDACHI.files.core, 'notcore_lex.zip': SUDACHI.files.notcore }, fetchedAt: today,
      licenseFiles: ['LICENSES/SudachiDict-LICENSE-2.0.txt', 'LICENSES/SudachiDict-LEGAL.txt', 'LICENSES/NEologd-unidic-COPYING.txt', 'LICENSES/NEologd-ipadic-COPYING.txt', 'LICENSES/UniDic-202512-BSD.txt', 'LICENSES/UniDic-202512-COPYING.txt'] },
    { id: 'unidic-small', description: 'UniDic small（SudachiDict small_lex.csv の 名詞,固有名詞,人名,姓/名）',
      license: '修正BSD（UniDic Consortium）。SudachiDict の配布物として Apache-2.0',
      version: SUDACHI.version, url: SUDACHI.base + 'small_lex.zip', sha256: SUDACHI.files.small, fetchedAt: today,
      licenseFiles: ['LICENSES/UniDic-202512-BSD.txt', 'LICENSES/UniDic-202512-COPYING.txt', 'LICENSES/SudachiDict-LEGAL.txt', 'LICENSES/SudachiDict-LICENSE-2.0.txt'] },
    { id: 'ipadic', description: 'mecab-ipadic 2.7.0-20070801 Noun.name.csv（名詞,固有名詞,人名,姓/名）', license: 'NAIST/ICOT 条項',
      version: IPADIC.version, url: IPADIC.url, sha256: IPADIC.sha256, fetchedAt: today, licenseFiles: ['LICENSES/mecab-ipadic-COPYING.txt'] },
    { id: 'wikidata', description: 'Wikidata の日本語ラベル（姓 Q101352、名 Q202444/Q12308941/Q11879590/Q3409032）', license: 'CC0 1.0',
      version: 'SPARQL スナップショット', url: SPARQL, query: 'scripts/queries/', snapshot: 'data/wikidata/', fetchedAt: today, licenseFiles: ['LICENSES/CC0-1.0.txt'] },
  ].map((s) => ({ ...s, counts: { surnames: per[s.id].surnames.size, givenNames: per[s.id].givenNames.size } })),
  total: { surnames: surnames.size, givenNames: givenNames.size },
};
// --offline の再現確認では生成日を変えないため、既存の meta があれば日付を引き継ぐ
const metaPath = path.join(DATA, 'sources.json');
if (OFFLINE && fs.existsSync(metaPath)) {
  const old = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  meta.generatedAt = old.generatedAt;
  // 出典の並びが変わっても取り違えないよう id で引く（古い meta に無い出典は今日の日付のまま）
  meta.sources.forEach((s) => { s.fetchedAt = old.sources.find((o) => o.id === s.id)?.fetchedAt ?? s.fetchedAt; });
}
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
console.log(JSON.stringify(meta.sources.map((s) => [s.id, s.counts])), meta.total);
