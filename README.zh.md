# dsh-github

[English](README.md) | 涓枃

涓?[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 鎵撻€犵殑 GitHub 妫€绱㈡彃浠躲€傚畨瑁呭悗 Agent 鑾峰緱涓や釜宸ュ叿锛?
- `github_search` 鈥斺€?鐢?GitHub 鍘熺敓鎼滅储璇硶鏌ユ壘浠撳簱涓?issue/PR锛堜緥濡?`repo:vercel/next.js is:issue`锛夈€?- `github_get` 鈥斺€?瀹屾暣璇诲彇涓€椤硅祫婧愶細浠撳簱鍏冩暟鎹€乮ssue 鎴栨媺鍙栬姹傛鏂囥€佹垨鏂囦欢瑙ｇ爜鍐呭銆?
榛樿鍖垮悕鍙敤锛堟瘡 IP 姣忓皬鏃?60 娆★級銆傞厤缃彧璇?fine-grained token 鍚庤В閿佷唬鐮佹悳绱㈠苟鎻愬崌鍒版瘡灏忔椂 5000 娆°€傚彧璇昏璁★細鎻掍欢涓嶄細鍒涘缓 issue銆佸彂璇勮鎴栧啓浠ｇ爜銆?
## 瀹夎

```sh
dsh plugin --profile web add git+https://github.com/moxingovo/dsh-github
```

閲嶅惎 `dsh web`锛屾柊浼氳瘽鑷姩鑾峰緱 `github_search` 涓?`github_get`銆?
## 鍙€?token

鍒涘缓 fine-grained token锛圧epository access 閫?Public Repositories 鍙锛夛紝鍐欏叆鐜鍙橀噺鎴?`$DSH_HOME/.env`锛?
```sh
GITHUB_TOKEN=github_pat_...
```

涓嶉厤缃?token 鏃跺叏閮ㄥ姛鑳戒粛鍙尶鍚嶄娇鐢紱鍙湁浠ｇ爜鎼滅储鍜屾洿楂橀€熺巼闇€瑕?token銆?
## 閰嶇疆

| 閿?| 榛樿 | 鍚箟 |
|---|---|---|
| `tokenEnv` | `GITHUB_TOKEN` | 瀛樻斁鍙€?token 鐨勭幆澧冨彉閲忓悕銆?|
| `requestTimeoutMs` | `30000` | 鍗曡姹傝秴鏃讹紙姣锛夈€?|
| `searchMaxPerPage` | `30` | `github_search` 椤靛ぇ灏忎笂闄愶紙API 涓婇檺 100锛夈€?|
| `fileMaxChars` | `200000` | `github_get` 鏂囦欢瀛楃涓婇檺锛堝€煎眰鎴柇骞跺甫 `truncated` 鏍囪锛夈€?|

鍙湪 `profiles/web/cordis.patch.yml` 涓鐩栦换鎰忓瓧娈碘€斺€旀寜琛屽悗灞傝鐩栧墠灞傘€?
## 閿欒鐮?
宸ュ叿浠ョ粨鏋勫寲閿欒澶辫触骞舵惡甯︿笅鍒椾唬鐮侊細`GITHUB_UNAUTHORIZED`锛?01锛岄€氬父鏄棤 token 鐨勪唬鐮佹悳绱級銆乣GITHUB_FORBIDDEN`锛?03锛岄€熺巼鎴栨潈闄愶級銆乣GITHUB_NOT_FOUND`锛?04锛夈€乣GITHUB_API_ERROR`锛?22 鎴栧叾浠栭潪 2xx锛夈€乣GITHUB_BAD_RESPONSE`锛堥潪 JSON 鍝嶅簲浣擄級銆乣GITHUB_REDIRECT_REFUSED`锛堝嚟鎹畨鍏ㄤ繚鎶わ級銆乣GITHUB_REQUEST_FAILED`锛堢綉缁滐級銆乣GITHUB_FILE_TOO_LARGE`锛圓PI 涓嶄笅鍙戣秴杩?1MB 鐨勬枃浠跺唴瀹癸級銆?
## 瀹夊叏

- token 鍙粠鐜鍙橀噺璇诲彇锛岀粷涓嶈繘鍏ラ厤缃枃浠躲€佹棩蹇楁垨宸ュ叿杈撳嚭銆?- 姣忔璇锋眰鎷掔粷閲嶅畾鍚戯紝token 涓嶅彲鑳借杞彂鍒板叾浠栨簮銆?- token 鍙彂閫佺粰 `api.github.com`銆?
## Skills

闅忎粨搴撻檮甯︿袱浠芥妧鑳斤細`skills/plugin-tool-github`锛堝伐鍏风敤娉曪級涓?`skills/plugin-web-github`锛堟湇鍔￠厤缃笌閿欒鐮侊級銆傛妸瀹冧滑澶嶅埗杩涗綘鐨?harness 鎶€鑳界洰褰曪紝Agent 渚夸細鍦ㄨ皟鐢ㄥ伐鍏峰墠鍏堟煡闃呫€?
## 寮€鍙?
闇€瑕?Node 22 鎴栨洿鏂帮細

```sh
npm ci
npm test
```

浠撳簱鐢?package-lock.json 閽夋渚濊禆鏍戙€傛祴璇曞浠跺畬鍏ㄧ绾胯繍琛岋紙HTTP 鍏ㄩ儴 mock锛夛紱绫诲瀷妫€鏌ラ拡瀵瑰凡鍙戝竷鐨?DeepSeek Harness 鍖呮墽琛屻€?
## 宸茬煡闂

DeepSeek Harness 瀹樻柟鍖呯殑鏃╂湡 rc 鐗堟湰澹版槑浜嗘湭鍙戝竷鐨?peer 渚濊禆锛歞sh-agent 0.0.1-rc.1/rc.2 涓?dsh-session 0.0.1-rc.1/rc.2 寮曠敤浜?@deepseek-ai/dsh-type-meta锛岃鍖呬笉鍦?npm 娉ㄥ唽琛ㄤ笂銆傚叏鏂板畨瑁呮椂鑻ヨВ鏋愬櫒钀藉埌杩欎簺鐗堟湰锛屼細浠?@deepseek-ai/dsh-type-meta 鐨?404 澶辫触锛堝凡鍦?pnpm 11 涓?npmmirror 闀滃儚澶嶇幇锛沶pm 瑙ｆ瀽鍒?0.0.1-rc.5 鎵€浠ユ垚鍔燂級銆傚绛栵細鐢?npm 閰嶅悎浠撳簱鍐呯殑 package-lock.json锛坣pm ci锛夛紝鎴栧湪宸茶濂?harness 鐨勫伐浣滃尯鍐呮墽琛?dsh plugin add鈥斺€斿叾 lockfile 宸查攣瀹氬彲鐢ㄧ増鏈€傝繖鏄笂娓?rc 闃舵鐨勫彂甯冮棶棰橈紝涓婃父淇鍏冩暟鎹悗鑷姩娑堝け銆?
## 璁稿彲璇?
[MIT](LICENSE)
