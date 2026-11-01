const STORAGE_KEYS = {
  foods: "dinner-wheel-foods-v1",
  history: "dinner-wheel-history-v1",
  theme: "dinner-wheel-theme",
};

const DEFAULT_FOODS = [
  { id: "food-hotpot", name: "火锅", emoji: "🍲" },
  { id: "food-noodles", name: "拉面", emoji: "🍜" },
  { id: "food-sushi", name: "寿司", emoji: "🍣" },
  { id: "food-rice", name: "番茄牛腩饭", emoji: "🍚" },
  { id: "food-dumplings", name: "饺子", emoji: "🥟" },
  { id: "food-burger", name: "汉堡", emoji: "🍔" },
  { id: "food-chicken", name: "炸鸡", emoji: "🍗" },
  { id: "food-salad", name: "沙拉", emoji: "🥗" },
];

const WHEEL_COLORS = [
  "#ffc968",
  "#bce981",
  "#91cbff",
  "#ffd0bf",
  "#cbb8ff",
  "#f5eab8",
  "#f6b4c3",
  "#9fe0cf",
];

const RESULT_LINES = [
  "别再翻外卖软件了，就它。",
  "今晚的胃和运气已经达成一致。",
  "看起来就很适合犒劳辛苦一天的自己。",
  "命运发话了，这一顿可以吃得开心点。",
  "从这一刻起，不再纠结，只管开饭。",
];

const state = {
  foods: [],
  history: [],
  rotation: 0,
  isSpinning: false,
  selectedEmoji: "🍽️",
  pendingDeletion: null,
};

const elements = {
  root: document.documentElement,
  greeting: document.querySelector("#greeting"),
  todayDate: document.querySelector("#todayDate"),
  themeToggle: document.querySelector("#themeToggle"),
  themeIcon: document.querySelector(".theme-icon"),
  installButton: document.querySelector("#installButton"),
  wheel: document.querySelector("#dinnerWheel"),
  wheelRotor: document.querySelector("#wheelRotor"),
  wheelDescription: document.querySelector("#wheelDesc"),
  candidateCount: document.querySelector("#candidateCount"),
  menuCount: document.querySelector("#menuCount"),
  centerSpin: document.querySelector("#centerSpin"),
  spinButton: document.querySelector("#spinButton"),
  resultBubble: document.querySelector("#resultBubble"),
  bubbleFood: document.querySelector("#bubbleFood"),
  resultCard: document.querySelector("#resultCard"),
  resultEmpty: document.querySelector("#resultEmpty"),
  resultContent: document.querySelector("#resultContent"),
  resultEmoji: document.querySelector("#resultEmoji"),
  resultFood: document.querySelector("#resultFood"),
  resultCaption: document.querySelector("#resultCaption"),
  resultNumber: document.querySelector("#resultNumber"),
  againButton: document.querySelector("#againButton"),
  historyList: document.querySelector("#historyList"),
  foodList: document.querySelector("#foodList"),
  openAddDialog: document.querySelector("#openAddDialog"),
  foodDialog: document.querySelector("#foodDialog"),
  closeAddDialog: document.querySelector("#closeAddDialog"),
  addFoodForm: document.querySelector("#addFoodForm"),
  foodName: document.querySelector("#foodName"),
  foodError: document.querySelector("#foodError"),
  selectedEmoji: document.querySelector("#selectedEmoji"),
  emojiOptions: document.querySelector("#emojiOptions"),
  resetFoods: document.querySelector("#resetFoods"),
  toast: document.querySelector("#toast"),
  toastMessage: document.querySelector("#toastMessage"),
  undoDelete: document.querySelector("#undoDelete"),
  installDialog: document.querySelector("#installDialog"),
  closeInstallDialog: document.querySelector("#closeInstallDialog"),
  confettiCanvas: document.querySelector("#confettiCanvas"),
};

let deferredInstallPrompt = null;
let toastTimer = null;
let confettiFrame = null;

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The app remains usable if storage is blocked.
  }
}

function normalizeFoods(value) {
  if (!Array.isArray(value)) return structuredClone(DEFAULT_FOODS);
  return value
    .filter(
      (food) =>
        food &&
        typeof food.name === "string" &&
        food.name.trim() &&
        typeof food.id === "string",
    )
    .slice(0, 16)
    .map((food) => ({
      id: food.id,
      name: food.name.trim().slice(0, 12),
      emoji: typeof food.emoji === "string" && food.emoji ? food.emoji : "🍽️",
    }));
}

function loadState() {
  state.foods = normalizeFoods(readStorage(STORAGE_KEYS.foods, DEFAULT_FOODS));
  const savedHistory = readStorage(STORAGE_KEYS.history, []);
  state.history = Array.isArray(savedHistory) ? savedHistory.slice(0, 3) : [];
}

function formatDateHeader() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).formatToParts(now);
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  const weekday = parts.find((part) => part.type === "weekday")?.value || "";
  elements.todayDate.textContent = `${month}月${day}日 ${weekday}`;
  elements.todayDate.dateTime = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  const hour = now.getHours();
  elements.greeting.textContent = hour < 11 ? "早上好" : hour < 17 ? "下午好" : "晚上好";
}

function updateThemeUI() {
  const isDark = elements.root.dataset.theme !== "light";
  elements.themeIcon.textContent = isDark ? "☾" : "☀";
  elements.themeToggle.setAttribute("aria-label", isDark ? "切换为浅色模式" : "切换为深色模式");
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = isDark ? "#151517" : "#f2f1eb";
}

function toggleTheme() {
  const next = elements.root.dataset.theme === "light" ? "dark" : "light";
  elements.root.dataset.theme = next;
  try {
    localStorage.setItem(STORAGE_KEYS.theme, next);
  } catch {}
  updateThemeUI();
  drawWheel();
}

function escapeForText(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function polarPoint(cx, cy, radius, angleDegrees) {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function wedgePath(index, total, center = 260, radius = 242, gap = 0.65) {
  const arc = 360 / total;
  const start = -90 + index * arc + gap / 2;
  const end = -90 + (index + 1) * arc - gap / 2;
  const startPoint = polarPoint(center, center, radius, start);
  const endPoint = polarPoint(center, center, radius, end);
  const largeArc = arc > 180 ? 1 : 0;
  return `M ${center} ${center} L ${startPoint.x.toFixed(3)} ${startPoint.y.toFixed(3)} A ${radius} ${radius} 0 ${largeArc} 1 ${endPoint.x.toFixed(3)} ${endPoint.y.toFixed(3)} Z`;
}

function wheelFontSize(total) {
  if (total <= 3) return 22;
  if (total <= 5) return 18;
  if (total <= 7) return 15.5;
  if (total <= 9) return 13.5;
  if (total <= 12) return 11.5;
  return 9.5;
}

function truncateLabel(name, total) {
  const clean = escapeForText(name);
  const maxLength = total <= 8 ? 7 : total <= 12 ? 6 : 5;
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}…` : clean;
}

function drawWheel() {
  const foods = state.foods;
  elements.wheelRotor.replaceChildren();

  if (!foods.length) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "260");
    circle.setAttribute("cy", "260");
    circle.setAttribute("r", "242");
    circle.setAttribute("fill", "var(--surface-raised)");
    elements.wheelRotor.append(circle);
    elements.wheelDescription.textContent = "转盘目前是空的，请先添加晚餐候选。";
    return;
  }

  const total = foods.length;
  const fontSize = wheelFontSize(total);
  const labelRadius = total <= 3 ? 170 : total <= 7 ? 164 : 171;
  const arc = 360 / total;

  if (total === 1) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "260");
    circle.setAttribute("cy", "260");
    circle.setAttribute("r", "242");
    circle.setAttribute("fill", WHEEL_COLORS[0]);
    circle.setAttribute("class", "wheel-segment");
    elements.wheelRotor.append(circle);
  } else {
    foods.forEach((food, index) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", wedgePath(index, total));
      path.setAttribute("fill", WHEEL_COLORS[index % WHEEL_COLORS.length]);
      path.setAttribute("class", "wheel-segment");
      elements.wheelRotor.append(path);
    });
  }

  foods.forEach((food, index) => {
    const centerAngle = -90 + (index + 0.5) * arc;
    const point = polarPoint(260, 260, labelRadius, centerAngle);
    let rotation = centerAngle + 90;
    if (rotation > 90 || rotation < -90) rotation += 180;

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", point.x.toFixed(2));
    label.setAttribute("y", point.y.toFixed(2));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("dominant-baseline", "middle");
    label.setAttribute("transform", `rotate(${rotation.toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)})`);
    label.setAttribute("class", "wheel-label");
    label.setAttribute("font-size", `${fontSize}`);
    label.textContent = truncateLabel(food.name, total);

    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = food.name;
    label.append(title);
    elements.wheelRotor.append(label);
  });

  elements.wheelDescription.textContent = `转盘上有 ${total} 个选项：${foods
    .map((food) => food.name)
    .join("、")}。`;
}

function renderFoodList() {
  elements.foodList.replaceChildren();
  elements.candidateCount.textContent = String(state.foods.length);
  elements.menuCount.textContent = String(state.foods.length);

  if (!state.foods.length) {
    const empty = document.createElement("div");
    empty.className = "food-list-empty";
    empty.textContent = "转盘饿了，先加点吃的吧。";
    elements.foodList.append(empty);
    return;
  }

  state.foods.forEach((food, index) => {
    const chip = document.createElement("div");
    chip.className = "food-chip";
    chip.style.animationDelay = `${Math.min(index * 25, 220)}ms`;

    const emoji = document.createElement("span");
    emoji.className = "food-chip-emoji";
    emoji.setAttribute("aria-hidden", "true");
    emoji.textContent = food.emoji;

    const name = document.createElement("span");
    name.className = "food-chip-name";
    name.textContent = food.name;

    const remove = document.createElement("button");
    remove.className = "remove-food";
    remove.type = "button";
    remove.dataset.foodId = food.id;
    remove.setAttribute("aria-label", `从转盘移除${food.name}`);
    remove.textContent = "×";

    chip.append(emoji, name, remove);
    elements.foodList.append(chip);
  });
}

function renderHistory() {
  elements.historyList.replaceChildren();
  if (!state.history.length) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "还没有记录，今晚让转盘先开个张。";
    elements.historyList.append(empty);
    return;
  }

  state.history.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "history-item";

    const icon = document.createElement("span");
    icon.className = "history-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = entry.emoji || "🍽️";

    const name = document.createElement("span");
    name.className = "history-name";
    name.textContent = entry.name;

    const date = document.createElement("time");
    date.className = "history-date";
    date.dateTime = entry.iso;
    date.textContent = entry.label;

    item.append(icon, name, date);
    elements.historyList.append(item);
  });
}

function refreshMenu() {
  drawWheel();
  renderFoodList();
}

function randomIndex(max) {
  if (max <= 1) return 0;
  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return values[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function normalizedRotation(value) {
  return ((value % 360) + 360) % 360;
}

function targetRotationFor(index, total) {
  if (total === 1) return 0;
  const arc = 360 / total;
  return normalizedRotation(-(index + 0.5) * arc);
}

function animateWheel(finalRotation, duration) {
  return new Promise((resolve) => {
    if (!elements.wheelRotor.animate) {
      elements.wheelRotor.style.transform = `rotate(${finalRotation}deg)`;
      window.setTimeout(resolve, duration);
      return;
    }

    const animation = elements.wheelRotor.animate(
      [
        { transform: `rotate(${state.rotation}deg)` },
        { transform: `rotate(${finalRotation}deg)` },
      ],
      {
        duration,
        easing: "cubic-bezier(.12,.78,.08,1)",
        fill: "forwards",
      },
    );
    animation.onfinish = resolve;
  });
}

function setSpinning(isSpinning) {
  state.isSpinning = isSpinning;
  elements.centerSpin.disabled = isSpinning;
  elements.spinButton.disabled = isSpinning;
  elements.openAddDialog.disabled = isSpinning;
  elements.resetFoods.disabled = isSpinning;
  elements.foodList.querySelectorAll("button").forEach((button) => {
    button.disabled = isSpinning;
  });
  elements.wheel.setAttribute("aria-busy", String(isSpinning));
  elements.centerSpin.classList.toggle("is-spinning", isSpinning);
  elements.spinButton.querySelector(".spin-button-copy").textContent = isSpinning ? "命运转动中…" : "替我决定";
  elements.spinButton.querySelector(".spin-button-glyph").textContent = isSpinning ? "◦" : "✦";
  if (isSpinning) elements.resultBubble.classList.remove("is-visible");
}

function vibrate(pattern) {
  if ("vibrate" in navigator) navigator.vibrate(pattern);
}

function playReveal() {
  const foods = state.foods;
  const chosenIndex = state.lastIndex;
  const food = foods[chosenIndex];
  if (!food) return;

  elements.resultEmpty.hidden = true;
  elements.resultContent.hidden = false;
  elements.againButton.hidden = false;
  elements.resultEmoji.textContent = food.emoji;
  elements.resultFood.textContent = food.name;
  elements.resultCaption.textContent = RESULT_LINES[randomIndex(RESULT_LINES.length)];
  elements.resultNumber.textContent = `NO. ${String(chosenIndex + 1).padStart(2, "0")}`;
  elements.bubbleFood.textContent = food.name;

  elements.resultContent.classList.remove("is-revealed");
  void elements.resultContent.offsetWidth;
  elements.resultContent.classList.add("is-revealed");
  window.setTimeout(() => elements.resultBubble.classList.add("is-visible"), 120);

  const now = new Date();
  const entry = {
    id: `${Date.now()}-${food.id}`,
    foodId: food.id,
    name: food.name,
    emoji: food.emoji,
    iso: now.toISOString(),
    label: new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now),
  };

  state.history = [entry, ...state.history.filter((item) => item.foodId !== food.id)].slice(0, 3);
  writeStorage(STORAGE_KEYS.history, state.history);
  renderHistory();
  launchConfetti();
  vibrate([35, 45, 75]);
}

async function spin() {
  if (state.isSpinning) return;
  if (!state.foods.length) {
    showToast("转盘还是空的，先加点吃的吧。");
    openFoodDialog();
    return;
  }

  setSpinning(true);
  await new Promise((resolve) => window.setTimeout(resolve, 120));

  const chosenIndex = randomIndex(state.foods.length);
  state.lastIndex = chosenIndex;
  const target = targetRotationFor(chosenIndex, state.foods.length);
  const currentNormalized = normalizedRotation(state.rotation);
  const delta = normalizedRotation(target - currentNormalized);
  const extraTurns = 5 + randomIndex(3);
  const finalRotation = state.rotation + extraTurns * 360 + delta;
  const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 700 : 4600;

  await animateWheel(finalRotation, duration);
  state.rotation = finalRotation;
  setSpinning(false);
  playReveal();

  if (window.matchMedia("(max-width: 900px)").matches) {
    const targetRect = elements.resultCard.getBoundingClientRect();
    if (targetRect.bottom > window.innerHeight) {
      elements.resultCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `food-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function addFood(name, emoji) {
  const cleanName = escapeForText(name).slice(0, 12);
  if (!cleanName) {
    showFoodError("先写下一种想吃的食物。");
    return false;
  }
  if (state.foods.length >= 16) {
    showFoodError("转盘最多放 16 个，先删掉一个再加吧。");
    return false;
  }
  if (state.foods.some((food) => food.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
    showFoodError(`“${cleanName}”已经在转盘上了。`);
    return false;
  }

  state.foods.push({ id: createId(), name: cleanName, emoji });
  writeStorage(STORAGE_KEYS.foods, state.foods);
  refreshMenu();
  return true;
}

function removeFood(id) {
  const index = state.foods.findIndex((food) => food.id === id);
  if (index < 0) return;
  const [removed] = state.foods.splice(index, 1);
  state.pendingDeletion = { food: removed, index };
  writeStorage(STORAGE_KEYS.foods, state.foods);
  refreshMenu();
  showToast(`已把「${removed.name}」移出转盘`, true);
}

function undoRemove() {
  if (!state.pendingDeletion) return;
  const { food, index } = state.pendingDeletion;
  if (state.foods.length >= 16) {
    showToast("转盘已满，暂时放不回去了。");
    return;
  }
  state.foods.splice(Math.min(index, state.foods.length), 0, food);
  state.pendingDeletion = null;
  writeStorage(STORAGE_KEYS.foods, state.foods);
  refreshMenu();
  hideToast();
  showToast(`「${food.name}」回来了`);
}

function resetFoods() {
  state.foods = structuredClone(DEFAULT_FOODS);
  state.pendingDeletion = null;
  writeStorage(STORAGE_KEYS.foods, state.foods);
  refreshMenu();
  showToast("已恢复推荐菜单");
}

function showFoodError(message) {
  elements.foodError.textContent = message;
  elements.foodError.hidden = false;
  elements.foodName.focus();
}

function clearFoodError() {
  elements.foodError.hidden = true;
  elements.foodError.textContent = "";
}

function selectEmoji(emoji) {
  state.selectedEmoji = emoji;
  elements.selectedEmoji.textContent = emoji;
  elements.emojiOptions.querySelectorAll(".emoji-option").forEach((button) => {
    const selected = button.dataset.emoji === emoji;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function openFoodDialog(prefill = "") {
  clearFoodError();
  elements.foodName.value = prefill;
  selectEmoji(prefill.includes("面") ? "🍜" : prefill.includes("锅") ? "🍲" : "🍽️");
  if (!elements.foodDialog.open) elements.foodDialog.showModal();
  window.setTimeout(() => elements.foodName.focus(), 70);
}

function closeFoodDialog() {
  if (elements.foodDialog.open) elements.foodDialog.close();
}

function showToast(message, canUndo = false) {
  window.clearTimeout(toastTimer);
  elements.toastMessage.textContent = message;
  elements.undoDelete.hidden = !canUndo;
  elements.toast.classList.add("is-visible");
  if (!canUndo) state.pendingDeletion = null;
  toastTimer = window.setTimeout(hideToast, canUndo ? 5200 : 2600);
}

function hideToast() {
  elements.toast.classList.remove("is-visible");
  window.clearTimeout(toastTimer);
}

function launchConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = elements.confettiCanvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (confettiFrame) cancelAnimationFrame(confettiFrame);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors = ["#b9ef77", "#ffc968", "#ff8b79", "#9ccfff", "#cdbaff"];
  const originX = innerWidth * (innerWidth < 900 ? 0.5 : 0.68);
  const originY = Math.min(innerHeight * 0.42, 360);
  const particles = Array.from({ length: 54 }, () => ({
    x: originX + (Math.random() - 0.5) * 80,
    y: originY + (Math.random() - 0.5) * 45,
    vx: (Math.random() - 0.5) * 11,
    vy: -3 - Math.random() * 8,
    gravity: 0.15 + Math.random() * 0.1,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.22,
    size: 4 + Math.random() * 7,
    color: colors[Math.floor(Math.random() * colors.length)],
    life: 1,
  }));

  const start = performance.now();
  function tick(now) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    particles.forEach((particle) => {
      particle.vy += particle.gravity;
      particle.vx *= 0.992;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.rotationSpeed;
      particle.life = Math.max(0, 1 - (now - start) / 1900);

      ctx.save();
      ctx.globalAlpha = particle.life;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;
      ctx.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
      ctx.restore();
    });

    if (now - start < 1950) {
      confettiFrame = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      confettiFrame = null;
    }
  }
  confettiFrame = requestAnimationFrame(tick);
}

function setCurrentDate() {
  formatDateHeader();
  window.setInterval(formatDateHeader, 60_000);
}

function bindEvents() {
  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.spinButton.addEventListener("click", spin);
  elements.centerSpin.addEventListener("click", spin);
  elements.againButton.addEventListener("click", spin);
  elements.openAddDialog.addEventListener("click", () => openFoodDialog());
  elements.closeAddDialog.addEventListener("click", closeFoodDialog);
  elements.resetFoods.addEventListener("click", resetFoods);
  elements.undoDelete.addEventListener("click", undoRemove);

  elements.foodName.addEventListener("input", clearFoodError);

  elements.emojiOptions.addEventListener("click", (event) => {
    const button = event.target.closest(".emoji-option");
    if (button) selectEmoji(button.dataset.emoji);
  });

  document.querySelectorAll("[data-quick-food]").forEach((button) => {
    button.addEventListener("click", () => {
      elements.foodName.value = button.dataset.quickFood;
      const match = button.textContent.trim().split(" ")[0];
      selectEmoji(match);
      clearFoodError();
      elements.foodName.focus();
    });
  });

  elements.addFoodForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const success = addFood(elements.foodName.value, state.selectedEmoji);
    if (!success) return;
    const addedName = elements.foodName.value.trim();
    closeFoodDialog();
    elements.foodName.value = "";
    showToast(`「${addedName}」已加入转盘`);
  });

  elements.foodList.addEventListener("click", (event) => {
    const button = event.target.closest(".remove-food");
    if (button) removeFood(button.dataset.foodId);
  });

  elements.foodDialog.addEventListener("click", (event) => {
    if (event.target === elements.foodDialog) closeFoodDialog();
  });

  document.addEventListener("keydown", (event) => {
    const isTyping = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
    const dialogOpen = elements.foodDialog.open || elements.installDialog.open;
    if (event.code === "Space" && !isTyping && !dialogOpen) {
      event.preventDefault();
      spin();
    }
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    elements.installButton.hidden = false;
  });

  elements.installButton.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice.catch(() => null);
      deferredInstallPrompt = null;
      elements.installButton.hidden = true;
      return;
    }
    elements.installDialog.showModal();
  });

  elements.closeInstallDialog.addEventListener("click", () => elements.installDialog.close());
  elements.installDialog.addEventListener("click", (event) => {
    if (event.target === elements.installDialog) elements.installDialog.close();
  });

  window.addEventListener("resize", () => {
    const canvas = elements.confettiCanvas;
    if (!confettiFrame) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  });
}

function setupInstallExperience() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(window.navigator.standalone);
  if (isIOS && !isStandalone) elements.installButton.hidden = false;
  if (isStandalone) elements.installButton.hidden = true;
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch {
    // Offline support is progressive; the page itself still works.
  }
}

function init() {
  loadState();
  setCurrentDate();
  updateThemeUI();
  refreshMenu();
  renderHistory();
  bindEvents();
  setupInstallExperience();
  registerServiceWorker();
}

init();
