# japanese-person-name-dictionary

日本人の**姓・名の辞書**だけを置くリポジトリ。判定ロジックは持たない
（判定は [japanese-person-name-detector](https://github.com/naogify/japanese-person-name-detector) の `createDetector({ surnames, givenNames })` に、この辞書を渡して使う）。

- `data/surnames.txt` / `data/given-names.txt`: 1行1語、UTF-8、重複なし、**NFKC＋異体字を代表字に畳み込み済み**
- `data/sources.json`: 出典ごとの件数・取得日・URL・版・sha256（語は載せない）
- `data/wikidata/`: Wikidata の SPARQL 結果のスナップショット（再現用）
- `scripts/build.mjs`: 各出典から辞書を組み立てる。`npm run build`（取得あり）／`npm run build:offline`（`.cache/` とスナップショットだけで再生成）
- `LICENSES/`: 各出典の条件の全文

## 使い方

```js
import { loadDictionary, fold } from '@naogify/japanese-person-name-dictionary';
import { createDetector } from '@naogify/japanese-person-name-detector';

const { surnames, givenNames } = loadDictionary();
const detector = createDetector({ surnames, givenNames, mode: 'both' });
// 辞書は畳み込み済みなので、判定対象も fold() を通す
detector.looksLikePersonName(fold(name));
```

npm には公開しない。`github:naogify/japanese-person-name-dictionary#<sha>` で参照する。

## 同梱データの出典と条件

| 出典 | 取り出すもの | 版 | 条件 | 全文 |
|---|---|---|---|---|
| UniDic small（SudachiDict `small_lex.csv` 経由） | 品詞 名詞,固有名詞,人名 の 姓・名 | SudachiDict 20260723 | 修正BSD（3条項）。UniDic Consortium | `LICENSES/UniDic-BSD.txt` |
| mecab-ipadic | `Noun.name.csv` の 姓・名 | 2.7.0-20070801 | NAIST／ICOT 条項（著作権表示と免責の同梱が条件） | `LICENSES/mecab-ipadic-NAIST-ICOT.txt` |
| Mozc OSS 辞書（google/mozc `src/data/dictionary_oss/dictionary00〜09.txt`） | 左文脈 ID が 名詞,固有名詞,人名 の 姓・名（`id.def` から引く） | コミット `60fe401…`（全 SHA は `sources.json`） | 3条項BSD（Google）＋ NAIST／ICOT 条項 ＋ 沖縄辞書（パブリックドメイン） | `LICENSES/Mozc-BSD-3.txt`・`LICENSES/Mozc-NAIST-ICOT.txt`・`LICENSES/Okinawa-PD.txt` |
| Wikidata | 日本語ラベル（姓 Q101352、名 Q202444 / Q12308941 / Q11879590 / Q3409032） | SPARQL スナップショット（日付は `sources.json`） | CC0 1.0 | `LICENSES/Wikidata-CC0.txt` |

- **宣伝・販促に UniDic Consortium・NAIST（奈良先端科学技術大学院大学）・Google Inc. とその貢献者の名称を使わない**（UniDic・Mozc の BSD 条項と NAIST の免責による）。
- Mozc の LICENSE は、リポジトリ全体を Google の3条項BSD、`src/data/dictionary*` に NAIST／ICOT 条項と沖縄辞書（PD）を併記している。Mozc の人名エントリには IPAdic・沖縄辞書のどちらでもない部分が大半を占め、その出自は Mozc の文書に書かれていない（Google の BSD の下にあると読んでいるが、**要法務確認**）。
- 件数・取得日・sha256 は `data/sources.json`。
- 使っていない出典（確認が取れるまで入れない）: SudachiDict core／notcore、工藤拓氏の人名データ zip、JMnedict（CC BY-SA）、japanese-personal-name-dataset。

## ライセンス

- コード（`scripts/`・`src/`・`test/`）: MIT（`LICENSE`）
- データ（`data/`）: 上の表の各出典の条件。再配布するときは `LICENSES/` を同梱する
- 法務の最終確認は別途（各条件は公開文書から読み取ったもの）

## 辞書の更新

`npm run build` を実行して `data/` の差分をコミットする。SudachiDict の版を上げるときは `scripts/build.mjs` の版・URL・sha256 を更新する。
