(() => {
  "use strict";

  /* ===== CONFIG ===== */
  const SIZE = 4;
  const STORAGE_BEST = "game2048-best";
  const STORAGE_THEME = "game2048-theme";
  const SLIDE_MS = 120;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ===== DOM ===== */
  const $ = id => document.getElementById(id);
  const tilesLayer = $("tiles");
  const boardEl = $("board");
  const scoreEl = $("score");
  const bestEl = $("best");
  const scoreBoxEl = $("score-box");
  const messageEl = $("message");
  const messageText = $("message-text");
  const messageBtn = $("message-btn");
  const continueBtn = $("continue-btn");
  const newGameBtn = $("new-game");
  const undoBtn = $("undo");
  const themeBtn = $("theme-btn");
  const themeColorMeta = $("theme-color");
  const cursorDot = $("cursor-dot");
  const cursorRing = $("cursor-ring");

  /* ===== STATE ===== */
  let tiles = [];
  let nextId = 1;
  let score = 0;
  let bestScore = 0;
  let gameOver = false;
  let won = false;
  let keepPlaying = false;
  let previousState = null;
  let isAnimating = false;
  const tileEls = new Map();

  /* ===== STORAGE ===== */
  function loadBest() {
    try {
      const value = Number.parseInt(localStorage.getItem(STORAGE_BEST) ?? "0", 10);
      if (Number.isFinite(value) && value >= 0) bestScore = value;
    } catch (_) { /* ignore storage errors */ }
    bestEl.textContent = bestScore.toLocaleString();
  }

  function saveBest() {
    try { localStorage.setItem(STORAGE_BEST, String(bestScore)); } catch (_) { /* ignore */ }
  }

  function loadTheme() {
    let dark = false;
    try { dark = localStorage.getItem(STORAGE_THEME) === "dark"; } catch (_) { /* ignore */ }
    applyTheme(dark);
  }

  function saveTheme(isDark) {
    try { localStorage.setItem(STORAGE_THEME, isDark ? "dark" : "light"); } catch (_) { /* ignore */ }
  }

  function applyTheme(isDark) {
    document.body.classList.toggle("dark", isDark);
    themeBtn.textContent = isDark ? "☀️" : "🌙";
    const label = isDark ? "Switch to light theme" : "Switch to dark theme";
    themeBtn.setAttribute("aria-label", label);
    themeBtn.setAttribute("title", label);
    if (themeColorMeta) themeColorMeta.content = isDark ? "#0f0e0b" : "#faf8ef";
  }

  /* ===== HELPERS ===== */
  const tileAt = (row, col) => tiles.find(t => t.row === row && t.col === col) || null;
  const tileById = id => tiles.find(t => t.id === id) || null;

  /* Snapshot is taken BEFORE a move mutates the board (correct Undo). */
  function snapshot() {
    return {
      tiles: tiles.map(t => ({ id: t.id, value: t.value, row: t.row, col: t.col, isNew: false })),
      score, nextId, gameOver, won, keepPlaying
    };
  }

  /* ===== RANDOM TILE ===== */
  function addRandomTile() {
    const empty = [];
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (!tileAt(row, col)) empty.push({ row, col });
      }
    }
    if (!empty.length) return null;

    const spot = empty[Math.floor(Math.random() * empty.length)];
    const tile = {
      id: nextId++,
      value: Math.random() < 0.9 ? 2 : 4,
      row: spot.row,
      col: spot.col,
      isNew: true
    };
    tiles.push(tile);
    return tile;
  }

  /* ===== TILE GEOMETRY ===== */
  function getBoardGeometry() {
    const styles = getComputedStyle(boardEl);
    const pad = Number.parseFloat(styles.paddingLeft) || 0;
    const gap = Number.parseFloat(styles.columnGap) || 0;
    const cellSize = (boardEl.clientWidth - pad * 2 - gap * (SIZE - 1)) / SIZE;
    return { pad, gap, cellSize };
  }

  function syncTileGeometry() {
    const { pad, gap, cellSize } = getBoardGeometry();

    for (const tile of tiles) {
      const el = tileEls.get(tile.id);
      if (!el) continue;

      let fontScale = 0.34;
      if (tile.value >= 10000) fontScale = 0.17;
      else if (tile.value >= 1000) fontScale = 0.20;
      else if (tile.value >= 100) fontScale = 0.26;

      el.style.width = `${cellSize}px`;
      el.style.height = `${cellSize}px`;
      el.style.setProperty("--tile-font-size", `${Math.max(14, cellSize * fontScale)}px`);

      const x = pad + tile.col * (cellSize + gap);
      const y = pad + tile.row * (cellSize + gap);
      el.style.transform = `translate(${x}px, ${y}px)`;
    }
  }

  /* ===== TILE DOM ===== */
  const tileClass = value => `tile tile-${Math.min(value, 8192)}`;

  function createTileEl(tile) {
    const el = document.createElement("div");
    el.className = tileClass(tile.value);
    el.dataset.value = String(tile.value);
    el.dataset.id = String(tile.id);

    const inner = document.createElement("div");
    inner.className = "tile-inner";
    inner.textContent = tile.value;
    el.appendChild(inner);

    if (tile.isNew && !reducedMotion) el.classList.add("tile-new");
    return el;
  }

  function updateTileEl(el, tile) {
    if (el.dataset.value !== String(tile.value)) {
      el.dataset.value = String(tile.value);
      el.className = tileClass(tile.value);
      const inner = el.firstElementChild;
      if (inner) inner.textContent = tile.value;
    }
  }

  function renderTiles() {
    const currentIds = new Set(tiles.map(t => t.id));

    /* Remove orphan DOM tiles */
    for (const [id, el] of tileEls) {
      if (!currentIds.has(id)) {
        el.remove();
        tileEls.delete(id);
      }
    }

    /* Create/update tiles */
    for (const tile of tiles) {
      let el = tileEls.get(tile.id);
      if (!el) {
        el = createTileEl(tile);
        tileEls.set(tile.id, el);
        tilesLayer.appendChild(el);
      } else {
        updateTileEl(el, tile);
      }
    }

    syncTileGeometry();
  }

  /* ===== SCORE ===== */
  function setScore(newScore, animate = true) {
    score = Math.max(0, newScore);
    scoreEl.textContent = score.toLocaleString();

    if (animate && !reducedMotion) {
      scoreEl.classList.remove("bump");
      void scoreEl.offsetWidth;
      scoreEl.classList.add("bump");
    }

    if (score > bestScore) {
      bestScore = score;
      bestEl.textContent = bestScore.toLocaleString();
      saveBest();
    }
  }

  function flashScore(points) {
    if (!points) return;
    const pop = document.createElement("span");
    pop.className = "score-float";
    pop.textContent = `+${points.toLocaleString()}`;
    scoreBoxEl.appendChild(pop);
    window.setTimeout(() => pop.remove(), 750);
  }

  /* ===== MOVEMENT ===== */
  const VECTORS = {
    up: { dr: -1, dc: 0 },
    down: { dr: 1, dc: 0 },
    left: { dr: 0, dc: -1 },
    right: { dr: 0, dc: 1 }
  };

  /* Tiles of a line, ordered from the side closest to the movement direction. */
  function getLineTiles(direction, line) {
    const vertical = direction === "up" || direction === "down";
    const result = tiles.filter(t => (vertical ? t.col === line : t.row === line));
    const axis = vertical ? "row" : "col";

    result.sort((a, b) =>
      direction === "up" || direction === "left" ? a[axis] - b[axis] : b[axis] - a[axis]
    );
    return result;
  }

  function destination(direction, line, index) {
    if (direction === "up") return { row: index, col: line };
    if (direction === "down") return { row: SIZE - 1 - index, col: line };
    if (direction === "left") return { row: line, col: index };
    return { row: line, col: SIZE - 1 - index };
  }

  function move(direction) {
    if (isAnimating || gameOver) return;
    if (!VECTORS[direction]) return;

    /* Snapshot MUST happen before anything changes. */
    const before = snapshot();

    const losers = new Set();
    const winners = new Map();

    /* Logical values are separate so the DOM keeps the old value during the slide. */
    const logicalValues = new Map(tiles.map(t => [t.id, t.value]));

    let moved = false;
    let gainedPoints = 0;

    for (let line = 0; line < SIZE; line++) {
      const lineTiles = getLineTiles(direction, line);

      let writeIndex = 0;
      let lastTile = null;
      let lastMerged = false;

      for (const tile of lineTiles) {
        const value = logicalValues.get(tile.id);

        /* First tile in the line */
        if (!lastTile) {
          const dest = destination(direction, line, writeIndex++);
          if (tile.row !== dest.row || tile.col !== dest.col) moved = true;
          tile.row = dest.row;
          tile.col = dest.col;
          lastTile = tile;
          lastMerged = false;
          continue;
        }

        const lastValue = logicalValues.get(lastTile.id);

        /* Merge into previous tile */
        if (!lastMerged && lastValue === value) {
          moved = true;
          losers.add(tile.id);

          const newValue = value * 2;
          logicalValues.set(lastTile.id, newValue);
          winners.set(lastTile.id, newValue);
          gainedPoints += newValue;

          /* Consumed tile slides onto its partner before removal. */
          tile.row = lastTile.row;
          tile.col = lastTile.col;

          /* Prevent double merging in one move. */
          lastMerged = true;
        } else {
          /* Normal movement */
          const dest = destination(direction, line, writeIndex++);
          if (tile.row !== dest.row || tile.col !== dest.col) moved = true;
          tile.row = dest.row;
          tile.col = dest.col;
          lastTile = tile;
          lastMerged = false;
        }
      }
    }

    /* No board change: do nothing. */
    if (!moved) return;

    /* This is now the true Undo point. */
    previousState = before;
    undoBtn.disabled = false;
    isAnimating = true;

    /* PHASE 1: tiles slide to new locations. */
    renderTiles();

    /* PHASE 2: apply merges, add random tile, evaluate game. */
    window.setTimeout(() => {
      applyMerges(losers, winners, gainedPoints);

      for (const tile of tiles) tile.isNew = false;

      const newTile = addRandomTile();
      renderTiles();

      if (newTile) {
        const newEl = tileEls.get(newTile.id);
        if (newEl) {
          if (!reducedMotion) {
            window.setTimeout(() => newEl.classList.remove("tile-new"), 220);
          } else {
            newEl.classList.remove("tile-new");
          }
        }
        newTile.isNew = false;
      }

      checkGameState();
      isAnimating = false;
    }, reducedMotion ? 0 : SLIDE_MS);
  }

  /* ===== MERGE APPLICATION ===== */
  function applyMerges(losers, winners, gainedPoints) {
    /* Remove consumed tiles. */
    tiles = tiles.filter(t => !losers.has(t.id));

    /* Update winner values. */
    for (const [id, newValue] of winners) {
      const tile = tileById(id);
      if (!tile) continue;

      tile.value = newValue;

      const el = tileEls.get(id);
      if (!el) continue;

      el.dataset.value = String(newValue);
      el.className = tileClass(newValue);

      const inner = el.firstElementChild;
      if (inner) inner.textContent = newValue;

      if (!reducedMotion) {
        void el.offsetWidth;
        el.classList.add("tile-merged");
        window.setTimeout(() => el.classList.remove("tile-merged"), 260);
      }

      /* >= 2048 also covers unexpectedly higher values. */
      if (newValue >= 2048 && !won) won = true;
    }

    if (gainedPoints > 0) {
      setScore(score + gainedPoints);
      flashScore(gainedPoints);
    }
  }

  /* ===== GAME STATE ===== */
  function canMove() {
    if (tiles.length < SIZE * SIZE) return true;

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const tile = tileAt(row, col);
        if (!tile) return true;

        const right = col < SIZE - 1 ? tileAt(row, col + 1) : null;
        const down = row < SIZE - 1 ? tileAt(row + 1, col) : null;

        if (right && right.value === tile.value) return true;
        if (down && down.value === tile.value) return true;
      }
    }
    return false;
  }

  function checkGameState() {
    /* Win has priority over Game Over. */
    if (won && !keepPlaying) {
      gameOver = false;
      showMessage("🎉 You Win!", "New Game", true);
      return;
    }

    if (!canMove()) {
      gameOver = true;
      showMessage("Game Over!", "Try Again", false);
    }
  }

  function showMessage(text, primaryLabel, isWin) {
    messageText.textContent = text;
    messageBtn.textContent = primaryLabel;
    continueBtn.hidden = !isWin;
    messageEl.classList.add("active");
  }

  function hideMessage() {
    messageEl.classList.remove("active");
    continueBtn.hidden = true;
  }

  /* ===== GAME INITIALIZATION ===== */
  function clearBoardDom() {
    tilesLayer.replaceChildren();
    tileEls.clear();
  }

  function initGame() {
    clearBoardDom();

    tiles = [];
    nextId = 1;
    score = 0;
    gameOver = false;
    won = false;
    keepPlaying = false;
    previousState = null;
    isAnimating = false;

    scoreEl.textContent = "0";
    bestEl.textContent = bestScore.toLocaleString();
    undoBtn.disabled = true;

    hideMessage();

    addRandomTile();
    addRandomTile();
    renderTiles();

    /* Clear "new tile" state after the opening animation. */
    window.setTimeout(() => {
      for (const tile of tiles) {
        tile.isNew = false;
        const el = tileEls.get(tile.id);
        if (el) el.classList.remove("tile-new");
      }
    }, 220);
  }

  /* ===== UNDO ===== */
  function undo() {
    if (!previousState || isAnimating) return;

    const state = previousState;
    previousState = null;

    clearBoardDom();

    tiles = state.tiles.map(t => ({ ...t, isNew: false }));
    nextId = state.nextId;
    score = state.score;
    gameOver = state.gameOver;
    won = state.won;
    keepPlaying = state.keepPlaying;

    scoreEl.textContent = score.toLocaleString();
    undoBtn.disabled = true;

    hideMessage();
    renderTiles();
  }

  /* ===== KEYBOARD ===== */
  const KEY_MAP = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", W: "up", s: "down", S: "down",
    a: "left", A: "left", d: "right", D: "right",
    k: "up", j: "down", h: "left", l: "right"
  };

  document.addEventListener("keydown", event => {
    const direction = KEY_MAP[event.key];
    if (!direction) return;

    /* Don't hijack typing fields. */
    const active = document.activeElement;
    if (active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) return;

    event.preventDefault();
    move(direction);
  });

  /* ===== TOUCH ===== */
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  boardEl.addEventListener("touchstart", event => {
    if (event.touches.length !== 1) return;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    touchStartTime = performance.now();
  }, { passive: true });

  boardEl.addEventListener("touchmove", event => {
    if (event.cancelable) event.preventDefault();
  }, { passive: false });

  boardEl.addEventListener("touchend", event => {
    if (!event.changedTouches.length) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const dt = performance.now() - touchStartTime;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    /* Ignore slow gestures and taps. */
    if (dt > 800) return;
    if (absX < 24 && absY < 24) return;

    if (absX > absY) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
  }, { passive: true });

  /* ===== MOUSE DRAG ===== */
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;

  boardEl.addEventListener("mousedown", event => {
    if (event.button !== 0) return;
    dragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
  });

  window.addEventListener("mousemove", event => {
    if (!dragging) return;

    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const threshold = 30;

    if (absX < threshold && absY < threshold) return;

    dragging = false;

    if (absX > absY) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
  });

  window.addEventListener("mouseup", () => { dragging = false; });

  /* ===== OVERLAY INPUT PROTECTION ===== */
  /* Stops overlay button interaction bubbling into board swipe/drag handlers. */
  ["touchstart", "touchmove", "touchend", "mousedown"].forEach(type => {
    messageEl.addEventListener(type, event => event.stopPropagation());
  });

  /* ===== BUTTONS ===== */
  newGameBtn.addEventListener("click", initGame);
  undoBtn.addEventListener("click", undo);

  /* Game Over and Win: primary button starts a new game. */
  messageBtn.addEventListener("click", initGame);

  /* Win screen only: continue the current game. */
  continueBtn.addEventListener("click", () => {
    keepPlaying = true;
    hideMessage();
  });

  /* ===== THEME ===== */
  themeBtn.addEventListener("click", () => {
    const isDark = !document.body.classList.contains("dark");
    applyTheme(isDark);
    saveTheme(isDark);
  });

  /* ===== CUSTOM CURSOR ===== */
  const finePointer = window.matchMedia("(min-width: 900px) and (hover: hover) and (pointer: fine)");

  if (finePointer.matches && cursorDot && cursorRing) {
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let cursorVisible = false;

    const loop = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;

      cursorDot.style.left = `${mx}px`;
      cursorDot.style.top = `${my}px`;
      cursorRing.style.left = `${rx}px`;
      cursorRing.style.top = `${ry}px`;

      requestAnimationFrame(loop);
    };
    loop();

    window.addEventListener("mousemove", event => {
      mx = event.clientX;
      my = event.clientY;

      if (!cursorVisible) {
        cursorVisible = true;
        rx = mx;
        ry = my;
      }
    }, { passive: true });

    document.addEventListener("mouseleave", () => {
      cursorDot.style.opacity = "0";
      cursorRing.style.opacity = "0";
    });

    document.addEventListener("mouseenter", () => {
      cursorDot.style.opacity = "1";
      cursorRing.style.opacity = "0.55";
    });

    document.querySelectorAll(".interactive, button, a").forEach(element => {
      element.addEventListener("mouseenter", () => document.body.classList.add("cursor-hover"));
      element.addEventListener("mouseleave", () => document.body.classList.remove("cursor-hover"));
    });
  }

  /* ===== RESPONSIVE GEOMETRY ===== */
  const handleResize = () => syncTileGeometry();

  window.addEventListener("resize", handleResize, { passive: true });

  if ("ResizeObserver" in window) {
    new ResizeObserver(handleResize).observe(boardEl);
  }

  /* ===== BOOT ===== */
  loadBest();
  loadTheme();
  initGame();
})();
