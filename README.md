# ブロックのたね

外部ライブラリ、CDN、ログインを使わない、段階的なビジュアルプログラミング学習環境です。

## 起動

ES Modules と Service Worker を使うため、配布先では HTTPS で公開します。手元では `blockseed` フォルダーを静的HTTPサーバーで配信してください。初回表示後は Service Worker によりオフラインでも動きます。

## 授業向けURL

- `?level=3`：★3で開く
- `?level=3&lock=1`：★3に固定する
- `?teacher=1`：先生モードを使う
- `?level=2&lock=1&easy=1`：レベル固定＋削除確認を増やす

タイトルのたねマークを5回押しても先生モードを開けます。

## 自己テスト

静的HTTPサーバーから `tests/index.html` を開きます。外部テストランナーは不要です。

## 1枚版

`python tools/build_single.py` を実行すると `dist/blockseed-single.html` が作られます。1枚版は配布用で、PWA更新機能は含みません。

## 公開用ファイル

`python tools/build_site.py` で、外部依存のない公開用ファイルを `dist/` にそろえます。
