console.log("HELLO FROM THE REAL SCRIPT");

function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

let archiveMode = false;

document.addEventListener("DOMContentLoaded", () => {
  console.log("Guessi script running");

  // ------------------------------
  // DATE HELPERS
  // ------------------------------
  function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function getIndexForDate(dateKey) {
    const [yyyy, mm, dd] = dateKey.split("-");
    const formatted = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    let hash = 0;
    for (let i = 0; i < formatted.length; i++) {
      hash = (hash * 131 + formatted.charCodeAt(i)) % 1000000007;
    }
    return hash % players.length;
  }

  // ------------------------------
  // PLAYER DATA
  // ------------------------------
  const players = window.players;
  const leagueMap = window.leagueMap;
  const continentMap = window.continentMap;

  let targetPlayer = players[getIndexForDate(getTodayKey())];

  // ------------------------------
  // DOM ELEMENTS
  // ------------------------------
  const guessInput = document.getElementById("guess-input");
  const guessButton = document.getElementById("guess-button");
  const suggestionsBox = document.getElementById("suggestions");
  const guessesContainer = document.getElementById("guesses-container");
  const profileSection = document.getElementById("player-profile");
  const profileImage = document.getElementById("player-image");
  const profileName = document.getElementById("player-name");
  const profileClubsRow = document.getElementById("player-clubs");
  const profilePositionsRow = document.getElementById("player-positions");
  const profileNationality = document.getElementById("player-nationality");
  const profileStatus = document.getElementById("player-status");
  const profileYear = document.getElementById("player-year");
  const profileFoot = document.getElementById("player-foot");

  let guessResults = [];

  // ------------------------------
  // STATS STORAGE
  // ------------------------------
  const defaultStats = {
    lastCompletedDate: null,
    currentStreak: 0,
    longestStreak: 0,
    totalWins: 0,
    totalGames: 0,
    guessDistribution: { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0 }
  };

  function loadStats() {
    const saved = localStorage.getItem("dailyball-stats");
    return saved ? JSON.parse(saved) : { ...defaultStats };
  }

  function saveStats(statsObj) {
    localStorage.setItem("dailyball-stats", JSON.stringify(statsObj));
  }

  let stats = loadStats();
  for (let i = 1; i <= 8; i++) {
    if (stats.guessDistribution[i] === undefined) stats.guessDistribution[i] = 0;
  }
  saveStats(stats);

  // ------------------------------
  // GAME STATE SAVE / RESTORE
  // ------------------------------
  function saveGameState() {
    const state = {
      date: getTodayKey(),
      guesses: guessResults.map(g => ({ playerName: g.player.name, result: g.result })),
      completed: false,
      outcome: null
    };
    localStorage.setItem("guessi-state", JSON.stringify(state));
  }

  function markGameComplete(outcome) {
    const state = JSON.parse(localStorage.getItem("guessi-state") || "{}");
    state.completed = true;
    state.outcome = outcome;
    localStorage.setItem("guessi-state", JSON.stringify(state));
  }

  function restoreGameState() {
    const raw = localStorage.getItem("guessi-state");
    if (!raw) return false;

    const state = JSON.parse(raw);
    if (state.date !== getTodayKey()) {
      localStorage.removeItem("guessi-state");
      return false;
    }

    state.guesses.forEach((g, index) => {
      const player = players.find(p => p.name === g.playerName);
      if (!player) return;

      if (index < state.guesses.length - 1) {
        addGuessRow(player, g.result);
      } else {
        renderPlayerProfile(player, g.result);
      }

      guessResults.push({ player, result: g.result });
    });

    if (guessResults.length > 0) {
      revealGuessSections();
      updateGuessCounter();
    }

    if (state.completed) {
      guessInput.disabled = true;
      guessButton.disabled = true;

      if (state.outcome === "win") {
        profileSection.classList.add("correct-celebration");
        document.getElementById("game-over-overlay").classList.add("active");
        const winBanner = document.getElementById("game-over-banner");
        winBanner.textContent = "Correct! It was " + targetPlayer.name;
        winBanner.classList.add("show");
        document.getElementById("current-header").textContent = "TODAY'S PLAYER";
      } else if (state.outcome === "loss") {
        if (guessResults.length > 0) {
          const last = guessResults[guessResults.length - 1];
          addGuessRow(last.player, last.result);
        }
        const neutralResult = {
          clubs: targetPlayer.clubs.map(() => "grey"),
          positions: targetPlayer.positions.map(() => "grey"),
          nationality: "grey",
          age: { color: "grey", arrow: "" },
          strongFoot: "grey",
          status: "grey"
        };
        renderPlayerProfile(targetPlayer, neutralResult);
        const card = document.querySelector(".db-player-card");
        if (card) card.classList.add("game-over-fail");
        document.getElementById("game-over-overlay").classList.add("active");
        const failBanner = document.getElementById("game-over-banner");
        failBanner.classList.add("fail");
        failBanner.innerHTML = "Unlucky! The answer was " + targetPlayer.name + " <span class=\"banner-sub\">Better luck tomorrow \u26BD</span>";
        failBanner.classList.add("show");
        document.getElementById("current-header").textContent = "TODAY'S PLAYER";
      }
    }

    return true;
  }

  // ------------------------------
  // SHARE GRID GENERATOR
  // ------------------------------
  function generateShareGrid() {
    const emojiMap = { green: "\uD83D\uDFE9", yellow: "\uD83D\uDFE8", grey: "\u2B1B" };

    const rows = guessResults.map(function(g) {
      const r = g.result;

      const clubEmoji = r.clubs.every(function(c) { return c === "green"; }) ? "\uD83D\uDFE9"
        : r.clubs.some(function(c) { return c === "green" || c === "yellow"; }) ? "\uD83D\uDFE8" : "\u2B1B";

      const posEmoji = r.positions.every(function(c) { return c === "green"; }) ? "\uD83D\uDFE9"
        : r.positions.some(function(c) { return c === "green" || c === "yellow"; }) ? "\uD83D\uDFE8" : "\u2B1B";

      const natEmoji = emojiMap[r.nationality] || "\u2B1B";
      const ageEmoji = emojiMap[r.age.color] || "\u2B1B";
      const footEmoji = emojiMap[r.strongFoot] || "\u2B1B";
      const statusEmoji = emojiMap[r.status] || "\u2B1B";

      return clubEmoji + posEmoji + natEmoji + ageEmoji + footEmoji + statusEmoji;
    });

    const todayKey = getTodayKey();
    const lastGuess = guessResults.length > 0 ? guessResults[guessResults.length - 1] : null;
    const won = lastGuess &&
      removeAccents(lastGuess.player.name.toLowerCase()) === removeAccents(targetPlayer.name.toLowerCase());
    const outcome = won ? (guessResults.length + "/8") : "X/8";

    return "Guessi \u26BD " + todayKey + " \u2014 " + outcome + "\n" + rows.join("\n") + "\nguessi.app";
  }

  // ------------------------------
  // AUTOCOMPLETE
  // ------------------------------
  guessInput.addEventListener("input", () => {
    const text = guessInput.value.toLowerCase().trim();
    if (!text) { suggestionsBox.style.display = "none"; return; }

    const matches = players.filter(p =>
      removeAccents(p.name.toLowerCase()).includes(removeAccents(text))
    );
    if (!matches.length) { suggestionsBox.style.display = "none"; return; }

    suggestionsBox.innerHTML = matches
      .map(p => "<div class=\"suggestion-item\">" + p.name + "</div>")
      .join("");
    suggestionsBox.style.display = "block";

    suggestionsBox.querySelectorAll(".suggestion-item").forEach(item => {
      item.addEventListener("click", () => {
        guessInput.value = item.textContent;
        suggestionsBox.style.display = "none";
      });
    });
  });

  document.addEventListener("click", (e) => {
    if (!suggestionsBox.contains(e.target) && e.target !== guessInput) {
      suggestionsBox.style.display = "none";
    }
  });

  // ------------------------------
  // GUESS COUNTER
  // ------------------------------
  function updateGuessCounter() {
    const counter = document.getElementById("guess-counter");
    counter.classList.remove("hidden");
    counter.textContent = "Guess " + guessResults.length + " / 8";
  }

  // ------------------------------
  // HANDLE GUESS
  // ------------------------------
  guessButton.addEventListener("click", handleGuess);
  guessInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleGuess();
  });

  function handleGuess() {
    if (archiveMode) return;

    if (guessResults.length >= 8) {
      revealTargetPlayer();
      return;
    }

    const value = guessInput.value.trim();
    if (!value) return;

    if (guessResults.length === 0) {
      document.getElementById("player-profile").classList.remove("hidden");
      document.getElementById("current-header").classList.remove("hidden");
      document.getElementById("previous-header").classList.remove("hidden");
    }

    const guessedPlayer = findPlayerByName(value);
    if (!guessedPlayer) {
      guessInput.classList.add("shake");
      setTimeout(() => guessInput.classList.remove("shake"), 300);
      return;
    }

    revealGuessSections();

    const result = comparePlayers(guessedPlayer, targetPlayer);

    if (guessResults.length > 0) {
      const last = guessResults[guessResults.length - 1];
      addGuessRow(last.player, last.result);
    }

    renderPlayerProfile(guessedPlayer, result);
    guessResults.push({ player: guessedPlayer, result });
    updateGuessCounter();
    saveGameState();

    // CORRECT GUESS
    if (
      removeAccents(guessedPlayer.name.toLowerCase()) ===
      removeAccents(targetPlayer.name.toLowerCase())
    ) {
      profileSection.classList.add("correct-celebration");
      playRollingBall();

      guessInput.disabled = true;
      guessButton.disabled = true;

      const todayKey = getTodayKey();

      document.getElementById("game-over-overlay").classList.add("active");
      const winBanner = document.getElementById("game-over-banner");
      winBanner.textContent = "Correct! It was " + targetPlayer.name;
      winBanner.classList.add("show");
      document.getElementById("current-header").textContent = "TODAY'S PLAYER";

      if (!archiveMode && stats.lastCompletedDate !== todayKey) {
        stats.totalGames++;
        stats.totalWins++;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yKey = yesterday.getFullYear() + "-" + String(yesterday.getMonth() + 1).padStart(2, "0") + "-" + String(yesterday.getDate()).padStart(2, "0");

        stats.currentStreak = (stats.lastCompletedDate === yKey) ? stats.currentStreak + 1 : 1;
        stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);

        const guessCount = guessResults.length;
        if (stats.guessDistribution[guessCount] !== undefined) {
          stats.guessDistribution[guessCount]++;
        }

        stats.lastCompletedDate = todayKey;
        saveStats(stats);
      }

      markGameComplete("win");
      showShareToast(generateShareGrid());
      return;
    }

    // WRONG GUESS — CHECK LIMIT
    if (guessResults.length === 8) {
      revealTargetPlayer();
      return;
    }

    if (isVeryColdGuess(result)) {
      profileSection.classList.add("card-shake");
      setTimeout(() => profileSection.classList.remove("card-shake"), 400);
    }

    guessInput.value = "";
  }

  // ------------------------------
  // SHARE TOAST
  // ------------------------------
  function showShareToast(message) {
    const toast = document.getElementById("share-toast");
    const text = document.getElementById("share-toast-text");

    text.textContent = message;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("show"), 10);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.classList.add("hidden"), 300);
    }, 6000);

    toast.onclick = async () => {
      try {
        // Build HTML version with clickable link
        const htmlMessage = message.replace(
          "guessi.app",
          "<a href='https://guessi.app'>guessi.app</a>"
        );
        const plainText = message;

        // Copy both plain text and HTML to clipboard
        const clipItem = new ClipboardItem({
          "text/plain": new Blob([plainText], { type: "text/plain" }),
          "text/html": new Blob([htmlMessage.replace(/\n/g, "<br>")], { type: "text/html" })
        });
        await navigator.clipboard.write([clipItem]);
        text.textContent = "Copied to clipboard! ✔";
        setTimeout(() => { text.textContent = message; }, 2000);
      } catch {
        // Fallback to plain text if ClipboardItem not supported
        try {
          await navigator.clipboard.writeText(message);
          text.textContent = "Copied to clipboard! ✔";
          setTimeout(() => { text.textContent = message; }, 2000);
        } catch {
          text.textContent = "Clipboard blocked";
        }
      }
    };
  }

  // ------------------------------
  // ROLLING FOOTBALL ANIMATION
  // ------------------------------
  function playRollingBall() {
    const ball = document.getElementById("rolling-ball");
    ball.classList.remove("hidden");
    setTimeout(() => ball.classList.add("show"), 20);
    setTimeout(() => {
      ball.classList.remove("show");
      setTimeout(() => ball.classList.add("hidden"), 300);
    }, 2400);
  }

  // ------------------------------
  // REVEAL TARGET PLAYER (FAIL)
  // ------------------------------
  function revealTargetPlayer() {
    const neutralResult = {
      clubs: targetPlayer.clubs.map(() => "grey"),
      positions: targetPlayer.positions.map(() => "grey"),
      nationality: "grey",
      age: { color: "grey", arrow: "" },
      strongFoot: "grey",
      status: "grey"
    };

    renderPlayerProfile(targetPlayer, neutralResult);
    revealGuessSections();

    guessInput.disabled = true;
    guessButton.disabled = true;

    const card = document.querySelector(".db-player-card");
    if (card) card.classList.add("game-over-fail");

    document.getElementById("game-over-overlay").classList.add("active");
    const failBanner = document.getElementById("game-over-banner");
    failBanner.classList.add("fail");
    failBanner.innerHTML = "Unlucky! The answer was " + targetPlayer.name + " <span class=\"banner-sub\">Better luck tomorrow \u26BD</span>";
    failBanner.classList.add("show");
    document.getElementById("current-header").textContent = "TODAY'S PLAYER";

    markGameComplete("loss");
    showShareToast(generateShareGrid());
  }

  // ------------------------------
  // FIND PLAYER
  // ------------------------------
  function findPlayerByName(name) {
    const clean = removeAccents(name.toLowerCase());
    return players.find(p => removeAccents(p.name.toLowerCase()) === clean);
  }

  // ------------------------------
  // POSITION GROUPS
  // ------------------------------
  const positionGroups = {
    GK: "GK",
    CB: "DEF", RB: "DEF", LB: "DEF", RWB: "DEF", LWB: "DEF",
    CDM: "MID", CM: "MID", CAM: "MID",
    RW: "ATT", LW: "ATT", ST: "ATT", CF: "ATT"
  };

  // ------------------------------
  // COMPARISON HELPERS
  // ------------------------------
  function normalizeClubName(name) {
    return name.replace(/\s*\(loan\)/i, "").trim();
  }

  function compareClubs(guessClubs, targetClubs) {
    const g = guessClubs.map(normalizeClubName);
    const t = targetClubs.map(normalizeClubName);
    const targetLeagues = t.map(c => leagueMap[c]).filter(Boolean);
    const leagueCounts = {};
    targetLeagues.forEach(l => leagueCounts[l] = (leagueCounts[l] || 0) + 1);
    const solvedLeagues = new Set();

    const results = g.map(club => {
      if (t.includes(club)) {
        const league = leagueMap[club];
        if (league) solvedLeagues.add(league);
        return "green";
      }
      return null;
    });

    return results.map((state, i) => {
      if (state === "green") return "green";
      const guessLeague = leagueMap[g[i]];
      if (!guessLeague) return "grey";
      if (!targetLeagues.includes(guessLeague)) return "grey";
      if (!solvedLeagues.has(guessLeague)) return "yellow";
      if (leagueCounts[guessLeague] === 1) return "grey";
      return "yellow";
    });
  }

  function comparePositions(guessPositions, targetPositions) {
    const results = [];
    const targetGroups = targetPositions.map(p => positionGroups[p]);
    const groupCounts = {};
    targetGroups.forEach(g => groupCounts[g] = (groupCounts[g] || 0) + 1);

    const greenCountPerGroup = {};
    guessPositions.forEach(pos => {
      if (targetPositions.includes(pos)) {
        const grp = positionGroups[pos];
        greenCountPerGroup[grp] = (greenCountPerGroup[grp] || 0) + 1;
      }
    });

    guessPositions.forEach(pos => {
      if (targetPositions.includes(pos)) {
        results.push("green");
      } else {
        results.push(null);
      }
    });

    return results.map((state, i) => {
      if (state === "green") return "green";
      const guessGroup = positionGroups[guessPositions[i]];
      if (!targetGroups.includes(guessGroup)) return "grey";
      const totalInGroup = groupCounts[guessGroup] || 0;
      const greenInGroup = greenCountPerGroup[guessGroup] || 0;
      const remainingInGroup = totalInGroup - greenInGroup;
      if (remainingInGroup <= 0) return "grey";
      return "yellow";
    });
  }

  function compareNationality(guessNat, targetNat) {
    if (guessNat === targetNat) return "green";
    const g = continentMap[guessNat];
    const t = continentMap[targetNat];
    return g && t && g === t ? "yellow" : "grey";
  }

  function compareAge(guessYear, targetYear) {
    if (guessYear === targetYear) return { color: "green", arrow: "" };
    const close = Math.abs(guessYear - targetYear) <= 2;
    return { color: close ? "yellow" : "grey", arrow: guessYear < targetYear ? "\u2191" : "\u2193" };
  }

  function compareFoot(guess, target) { return guess === target ? "green" : "grey"; }
  function compareStatus(guess, target) { return guess === target ? "green" : "grey"; }

  function comparePlayers(guess, target) {
    return {
      clubs: compareClubs(guess.clubs, target.clubs),
      positions: comparePositions(guess.positions, target.positions),
      nationality: compareNationality(guess.nationality, target.nationality),
      age: compareAge(guess.YearOfBirth, target.YearOfBirth),
      strongFoot: compareFoot(guess.strongFoot, target.strongFoot),
      status: compareStatus(guess.status, target.status)
    };
  }

  // ------------------------------
  // GLOW HELPERS
  // ------------------------------
  function applyGlow(el, state) {
    if (!el) return;
    el.classList.remove("state-green", "state-yellow", "state-grey", "glow-green", "glow-yellow", "glow-grey");
    if (state === "green") el.classList.add("state-green", "glow-green");
    else if (state === "yellow") el.classList.add("state-yellow", "glow-yellow");
    else el.classList.add("state-grey", "glow-grey");
  }

  function isVeryColdGuess(result) {
    const signals = [...result.clubs, ...result.positions, result.nationality, result.age.color, result.strongFoot, result.status];
    return !signals.some(s => s === "green" || s === "yellow");
  }

  // ------------------------------
  // RENDER MAIN PROFILE
  // ------------------------------
  function renderPlayerProfile(player, result) {
    profileSection.style.display = "block";
    profileImage.src = player.image;
    profileName.textContent = player.name;

    profileClubsRow.innerHTML = "";
    player.clubs.forEach((club, i) => {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = club;
      applyGlow(pill, result.clubs[i]);
      profileClubsRow.appendChild(pill);
    });

    profilePositionsRow.innerHTML = "";
    player.positions.forEach((pos, i) => {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = pos;
      applyGlow(pill, result.positions[i]);
      profilePositionsRow.appendChild(pill);
    });

    profileNationality.textContent = player.nationality;
    applyGlow(profileNationality, result.nationality);

    profileStatus.textContent = player.status;
    applyGlow(profileStatus, result.status);

    profileYear.textContent = player.YearOfBirth + " " + result.age.arrow;
    applyGlow(profileYear, result.age.color);

    profileFoot.textContent = player.strongFoot;
    applyGlow(profileFoot, result.strongFoot);
  }

  // ------------------------------
  // RENDER GUESS HISTORY CARD
  // ------------------------------
  function addGuessRow(player, result) {
    const card = document.createElement("div");
    card.classList.add("guess-card");

    const header = document.createElement("div");
    header.classList.add("guess-header");

    const img = document.createElement("img");
    img.className = "guess-photo";
    img.src = player.image;

    const nameEl = document.createElement("div");
    nameEl.className = "guess-name";
    nameEl.textContent = player.name;

    header.appendChild(img);
    header.appendChild(nameEl);
    card.appendChild(header);

    const clubsField = document.createElement("div");
    clubsField.classList.add("guess-field");
    clubsField.innerHTML = "<span class=\"guess-label\">Clubs</span>";
    const clubsRow = document.createElement("div");
    clubsRow.className = "guess-pill-row";
    player.clubs.forEach((club, i) => {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = club;
      applyGlow(pill, result.clubs[i]);
      clubsRow.appendChild(pill);
    });
    clubsField.appendChild(clubsRow);
    card.appendChild(clubsField);

    const posField = document.createElement("div");
    posField.classList.add("guess-field");
    posField.innerHTML = "<span class=\"guess-label\">Positions</span>";
    const posRow = document.createElement("div");
    posRow.className = "guess-pill-row";
    player.positions.forEach((pos, i) => {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = pos;
      applyGlow(pill, result.positions[i]);
      posRow.appendChild(pill);
    });
    posField.appendChild(posRow);
    card.appendChild(posField);

    const twoCol = document.createElement("div");
    twoCol.className = "guess-two-col";

    const colLeft = document.createElement("div");
    colLeft.className = "guess-col";

    const natField = document.createElement("div");
    natField.classList.add("guess-field");
    natField.innerHTML = "<span class=\"guess-label\">Nationality</span>";
    const natPill = document.createElement("span");
    natPill.className = "pill";
    natPill.textContent = player.nationality;
    applyGlow(natPill, result.nationality);
    natField.appendChild(natPill);
    colLeft.appendChild(natField);

    const statusField = document.createElement("div");
    statusField.classList.add("guess-field");
    statusField.innerHTML = "<span class=\"guess-label\">Status</span>";
    const statusPill = document.createElement("span");
    statusPill.className = "pill";
    statusPill.textContent = player.status;
    applyGlow(statusPill, result.status);
    statusField.appendChild(statusPill);
    colLeft.appendChild(statusField);

    const colRight = document.createElement("div");
    colRight.className = "guess-col";

    const yearField = document.createElement("div");
    yearField.classList.add("guess-field");
    yearField.innerHTML = "<span class=\"guess-label\">Birth Year</span>";
    const yearPill = document.createElement("span");
    yearPill.className = "pill";
    yearPill.textContent = player.YearOfBirth + " " + result.age.arrow;
    applyGlow(yearPill, result.age.color);
    yearField.appendChild(yearPill);
    colRight.appendChild(yearField);

    const footField = document.createElement("div");
    footField.classList.add("guess-field");
    footField.innerHTML = "<span class=\"guess-label\">Foot</span>";
    const footPill = document.createElement("span");
    footPill.className = "pill";
    footPill.textContent = player.strongFoot;
    applyGlow(footPill, result.strongFoot);
    footField.appendChild(footPill);
    colRight.appendChild(footField);

    twoCol.appendChild(colLeft);
    twoCol.appendChild(colRight);
    card.appendChild(twoCol);

    guessesContainer.prepend(card);
  }

  // ------------------------------
  // REVEAL / HIDE SECTIONS
  // ------------------------------
  function revealGuessSections() {
    document.getElementById("current-header").classList.remove("hidden");
    document.getElementById("player-profile").classList.remove("hidden");
    document.getElementById("previous-header").classList.remove("hidden");
  }

  function renderHiddenDailyCard() {
    document.getElementById("player-profile").classList.add("hidden");
    document.getElementById("current-header").classList.add("hidden");
    document.getElementById("previous-header").classList.add("hidden");
  }

  // ------------------------------
  // MODAL SYSTEM
  // ------------------------------
  const overlay = document.getElementById("modal-overlay");
  const statsModal = document.getElementById("stats-modal");
  const settingsModal = document.getElementById("settings-modal");
  const helpModal = document.getElementById("help-modal");
  const statsBtn = document.getElementById("stats-btn");
  const settingsBtn = document.getElementById("settings-btn");
  const helpBtn = document.getElementById("help-btn");

  function openModal(modal) {
    overlay.classList.remove("hidden");
    modal.classList.remove("hidden");
  }

  function closeModal() {
    overlay.classList.add("hidden");
    statsModal.classList.add("hidden");
    settingsModal.classList.add("hidden");
    helpModal.classList.add("hidden");
    if (!archiveMode) {
      guessInput.disabled = false;
      guessButton.disabled = false;
    }
  }

  settingsBtn.addEventListener("click", () => openModal(settingsModal));
  helpBtn.addEventListener("click", () => openModal(helpModal));

  document.querySelectorAll(".close-modal").forEach(btn => {
    btn.addEventListener("click", closeModal);
  });

  overlay.addEventListener("click", closeModal);

  // ------------------------------
  // YESTERDAY BUTTON
  // ------------------------------
  document.getElementById("yesterday-btn").addEventListener("click", () => {
    if (archiveMode) {
      archiveMode = false;
      targetPlayer = players[getIndexForDate(getTodayKey())];
      guessResults = [];
      guessesContainer.innerHTML = "";

      profileSection.style.display = "";
      document.getElementById("player-image").src = "";
      document.getElementById("player-name").textContent = "";
      document.getElementById("player-clubs").innerHTML = "";
      document.getElementById("player-positions").innerHTML = "";
      document.getElementById("player-nationality").textContent = "";
      document.getElementById("player-status").textContent = "";
      document.getElementById("player-year").textContent = "";
      document.getElementById("player-foot").textContent = "";
      document.getElementById("guess-counter").classList.add("hidden");
      renderHiddenDailyCard();
      document.getElementById("current-header").textContent = "CURRENT GUESS";

      restoreGameState();

      const state = JSON.parse(localStorage.getItem("guessi-state") || "{}");
      if (!state.completed) {
        if (stats.lastCompletedDate === getTodayKey()) {
          guessInput.disabled = true;
          guessButton.disabled = true;
          showShareToast("You've already played today! Come back tomorrow.");
        } else {
          guessInput.disabled = false;
          guessButton.disabled = false;
          guessInput.value = "";
        }
      }
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateKey = yesterday.getFullYear() + "-" + String(yesterday.getMonth() + 1).padStart(2, "0") + "-" + String(yesterday.getDate()).padStart(2, "0");

    archiveMode = true;
    const index = getIndexForDate(dateKey);
    targetPlayer = players[index];

    const neutralResult = {
      clubs: targetPlayer.clubs.map(() => "grey"),
      positions: targetPlayer.positions.map(() => "grey"),
      nationality: "grey",
      age: { color: "grey", arrow: "" },
      strongFoot: "grey",
      status: "grey"
    };

    renderPlayerProfile(targetPlayer, neutralResult);
    revealGuessSections();
    guessesContainer.innerHTML = "";
    guessInput.disabled = true;
    guessButton.disabled = true;
    document.getElementById("current-header").textContent = "Yesterday's Player (" + dateKey + ")";
  });

  // ------------------------------
  // STATS MODAL
  // ------------------------------
  const closeStats = document.getElementById("close-stats");
  const guessDistContainer = document.getElementById("guess-distribution");

  function openStatsModal() {
    document.getElementById("stat-total-games").textContent = stats.totalGames;
    document.getElementById("stat-win-pct").textContent =
      stats.totalGames > 0
        ? Math.round((stats.totalWins / stats.totalGames) * 100) + "%"
        : "0%";
    document.getElementById("stat-current-streak").textContent = stats.currentStreak;
    document.getElementById("stat-longest-streak").textContent = stats.longestStreak;

    guessDistContainer.innerHTML = "";
    const max = Math.max(...Object.values(stats.guessDistribution), 1);

    for (let i = 1; i <= 8; i++) {
      const count = stats.guessDistribution[i];
      const width = (count / max) * 200;
      const bar = document.createElement("div");
      bar.classList.add("guess-bar");
      bar.innerHTML = "<div class=\"guess-bar-label\">" + i + "</div><div class=\"guess-bar-fill\" style=\"width:" + width + "px\"></div><div style=\"margin-left:8px\">" + count + "</div>";
      guessDistContainer.appendChild(bar);
    }

    openModal(statsModal);
  }

  statsBtn.addEventListener("click", openStatsModal);
  closeStats.addEventListener("click", closeModal);

  // ------------------------------
  // RESTORE STATE ON LOAD
  // ------------------------------
  restoreGameState();

  const savedState = JSON.parse(localStorage.getItem("guessi-state") || "{}");
  if (savedState.completed) {
    guessInput.disabled = true;
    guessButton.disabled = true;
  }

}); // END DOMContentLoaded