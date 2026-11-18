# xero portfolio

GitHub Pages 向けの静的なポートフォリオです。フロントエンドは Claude Code、作品データと公開設定は GPT が担当しました。

## 内容の変更

`data/projects.json` の作品情報を編集してください。プライベートなリポジトリは、公開訪問者が開けないためリンクを設定していません。連絡先とプロフィールは本人確認後に設定してください。

## ローカルで見る

このフォルダーで `python -m http.server 8000` を実行し、`http://localhost:8000/` を開きます。JSON の読み込みに HTTP サーバーが必要です。

## 公開

GitHub リポジトリの Settings → Pages → Build and deployment の Source を GitHub Actions に変更します。main ブランチへの更新で自動公開されます。GitHub Pages は静的サイトのホスティングです。フォーム送信などサーバー機能が必要な場合は別のサービスが必要です。
