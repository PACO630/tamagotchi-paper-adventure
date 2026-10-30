# 拓麻歌子紙片大冒險 Tamagotchi Paper Adventure

作者：**@paco._0630**

《拓麻歌子：失落的星之心》— 一款可以直接部署到 GitHub Pages 的 2.5D 紙片風 RPG。
角色是故意畫得很爛的 **MS Paint 滑鼠塗鴉**，世界則是精緻的紙雕立體場景。

> 非商業粉絲作品。「Tamagotchi／拓麻歌子」為 BANDAI 之商標；所有角色、場景、音樂與音效皆為本專案原創繪製／合成，沒有使用任何官方或其他遊戲的素材。

## 內容

- **完整八章主線**：消失的星光 → 糖果森林的秘密 → 雲朵天空島 → 失控的玩具工廠 → 神秘海洋 → 夢幻城堡 → 黑暗異世界 → 星之心的真相（含結局慶祝與合照、製作人員名單）。每章都有開場、NPC、主線／支線任務、地圖機關、隱藏寶箱、Boss 與結尾。
- **地圖探索**：x／深度 z 的 2.5D 移動、跳躍、紙片翻轉轉身、鎚子敲碎牆壁、隱藏寶箱（跳一下會出現）、移動平台、坑洞、風／海流／輸送帶、會落下的機械手臂、黑暗區域、順序機關、鏡子迷宮傳送門、彈簧、回復台、存檔方塊。
- **回合制戰鬥**：鎚子（光圈時機）、跳躍（落地連踩）、技能（連打／方向鍵序列）、防禦（敵人衝來時按鍵，Perfect 完全格擋）、道具、逃跑；飛行／尖刺／裝甲／幽靈／火焰特性，12 種狀態，敵人 AI，8 個各有機制的 Boss（召喚、糖霜護盾、空中被踩落、裝甲階段＋自爆倒數、潮汐、反擊架式＋鏡像分身、模仿技能、最終三階段：黑暗領域 → 永恆之壁 → 全夥伴合體技）。
- **成長**：等級、經驗值、能力值、技能解鎖、徽章裝備（3 格）、消耗品、24 張收藏貼紙。單人模式麻美吉會遇到 7 位夥伴，可切換同行夥伴參戰。
- **多人模式（最多 4 人）**：WebRTC P2P（PeerJS），房間代碼、角色不可重複、房主開始／解散、斷線偵測、同 ID 重新加入、房主離線時權限交接。房主權威式狀態同步（動作序號、重複封包過濾、缺號／雜湊不符自動補快照）。
- **存檔**：IndexedDB 三格存檔＋自動存檔（任務、Boss、重要道具、新地區、章節、升級、離開、回主選單、定時）；LocalStorage 只存名稱／ID／音量等小設定；**JSON 匯出／匯入**（驗證、版本遷移、完整性檢查、匯入前備份、失敗自動還原）。
- **PWA**：Service Worker（版本化資源快取，絕不碰 IndexedDB）、可加入主畫面、`navigator.storage.persist()`。
- **電腦與手機**：鍵盤（WASD／方向鍵、Space、J/X、Enter/E、ESC、Q）、觸控搖桿與按鈕（直式時遊戲在上、控制在下）、全螢幕、高 DPI 縮放。

## 開發

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 型別檢查 + 正式建置到 dist/
npm run preview    # 預覽正式建置（含 Service Worker）
```

- `art-preview.html`：開發用的角色／敵人／場景畫廊（`npm run dev` 後開啟 `/art-preview.html`）。
- `?profile=b`：使用另一組本地身分與存檔，方便在同一台電腦開兩個分頁測試多人模式。
- `?sto=1`：遊戲迴圈改用 setTimeout（背景分頁自動化測試用）。
- `?nopwa=1`：在手機瀏覽器略過「請安裝成網頁 App」頁面（僅供測試）。

## 手機

手機用瀏覽器開啟時會顯示安裝教學（iPhone：分享 → 加入主畫面；Android：安裝按鈕或選單 → 安裝應用程式），必須從主畫面開啟網頁 App 才能遊玩。遊戲只能橫向遊玩，直拿時會暫停並提示轉向。

## 部署到 GitHub Pages

1. 推到 GitHub 的 `main` 分支。
2. Repository → Settings → Pages → Source 選 **GitHub Actions**。
3. `.github/workflows/deploy.yml` 會自動型別檢查、建置並發佈 `dist/`。

建置使用相對路徑（`base: './'`），可直接放在 `https://<使用者>.github.io/<專案名稱>/`。

## 多人連線說明

- 連線配對使用 PeerJS 公用 Cloud Broker（只交換連線資訊），遊戲資料全部走玩家之間的 DataChannel，沒有自建伺服器或資料庫。
- 預設 STUN：Google／Twilio；可在「遊戲設定」開關公用 TURN 中繼，或填入自己的 TURN 伺服器。公用服務屬於盡力而為，在嚴格的公司／校園網路可能無法連線。
- 劇情由房主推進；戰鬥輪流行動，被攻擊的玩家在自己的裝置上按防禦。經驗值與等級保存到每位玩家自己的存檔。

## 美術：hand-drawn Skill 第 5 號畫風

`.claude/skills/hand-drawn/` 是以淺克隆安裝的完整 [threerocks/hand-drawn-styles](https://github.com/threerocks/hand-drawn-styles)（main 分支），保留全部目錄，Claude Code 可直接使用。驗證：

```bash
npm run skill:check   # = cd .claude/skills/hand-drawn && python3 -B scripts/check_skill.py
```

> macOS 若出現 `CERTIFICATE_VERIFY_FAILED`，代表 Python 沒有安裝根憑證：執行 `Install Certificates.command`，或先 `export SSL_CERT_FILE=/etc/ssl/cert.pem`。

Skill 只產生提示詞、不產生圖片。`npm run art:prompts` 會呼叫 skill 的 `scripts/render_prompt.py --style 5` 產生每個角色的正式提示詞到 `docs/art-prompts.md`；遊戲內的精靈圖則由 `src/art/paint.ts` 依照同一份配方在執行時程序化繪製（抖動斷續的線條、刻意不對的比例、涂出邊界的純色、像素鋸齒、白底紙片外框、無漸層）。

## 專案結構

```
src/
  core/      設定、事件、遊戲核心(G)、流程控制
  data/      角色、技能、道具、敵人、任務、音樂、chapters/ch1-8（劇情與地圖資料）
  art/       MS Paint 塗鴉渲染、角色／敵人／圖示、紙雕場景、材質管理
  systems/   存檔(IndexedDB)、LocalStorage、身分、設定、JSON 匯出入、成長、背包、劇情腳本、音效音樂、狀態動作
  world/     2.5D 地圖場景、紙片角色
  battle/    戰鬥規則、戰鬥場景與按鍵時機、戰鬥 UI、戰鬥流程
  net/       PeerJS 連線、協定、多人同步
  ui/        DOM 介面、HUD、對話框、觸控、各畫面
  scenes/    啟動與標題場景
  pwa/       Service Worker 樣板與註冊
```
