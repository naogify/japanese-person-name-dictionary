# japanese-person-name-dictionary

日本人の**姓・名の辞書**だけを置くリポジトリ。判定ロジックは持たない
（判定は [japanese-person-name-detector](https://github.com/naogify/japanese-person-name-detector) の `createDetector({ surnames, givenNames })` に、この辞書を渡して使う）。

- `data/surnames.txt` / `data/given-names.txt`: 統合版。1行1語、UTF-8、重複なし、**NFKC＋異体字を代表字に畳み込み済み**
- `data/sources.json`: 出典ごとの件数・取得日・URL・版・sha256（語は載せない）
- `data/wikidata/`: Wikidata の SPARQL 結果のスナップショット（再現用）
- `scripts/build.mjs`: 各出典から辞書を組み立てる。`npm run build`（取得あり）／`npm run build:offline`（`.cache/` とスナップショットだけで再生成）
- `data/by-source/`: 出典ごとの語リスト（1 出典だけ外して作り直せる）
- `LICENSES/`: 各出典のライセンス全文（原文のまま）
- `THIRD_PARTY_NOTICES.md`: 出典ごとの名称・URL・版・ライセンス・表示物・義務の表

## インストール

```bash
npm install @naogify/japanese-person-name-dictionary
```

Node.js 20 以上、ESM のみ。パッケージは約 2.5MB（展開後約 6MB）。

## 使い方

判定器 [`@naogify/japanese-person-name-detector`](https://github.com/naogify/japanese-person-name-detector) はこの辞書を既定で使うので、
判定だけなら判定器を入れれば足りる。辞書を直接使うときは次のとおり。

```js
import { loadDictionary, fold } from '@naogify/japanese-person-name-dictionary';

const { surnames, givenNames } = loadDictionary(); // Set<string> が 2 つ（初回にファイルから読む）
// 辞書は NFKC＋異体字の畳み込み済みなので、引く側も fold() を通す
surnames.has(fold('髙橋')); // true
```

- `loadDictionary()`: 統合版の姓・名を `Set<string>` で返す
- `fold(s)`: 照合用の畳み込み（NFKC → 異体字を代表字へ。全角スペースの区切りは保つ）
- `SURNAMES_PATH` / `GIVEN_NAMES_PATH`: 統合版ファイルの絶対パス
- ファイルを直接読むこともできる: `@naogify/japanese-person-name-dictionary/surnames.txt`・`/given-names.txt`・`/sources.json`

## 同梱データの出典と条件

出典は 5 つ。**出典ごとの語リスト**は `data/by-source/<mozc|sudachi|unidic-small|ipadic|wikidata>/{surnames,given-names}.txt`、**統合版**は `data/surnames.txt`・`data/given-names.txt`（5 出典の和集合）。
件数・版・取得日・ライセンス名・sha256 は `data/sources.json`。出典ごとの URL・版・ライセンス・同梱した表示物・守る義務の表は **[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)**、ライセンス全文（原文のまま）は `LICENSES/`。

| 出典 | 条件（要旨） | 全文 |
|---|---|---|
| Mozc OSS 辞書（Google） | 3条項BSD＋NAIST/ICOT 条項＋沖縄辞書（パブリックドメイン） | `LICENSES/Mozc-LICENSE.txt` |
| SudachiDict core/notcore（Works Applications） | Apache-2.0（NEologd〔Apache-2.0〕等を含む） | `LICENSES/SudachiDict-LICENSE-2.0.txt`・`SudachiDict-LEGAL.txt`・`NEologd-*-COPYING.txt` |
| UniDic small（SudachiDict 経由） | 修正BSD（UniDic Consortium） | `LICENSES/SudachiDict-LEGAL.txt`・`UniDic-202512-BSD.txt` |
| mecab-ipadic（NAIST・ICOT） | NAIST 条項＋ICOT 条項 | `LICENSES/mecab-ipadic-COPYING.txt` |
| Wikidata | CC0 1.0 | `LICENSES/CC0-1.0.txt` |

### 守ること

- **宣伝・販促に Google・奈良先端科学技術大学院大学（NAIST）・Works Applications・UniDic Consortium／国立国語研究所の名前を使わない**（各ライセンスの条項による）。
- 再配布するときは `LICENSES/`・`THIRD_PARTY_NOTICES.md` を同梱する（BSD・NAIST・Apache-2.0 の表示義務）。
- ICOT 条項の無保証（"NO WARRANTY"）の段落は `LICENSES/Mozc-LICENSE.txt`・`LICENSES/mecab-ipadic-COPYING.txt` に含まれる。

### Apache-2.0（SudachiDict・NEologd）の要件チェックリスト

- [x] ライセンスの写しを渡す: `LICENSES/SudachiDict-LICENSE-2.0.txt`
- [x] 元の著作権・帰属表示を保持: `LICENSES/SudachiDict-LEGAL.txt`・`NEologd-*-COPYING.txt`（原文のまま）
- [x] NOTICE 相当を保持: SudachiDict に独立した NOTICE ファイルは無く、LEGAL がその役目なので原文で同梱
- [x] 改変の明示: 元の辞書から**語（表記）だけを抜き出し、NFKC と異体字の畳み込みをかけた**派生物であることを `THIRD_PARTY_NOTICES.md` と本節に記載（`scripts/build.mjs` が再現手順）
- [x] 商標・名称を使わない（§6）: 上記「宣伝に使わない」
- [ ] 社内法務の最終確認（未）

### 使っていない出典

JMnedict（CC BY-SA 4.0）、工藤拓氏の人名データ zip（利用条件の記載なし。内容は Mozc の旧版の部分集合）、japanese-personal-name-dataset。

## ライセンス

- **コード**（`scripts/`・`src/`・`test/`）: MIT（`LICENSE`）
- **データ**（`data/`）: MIT ではない。各出典の条件に従う（上の表・`THIRD_PARTY_NOTICES.md`）
- 条件は公開文書から読み取ったもの。**法務の最終確認は別途**

## 公開手順（npm）

1. `package.json` の `version` を上げてコミットし、main にマージする
2. GitHub で `v<version>` のタグの Release を作って公開する
3. `.github/workflows/publish.yml` がテストしてから npm に公開する（provenance つき）

初回だけは npm 上にパッケージが無く Trusted Publishing を登録できないので、
`npm login` してから手元で `npm publish` するか、リポジトリの Secrets に `NPM_TOKEN` を入れてから Release を作る。
公開後、npmjs.com のパッケージ設定で Trusted Publisher（このリポジトリ・`publish.yml`）を登録し、`NPM_TOKEN` は消してよい。

## 辞書の更新

`npm run build` を実行して `data/` の差分をコミットする。SudachiDict の版を上げるときは `scripts/build.mjs` の版・URL・sha256 を更新する。
