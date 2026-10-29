// ============================================================================
// TIMELINE UP OR DOWN — GLOBAL HISTORY & INVENTION STREAK CHALLENGE ENGINE
// ============================================================================

(function () {
  "use strict";

  const DECK_KEY = "timeline";
  const GLOW_COLOR = "#f59e0b";

  function trackEvent(eventName, params) {
    if (typeof window.gtag === "function") {
      try {
        window.gtag("event", eventName, Object.assign({ game_mode: DECK_KEY, lang: state.lang }, params || {}));
      } catch (_) {}
    }
  }

  // --------------------------------------------------------------------------
  // GAME STATE
  // --------------------------------------------------------------------------
  const state = {
    lang: detectInitialLang(),
    streak: 0,
    isRevealing: false,
    waitingForNext: false,
    usedIds: new Set(),
    leftItem: null,
    rightItem: null,
    historyEmojis: [] // ['🟩', '🟩', '💥']
  };

  // --------------------------------------------------------------------------
  // LANGUAGE & FORMATTING HELPERS
  // --------------------------------------------------------------------------
  function detectInitialLang() {
    const saved = localStorage.getItem("updown_lang");
    if (saved && window.GAME_I18N[saved]) return saved;
    const nav = (navigator.language || "ko").toLowerCase();
    if (nav.startsWith("ko")) return "ko";
    if (nav.startsWith("ja")) return "ja";
    if (nav.startsWith("zh")) return "zh";
    return "en";
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
    return parseInt(localStorage.getItem("updown_best_timeline") || "0", 10);
  }

  function setBestStreak(score) {
    const prev = getBestStreak();
    if (score > prev) {
      localStorage.setItem("updown_best_timeline", String(score));
    }
  }

  // --------------------------------------------------------------------------
  // DOM ELEMENTS
  // --------------------------------------------------------------------------
  const els = {
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
  // DECK & ITEM SELECTION LOGIC (Smart Rolling Preloader for 500-item Deck)
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

    const searchTitle = item.source.wikiTitle[lang] || item.source.wikiTitle.en;
    if (!searchTitle) return;

    try {
      const apiUrl = `https://${lang}.wikipedia.org/w/api.php?origin=*&action=query&prop=extracts|info&inprop=url&exintro=1&explaintext=1&exsentences=2&redirects=1&format=json&titles=${encodeURIComponent(searchTitle)}`;
      const res = await fetch(apiUrl);
      if (!res.ok) return;
      const data = await res.json();
      const pages = (data.query && data.query.pages) || {};
      const firstPage = Object.values(pages)[0];
      if (firstPage && firstPage.extract && firstPage.extract.trim().length > 15) {
        const cleanExtract = firstPage.extract.replace(/\s+/g, " ").trim();
        const baseNote = (item.note && (item.note[lang] || item.note.en)) || "";
        item._wikiExtract[lang] = cleanExtract.includes(baseNote.slice(0, 15))
          ? cleanExtract
          : `${baseNote} — ${cleanExtract}`;
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

  // --------------------------------------------------------------------------
  // GAME INITIALIZATION & ROUND RENDERING
  // --------------------------------------------------------------------------
  function startNewGame() {
    state.streak = 0;
    state.isRevealing = false;
    state.waitingForNext = false;
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

    els.keyboardHint.textContent = dict.keyboardHint;

    els.gameOverTitle.textContent = dict.gameOverTitle;
    els.lblYourScore.textContent = dict.yourScore;
    els.lblBestScoreModal.textContent = dict.bestScore;
    els.lblDefeatedBy.textContent = dict.defeatedBy;
    els.lblPlayAgain.textContent = dict.playAgain;
    els.lblShareResult.textContent = dict.shareResult;

    if (state.leftItem && state.rightItem) {
      refreshCardTexts();
    }
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

        els.vsCircle.classList.add("correct");
        els.vsText.textContent = "✓";
        els.verdictPill.classList.add("win");
        els.verdictPill.textContent = isTie ? dict.tie : dict.correct;

        setTimeout(() => {
          advanceChain();
        }, 1500);
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
    state.leftItem = state.rightItem;
    state.rightItem = drawNextItem(state.leftItem);

    state.isRevealing = false;
    renderArena(true);
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

  function showGameOverModal() {
    const dict = t();
    const rank = getRankForStreak(state.streak);
    els.rankTitle.textContent = rank.title;
    els.rankDesc.textContent = rank.desc;

    els.finalStreakNum.textContent = state.streak;
    els.bestStreakNumModal.textContent = getBestStreak();
    els.emojiHistoryBar.textContent = state.historyEmojis.join("");

    const leftName = state.leftItem.name[state.lang] || state.leftItem.name.en;
    const rightName = state.rightItem.name[state.lang] || state.rightItem.name.en;
    const leftValStr = formatValue(state.leftItem.value);
    const rightValStr = formatValue(state.rightItem.value);

    const leftOrigin = getItemOriginText(state.leftItem, state.lang);
    const rightOrigin = getItemOriginText(state.rightItem, state.lang);
    const leftBasis = getItemBasisText(state.leftItem, state.lang);
    const rightBasis = getItemBasisText(state.rightItem, state.lang);
    const leftUrl = getItemSourceUrl(state.leftItem, state.lang);
    const rightUrl = getItemSourceUrl(state.rightItem, state.lang);
    const srcBtnLabel = dict.viewSource || "원문 출처 ↗";

    els.defeatedComparison.innerHTML = `
      <div class="defeated-row" style="align-items:flex-start;">
        <img class="defeated-thumb" src="${state.leftItem.image || ""}" alt="" referrerpolicy="no-referrer" />
        <div style="flex:1;">
          <div>${state.leftItem.emoji} <strong>${leftName}</strong>: <span style="color:#fbbf24;font-weight:800;">${leftValStr}</span>
            <a href="${leftUrl}" target="_blank" rel="noopener noreferrer" class="source-link" style="margin-left:6px;font-size:0.75rem;">${srcBtnLabel}</a>
          </div>
          <div style="font-size:0.78rem;color:#cbd5e1;margin-top:2px;">${leftOrigin}</div>
          <div style="font-size:0.72rem;color:#94a3b8;margin-top:2px;">📏 ${leftBasis}</div>
        </div>
      </div>
      <div style="height:1px;background:rgba(255,255,255,0.08);margin:4px 0;"></div>
      <div class="defeated-row" style="align-items:flex-start;">
        <img class="defeated-thumb" src="${state.rightItem.image || ""}" alt="" referrerpolicy="no-referrer" />
        <div style="flex:1;">
          <div>${state.rightItem.emoji} <strong>${rightName}</strong>: <span style="color:#fb7185;font-weight:800;">${rightValStr}</span>
            <a href="${rightUrl}" target="_blank" rel="noopener noreferrer" class="source-link" style="margin-left:6px;font-size:0.75rem;">${srcBtnLabel}</a>
          </div>
          <div style="font-size:0.78rem;color:#cbd5e1;margin-top:2px;">${rightOrigin}</div>
          <div style="font-size:0.72rem;color:#94a3b8;margin-top:2px;">📏 ${rightBasis}</div>
        </div>
      </div>
    `;

    els.gameOverModal.classList.remove("hidden");
    trackEvent("game_over", {
      final_streak: state.streak,
      best_streak: getBestStreak(),
      defeated_left: state.leftItem.id,
      defeated_right: state.rightItem.id
    });
  }

  function copyShareText() {
    const dict = t();
    const rank = getRankForStreak(state.streak);
    const modeName = dict.themes.timeline.name;
    const emojis = state.historyEmojis.join("");
    const leftName = state.leftItem.name[state.lang] || state.leftItem.name.en;
    const rightName = state.rightItem.name[state.lang] || state.rightItem.name.en;

    const text = [
      `⏳ ${dict.appTitle} [${modeName}]`,
      `🔥 ${dict.currentStreak}: ${state.streak} | 🏆 ${rank.title}`,
      emojis,
      `💥 ${state.leftItem.emoji} ${leftName} vs ${state.rightItem.emoji} ${rightName}`
    ].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      trackEvent("share_result", { final_streak: state.streak, best_streak: getBestStreak() });
      const orig = els.lblShareResult.textContent;
      els.lblShareResult.textContent = dict.copied;
      setTimeout(() => {
        els.lblShareResult.textContent = orig;
      }, 2000);
    });
  }

  // --------------------------------------------------------------------------
  // EVENT LISTENERS
  // --------------------------------------------------------------------------
  els.btnHigher.addEventListener("click", () => handleGuess("higher"));
  els.btnLower.addEventListener("click", () => handleGuess("lower"));

  els.langBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const newLang = btn.dataset.lang;
      if (window.GAME_I18N[newLang]) {
        state.lang = newLang;
        localStorage.setItem("updown_lang", newLang);
        trackEvent("language_change", { selected_lang: newLang });
        if (state.leftItem) preloadWikiExtract(state.leftItem, newLang);
        if (state.rightItem) preloadWikiExtract(state.rightItem, newLang);
        updateStaticLabels();
      }
    });
  });

  els.playAgainBtn.addEventListener("click", () => {
    startNewGame();
  });

  els.shareResultBtn.addEventListener("click", copyShareText);

  window.addEventListener("keydown", (e) => {
    if (!els.gameOverModal.classList.contains("hidden")) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        startNewGame();
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
