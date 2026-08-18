# 勤怠管理 Web公開版

## 含まれる機能
- Supabase Authログイン
- 複数社員
- 社員ごとの勤怠データ分離
- 出勤/退勤
- 休憩
- 月次履歴
- 管理者画面
- 管理者による時刻修正
- 日別CSV出力
- 出勤・退勤時のGPS位置情報取得
- GPSの緯度・経度・取得精度を保存
- 管理者画面から位置情報を確認し、OpenStreetMapで表示（APIキー不要）
- RLS

## 公開手順
1. Supabaseでプロジェクトを作成
2. `supabase/schema.sql`をSQL Editorで実行
3. Authenticationで社員ユーザーを作成
4. `profiles`で管理者のroleをadminに変更
5. `.env.example`を`.env`にしてSupabase URL/キーを設定
6. `npm install`
7. `npm run dev`
8. GitHubへpush
9. VercelでGitHubリポジトリをImport
10. VercelのEnvironment Variablesに同じ2つの環境変数を登録
11. Deploy

Supabaseのブラウザ側にはPublishable/Anon keyを使い、service_role keyは絶対に入れないでください。


## 位置情報について
- 出勤/退勤ボタンを押した時にブラウザのGeolocation APIで位置情報を取得します。
- HTTPS環境（Vercelの公開URLなど）で動作させてください。
- 利用者がブラウザの位置情報許可をONにする必要があります。
- 保存項目は緯度・経度・取得時の推定精度です。
- 管理画面では座標をクリックしてOpenStreetMapで確認できます。
- 会社から一定距離以内だけ打刻可能にする「ジオフェンス」は今回の版ではまだ有効化していません。
- 本番運用では、位置情報の利用目的、保存期間、閲覧権限などを社内ルール/プライバシーポリシーで明確にしてください。

### 既存Supabaseプロジェクトへ適用する場合
既存テーブルを作成済みなら、schema.sqlを最初から再実行するのではなく、SQL Editorで次の4列を追加してください。

alter table public.attendance_records
  add column if not exists clock_in_latitude double precision,
  add column if not exists clock_in_longitude double precision,
  add column if not exists clock_in_accuracy double precision,
  add column if not exists clock_out_latitude double precision,
  add column if not exists clock_out_longitude double precision,
  add column if not exists clock_out_accuracy double precision;
\n\n## 勤務場所入力\n出勤時に「勤務場所」を入力し、勤怠レコードの `work_location` に保存します。既存のSupabaseプロジェクトでは `supabase/migration_work_location.sql` をSQL Editorで一度実行してください。\n