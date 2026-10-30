// ============================================================================
// TIMELINE UP OR DOWN — GLOBAL HISTORY & INVENTION STREAK CHALLENGE ENGINE
// ============================================================================

(function () {
  "use strict";

  const DECK_KEY = "timeline";
  const GLOW_COLOR = "#f59e0b";
  // After a correct answer the next round starts on its own after this long (sooner via "Next" / Enter)
  const AUTO_ADVANCE_MS = 4000;

  function trackEvent(eventName, params) {
    if (typeof window.gtag === "function") {
      try {
        window.gtag("event", eventName, Object.assign({ game_mode: DECK_KEY, lang: state.lang }, params || {}));
      } catch (_) {}
    }
  }

  // --------------------------------------------------------------------------
  // SAFE STORAGE (localStorage throws when blocked, e.g. in some in-app browsers)
  // --------------------------------------------------------------------------
  const memoryStorage = {};

  function readStorage(key) {
    if (Object.prototype.hasOwnProperty.call(memoryStorage, key)) return memoryStorage[key];
    try {
      return window.localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function writeStorage(key, value) {
    memoryStorage[key] = value;
    try {
      window.localStorage.setItem(key, value);
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // GAME STATE
  // --------------------------------------------------------------------------
  const state = {
    lang: detectInitialLang(),
    streak: 0,
    targetStreak: detectChallengeTarget(),
    isRevealing: false,
    waitingForNext: false,
    advanceTimer: null,
    usedIds: new Set(),
    leftItem: null,
    rightItem: null,
    historyEmojis: [] // ['🟩', '🟩', '💥']
  };

  // --------------------------------------------------------------------------
  // LANGUAGE & FORMATTING HELPERS
  // --------------------------------------------------------------------------
  function detectInitialLang() {
    try {
      const params = new URLSearchParams(window.location.search);
      const qLang = params.get("lang");
      if (qLang && window.GAME_I18N && window.GAME_I18N[qLang]) return qLang;
    } catch (_) {}
    const saved = readStorage("updown_lang");
    if (saved && window.GAME_I18N[saved]) return saved;
    const nav = (navigator.language || "ko").toLowerCase();
    if (nav.startsWith("ko")) return "ko";
    if (nav.startsWith("ja")) return "ja";
    if (nav.startsWith("zh")) return "zh";
    return "en";
  }

  function detectChallengeTarget() {
    try {
      const params = new URLSearchParams(window.location.search);
      const tVal = parseInt(params.get("target") || "0", 10);
      return Number.isFinite(tVal) && tVal > 0 ? tVal : 0;
    } catch (_) {
      return 0;
    }
  }

  function t() {
    return window.GAME_I18N[state.lang] || window.GAME_I18N.en;
  }

  function formatValue(val) {
    const yr = Math.round(val);
    if (state.lang === "ko") return `${yr}년`;
    if (state.lang === "ja" || state.lang === "zh") return `${yr}年`;
    return `${yr}`;
  }

  function getBestStreak() {
    return parseInt(readStorage("updown_best_timeline") || "0", 10) || 0;
  }

  function setBestStreak(score) {
    const prev = getBestStreak();
    if (score > prev) {
      writeStorage("updown_best_timeline", String(score));
    }
  }

  // --------------------------------------------------------------------------
  // DOM ELEMENTS
  // --------------------------------------------------------------------------
  const els = {
    challengeBanner: document.getElementById("challengeBanner"),
    challengeBannerText: document.getElementById("challengeBannerText"),
    quickShareBtn: document.getElementById("quickShareBtn"),
    lblQuickShare: document.getElementById("lblQuickShare"),
    lblCurrentStreak: document.getElementById("lblCurrentStreak"),
    lblBestStreak: document.getElementById("lblBestStreak"),
    currentStreakVal: document.getElementById("currentStreakVal"),
    bestStreakVal: document.getElementById("bestStreakVal"),
    langBtns: document.querySelectorAll(".lang-btn"),

    leftCard: document.getElementById("leftCard"),
    rightCard: document.getElementById("rightCard"),
    leftBgPhoto: document.getElementById("leftBgPhoto"),
    rightBgPhoto: document.getElementById("rightBgPhoto"),
    leftGlow: document.getElementById("leftGlow"),
    rightGlow: document.getElementById("rightGlow"),
    leftPhoto: document.getElementById("leftPhoto"),
    rightPhoto: document.getElementById("rightPhoto"),
    leftPhotoCredit: document.getElementById("leftPhotoCredit"),
    rightPhotoCredit: document.getElementById("rightPhotoCredit"),
    leftEmoji: document.getElementById("leftEmoji"),
    rightEmoji: document.getElementById("rightEmoji"),
    leftTitle: document.getElementById("leftTitle"),
    rightTitle: document.getElementById("rightTitle"),
    leftValue: document.getElementById("leftValue"),

    leftFactCard: document.getElementById("leftFactCard"),
    leftLblOrigin: document.getElementById("leftLblOrigin"),
    leftNote: document.getElementById("leftNote"),
    leftLblBasis: document.getElementById("leftLblBasis"),
    leftBasis: document.getElementById("leftBasis"),
    leftSourceName: document.getElementById("leftSourceName"),
    leftSourceLink: document.getElementById("leftSourceLink"),

    guessActions: document.getElementById("guessActions"),
    btnHigher: document.getElementById("btnHigher"),
    btnLower: document.getElementById("btnLower"),
    higherBtnText: document.getElementById("higherBtnText"),
    lowerBtnText: document.getElementById("lowerBtnText"),
    higherSubText: document.getElementById("higherSubText"),
    lowerSubText: document.getElementById("lowerSubText"),

    rightValueBox: document.getElementById("rightValueBox"),
    rightValue: document.getElementById("rightValue"),
    verdictPill: document.getElementById("verdictPill"),
    nextBtn: document.getElementById("nextBtn"),
    nextProgress: document.getElementById("nextProgress"),
    lblNext: document.getElementById("lblNext"),

    rightFactCard: document.getElementById("rightFactCard"),
    rightLblOrigin: document.getElementById("rightLblOrigin"),
    rightNote: document.getElementById("rightNote"),
    rightLblBasis: document.getElementById("rightLblBasis"),
    rightBasis: document.getElementById("rightBasis"),
    rightSourceName: document.getElementById("rightSourceName"),
    rightSourceLink: document.getElementById("rightSourceLink"),

    vsCircle: document.getElementById("vsCircle"),
    vsText: document.getElementById("vsText"),
    keyboardHint: document.getElementById("keyboardHint"),
    creditsLink: document.getElementById("creditsLink"),
    creditsLinkModal: document.getElementById("creditsLinkModal"),

    gameOverModal: document.getElementById("gameOverModal"),
    gameOverTitle: document.getElementById("gameOverTitle"),
    rankTitle: document.getElementById("rankTitle"),
    rankDesc: document.getElementById("rankDesc"),
    lblYourScore: document.getElementById("lblYourScore"),
    lblBestScoreModal: document.getElementById("lblBestScoreModal"),
    finalStreakNum: document.getElementById("finalStreakNum"),
    bestStreakNumModal: document.getElementById("bestStreakNumModal"),
    emojiHistoryBar: document.getElementById("emojiHistoryBar"),
    lblDefeatedBy: document.getElementById("lblDefeatedBy"),
    defeatedComparison: document.getElementById("defeatedComparison"),
    playAgainBtn: document.getElementById("playAgainBtn"),
    lblPlayAgain: document.getElementById("lblPlayAgain"),
    shareResultBtn: document.getElementById("shareResultBtn"),
    lblShareResult: document.getElementById("lblShareResult")
  };

  // --------------------------------------------------------------------------
  // DECK & ITEM SELECTION LOGIC (Smart Rolling Preloader for the full deck)
  // --------------------------------------------------------------------------
  const preloadedUrls = new Set();
  const upcomingQueue = [];

  function preloadSingleImage(url) {
    if (!url || preloadedUrls.has(url)) return;
    preloadedUrls.add(url);
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.src = url;
  }

  // Real-time Wikipedia Origin / Background Summary Enricher (CORS enabled via origin=*)
  async function preloadWikiExtract(item, lang) {
    if (!item || !item.source || !item.source.wikiTitle) return;
    item._wikiExtract = item._wikiExtract || {};
    item._wikiUrl = item._wikiUrl || {};
    if (item._wikiExtract[lang]) return;

    // Only the item's own article in this language (mapped via Wikidata); without one, the built-in note stays
    const searchTitle = item.source.wikiTitle[lang];
    if (!searchTitle) return;

    try {
      // zh articles mix Traditional/Simplified script; the zh UI is Simplified
      const variant = lang === "zh" ? "&variant=zh-cn" : "";
      const apiUrl = `https://${lang}.wikipedia.org/w/api.php?origin=*&action=query&prop=extracts|info|pageprops&inprop=url&ppprop=disambiguation&exintro=1&explaintext=1&exsentences=2&redirects=1&format=json${variant}&titles=${encodeURIComponent(searchTitle)}`;
      const res = await fetch(apiUrl);
      if (!res.ok) return;
      const data = await res.json();
      const pages = (data.query && data.query.pages) || {};
      const firstPage = Object.values(pages)[0];
      const isDisambiguation = Boolean(firstPage && firstPage.pageprops && "disambiguation" in firstPage.pageprops);
      if (firstPage && !isDisambiguation && firstPage.extract && firstPage.extract.trim().length > 15) {
        item._wikiExtract[lang] = firstPage.extract.replace(/\s+/g, " ").trim();
        if (firstPage.fullurl) {
          item._wikiUrl[lang] = firstPage.fullurl;
        }
        if (state.leftItem === item || state.rightItem === item) {
          refreshCardTexts();
        }
      }
    } catch (_) {
      // Silently keep built-in note on offline/network error
    }
  }

  function pickWeightedCandidate(pool) {
    // Give hand-curated historical/invention/brand items 2.5x weight so movies/games mix evenly with history & inventions
    const weights = pool.map((it) =>
      it.id.startsWith("tl_Q") ? 1 : 2.5
    );
    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function rawDrawFromDeck(excludeItem) {
    const deck = window.GAME_DECKS[DECK_KEY] || [];
    let candidates = deck.filter(
      (item) =>
        (!excludeItem || item.id !== excludeItem.id) &&
        !state.usedIds.has(item.id)
    );

    if (candidates.length === 0) {
      deck.forEach((d) => state.usedIds.delete(d.id));
      candidates = deck.filter((item) => !excludeItem || item.id !== excludeItem.id);
    }

    let filteredPool = candidates;

    if (!excludeItem) {
      // Initial item: pick a random historical era bracket (20% each) so runs start at diverse eras
      const brackets = [
        (v) => v < 1880,
        (v) => v >= 1880 && v < 1945,
        (v) => v >= 1945 && v < 1985,
        (v) => v >= 1985 && v < 2005,
        (v) => v >= 2005
      ];
      const chosenBracket = brackets[Math.floor(Math.random() * brackets.length)];
      const bracketPool = candidates.filter((it) => chosenBracket(it.value));
      if (bracketPool.length > 0) {
        filteredPool = bracketPool;
      }
    } else {
      // Smart Era-Proximity Matchmaking relative to excludeItem.value (Year)
      const baseYear = excludeItem.value;
      const roll = Math.random();

      let minDiff = 0;
      let maxDiff = Infinity;

      if (roll < 0.60) {
        // 60% chance: Close Rival Era Match (1 to 15 years difference — super fun & tricky!)
        minDiff = 1;
        maxDiff = 15;
      } else if (roll < 0.85) {
        // 25% chance: Medium Era Shift (16 to 65 years difference — shifts across generations)
        minDiff = 16;
        maxDiff = 65;
      } else {
        // 15% chance: Time-Warp Wildcard (> 65 years jump across centuries)
        minDiff = 66;
        maxDiff = Infinity;
      }

      const tierPool = candidates.filter((it) => {
        const diff = Math.abs(it.value - baseYear);
        return diff >= minDiff && diff <= maxDiff;
      });

      if (tierPool.length >= 2) {
        filteredPool = tierPool;
      } else {
        // Fallback: sort by year distance and pick from the closest 12 candidates (excluding exact 0 year diff when possible)
        const sortedByClosest = [...candidates].sort((a, b) => {
          const da = Math.abs(a.value - baseYear) || 9999;
          const db = Math.abs(b.value - baseYear) || 9999;
          return da - db;
        });
        filteredPool = sortedByClosest.slice(0, Math.min(12, sortedByClosest.length));
      }
    }

    const picked = pickWeightedCandidate(filteredPool);
    state.usedIds.add(picked.id);
    if (picked) {
      if (picked.image) preloadSingleImage(picked.image);
      preloadWikiExtract(picked, state.lang);
    }
    return picked;
  }

  function fillUpcomingQueue(lastItem) {
    while (upcomingQueue.length < 3) {
      const prev = upcomingQueue.length > 0 ? upcomingQueue[upcomingQueue.length - 1] : lastItem;
      const next = rawDrawFromDeck(prev);
      if (next) upcomingQueue.push(next);
      else break;
    }
  }

  function drawNextItem(excludeItem) {
    if (upcomingQueue.length > 0) {
      const next = upcomingQueue.shift();
      fillUpcomingQueue(next);
      return next;
    }
    const first = rawDrawFromDeck(excludeItem);
    fillUpcomingQueue(first);
    return first;
  }

  function applyCardImage(imgEl, bgEl, item) {
    const title = item.name[state.lang] || item.name.en;
    imgEl.alt = title;
    // Logos and screenshots are shown whole instead of cropped to fill the frame
    imgEl.classList.toggle("fit-contain", item.imageFit === "contain");
    if (item.image) {
      if (imgEl.dataset.src !== item.image) {
        imgEl.style.opacity = "0.2";
        imgEl.dataset.src = item.image;
        imgEl.onload = () => {
          imgEl.style.opacity = "1";
        };
        imgEl.onerror = () => {
          imgEl.style.opacity = "0";
        };
        imgEl.src = item.image;
      } else {
        imgEl.style.opacity = "1";
      }
      bgEl.style.backgroundImage = `url("${item.image}")`;
    } else {
      imgEl.removeAttribute("src");
      bgEl.style.backgroundImage = "none";
    }
  }

  // Image attribution (CC BY / BY-SA need author + license); the link opens the file page with full details
  function creditText(item) {
    const credit = item.imageCredit;
    if (!credit) return "";
    return `${t().lblPhoto || "Photo"}: ${credit.author ? `${credit.author} · ` : ""}${credit.license}`;
  }

  function applyPhotoCredit(linkEl, item) {
    const credit = item.imageCredit;
    linkEl.classList.toggle("hidden", !credit || !item.image);
    if (!credit) return;
    const text = creditText(item);
    linkEl.href = credit.source;
    linkEl.title = text;
    linkEl.setAttribute("aria-label", text);
  }

  // --------------------------------------------------------------------------
  // GAME INITIALIZATION & ROUND RENDERING
  // --------------------------------------------------------------------------
  function startNewGame() {
    state.streak = 0;
    state.isRevealing = false;
    state.waitingForNext = false;
    stopAutoAdvance();
    state.usedIds.clear();
    upcomingQueue.length = 0;
    state.historyEmojis = [];

    state.leftItem = drawNextItem(null);
    state.rightItem = drawNextItem(state.leftItem);

    els.gameOverModal.classList.add("hidden");

    updateStaticLabels();
    renderArena(false);
    trackEvent("game_start", { best_streak: getBestStreak() });
  }

  function updateStaticLabels() {
    const dict = t();
    document.documentElement.lang = state.lang;

    els.langBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === state.lang);
    });

    els.lblCurrentStreak.textContent = dict.currentStreak;
    els.lblBestStreak.textContent = dict.bestStreak;
    els.currentStreakVal.textContent = state.streak;
    els.bestStreakVal.textContent = getBestStreak();

    if (els.lblQuickShare) {
      els.lblQuickShare.textContent = QUICK_SHARE_LABELS[state.lang] || QUICK_SHARE_LABELS.en;
    }
    updateChallengeBanner();

    els.keyboardHint.textContent = dict.keyboardHint;
    [els.creditsLink, els.creditsLinkModal].forEach((link) => {
      link.textContent = dict.imageCredits;
      link.href = `credits.html?lang=${state.lang}`;
    });

    els.gameOverTitle.textContent = dict.gameOverTitle;
    els.lblYourScore.textContent = dict.yourScore;
    els.lblBestScoreModal.textContent = dict.bestScore;
    els.lblDefeatedBy.textContent = dict.defeatedBy;
    els.lblPlayAgain.textContent = dict.playAgain;
    els.lblShareResult.textContent = dict.shareResult;
    els.lblNext.textContent = dict.nextRound || "Next ▶";

    if (state.leftItem && state.rightItem) {
      refreshCardTexts();
    }
  }

  function updateChallengeBanner() {
    if (!els.challengeBanner || !els.challengeBannerText) return;
    const active = state.targetStreak > 0;
    els.challengeBanner.classList.toggle("hidden", !active);
    // On phones the banner sits on its own row under the HUD, so the layout needs to know
    document.body.classList.toggle("has-challenge", active);
    if (!active) return;
    const beaten = state.streak > state.targetStreak;
    els.challengeBanner.classList.toggle("beaten", beaten);
    const msgs = {
      ko: beaten
        ? `🎉 친구의 ${state.targetStreak}연승 기록 돌파!`
        : `🔥 친구의 ${state.targetStreak}연승 기록에 도전 중!`,
      en: beaten
        ? `🎉 Beat friend's ${state.targetStreak}-streak!`
        : `🔥 Challenging friend's ${state.targetStreak} streak!`,
      ja: beaten
        ? `🎉 友達の${state.targetStreak}連勝記録を突破！`
        : `🔥 友達の${state.targetStreak}連勝記録に挑戦中！`,
      zh: beaten
        ? `🎉 已打破好友的 ${state.targetStreak} 连胜纪录！`
        : `🔥 正在挑战好友的 ${state.targetStreak} 连胜纪录！`
    };
    els.challengeBannerText.textContent = msgs[state.lang] || msgs.en;
  }

  function getItemOriginText(item, lang) {
    if (item._wikiExtract && item._wikiExtract[lang]) {
      return item._wikiExtract[lang];
    }
    return (item.note && (item.note[lang] || item.note.en)) || "";
  }

  function getItemBasisText(item, lang) {
    if (item.basis) {
      return item.basis[lang] || item.basis.en || "";
    }
    return "";
  }

  function getItemSourceUrl(item, lang) {
    if (item._wikiUrl && item._wikiUrl[lang]) {
      return item._wikiUrl[lang];
    }
    if (item.source && item.source.url) {
      return item.source.url[lang] || item.source.url.en || "#";
    }
    return "#";
  }

  function refreshCardTexts() {
    const dict = t();
    const themeDict = dict.themes.timeline;

    els.leftGlow.style.background = GLOW_COLOR;
    els.rightGlow.style.background = GLOW_COLOR;

    els.leftLblOrigin.textContent = dict.lblOrigin || "정보·유래";
    els.leftLblBasis.textContent = dict.lblBasis || "연도 근거";
    els.rightLblOrigin.textContent = dict.lblOrigin || "정보·유래";
    els.rightLblBasis.textContent = dict.lblBasis || "연도 근거";

    // Left Card
    applyCardImage(els.leftPhoto, els.leftBgPhoto, state.leftItem);
    applyPhotoCredit(els.leftPhotoCredit, state.leftItem);
    els.leftEmoji.textContent = state.leftItem.emoji;
    els.leftTitle.textContent = state.leftItem.name[state.lang] || state.leftItem.name.en;
    els.leftValue.textContent = formatValue(state.leftItem.value);
    els.leftNote.textContent = getItemOriginText(state.leftItem, state.lang);
    els.leftBasis.textContent = getItemBasisText(state.leftItem, state.lang);
    els.leftSourceName.textContent = `📚 ${(state.leftItem.source && state.leftItem.source.name) || "Wikipedia"}`;
    els.leftSourceLink.textContent = dict.viewSource || "원문 출처 보기 ↗";
    els.leftSourceLink.href = getItemSourceUrl(state.leftItem, state.lang);

    // Right Card
    applyCardImage(els.rightPhoto, els.rightBgPhoto, state.rightItem);
    applyPhotoCredit(els.rightPhotoCredit, state.rightItem);
    els.rightEmoji.textContent = state.rightItem.emoji;
    els.rightTitle.textContent = state.rightItem.name[state.lang] || state.rightItem.name.en;
    els.rightNote.textContent = getItemOriginText(state.rightItem, state.lang);
    els.rightBasis.textContent = getItemBasisText(state.rightItem, state.lang);
    els.rightSourceName.textContent = `📚 ${(state.rightItem.source && state.rightItem.source.name) || "Wikipedia"}`;
    els.rightSourceLink.textContent = dict.viewSource || "원문 출처 보기 ↗";
    els.rightSourceLink.href = getItemSourceUrl(state.rightItem, state.lang);

    // Buttons
    els.higherBtnText.textContent = themeDict.higherBtn;
    els.lowerBtnText.textContent = themeDict.lowerBtn;
    els.higherSubText.textContent = themeDict.higherSub;
    els.lowerSubText.textContent = themeDict.lowerSub;

    if (state.isRevealing) {
      els.rightValue.textContent = formatValue(state.rightItem.value);
    }
  }

  function renderArena(withSlideAnim = false) {
    els.vsCircle.className = "vs-circle";
    els.vsText.textContent = t().vs;

    els.guessActions.classList.remove("hidden");
    els.rightValueBox.classList.add("hidden");
    els.rightFactCard.classList.add("hidden");
    els.rightCard.classList.remove("revealed");
    els.nextBtn.classList.add("hidden");

    refreshCardTexts();

    if (withSlideAnim) {
      els.leftCard.classList.remove("chain-slide");
      els.rightCard.classList.remove("chain-slide");
      void els.leftCard.offsetWidth;
      els.leftCard.classList.add("chain-slide");
      els.rightCard.classList.add("chain-slide");
    }
  }

  // --------------------------------------------------------------------------
  // NUMBER COUNT-UP ANIMATION & GUESS EVALUATION
  // --------------------------------------------------------------------------
  function animateValueCountUp(startVal, targetVal, durationMs, onComplete) {
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentVal = startVal + (targetVal - startVal) * eased;

      els.rightValue.textContent = formatValue(currentVal);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        els.rightValue.textContent = formatValue(targetVal);
        if (onComplete) onComplete();
      }
    }

    requestAnimationFrame(step);
  }

  function handleGuess(direction) {
    if (state.isRevealing) return;
    state.isRevealing = true;

    const leftVal = state.leftItem.value;
    const rightVal = state.rightItem.value;
    const isTie = rightVal === leftVal;
    const isCorrect =
      isTie ||
      (direction === "higher" && rightVal > leftVal) ||
      (direction === "lower" && rightVal < leftVal);

    els.guessActions.classList.add("hidden");
    els.rightValueBox.classList.remove("hidden");
    els.verdictPill.classList.add("hidden");
    els.rightCard.classList.add("revealed");

    const countStartYear = Math.max(1000, leftVal - 40);
    animateValueCountUp(countStartYear, rightVal, 680, () => {
      const dict = t();
      els.verdictPill.classList.remove("hidden", "win", "lose");
      els.rightFactCard.classList.remove("hidden");
      refreshCardTexts();

      if (isCorrect) {
        state.streak += 1;
        state.historyEmojis.push("🟩");
        setBestStreak(state.streak);
        trackEvent("guess_answer", {
          is_correct: true,
          streak: state.streak,
          direction: direction,
          left_item: state.leftItem.id,
          right_item: state.rightItem.id,
          year_diff: Math.abs(rightVal - leftVal)
        });

        els.currentStreakVal.textContent = state.streak;
        els.bestStreakVal.textContent = getBestStreak();
        updateChallengeBanner();

        els.vsCircle.classList.add("correct");
        els.vsText.textContent = "✓";
        els.verdictPill.classList.add("win");
        els.verdictPill.textContent = isTie ? dict.tie : dict.correct;

        offerNextRound();
      } else {
        state.historyEmojis.push("💥");
        trackEvent("guess_answer", {
          is_correct: false,
          streak: state.streak,
          direction: direction,
          left_item: state.leftItem.id,
          right_item: state.rightItem.id,
          year_diff: Math.abs(rightVal - leftVal)
        });
        els.vsCircle.classList.add("wrong");
        els.vsText.textContent = "✕";
        els.verdictPill.classList.add("lose");
        els.verdictPill.textContent = dict.wrong;

        setTimeout(() => {
          showGameOverModal();
        }, 1800);
      }
    });
  }

  function advanceChain() {
    if (!state.waitingForNext) return;
    state.waitingForNext = false;
    stopAutoAdvance();

    state.leftItem = state.rightItem;
    state.rightItem = drawNextItem(state.leftItem);

    state.isRevealing = false;
    renderArena(true);
  }

  // --------------------------------------------------------------------------
  // NEXT ROUND (auto-advance, leaving time to read; touching the facts pauses it)
  // --------------------------------------------------------------------------
  function offerNextRound() {
    state.waitingForNext = true;
    els.nextBtn.classList.remove("hidden", "counting");
    void els.nextBtn.offsetWidth; // restart the countdown fill
    els.nextBtn.classList.add("counting");
    stopAutoAdvance();
    state.advanceTimer = setTimeout(advanceChain, AUTO_ADVANCE_MS);
  }

  function stopAutoAdvance() {
    clearTimeout(state.advanceTimer);
    state.advanceTimer = null;
  }

  // The player is reading (tap, scroll, focus on the facts): wait for "Next" instead of moving on
  function pauseAutoAdvance() {
    if (!state.waitingForNext || !state.advanceTimer) return;
    stopAutoAdvance();
    els.nextBtn.classList.remove("counting");
  }

  // --------------------------------------------------------------------------
  // GAME OVER & SHARE RESULT
  // --------------------------------------------------------------------------
  function getRankForStreak(streak) {
    const ranks = t().ranks;
    let chosen = ranks[0];
    for (const r of ranks) {
      if (streak >= r.min) chosen = r;
    }
    return chosen;
  }

  // Built with textContent (not innerHTML): origin text can come from live Wikipedia extracts
  function buildDefeatedRow(item, yearClass) {
    const thumb = document.createElement("img");
    thumb.className = "defeated-thumb";
    thumb.alt = "";
    thumb.referrerPolicy = "no-referrer";
    if (item.image) thumb.src = item.image;
    if (item.imageFit === "contain") thumb.classList.add("fit-contain");

    const name = document.createElement("strong");
    name.textContent = item.name[state.lang] || item.name.en;

    const year = document.createElement("span");
    year.className = `defeated-year ${yearClass}`;
    year.textContent = formatValue(item.value);

    const link = document.createElement("a");
    link.className = "source-link defeated-source";
    link.href = getItemSourceUrl(item, state.lang);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = t().viewSource || "원문 출처 ↗";

    const head = document.createElement("div");
    head.append(`${item.emoji} `, name, ": ", year, link);

    const origin = document.createElement("div");
    origin.className = "defeated-origin";
    origin.textContent = getItemOriginText(item, state.lang);

    const basis = document.createElement("div");
    basis.className = "defeated-basis";
    basis.textContent = `📏 ${getItemBasisText(item, state.lang)}`;

    const body = document.createElement("div");
    body.className = "defeated-body";
    body.append(head, origin, basis);

    if (item.imageCredit) {
      const credit = document.createElement("a");
      credit.className = "defeated-credit";
      credit.href = item.imageCredit.source;
      credit.target = "_blank";
      credit.rel = "noopener noreferrer";
      credit.textContent = `📷 ${creditText(item)}`;
      body.append(credit);
    }

    const row = document.createElement("div");
    row.className = "defeated-row";
    row.append(thumb, body);
    return row;
  }

  function showGameOverModal() {
    const rank = getRankForStreak(state.streak);
    els.rankTitle.textContent = rank.title;
    els.rankDesc.textContent = rank.desc;

    els.finalStreakNum.textContent = state.streak;
    els.bestStreakNumModal.textContent = getBestStreak();
    els.emojiHistoryBar.textContent = state.historyEmojis.join("");

    const divider = document.createElement("div");
    divider.className = "defeated-divider";
    els.defeatedComparison.replaceChildren(
      buildDefeatedRow(state.leftItem, "is-left"),
      divider,
      buildDefeatedRow(state.rightItem, "is-right")
    );

    els.gameOverModal.classList.remove("hidden");
    trackEvent("game_over", {
      final_streak: state.streak,
      best_streak: getBestStreak(),
      defeated_left: state.leftItem.id,
      defeated_right: state.rightItem.id
    });
  }

  function buildShareUrl(scoreToBeat) {
    const base = "https://time-up-or-down.pages.dev/";
    const params = new URLSearchParams();
    if (scoreToBeat && scoreToBeat > 0) params.set("target", String(scoreToBeat));
    if (state.lang && state.lang !== "ko") params.set("lang", state.lang);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  // --------------------------------------------------------------------------
  // SHARE HELPERS (native share sheet on touch devices, clipboard elsewhere)
  // --------------------------------------------------------------------------
  const QUICK_SHARE_LABELS = { ko: "친구 초대", en: "Share", ja: "シェア", zh: "分享" };
  const QUICK_SHARE_COPIED = { ko: "링크 복사됨!", en: "Copied!", ja: "コピー完了！", zh: "已复制！" };
  const MANUAL_COPY_PROMPT = {
    ko: "아래 내용을 복사해서 공유해 주세요",
    en: "Copy this text to share it:",
    ja: "以下をコピーしてシェアしてください",
    zh: "请复制以下内容进行分享"
  };

  // execCommand fallback for in-app browsers / WebViews without the async Clipboard API
  function legacyCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (_) {}
    area.remove();
    return copied;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(() => {
        if (!legacyCopy(text)) throw new Error("copy failed");
      });
    }
    return legacyCopy(text) ? Promise.resolve() : Promise.reject(new Error("copy failed"));
  }

  // `text` must not contain the URL: share targets that append `url` would show it twice.
  // Resolves to "shared", "copied", "manual" (copy prompt shown) or "cancelled".
  function shareOrCopy(title, text, url) {
    const fullText = `${text} ${url}`;
    const copyOrPrompt = () =>
      copyText(fullText).then(
        () => "copied",
        () => {
          window.prompt(MANUAL_COPY_PROMPT[state.lang] || MANUAL_COPY_PROMPT.en, fullText);
          return "manual";
        }
      );

    const useShareSheet =
      typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (!useShareSheet) return copyOrPrompt();

    return navigator.share({ title, text, url }).then(
      () => "shared",
      (err) => (err && err.name === "AbortError" ? "cancelled" : copyOrPrompt())
    );
  }

  function flashLabel(labelEl, message, getRestoreText, durationMs) {
    labelEl.textContent = message;
    clearTimeout(labelEl._flashTimer);
    labelEl._flashTimer = setTimeout(() => {
      labelEl.textContent = getRestoreText();
    }, durationMs);
  }

  function handleShareResult() {
    const dict = t();
    const rank = getRankForStreak(state.streak);
    const modeName = dict.themes.timeline.name;
    const emojis = state.historyEmojis.join("");
    const leftName = state.leftItem.name[state.lang] || state.leftItem.name.en;
    const rightName = state.rightItem.name[state.lang] || state.rightItem.name.en;
    // After a 0-streak run the link carries the best record, so the text must name that score too
    const challengeScore = state.streak || getBestStreak();
    const shareUrl = buildShareUrl(challengeScore);

    const ctaByLang = challengeScore > 0
      ? {
          ko: `👉 내 기록(${challengeScore}연승) 깨러 오기:`,
          en: `👉 Can you beat my ${challengeScore}-streak? Play free:`,
          ja: `👉 私の記録（${challengeScore}連勝）に挑戦:`,
          zh: `👉 来挑战我的 ${challengeScore} 连胜纪录:`
        }
      : {
          ko: "👉 지금 바로 도전하기:",
          en: "👉 Play now:",
          ja: "👉 今すぐ挑戦:",
          zh: "👉 立即挑战:"
        };

    const text = [
      `⏳ ${dict.appTitle} [${modeName}]`,
      `🔥 ${dict.currentStreak}: ${state.streak} | 🏆 ${rank.title}`,
      emojis,
      `💥 ${state.leftItem.emoji} ${leftName} vs ${state.rightItem.emoji} ${rightName}`,
      ctaByLang[state.lang] || ctaByLang.en
    ].join("\n");

    shareOrCopy(dict.appTitle, text, shareUrl).then((method) => {
      if (method === "cancelled") return;
      trackEvent("share_result", { final_streak: state.streak, best_streak: getBestStreak(), method: method });
      if (method === "copied") {
        flashLabel(els.lblShareResult, dict.copied, () => t().shareResult, 2000);
      }
    });
  }

  function handleQuickShare() {
    const dict = t();
    const best = Math.max(state.streak, getBestStreak());
    const shareUrl = buildShareUrl(best);
    const leftName = state.leftItem ? (state.leftItem.name[state.lang] || state.leftItem.name.en) : "";
    const rightName = state.rightItem ? (state.rightItem.name[state.lang] || state.rightItem.name.en) : "";

    const msgByLang = {
      ko: `⏳ ${dict.appTitle}\n"${leftName} vs ${rightName}" 어느 쪽이 더 최근에 나왔을까?\n👉 지금 바로 도전하기:`,
      en: `⏳ ${dict.appTitle}\n"${leftName} vs ${rightName}" — which came later?\n👉 Play now:`,
      ja: `⏳ ${dict.appTitle}\n「${leftName} vs ${rightName}」より新しいのはどっち？\n👉 今すぐ挑戦:`,
      zh: `⏳ ${dict.appTitle}\n“${leftName} vs ${rightName}”哪一个出现得更晚？\n👉 立即挑战:`
    };
    const text = msgByLang[state.lang] || msgByLang.en;

    shareOrCopy(dict.appTitle, text, shareUrl).then((method) => {
      if (method === "cancelled") return;
      trackEvent("quick_share", { best_streak: best, method: method });
      if (method === "copied" && els.lblQuickShare) {
        flashLabel(
          els.lblQuickShare,
          QUICK_SHARE_COPIED[state.lang] || QUICK_SHARE_COPIED.en,
          () => QUICK_SHARE_LABELS[state.lang] || QUICK_SHARE_LABELS.en,
          1800
        );
      }
    });
  }

  // --------------------------------------------------------------------------
  // EVENT LISTENERS
  // --------------------------------------------------------------------------
  els.btnHigher.addEventListener("click", () => handleGuess("higher"));
  els.btnLower.addEventListener("click", () => handleGuess("lower"));

  els.nextProgress.style.animationDuration = `${AUTO_ADVANCE_MS}ms`;
  els.nextBtn.addEventListener("click", advanceChain);
  ["pointerdown", "touchstart", "wheel", "focusin"].forEach((type) => {
    els.rightFactCard.addEventListener(type, pauseAutoAdvance, { passive: true });
  });
  // scroll doesn't bubble: listen in the capture phase to catch the fact text scrolling
  els.rightFactCard.addEventListener("scroll", pauseAutoAdvance, { capture: true, passive: true });

  els.langBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const newLang = btn.dataset.lang;
      if (window.GAME_I18N[newLang]) {
        state.lang = newLang;
        writeStorage("updown_lang", newLang);
        trackEvent("language_change", { selected_lang: newLang });
        if (state.leftItem) preloadWikiExtract(state.leftItem, newLang);
        if (state.rightItem) preloadWikiExtract(state.rightItem, newLang);
        upcomingQueue.forEach((item) => preloadWikiExtract(item, newLang));
        updateStaticLabels();
      }
    });
  });

  els.playAgainBtn.addEventListener("click", () => {
    startNewGame();
  });

  els.shareResultBtn.addEventListener("click", handleShareResult);
  if (els.quickShareBtn) {
    els.quickShareBtn.addEventListener("click", handleQuickShare);
  }

  window.addEventListener("keydown", (e) => {
    // Let a focused button/link (e.g. Share, a source link) handle its own Enter/Space
    const onControl = e.target instanceof Element && e.target.closest("button, a");
    const isConfirmKey = (e.key === "Enter" || e.key === " ") && !onControl;
    if (!els.gameOverModal.classList.contains("hidden")) {
      if (isConfirmKey) {
        e.preventDefault();
        startNewGame();
      }
      return;
    }
    if (state.waitingForNext) {
      if (isConfirmKey || e.key === "ArrowRight") {
        e.preventDefault();
        advanceChain();
      }
      return;
    }
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
      e.preventDefault();
      handleGuess("higher");
    } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      e.preventDefault();
      handleGuess("lower");
    }
  });

  // Boot the game!
  startNewGame();
})();
