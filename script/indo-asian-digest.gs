/**
 * ============================================================
 * スクリプト名: The Indo-Asian Digest 自動配信システム v4.0
 * ============================================================
 */

const CONFIG = {
  EMAIL_SUBJECT: '日刊 The Indo-Asian Digest（インド・アジアン・ダイジェスト）',
  APP_VERSION:   'v4.1', // 変更のたびに更新。メール件名には出さず、本文フッターにのみ表示する
  MODEL_NAME:    'gemini-2.5-flash',
  MAX_RETRY:     3,
  HISTORY_DAYS:  2,   // 見出し重複チェックの遡及日数（検索の新鮮さ基準=24-48hに合わせる）
  HISTORY_MAX:   20,  // プロンプトに渡す既出見出しの最大件数（肥大化防止）
};

const COUNTRIES_DEF = [
  // ★ 本数配分: 全国 4本 / デリー・グルガオン 10本（据え置き）/ ムンバイ・コルカタ・チェンナイ 各 2本
  // code/anchorPrefix/tocTag はデザイン刷新（バッジ表記・アンカーリンク・目次タグ）用
  // isCity: true の地域は「インド主要都市」として現地メディア中心に収集し、CITY_SCOPES で取材範囲を限定する
  { name: "インド",                   label: "インド",                   subLabel: "India — National & Economy",       emoji: "🇮🇳", count: 4, isIndia: true,  domains: "economictimes.indiatimes.com, livemint.com, business-standard.com, thehindu.com, indianexpress.com, moneycontrol.com, inc42.com",
    code: "IN", anchorPrefix: "india", tocTag: "全国", sectionTitle: "インド — 全国" },
  { name: "インド（デリー・グルガオン）", label: "インド — デリー / グルガオン", subLabel: "India — Delhi & Gurugram Region",    emoji: "🏙️", count: 10, isIndia: true,  domains: "timesofindia.indiatimes.com, hindustantimes.com, ndtv.com, indianexpress.com",
    code: "IN", anchorPrefix: "delhi", tocTag: "デリー", sectionTitle: "デリー / グルガオン" },
  { name: "インド（ムンバイ）",       label: "インド — ムンバイ",       subLabel: "India — Mumbai & MMR",           emoji: "🌆", count: 2, isIndia: true, isCity: true, domains: "mid-day.com, freepressjournal.in, mumbailive.com, hindustantimes.com, timesofindia.indiatimes.com, indianexpress.com",
    code: "IN", anchorPrefix: "mumbai", tocTag: "ムンバイ", sectionTitle: "ムンバイ" },
  { name: "インド（コルカタ）",       label: "インド — コルカタ",       subLabel: "India — Kolkata & West Bengal",  emoji: "🌉", count: 2, isIndia: true, isCity: true, domains: "telegraphindia.com, thestatesman.com, millenniumpost.in, anandabazar.com, timesofindia.indiatimes.com, hindustantimes.com",
    code: "IN", anchorPrefix: "kolkata", tocTag: "コルカタ", sectionTitle: "コルカタ" },
  { name: "インド（チェンナイ）",     label: "インド — チェンナイ",     subLabel: "India — Chennai & Tamil Nadu",   emoji: "🛕", count: 2, isIndia: true, isCity: true, domains: "thehindu.com, dtnext.in, newindianexpress.com, dinamalar.com, timesofindia.indiatimes.com",
    code: "IN", anchorPrefix: "chennai", tocTag: "チェンナイ", sectionTitle: "チェンナイ" },
  { name: "中国",                     label: "中国",                     subLabel: "China",                            emoji: "🇨🇳", count: 2, isIndia: false, domains: "reuters.com, scmp.com, bloomberg.com",
    code: "CN", anchorPrefix: "cn", tocTag: "CN" },
  { name: "シンガポール",               label: "シンガポール",               subLabel: "Singapore",                        emoji: "🇸🇬", count: 2, isIndia: false, domains: "straitstimes.com, businesstimes.com.sg",
    code: "SG", anchorPrefix: "sg", tocTag: "SG" },
  { name: "タイ",                     label: "タイ",                     subLabel: "Thailand",                         emoji: "🇹🇭", count: 2, isIndia: false, domains: "bangkokpost.com, nationthailand.com",
    code: "TH", anchorPrefix: "th", tocTag: "TH" },
  { name: "マレーシア",                label: "マレーシア",                subLabel: "Malaysia",                         emoji: "🇲🇾", count: 2, isIndia: false, domains: "thestar.com.my, theedgemalaysia.com",
    code: "MY", anchorPrefix: "my", tocTag: "MY" },
  { name: "ベトナム",                  label: "ベトナム",                  subLabel: "Vietnam",                          emoji: "🇻🇳", count: 2, isIndia: false, domains: "vietnamnews.vn, e.vnexpress.net",
    code: "VN", anchorPrefix: "vn", tocTag: "VN" },
  { name: "中東・ガルフ諸国",           label: "中東・ガルフ",              subLabel: "Middle East & Gulf",               emoji: "🌙",  count: 3, isIndia: false, domains: "gulfnews.com, arabnews.com, khaleejtimes.com, thenationalnews.com, reuters.com",
    code: "ME", anchorPrefix: "me", tocTag: "ME" },
];

// 都市セクション専用の取材スコープ。
// 「その都市の住人・駐在員にしか刺さらないネタ」だけを拾わせるための定義で、
// PRIORITY SOURCES（COUNTRIES_DEF.domains）の現地紙とセットで使う。
const CITY_SCOPES = {
  mumbai: {
    short:    'Mumbai',
    area:     'MUMBAI (including Navi Mumbai, Thane and the wider Mumbai Metropolitan Region)',
    keywords: '"Mumbai" or "Navi Mumbai" or "Thane" or "MMR"',
    topics:   'BMC / municipal governance, Mumbai suburban railway, Metro, Coastal Road and Mumbai Trans Harbour Link, '
            + 'Dharavi and other redevelopment projects, Mumbai property market, monsoon flooding and civic infrastructure, '
            + 'Maharashtra state decisions that land directly on Mumbai, local retail and consumer business, local crime and public safety',
  },
  kolkata: {
    short:    'Kolkata',
    area:     'KOLKATA (including Howrah, Salt Lake / Bidhannagar and the wider Kolkata metropolitan area)',
    keywords: '"Kolkata" or "Howrah" or "West Bengal"',
    topics:   'KMC / municipal governance, Kolkata Metro and the East-West corridor, Howrah and city transport, '
            + 'West Bengal state decisions that land directly on Kolkata, the port and eastern-region industry, '
            + 'retail districts such as Park Street and New Market, festivals and culture including Durga Puja, local crime and public safety',
  },
  chennai: {
    short:    'Chennai',
    area:     'CHENNAI (including the Chennai Metropolitan Area and its industrial belt such as Sriperumbudur and Oragadam)',
    keywords: '"Chennai" or "Tamil Nadu" or "Sriperumbudur"',
    topics:   'Greater Chennai Corporation governance, Chennai Metro Rail phase 2, roads, flooding and cyclone response, '
            + 'Tamil Nadu state decisions that land directly on Chennai, the automobile and electronics manufacturing belt, '
            + 'the OMR IT corridor and startups, retail and mall openings, local crime and public safety',
  },
};

function splitToAndBcc(recipientsStr) {
  // 宛先を「実行アカウント自身（TO）」と「それ以外全員（BCC）」に分割する。
  // 自分がリストに含まれない/取得できない場合はリストの先頭をTOにフォールバックする。
  const recipients = recipientsStr.split(',').map(e => e.trim()).filter(Boolean);
  const myEmail = Session.getEffectiveUser().getEmail() || recipients[0] || '';
  if (!myEmail) throw new Error('ALERT_EMAILS から有効な宛先を1件も取得できませんでした。');
  const bcc = recipients.filter(e => e.toLowerCase() !== myEmail.toLowerCase()).join(',');
  return { to: myEmail, bcc };
}

function mainFunction() {
  const startTime = Date.now();
  try {
    const props      = PropertiesService.getScriptProperties();
    const apiKey     = props.getProperty('GEMINI_API_KEY');
    const targetMail = props.getProperty('ALERT_EMAILS');

    if (!apiKey)     throw new Error('GEMINI_API_KEY がスクリプトプロパティに設定されていません。');
    if (!targetMail) throw new Error('ALERT_EMAILS がスクリプトプロパティに設定されていません。');

    const today    = new Date();
    const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy/MM/dd');
    const todayISO = Utilities.formatDate(today, 'UTC', 'yyyy年MM月dd日');
    const monthEN  = Utilities.formatDate(today, 'UTC', 'MMMM');

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL_NAME}:generateContent?key=${apiKey}`;

    Logger.log(`[${todayStr}] 並列リクエスト開始 (${COUNTRIES_DEF.length} 地域)`);

    const fetchRequests = COUNTRIES_DEF.map(c => buildRequest(apiEndpoint, c, todayISO, monthEN, getRecentHeadlines(c.name)));
    const responses     = UrlFetchApp.fetchAll(fetchRequests);

    Logger.log('全レスポンス受信完了。パース＆取得チェックを開始します。');

    const allNews     = [];
    const retryNeeded = [];

    responses.forEach((res, idx) => {
      const c     = COUNTRIES_DEF[idx];
      const items = parseResponse(res, c, monthEN);
      const isFallback = items.length === 1 && items[0].title === `${c.name}の最新動向`;

      if (isFallback) {
        Logger.log(`[RETRY NEEDED] ${c.name}: フォールバック検出。リトライキューに追加。`);
        retryNeeded.push({ idx, countryDef: c });
      }

      allNews.push({
        country:      c.name,
        label:        c.label,
        subLabel:     c.subLabel,
        emoji:        c.emoji,
        isIndia:      c.isIndia,
        isCity:       !!c.isCity,
        code:         c.code,
        anchorPrefix: c.anchorPrefix,
        tocTag:       c.tocTag,
        sectionTitle: c.sectionTitle,
        items,
      });
    });

    if (retryNeeded.length > 0) {
      Logger.log(`[RETRY] ${retryNeeded.length}地域をリトライします。`);

      for (const { idx, countryDef } of retryNeeded) {
        let retryItems = null;

        for (let attempt = 1; attempt <= CONFIG.MAX_RETRY; attempt++) {
          Logger.log(`[RETRY] ${countryDef.name}: 試行 ${attempt}/${CONFIG.MAX_RETRY}`);
          Utilities.sleep(2000 * attempt);

          const req      = buildRequest(apiEndpoint, countryDef, todayISO, monthEN, getRecentHeadlines(countryDef.name));
          const retryRes = UrlFetchApp.fetch(req.url, {
            method:             req.method,
            contentType:        req.contentType,
            payload:            req.payload,
            muteHttpExceptions: true,
          });

          const items      = parseResponse(retryRes, countryDef, monthEN);
          const isFallback = items.length === 1 && items[0].title === `${countryDef.name}の最新動向`;

          if (!isFallback) {
            Logger.log(`[RETRY SUCCESS] ${countryDef.name}: 試行${attempt}で取得成功 (${items.length}件)`);
            retryItems = items;
            break;
          }
          Logger.log(`[RETRY FAIL] ${countryDef.name}: 試行${attempt}も失敗。`);
        }

        if (retryItems) {
          allNews[idx].items = retryItems;
        } else {
          Logger.log(`[WARN] ${countryDef.name}: ${CONFIG.MAX_RETRY}回リトライしても取得できませんでした。フォールバックのまま送信。`);
        }
      }
    }

    saveHeadlinesToHistory(allNews, todayStr);

    const { subject, htmlBody, plainBody } = buildEmail(today, todayStr, allNews);

    const { to: mainTo, bcc: mainBcc } = splitToAndBcc(targetMail);
    GmailApp.sendEmail(mainTo, subject, plainBody, {
      htmlBody: htmlBody,
      bcc:      mainBcc,
    });

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    Logger.log(`送信完了。所要時間: ${elapsed}秒`);

  } catch (e) {
    Logger.log(`[FATAL] ${e.stack}`);
    const errorMail = PropertiesService.getScriptProperties().getProperty('ALERT_EMAILS') || '';
    if (errorMail) {
      const { to: errTo, bcc: errBcc } = splitToAndBcc(errorMail);
      GmailApp.sendEmail(errTo, `【エラー】${CONFIG.EMAIL_SUBJECT} - 実行失敗`, `エラーが発生しました。\n\n${e.stack}`, { bcc: errBcc });
    }
  }
}

function historyCutoffStr() {
  // "yyyy/MM/dd" は桁が揃うため文字列比較でそのまま日付順になる。
  // new Date("yyyy-MM-dd") はUTC真夜中として解釈されるため、
  // ローカルタイムゾーンで作った todayStr とDateオブジェクトで比較すると
  // タイムゾーン分のズレが出る問題を避けるため、文字列比較に統一する。
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CONFIG.HISTORY_DAYS);
  return Utilities.formatDate(cutoff, Session.getScriptTimeZone(), 'yyyy/MM/dd');
}

function getRecentHeadlines(countryName) {
  const props = PropertiesService.getScriptProperties();
  const raw   = props.getProperty(`HEADLINE_HISTORY_${countryName}`);
  if (!raw) return [];

  let history;
  try { history = JSON.parse(raw); } catch (e) { return []; }

  const cutoffStr = historyCutoffStr();

  const titles = [];
  history
    .filter(entry => entry.date >= cutoffStr)
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach(entry => titles.push(...entry.titles));

  return [...new Set(titles)].slice(0, CONFIG.HISTORY_MAX);
}

function saveHeadlinesToHistory(allNews, todayStr) {
  const props     = PropertiesService.getScriptProperties();
  const cutoffStr = historyCutoffStr();

  allNews.forEach(({ country, items }) => {
    const key = `HEADLINE_HISTORY_${country}`;
    let history = [];
    const raw = props.getProperty(key);
    if (raw) { try { history = JSON.parse(raw); } catch (e) { history = []; } }

    // 同日の再実行では既存エントリを置き換える（重複追加による除外リストの肥大化を防ぐ）
    history = history.filter(entry => entry.date !== todayStr && entry.date >= cutoffStr);
    history.push({ date: todayStr, titles: items.map(i => i.title) });
    props.setProperty(key, JSON.stringify(history));
  });
}

function buildRequest(endpoint, countryDef, todayISO, monthEN, recentHeadlines) {
  const exampleOutput = JSON.stringify([
    {
      title: "インド準備銀行が政策金利を0.25%引き下げ、6年ぶりの最低水準に",
      summary: "RBIは6月11日の会合でレポレートを6.25%から6.00%に引き下げ、成長支援を優先する姿勢を示した。これはCPI前年比が4.2%と目標圏内に収まったことを受けた判断であり、ルピーは一時1ドル=84.3ルピーまで下落した。",
      search_keywords: `India economy policy ${monthEN}`
    }
  ], null, 2);

  const indiaExtra = countryDef.name === 'インド'
    ? `STRICT SCOPE — NATIONAL INDIA ONLY:\n` +
      `- Report ONLY national-level India news: central government policy, RBI/SEBI decisions, national economy, India-wide industry trends, international relations, nationwide social issues.\n` +
      `- EXCLUDE any story whose primary focus is the local affairs of Delhi/NCR, Gurugram, Mumbai, Kolkata or Chennai ` +
      `(e.g. municipal news, city metro updates, city property markets, local infrastructure). ` +
      `Each of those cities has its own dedicated section in this digest.\n` +
      `- A story is acceptable only if it would matter equally to a reader in Delhi, Mumbai, Chennai and Kolkata alike — not to the residents of one city.\n\n` +
      `CATEGORY BALANCE — there are only ${countryDef.count} slots, so pick the ${countryDef.count} biggest national stories of the day ` +
      `and spread them across different categories rather than filling the section with economy/business:\n` +
      `- Economy & Business (RBI, markets, corporate earnings, trade): 1–2 items\n` +
      `- Politics & Policy (central government, elections, diplomacy, legislation): about 1 item\n` +
      `- Technology & Startups (IT sector, unicorns, digital policy, AI): about 1 item\n` +
      `- Society, Culture & Environment (education, healthcare, climate, social issues) or International Relations / Defense: about 1 item\n` +
      `- Do NOT return more than 2 items from the Economy & Business category.\n` +
      `- Do NOT return two items from the same category unless nothing else of national significance happened today.\n\n`
    : '';

  const delhiExtra = countryDef.name === 'インド（デリー・グルガオン）'
    ? `STRICT SCOPE — DELHI & GURUGRAM LOCAL ONLY:\n` +
      `- Report ONLY news physically located in or directly about Delhi (New Delhi, NCR) or Gurugram (Gurgaon).\n` +
      `- Acceptable topics: Delhi/Gurugram local governance, Delhi Metro updates, NCR infrastructure, Gurugram corporate/startup local news, Delhi air quality/weather, local crime, NCR real estate, Delhi municipal issues.\n` +
      `- EXCLUDE national India news, central government policy, or any story that merely mentions Delhi as a dateline but is actually a national story.\n` +
      `- Every story must be genuinely LOCAL to Delhi or Gurugram — something that would NOT be reported as a top story in Mumbai or Chennai.\n` +
      `- Search queries must include "Delhi" or "Gurugram" or "NCR" as explicit keywords.\n\n` +
      `CATEGORY BALANCE — the ${countryDef.count} items MUST be a mix across these local categories, not dominated by one type:\n` +
      `- Governance & Infrastructure (Metro, roads, municipal projects): about 3 items\n` +
      `- Corporate / Gurugram Business (office market, startups, local industry): about 2 items\n` +
      `- Environment & Health (air quality, water, hospitals): about 2 items\n` +
      `- Real Estate & Urban Development: about 1 item\n` +
      `- Crime & Public Safety: about 1 item\n` +
      `- Culture, Education & Society (local events, schools): about 1 item\n` +
      `- Do NOT return more than 4 items from the Governance & Infrastructure category.\n\n`
    : '';

  const cityScope = CITY_SCOPES[countryDef.anchorPrefix];
  const cityExtra = cityScope
    ? `STRICT SCOPE — ${cityScope.area} LOCAL ONLY:\n` +
      `- Report ONLY news physically located in, or directly about, ${cityScope.area}.\n` +
      `- Acceptable topics: ${cityScope.topics}.\n` +
      `- EXCLUDE national India news and central government policy, and EXCLUDE any story that merely carries a ` +
      `${cityScope.short} dateline while actually being a national story.\n` +
      `- EXCLUDE anything whose primary focus is Delhi or Gurugram — that has its own separate section.\n` +
      `- Every story must be genuinely LOCAL: something the city's own newspaper would run on its city page, ` +
      `not something that would lead the national front page.\n` +
      `- Search queries must include ${cityScope.keywords} as explicit keywords.\n` +
      `- The PRIORITY SOURCES listed below are this city's own local outlets. Search them first, and only fall back ` +
      `to national outlets' city editions when the local ones have nothing fresh.\n\n` +
      `TOPIC SPREAD — the ${countryDef.count} items MUST cover ${countryDef.count} DIFFERENT topics ` +
      `(for example, do not return two transport stories). With so few slots, choose the ${countryDef.count} stories ` +
      `with the greatest impact on city residents and on Japanese companies operating there.\n\n`
    : '';

  const avoidExtra = (recentHeadlines && recentHeadlines.length > 0)
    ? `FRESHNESS FIRST: Your top priority is still genuinely NEW stories from the last 24–48 hours, as instructed below. ` +
      `The list here exists ONLY to stop you from sending the exact same headline again that was already sent yesterday/the day before:\n` +
      recentHeadlines.map(t => `- ${t}`).join('\n') + `\n` +
      `If the underlying story has a genuinely NEW development since then (e.g. an actual new policy decision, not just further analysis of an old one), ` +
      `it is fine to report it again with the new angle. Otherwise, actively search for different fresh stories instead of rehashing these.\n\n`
    : '';

  const middleEastExtra = countryDef.name === '中東・ガルフ諸国'
    ? `FOCUS: Prioritize news about Gulf Cooperation Council (GCC) countries — UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman. ` +
      `Include geopolitical developments, oil/energy markets, Gulf War related tensions, Iran-related news, and economic developments in the Gulf region.\n\n`
    : '';

  const systemText =
    `You are an elite financial news editor specializing in Asian and Middle Eastern markets. ` +
    `Your ONLY output must be a valid JSON array — no markdown, no prose, no URLs in text fields. ` +
    `Do NOT include citation markers like [cite: N] or [1] anywhere in the output. ` +
    `Each search_keywords must be exactly 3–4 words: at least one proper noun (company/country/city) + "${monthEN}". ` +
    `No symbols ($, %, comma, quotes, decimals) in search_keywords.`;

  const userText =
    `Today is ${todayISO}. Use googleSearch to find news about "${countryDef.name}".\n\n` +
    indiaExtra +
    delhiExtra +
    cityExtra +
    middleEastExtra +
    avoidExtra +
    `TASK: Return EXACTLY ${countryDef.count} news items. This is mandatory.\n` +
    `- Search for stories published in the last 24–48 hours.\n` +
    `- If you cannot find ${countryDef.count} stories from today, fill remaining slots with ` +
    `the most recent and relevant stories from the last 72 hours. Never return fewer than ${countryDef.count} items.\n\n` +
    `PRIORITY SOURCES: ${countryDef.domains}\n` +
    `FALLBACK SOURCES: Reuters, Bloomberg, BBC, AP\n\n` +
    `RULES:\n` +
    `1. No duplicate topics.\n` +
    `2. title: Japanese headline with specific numeric data (%, ¥, $, etc.).\n` +
    `3. summary: Exactly 2–3 Japanese sentences (100–150 chars). No line breaks inside. No citation markers.\n` +
    `4. search_keywords: 3–4 English words only. Include one proper noun + "${monthEN}".\n\n` +
    `OUTPUT: Return ONLY a valid JSON array with exactly ${countryDef.count} objects. No markdown fences. No explanation.\n` +
    `Example:\n${exampleOutput}`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: userText }] }],
    tools:    [{ googleSearch: {} }],
    systemInstruction: { parts: [{ text: systemText }] },
    generationConfig: { maxOutputTokens: 8192 },
  };

  return {
    url:              endpoint,
    method:           'post',
    contentType:      'application/json',
    payload:          JSON.stringify(payload),
    muteHttpExceptions: true,
  };
}

function parseResponse(response, countryDef, monthEN) {
  const fallbackItem = [{
    title:   `${countryDef.name}の最新動向`,
    summary: `${countryDef.name}に関する本日のトップニュースを取得できませんでした。公式メディアを直接ご確認ください。`,
    url:     buildSearchUrl(`${countryDef.name} news ${monthEN}`),
  }];

  const code = response.getResponseCode();
  if (code !== 200) { Logger.log(`[WARN] ${countryDef.name}: HTTP ${code}`); return fallbackItem; }

  let apiJson;
  try { apiJson = JSON.parse(response.getContentText()); }
  catch (e) { Logger.log(`[WARN] ${countryDef.name}: JSONパース失敗`); return fallbackItem; }

  if (!apiJson.candidates || apiJson.candidates.length === 0) {
    Logger.log(`[WARN] ${countryDef.name}: candidates 空`); return fallbackItem;
  }

  const candidate    = apiJson.candidates[0];
  const finishReason = candidate.finishReason || '不明';
  if (finishReason === 'MAX_TOKENS') Logger.log(`[WARN] ${countryDef.name}: MAX_TOKENS 途中切断`);

  const parts = candidate?.content?.parts;
  if (!parts || parts.length === 0) {
    Logger.log(`[WARN] ${countryDef.name}: parts 空 finishReason=${finishReason}`); return fallbackItem;
  }

  let rawText = parts.filter(p => p.text).map(p => p.text).join('');
  rawText = rawText.replace(/```[a-zA-Z]*\s*/g, '').replace(/```/g, '');
  rawText = rawText.replace(/\s*\[cite\s*:\s*\d+\]/g, '').trim();

  const firstBracket = rawText.indexOf('[');
  if (firstBracket === -1) { Logger.log(`[WARN] ${countryDef.name}: [ なし`); return fallbackItem; }

  let depth = 0, inStr = false, escape = false, endIdx = -1;
  for (let i = firstBracket; i < rawText.length; i++) {
    const ch = rawText[i];
    if (escape)      { escape = false; continue; }
    if (ch === '\\') { escape = true;  continue; }
    if (ch === '"')  { inStr = !inStr; continue; }
    if (inStr)       { continue; }
    if (ch === '[' || ch === '{') depth++;
    if (ch === ']' || ch === '}') depth--;
    if (depth === 0 && ch === ']') { endIdx = i; break; }
  }

  if (endIdx === -1) {
    if (finishReason === 'MAX_TOKENS') {
      let partial = rawText.slice(firstBracket).trimEnd();
      if (!partial.endsWith('}')) partial += '"}';
      if (!partial.endsWith(']')) partial += ']';
      try {
        const rescued = JSON.parse(partial);
        if (Array.isArray(rescued) && rescued.length > 0) {
          Logger.log(`[INFO] ${countryDef.name}: 救済成功 ${rescued.length}件`);
          return rescued.slice(0, countryDef.count).map(item => normalizeItem(item, monthEN));
        }
      } catch (e) { Logger.log(`[WARN] ${countryDef.name}: 救済失敗 ${e.message}`); }
    }
    Logger.log(`[WARN] ${countryDef.name}: JSON 完結せず`); return fallbackItem;
  }

  let newsArray;
  try { newsArray = JSON.parse(rawText.slice(firstBracket, endIdx + 1)); }
  catch (e) { Logger.log(`[WARN] ${countryDef.name}: parse失敗 ${e.message}`); return fallbackItem; }

  if (!Array.isArray(newsArray) || newsArray.length === 0) {
    Logger.log(`[WARN] ${countryDef.name}: 空配列`); return fallbackItem;
  }

  Logger.log(`[INFO] ${countryDef.name}: 成功 ${newsArray.length}件`);
  return newsArray.slice(0, countryDef.count).map(item => normalizeItem(item, monthEN));
}

function normalizeItem(item, monthEN) {
  const title   = (item.title   || '最新トップニュース').trim();
  const summary = (item.summary || '詳細は下記リンクよりご確認ください。').trim();
  let   kw      = (item.search_keywords || title).trim();
  kw = kw.replace(/["""''`,.\$%]/g, '').replace(/\s+/g, ' ').trim();
  if (!kw.toLowerCase().includes(monthEN.toLowerCase())) kw = `${kw} ${monthEN}`;
  return { title, summary, url: buildSearchUrl(kw) };
}

function buildSearchUrl(keywords) {
  return `https://www.google.com/search?q=${encodeURIComponent(keywords)}&tbm=nws&tbs=qdr:h30`;
}

function buildEmail(today, todayStr, allNews) {
  const subject = `日刊 The Indo-Asian Digest（インド・アジアン・ダイジェスト） - ${todayStr}`;

  // ★ デザイン刷新（claude.ai/design「Indo-Asian Digest Redesign」に準拠）
  //   配色（サフラン/グリーン/ネイビー）は維持し、レイアウトのみ刷新。
  //   ヘッダー/サブヘッダーの背景写真は画像専用の公開GitHubリポジトリ（Sky-GL/digest-assets）から配信。
  const SAFFRON        = '#FF9933';
  const GREEN           = '#C2E0C6';
  const GTXT            = '#1a3320';
  const NAVY            = '#000080';
  const ACCENT          = '#B25900'; // インド絻リンク・タグ色（白背景でも視認性の高い濃橙）
  const OUTER_BG         = '#e7e3da';
  const CARD_BORDER      = 'rgba(34,31,28,0.1)';
  const DARK_TEXT        = '#221f1c';
  const BODY_TEXT        = '#4a453f';
  const BODY_TEXT_2      = '#5c5750';
  const OTHER_CARD_BG    = '#f5f3ee';
  const FOOTER_BG        = '#221f1c';
  const FONT_HEAD        = `'Archivo',Helvetica,Arial,sans-serif`;
  const FONT_BODY        = `Helvetica,Arial,sans-serif`;

  // 背景写真は画像専用の公開GitHubリポジトリ（Sky-GL/digest-assets）から配信。
  // data:URIやGoogle Driveリンクは配信時にGmailが除去/不安定化するため、raw.githubusercontent.com経由に統一した。
  const headerPhotoUrl    = 'https://raw.githubusercontent.com/Sky-GL/digest-assets/main/header.jpg';
  const subheaderPhotoUrl = 'https://raw.githubusercontent.com/Sky-GL/digest-assets/main/subheader.jpg';

  const tz = Session.getScriptTimeZone();
  // Utilities.formatDate の 'u'（ISO曜日番号）パターンの対応可否に依存しないよう、
  // yyyy/M/d を数値取得してから Date.UTC + getUTCDay() で曜日を確実に算出する。
  const [dY, dM, dD] = Utilities.formatDate(today, tz, 'yyyy/M/d').split('/').map(Number);
  const weekdayJP  = ['日', '月', '火', '水', '木', '金', '土'][new Date(Date.UTC(dY, dM - 1, dD)).getUTCDay()];
  const dateLabel  = `${dY}年${dM}月${dD}日（${weekdayJP}）`;

  const totalItems      = allNews.reduce((sum, s) => sum + s.items.length, 0);
  const storyCountLabel = `${totalItems}本のニュース・${allNews.length}エリア`;

  const indiaSections   = allNews.filter(s => s.isIndia);
  const otherSections   = allNews.filter(s => !s.isIndia);
  const indiaNational   = indiaSections.find(s => s.anchorPrefix === 'india');
  const delhiSection    = indiaSections.find(s => s.anchorPrefix === 'delhi');
  const citySections    = indiaSections.filter(s => s.isCity);

  function tocColumn(sections, tagColor, maxItemsPerSection, showTag) {
    if (showTag === undefined) showTag = true;
    let html = '';
    sections.forEach(s => {
      const items = maxItemsPerSection ? s.items.slice(0, maxItemsPerSection) : s.items;
      items.forEach((item, i) => {
        const tagHtml = showTag ? `<span style="font-size:10px;font-weight:800;color:${tagColor};margin-right:8px;">${escapeHtml(s.tocTag)}</span>` : '';
        html += `
          <a href="#${s.anchorPrefix}-${i}" style="display:block;font-size:13.5px;line-height:1.55;color:${DARK_TEXT};text-decoration:none;padding:5px 0;border-bottom:1px solid ${CARD_BORDER};">
            ${tagHtml}${escapeHtml(item.title)}
          </a>`;
      });
    });
    return html;
  }

  const tocHtml = `
    <div style="font-family:${FONT_HEAD};font-weight:800;font-size:10.5px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8479;margin-bottom:14px;">本日の見出し一覧</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px;"><tr>
      <td style="width:50%;vertical-align:top;padding-right:13px;">
        <div style="font-size:11px;font-weight:800;color:${ACCENT};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">インド — 全国</div>
        ${tocColumn(indiaNational ? [indiaNational] : [], ACCENT, null, false)}
      </td>
      <td style="width:50%;vertical-align:top;padding-left:13px;">
        <div style="font-size:11px;font-weight:800;color:${ACCENT};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">デリー / グルガオン</div>
        ${tocColumn(delhiSection ? [delhiSection] : [], ACCENT, null, false)}
      </td>
    </tr></table>
    <div style="border-top:1px solid ${CARD_BORDER};padding-top:14px;margin-bottom:16px;">
      <div style="font-size:11px;font-weight:800;color:${ACCENT};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">インド主要都市</div>
      ${tocColumn(citySections, ACCENT, null, true)}
    </div>
    <div style="border-top:1px solid ${CARD_BORDER};padding-top:14px;">
      <div style="font-size:11px;font-weight:800;color:${NAVY};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">アジア・中東</div>
      ${tocColumn(otherSections, NAVY, 1)}
    </div>`;

  // トップ記事カード以外の通常行。全国・デリーの2件目以降と、都市セクションの全件で共用する。
  function indiaItemRow(section, item, idx) {
    return `
      <div style="padding:13px 0;border-bottom:1px solid ${CARD_BORDER};">
        <a name="${section.anchorPrefix}-${idx}"></a>
        <div style="font-weight:700;font-size:14.5px;color:${DARK_TEXT};line-height:1.5;margin-bottom:4px;">${escapeHtml(item.title)}</div>
        <div style="font-size:13px;line-height:1.7;color:${BODY_TEXT_2};margin-bottom:6px;">${escapeHtml(item.summary)}</div>
        <a href="${item.url}" style="font-size:12px;font-weight:700;color:${ACCENT};text-decoration:none;">Google Newsで確認 →</a>
      </div>`;
  }

  function indiaStyleSection(section) {
    const [topItem, ...restItems] = section.items;

    const headerHtml = `
        <div style="background:${SAFFRON};padding:14px 28px;">
          <span style="font-family:${FONT_HEAD};font-weight:800;color:#ffffff;font-size:15px;">${section.code} ${escapeHtml(section.sectionTitle)}</span>
        </div>`;

    // 各2本の都市セクションはトップ記事の大見出しを使わず、コンパクトな一覧で出す。
    // （大見出しブロックがインド系5セクションで連続すると本文が読みづらくなるため）
    if (section.isCity) {
      return `
      <div>${headerHtml}
        <div style="padding:16px 28px 4px;">${section.items.map((item, i) => indiaItemRow(section, item, i)).join('')}</div>
      </div>`;
    }

    const topHtml = topItem ? `
      <div style="border:1px solid ${CARD_BORDER};margin-bottom:18px;">
        <div style="padding:18px 20px;">
          <a name="${section.anchorPrefix}-0"></a>
          <span style="background:${GREEN};color:${GTXT};font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding:3px 8px;">トップ記事</span>
          <div style="font-family:${FONT_HEAD};font-weight:800;font-size:19px;line-height:1.3;color:${DARK_TEXT};margin:10px 0 8px;">${escapeHtml(topItem.title)}</div>
          <div style="font-size:14px;line-height:1.75;color:${BODY_TEXT};margin-bottom:10px;">${escapeHtml(topItem.summary)}</div>
          <a href="${topItem.url}" style="font-size:12.5px;font-weight:700;color:${ACCENT};text-decoration:none;">Google Newsで確認 →</a>
        </div>
      </div>` : '';

    const restHtml = restItems.map((item, i) => indiaItemRow(section, item, i + 1)).join('');

    return `
      <div>${headerHtml}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr><td background="${subheaderPhotoUrl}" bgcolor="${GREEN}" style="background-color:${GREEN};padding:8px 28px;">
          <span style="font-family:${FONT_HEAD};font-weight:800;font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:${GTXT};text-shadow:0 1px 2px rgba(255,255,255,0.6);">トップニュース</span>
        </td></tr></table>
        <div style="padding:20px 28px 4px;">${topHtml}${restHtml}</div>
      </div>`;
  }

  const indiaBodyHtml = indiaSections.map(indiaStyleSection).join('');

  const otherBodyHtml = otherSections.map(section => `
    <div style="background:${OTHER_CARD_BG};border-top:3px solid ${NAVY};padding:16px 20px;margin-bottom:14px;">
      <div style="margin-bottom:10px;">
        <span style="background:${NAVY};color:#ffffff;font-family:${FONT_HEAD};font-weight:800;font-size:11px;letter-spacing:0.04em;padding:3px 8px;">${section.code}</span>
        <span style="font-weight:700;font-size:14px;color:${DARK_TEXT};margin-left:8px;">${escapeHtml(section.label)}</span>
      </div>
      ${section.items.map((item, i) => `
        <div style="padding:11px 0;border-bottom:1px solid ${CARD_BORDER};">
          <a name="${section.anchorPrefix}-${i}"></a>
          <div style="font-weight:700;font-size:14px;color:${DARK_TEXT};line-height:1.5;margin-bottom:4px;">${escapeHtml(item.title)}</div>
          <div style="font-size:12.5px;line-height:1.65;color:${BODY_TEXT_2};margin-bottom:6px;">${escapeHtml(item.summary)}</div>
          <a href="${item.url}" style="font-size:11.5px;font-weight:700;color:${NAVY};text-decoration:none;">Google Newsで確認 →</a>
        </div>`).join('')}
    </div>`).join('');

  // ニュース由来のテキスト（見出し等）だけをサロゲートペア対策の対象にする。
  // htmlBody全体（base64画像を含む）に対して都度スキャンするのは無駄なため、ここで先に処理しておく。
  const compressedToc       = encodeAstralEntities(tocHtml.replace(/\s{2,}/g, ' ').replace(/>\s+</g, '><'));
  const compressedIndiaBody = encodeAstralEntities(indiaBodyHtml.replace(/\s{2,}/g, ' ').replace(/>\s+</g, '><'));
  const compressedOtherBody = encodeAstralEntities(otherBodyHtml.replace(/\s{2,}/g, ' ').replace(/>\s+</g, '><'));

  function triColorBar(marginBottom) {
    return `<table style="width:100%;border-collapse:collapse;${marginBottom ? `margin-bottom:${marginBottom}px;` : ''}"><tr>
<td style="width:33.33%;height:4px;background:${SAFFRON};font-size:0;line-height:0;">&nbsp;</td>
<td style="width:33.33%;height:4px;background:${GREEN};font-size:0;line-height:0;">&nbsp;</td>
<td style="width:33.34%;height:4px;background:${NAVY};font-size:0;line-height:0;">&nbsp;</td>
</tr></table>`;
  }

  const htmlBody = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&display=swap');</style>
</head>
<body style="margin:0;padding:0;background:${OUTER_BG};font-family:${FONT_BODY};">
<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid ${CARD_BORDER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
<tr><td background="${headerPhotoUrl}" bgcolor="${SAFFRON}" style="background-color:${SAFFRON};padding:22px 28px 24px;">
<div style="font-family:${FONT_HEAD};font-weight:800;font-size:10.5px;letter-spacing:0.16em;text-transform:uppercase;color:#ffffff;text-shadow:0 1px 3px rgba(0,0,0,0.45);margin-bottom:8px;">DAISO India 社内向けニュースダイジェスト</div>
<div style="font-family:${FONT_HEAD};font-weight:800;font-size:30px;line-height:1.05;letter-spacing:-0.01em;color:#ffffff;text-shadow:0 1px 4px rgba(0,0,0,0.4);">The Indo-Asian Digest</div>
<table style="width:100%;border-collapse:collapse;margin-top:16px;"><tr>
<td style="font-size:13px;color:#ffffff;text-shadow:0 1px 3px rgba(0,0,0,0.5);">${dateLabel}</td>
<td style="text-align:right;font-size:13px;color:#ffffff;text-shadow:0 1px 3px rgba(0,0,0,0.5);">${storyCountLabel}</td>
</tr></table>
</td></tr></table>
<div style="height:4px;background:${GREEN};"></div>
<div style="padding:24px 28px 22px;border-bottom:2px solid ${CARD_BORDER};">${compressedToc}</div>
${compressedIndiaBody}
<div style="padding:24px 28px 8px;">
<div style="font-family:${FONT_HEAD};font-weight:800;font-size:10.5px;letter-spacing:0.14em;text-transform:uppercase;color:${NAVY};margin-bottom:16px;">アジア・中東の国々</div>
${compressedOtherBody}
</div>
<div style="padding:26px 28px;background:${FOOTER_BG};">
${triColorBar(16)}
<div style="font-family:${FONT_HEAD};font-weight:800;font-size:13px;color:#ffffff;letter-spacing:0.02em;margin-bottom:6px;">The Indo-Asian Digest</div>
<div style="font-size:12px;line-height:1.6;color:rgba(255,255,255,0.6);">DAISO India 社内配信専用。本メールはGoogle Apps Scriptにより毎日自動配信されています。リンクはGoogle News経由（過去30時間以内）でフィルタリング済みです。</div>
<div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:10px;">${CONFIG.APP_VERSION}</div>
</div>
</div>
</body></html>`;

  let plainBody = `The Indo-Asian Digest（インド・アジアン・ダイジェスト）\n`;
  plainBody += `${dateLabel}　${storyCountLabel}\n\n`;
  plainBody += `${'='.repeat(60)}\nHeadlines\n${'='.repeat(60)}\n`;
  allNews.forEach(({ label, emoji, items }) => {
    items.forEach(item => { plainBody += `${emoji} ${label} — ${item.title}\n`; });
  });
  plainBody += `\n${'='.repeat(60)}\nDetails\n${'='.repeat(60)}\n\n`;
  allNews.forEach(({ label, emoji, items }) => {
    plainBody += `${emoji} ${label}\n${'-'.repeat(50)}\n`;
    items.forEach(item => { plainBody += `${item.title}\n${item.summary}\n${item.url}\n\n`; });
  });
  plainBody += `${'='.repeat(60)}\nThe Indo-Asian Digest — DAISO India\n${CONFIG.APP_VERSION}`;

  return { subject, htmlBody, plainBody };
}

function encodeAstralEntities(str) {
  // GmailApp.sendEmail() はサロゲートペア文字（国旗絵文字など U+10000 以上）を
  // MIME生成時に文字化けさせる既知の不具合があるため、HTML数値文字参照に変換して回避する。
  return String(str).replace(/[\u{10000}-\u{10FFFF}]/gu, ch => `&#x${ch.codePointAt(0).toString(16).toUpperCase()};`);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}