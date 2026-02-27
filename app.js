const STORAGE_KEY = "aquapace_workouts";

const form = document.getElementById("workoutForm");
const listEl = document.getElementById("workoutsList");
const emptyStateEl = document.getElementById("emptyState");
const clearAllBtn = document.getElementById("clearAll");
const typeFilterEl = document.getElementById("typeFilter");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEdit");
const dateInputEl = document.getElementById("date");
const typeInputEl = document.getElementById("type");
const strokeInputEl = document.getElementById("stroke");
const feelingInputEl = document.getElementById("feeling");
const distanceInputEl = document.getElementById("distance");
const durationInputEl = document.getElementById("duration");
const notesInputEl = document.getElementById("notes");
const formErrorEl = document.getElementById("formError");
const planFormEl = document.getElementById("planForm");
const planDateInputEl = document.getElementById("planDate");
const planTypeInputEl = document.getElementById("planType");
const planStrokeInputEl = document.getElementById("planStroke");
const planDistanceInputEl = document.getElementById("planDistance");
const planDurationInputEl = document.getElementById("planDuration");
const planObjectiveInputEl = document.getElementById("planObjective");
const planErrorEl = document.getElementById("planError");
const plansListEl = document.getElementById("plansList");
const planEmptyStateEl = document.getElementById("planEmptyState");
const planWeekPlannedEl = document.getElementById("planWeekPlanned");
const planWeekDoneEl = document.getElementById("planWeekDone");
const planWeekDistanceEl = document.getElementById("planWeekDistance");
const planWeekDistanceDoneEl = document.getElementById("planWeekDistanceDone");
const monthChartCanvas = document.getElementById("monthDistanceChart");
const paceChartCanvas = document.getElementById("paceSessionChart");
const monthTotalEl = document.getElementById("monthTotal");
const paceChartMetaEl = document.getElementById("paceChartMeta");
const chartMonthLabelEl = document.getElementById("chartMonthLabel");
const chartTitleEl = document.getElementById("chartTitle");
const distanceTabBtn = document.getElementById("distanceTabBtn");
const paceTabBtn = document.getElementById("paceTabBtn");
const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");
const monthlyGoalInput = document.getElementById("monthlyGoalInput");
const goalProgressTextEl = document.getElementById("goalProgressText");
const goalBarFillEl = document.getElementById("goalBarFill");

const weekDistanceEl = document.getElementById("weekDistance");
const weekTimeEl = document.getElementById("weekTime");
const weekPaceEl = document.getElementById("weekPace");
const weekSessionsEl = document.getElementById("weekSessions");
const weekPaceRecordEl = document.getElementById("weekPaceRecord");
const exportDataBtn = document.getElementById("exportDataBtn");
const importDataBtn = document.getElementById("importDataBtn");
const importDataInput = document.getElementById("importDataInput");
const dataMessageEl = document.getElementById("dataMessage");
const authEmailEl = document.getElementById("authEmail");
const authPasswordEl = document.getElementById("authPassword");
const signInBtn = document.getElementById("signInBtn");
const signUpBtn = document.getElementById("signUpBtn");
const signOutBtn = document.getElementById("signOutBtn");
const authStatusEl = document.getElementById("authStatus");
const syncStatusEl = document.getElementById("syncStatus");
const authUserBadgeEl = document.getElementById("authUserBadge");

let editingWorkoutId = null;
let chartMonthOffset = 0;
let chartMode = "distance";
let supabaseClient = null;
let currentUserId = null;
let isSyncingRemote = false;
let hasPendingRemoteSync = false;
let isApplyingRemoteData = false;
const GOAL_STORAGE_KEY = "aquapace_monthly_goal";
const PLAN_STORAGE_KEY = "aquapace_plans";
const SUPABASE_URL = "https://rhwaamdakfyqdwzuukvr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_a86EdlugjJIn9CB5zhyFEg_dL7a7pXS";
const SUPABASE_TABLE = "aquapace_user_data";
const ALLOWED_TYPES = new Set(["technique", "endurance", "sprint", "mixte"]);
const ALLOWED_STROKES = new Set(["crawl", "dos", "brasse", "papillon", "mixte"]);
const ALLOWED_FEELINGS = new Set(["facile", "correct", "difficile", "epuisant"]);
const ALLOWED_PLAN_STATUS = new Set(["todo", "done", "missed"]);

function loadWorkouts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWorkouts(workouts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
  if (!isApplyingRemoteData) queueRemoteSync();
}

function loadPlans() {
  try {
    const raw = localStorage.getItem(PLAN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePlans(plans) {
  localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plans));
  if (!isApplyingRemoteData) queueRemoteSync();
}

function loadMonthlyGoal() {
  const raw = Number(localStorage.getItem(GOAL_STORAGE_KEY));
  if (!Number.isFinite(raw) || raw <= 0) return 10000;
  return Math.round(raw);
}

function saveMonthlyGoal(goal) {
  localStorage.setItem(GOAL_STORAGE_KEY, String(goal));
  if (!isApplyingRemoteData) queueRemoteSync();
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
}

function formatDateFR(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR");
}

function startOfWeekMonday(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isInCurrentWeek(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const start = startOfWeekMonday(new Date());
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return dt >= start && dt < end;
}

function paceMinPer100m(distanceM, durationMin) {
  if (distanceM <= 0 || durationMin <= 0) return null;
  const minPer100 = (durationMin / distanceM) * 100;
  const mins = Math.floor(minPer100);
  const secsRaw = Math.round((minPer100 - mins) * 60);
  const secs = secsRaw === 60 ? 0 : secsRaw;
  const minutes = secsRaw === 60 ? mins + 1 : mins;
  return `${minutes}:${String(secs).padStart(2, "0")} /100m`;
}

function paceValueMinPer100m(distanceM, durationMin) {
  if (distanceM <= 0 || durationMin <= 0) return null;
  return (durationMin / distanceM) * 100;
}

function formatPaceValue(minPer100) {
  if (!Number.isFinite(minPer100) || minPer100 <= 0) return "-";
  const mins = Math.floor(minPer100);
  const secsRaw = Math.round((minPer100 - mins) * 60);
  const secs = secsRaw === 60 ? 0 : secsRaw;
  const minutes = secsRaw === 60 ? mins + 1 : mins;
  return `${minutes}:${String(secs).padStart(2, "0")} /100m`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function labelType(type) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getTodayIsoLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function showFormError(message) {
  if (!formErrorEl) return;
  formErrorEl.textContent = message;
  formErrorEl.classList.remove("hidden");
}

function clearFormError() {
  if (!formErrorEl) return;
  formErrorEl.textContent = "";
  formErrorEl.classList.add("hidden");
}

function showPlanError(message) {
  if (!planErrorEl) return;
  planErrorEl.textContent = message;
  planErrorEl.classList.remove("hidden");
}

function clearPlanError() {
  if (!planErrorEl) return;
  planErrorEl.textContent = "";
  planErrorEl.classList.add("hidden");
}

function showDataMessage(message, isError = false) {
  if (!dataMessageEl) return;
  dataMessageEl.textContent = message;
  dataMessageEl.classList.remove("hidden");
  dataMessageEl.classList.toggle("error", isError);
}

function clearDataMessage() {
  if (!dataMessageEl) return;
  dataMessageEl.textContent = "";
  dataMessageEl.classList.add("hidden");
  dataMessageEl.classList.remove("error");
}

function showAuthStatus(message, isError = false) {
  if (!authStatusEl) return;
  if (!isError) {
    authStatusEl.textContent = "";
    authStatusEl.classList.add("hidden");
    authStatusEl.classList.remove("error");
    return;
  }
  authStatusEl.textContent = message;
  authStatusEl.classList.remove("hidden");
  authStatusEl.classList.toggle("error", isError);
}

function showSyncStatus(message, isError = false) {
  if (!syncStatusEl) return;
  if (!isError) {
    syncStatusEl.textContent = "";
    syncStatusEl.classList.add("hidden");
    syncStatusEl.classList.remove("error");
    return;
  }
  syncStatusEl.textContent = message;
  syncStatusEl.classList.remove("hidden");
  syncStatusEl.classList.toggle("error", isError);
}

function clearSyncStatus() {
  if (!syncStatusEl) return;
  syncStatusEl.textContent = "";
  syncStatusEl.classList.add("hidden");
  syncStatusEl.classList.remove("error");
}

function hasSupabaseConfig() {
  return (
    typeof window.supabase !== "undefined" &&
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
    SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY"
  );
}

function updateAuthUi() {
  if (!signInBtn || !signUpBtn || !signOutBtn || !authEmailEl || !authPasswordEl) return;
  const connected = Boolean(currentUserId);
  signOutBtn.classList.toggle("hidden", !connected);
  signInBtn.classList.toggle("hidden", connected);
  signUpBtn.classList.toggle("hidden", connected);
  authEmailEl.disabled = connected;
  authPasswordEl.disabled = connected;
  if (authUserBadgeEl) {
    authUserBadgeEl.textContent = connected ? "Connecte" : "Local";
  }
}

function validateWorkout(w) {
  if (!w.date) return "Renseigne la date de la seance.";
  if (w.date > getTodayIsoLocal()) return "La date ne peut pas etre dans le futur.";
  if (!ALLOWED_TYPES.has(w.type)) return "Type de seance invalide.";
  if (!ALLOWED_STROKES.has(w.stroke)) return "Type de nage invalide.";
  if (!ALLOWED_FEELINGS.has(w.feeling)) return "Ressenti invalide.";
  if (!Number.isFinite(w.distance) || w.distance < 50) return "La distance doit etre d'au moins 50 m.";
  if (!Number.isFinite(w.duration) || w.duration <= 0) return "La duree doit etre superieure a 0 minute.";
  return null;
}

function validatePlan(plan) {
  if (!plan.date) return "Renseigne la date du plan.";
  if (!ALLOWED_TYPES.has(plan.type)) return "Type de seance du plan invalide.";
  if (!ALLOWED_STROKES.has(plan.stroke)) return "Type de nage du plan invalide.";
  if (!Number.isFinite(plan.targetDistance) || plan.targetDistance < 50) {
    return "La distance cible doit etre d'au moins 50 m.";
  }
  if (!Number.isFinite(plan.targetDuration) || plan.targetDuration <= 0) {
    return "La duree cible doit etre superieure a 0 minute.";
  }
  if (!ALLOWED_PLAN_STATUS.has(plan.status)) return "Statut du plan invalide.";
  return null;
}

function normalizeImportedWorkout(raw) {
  const candidate = {
    id: typeof raw?.id === "string" && raw.id.trim() ? raw.id.trim() : uid(),
    date: typeof raw?.date === "string" ? raw.date : "",
    type: typeof raw?.type === "string" ? raw.type : "",
    stroke: typeof raw?.stroke === "string" ? raw.stroke : "crawl",
    feeling: typeof raw?.feeling === "string" ? raw.feeling : "correct",
    distance: Number(raw?.distance),
    duration: Number(raw?.duration),
    notes: typeof raw?.notes === "string" ? raw.notes.trim() : "",
  };

  return validateWorkout(candidate) ? null : candidate;
}

function normalizeImportedPlan(raw) {
  const candidate = {
    id: typeof raw?.id === "string" && raw.id.trim() ? raw.id.trim() : uid(),
    date: typeof raw?.date === "string" ? raw.date : "",
    type: typeof raw?.type === "string" ? raw.type : "",
    stroke: typeof raw?.stroke === "string" ? raw.stroke : "crawl",
    targetDistance: Number(raw?.targetDistance),
    targetDuration: Number(raw?.targetDuration),
    objective: typeof raw?.objective === "string" ? raw.objective.trim() : "",
    status: typeof raw?.status === "string" ? raw.status : "todo",
    linkedWorkoutId:
      typeof raw?.linkedWorkoutId === "string" && raw.linkedWorkoutId.trim()
        ? raw.linkedWorkoutId.trim()
        : null,
  };

  return validatePlan(candidate) ? null : candidate;
}

function getPlanEffectiveStatus(plan, workoutsById) {
  if (plan.linkedWorkoutId && workoutsById.has(plan.linkedWorkoutId)) return "done";
  if (plan.status === "done") return "done";
  if (plan.status === "missed") return "missed";
  return "todo";
}

function autoLinkPlanWithWorkout(workout, plans) {
  const exactTypeIndex = plans.findIndex(
    (p) => p.date === workout.date && p.type === workout.type && !p.linkedWorkoutId && p.status !== "missed"
  );
  const fallbackIndex = plans.findIndex(
    (p) => p.date === workout.date && !p.linkedWorkoutId && p.status !== "missed"
  );
  const targetIndex = exactTypeIndex !== -1 ? exactTypeIndex : fallbackIndex;
  if (targetIndex === -1) return plans;

  const next = [...plans];
  next[targetIndex] = { ...next[targetIndex], linkedWorkoutId: workout.id };
  return next;
}

function toExportFilename() {
  const date = getTodayIsoLocal();
  return `aquapace-backup-${date}.json`;
}

async function fetchRemotePayload() {
  if (!supabaseClient || !currentUserId) return null;

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLE)
    .select("workouts, plans, monthly_goal")
    .eq("user_id", currentUserId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function normalizeRemotePayload(data) {
  const workouts = Array.isArray(data?.workouts) ? data.workouts.map(normalizeImportedWorkout).filter(Boolean) : [];
  const plans = Array.isArray(data?.plans) ? data.plans.map(normalizeImportedPlan).filter(Boolean) : [];
  const monthlyGoalCandidate = Math.round(Number(data?.monthly_goal));
  const monthlyGoal = Number.isFinite(monthlyGoalCandidate) && monthlyGoalCandidate > 0 ? monthlyGoalCandidate : 10000;
  return { workouts, plans, monthlyGoal };
}

async function pushLocalDataToRemote() {
  if (!supabaseClient || !currentUserId) return;

  const payload = {
    user_id: currentUserId,
    workouts: loadWorkouts(),
    plans: loadPlans(),
    monthly_goal: loadMonthlyGoal(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseClient.from(SUPABASE_TABLE).upsert(payload, { onConflict: "user_id" });
  if (error) throw error;
}

async function pullRemoteDataToLocal() {
  if (!supabaseClient || !currentUserId) return;

  const remote = await fetchRemotePayload();
  if (!remote) {
    await pushLocalDataToRemote();
    showSyncStatus("Compte connecte. Donnees locales sauvegardees sur Supabase.");
    return;
  }

  const normalized = normalizeRemotePayload(remote);
  isApplyingRemoteData = true;
  saveWorkouts(normalized.workouts);
  savePlans(normalized.plans);
  saveMonthlyGoal(normalized.monthlyGoal);
  isApplyingRemoteData = false;
  monthlyGoalInput.value = String(normalized.monthlyGoal);
  showSyncStatus("Donnees synchronisees depuis Supabase.");
}

async function processRemoteSyncQueue() {
  if (!supabaseClient || !currentUserId || isSyncingRemote) return;
  isSyncingRemote = true;
  try {
    do {
      hasPendingRemoteSync = false;
      await pushLocalDataToRemote();
    } while (hasPendingRemoteSync);
    showSyncStatus("Synchronisation terminee.");
  } catch {
    showSyncStatus("Erreur de synchronisation Supabase.", true);
  } finally {
    isSyncingRemote = false;
  }
}

function queueRemoteSync() {
  if (!supabaseClient || !currentUserId) return;
  hasPendingRemoteSync = true;
  processRemoteSyncQueue();
}

function dateFromIso(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addMonths(baseDate, offset) {
  return new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1);
}

function getPersonalRecordIds(workouts) {
  const distanceIds = new Set();
  const paceIds = new Set();

  let maxDistance = null;
  let bestPace = null;

  for (const w of workouts) {
    const distance = Number(w.distance || 0);
    if (maxDistance == null || distance > maxDistance) {
      maxDistance = distance;
    }

    const pace = paceValueMinPer100m(distance, Number(w.duration || 0));
    if (pace != null && (bestPace == null || pace < bestPace)) {
      bestPace = pace;
    }
  }

  for (const w of workouts) {
    const distance = Number(w.distance || 0);
    if (maxDistance != null && distance === maxDistance) {
      distanceIds.add(w.id);
    }

    const pace = paceValueMinPer100m(distance, Number(w.duration || 0));
    if (bestPace != null && pace != null && pace === bestPace) {
      paceIds.add(w.id);
    }
  }

  return { distanceIds, paceIds };
}

function getWeeklyPaceRecord(weekWorkouts) {
  let bestPace = null;
  for (const w of weekWorkouts) {
    const pace = paceValueMinPer100m(Number(w.distance || 0), Number(w.duration || 0));
    if (pace == null) continue;
    if (bestPace == null || pace < bestPace) bestPace = pace;
  }
  return bestPace;
}

function getMonthlyDistanceBuckets(workouts, monthDate) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const weekCount = Math.ceil(daysInMonth / 7);

  const buckets = Array.from({ length: weekCount }, () => 0);

  for (const w of workouts) {
    const date = dateFromIso(w.date);
    const sameMonth =
      date.getFullYear() === monthStart.getFullYear() &&
      date.getMonth() === monthStart.getMonth();

    if (!sameMonth) continue;

    const day = date.getDate();
    const weekIndex = Math.floor((day - 1) / 7);
    buckets[weekIndex] += Number(w.distance || 0);
  }

  const labels = buckets.map((_, index) => `S${index + 1}`);
  const total = buckets.reduce((acc, val) => acc + val, 0);
  const monthLabel = monthStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return { labels, buckets, total, monthLabel };
}

function renderMonthlyChart(workouts) {
  if (!monthChartCanvas || !monthTotalEl || !chartMonthLabelEl) return;

  const currentMonth = new Date();
  const selectedMonth = addMonths(currentMonth, chartMonthOffset);
  const { labels, buckets, total, monthLabel } = getMonthlyDistanceBuckets(workouts, selectedMonth);

  chartMonthLabelEl.textContent = monthLabel;
  monthTotalEl.textContent = `Total ${monthLabel}: ${total} m`;
  nextMonthBtn.disabled = chartMonthOffset === 0;
  renderGoalProgress(total);

  const ctx = monthChartCanvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = Math.max(300, Math.floor(monthChartCanvas.clientWidth || 300));
  const cssHeight = 220;

  monthChartCanvas.width = Math.floor(cssWidth * dpr);
  monthChartCanvas.height = Math.floor(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const pad = { top: 16, right: 16, bottom: 36, left: 40 };
  const chartW = cssWidth - pad.left - pad.right;
  const chartH = cssHeight - pad.top - pad.bottom;

  if (!buckets.length) return;

  const maxValue = Math.max(1000, ...buckets);
  const steps = 4;

  ctx.strokeStyle = "rgba(95,64,47,.18)";
  ctx.fillStyle = "#7c6559";
  ctx.font = "12px 'IBM Plex Sans', sans-serif";

  for (let i = 0; i <= steps; i += 1) {
    const y = pad.top + (chartH / steps) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();

    const value = Math.round(maxValue - (maxValue / steps) * i);
    ctx.fillText(`${value} m`, 4, y + 4);
  }

  const groupW = chartW / buckets.length;
  const barW = Math.min(44, groupW * 0.6);

  for (let i = 0; i < buckets.length; i += 1) {
    const value = buckets[i];
    const barH = (value / maxValue) * chartH;
    const x = pad.left + i * groupW + (groupW - barW) / 2;
    const y = pad.top + chartH - barH;

    ctx.fillStyle = "rgba(231,137,87,.2)";
    ctx.fillRect(x, pad.top, barW, chartH);

    ctx.fillStyle = "#e78957";
    ctx.fillRect(x, y, barW, barH);

    ctx.fillStyle = "#3a2b24";
    ctx.textAlign = "center";
    ctx.fillText(labels[i], x + barW / 2, cssHeight - 12);
  }
}

function getPaceSessionsForMonth(workouts, monthDate) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  return workouts
    .filter((w) => {
      const date = dateFromIso(w.date);
      return date.getFullYear() === monthStart.getFullYear() && date.getMonth() === monthStart.getMonth();
    })
    .map((w) => ({
      date: w.date,
      distance: Number(w.distance || 0),
      duration: Number(w.duration || 0),
      pace: paceValueMinPer100m(Number(w.distance || 0), Number(w.duration || 0)),
    }))
    .filter((x) => x.pace != null)
    .sort((a, b) => (a.date > b.date ? 1 : -1));
}

function renderPaceChart(workouts) {
  if (!paceChartCanvas || !chartMonthLabelEl || !paceChartMetaEl) return;

  const currentMonth = new Date();
  const selectedMonth = addMonths(currentMonth, chartMonthOffset);
  const monthLabel = selectedMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const sessions = getPaceSessionsForMonth(workouts, selectedMonth);

  chartMonthLabelEl.textContent = monthLabel;
  nextMonthBtn.disabled = chartMonthOffset === 0;

  if (!sessions.length) {
    paceChartMetaEl.textContent = `Aucune seance avec allure calculee pour ${monthLabel}.`;
  } else {
    const best = sessions.reduce((acc, x) => (x.pace < acc.pace ? x : acc));
    paceChartMetaEl.textContent = `Meilleure allure (${monthLabel}) : ${formatPaceValue(best.pace)} le ${formatDateFR(best.date)}.`;
  }

  const ctx = paceChartCanvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = Math.max(300, Math.floor(paceChartCanvas.clientWidth || 300));
  const cssHeight = 220;

  paceChartCanvas.width = Math.floor(cssWidth * dpr);
  paceChartCanvas.height = Math.floor(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  if (!sessions.length) return;

  const values = sessions.map((x) => x.pace);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(0.2, maxValue - minValue);

  const pad = { top: 16, right: 16, bottom: 36, left: 44 };
  const chartW = cssWidth - pad.left - pad.right;
  const chartH = cssHeight - pad.top - pad.bottom;
  const steps = 4;

  ctx.strokeStyle = "rgba(95,64,47,.18)";
  ctx.fillStyle = "#7c6559";
  ctx.font = "12px 'IBM Plex Sans', sans-serif";
  ctx.textAlign = "left";

  for (let i = 0; i <= steps; i += 1) {
    const ratio = i / steps;
    const y = pad.top + chartH * ratio;
    const value = minValue + (range * i) / steps;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
    ctx.fillText(formatPaceValue(value).replace(" /100m", ""), 4, y + 4);
  }

  const xStep = sessions.length > 1 ? chartW / (sessions.length - 1) : 0;
  const points = sessions.map((s, i) => {
    const x = pad.left + i * xStep;
    const y = pad.top + ((s.pace - minValue) / range) * chartH;
    return { x, y, day: s.date.slice(8, 10) };
  });

  if (points.length === 1) {
    points[0].x = pad.left + chartW / 2;
  }

  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#2a9ac9";
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  for (const p of points) {
    ctx.fillStyle = "#2a9ac9";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#3a2b24";
    ctx.textAlign = "center";
    ctx.fillText(p.day, p.x, cssHeight - 12);
  }
}

function setChartMode(mode) {
  chartMode = mode;

  const isDistance = mode === "distance";
  monthChartCanvas.classList.toggle("hidden", !isDistance);
  paceChartCanvas.classList.toggle("hidden", isDistance);

  monthTotalEl.classList.toggle("hidden", !isDistance);
  paceChartMetaEl.classList.toggle("hidden", isDistance);

  distanceTabBtn.classList.toggle("active", isDistance);
  paceTabBtn.classList.toggle("active", !isDistance);
  distanceTabBtn.setAttribute("aria-selected", String(isDistance));
  paceTabBtn.setAttribute("aria-selected", String(!isDistance));
  if (chartTitleEl) {
    chartTitleEl.textContent = isDistance ? "Progression distance (mois)" : "Comparaison des allures (mois)";
  }
}

function renderActiveChart(workouts) {
  if (chartMode === "distance") {
    renderMonthlyChart(workouts);
    return;
  }
  renderPaceChart(workouts);
}

function renderGoalProgress(currentTotal) {
  if (!monthlyGoalInput || !goalProgressTextEl || !goalBarFillEl) return;

  const goal = Math.max(100, Number(monthlyGoalInput.value) || 10000);
  const percentRaw = (currentTotal / goal) * 100;
  const percentRounded = Math.round(percentRaw);
  const percentClamped = Math.max(0, Math.min(100, percentRaw));
  const hue = Math.round((percentClamped / 100) * 120); // 0=rouge, 120=vert

  goalProgressTextEl.textContent = `Progression: ${percentRounded}% (${currentTotal} / ${goal} m)`;
  goalBarFillEl.style.width = `${percentClamped}%`;
  goalBarFillEl.style.background = `hsl(${hue} 78% 45%)`;
}

function setEditingMode(workoutId) {
  editingWorkoutId = workoutId;
  submitBtn.textContent = "Mettre a jour";
  cancelEditBtn.classList.remove("hidden");
}

function resetEditingMode() {
  editingWorkoutId = null;
  submitBtn.textContent = "Enregistrer";
  cancelEditBtn.classList.add("hidden");
}

function fillFormWithWorkout(workout) {
  dateInputEl.value = workout.date;
  typeInputEl.value = workout.type;
  strokeInputEl.value = workout.stroke || "crawl";
  feelingInputEl.value = workout.feeling || "correct";
  distanceInputEl.value = workout.distance;
  durationInputEl.value = workout.duration;
  notesInputEl.value = workout.notes || "";
  clearFormError();
}

function getFilteredWorkouts(workouts) {
  const selectedType = typeFilterEl.value;
  if (selectedType === "all") return workouts;
  return workouts.filter((w) => w.type === selectedType);
}

function renderPlans(workouts) {
  const plans = loadPlans().sort((a, b) => (a.date < b.date ? 1 : -1));
  const workoutsById = new Map(workouts.map((w) => [w.id, w]));
  const weekPlans = plans.filter((p) => isInCurrentWeek(p.date));

  const plannedCount = weekPlans.length;
  const donePlans = weekPlans.filter((p) => getPlanEffectiveStatus(p, workoutsById) === "done");
  const plannedDistance = weekPlans.reduce((acc, p) => acc + Number(p.targetDistance || 0), 0);
  const doneDistance = donePlans.reduce((acc, p) => {
    const linked = workoutsById.get(p.linkedWorkoutId);
    return acc + Number(linked?.distance || 0);
  }, 0);

  planWeekPlannedEl.textContent = String(plannedCount);
  planWeekDoneEl.textContent = String(donePlans.length);
  planWeekDistanceEl.textContent = `${plannedDistance} m`;
  planWeekDistanceDoneEl.textContent = `${doneDistance} m`;

  plansListEl.innerHTML = "";
  if (!plans.length) {
    planEmptyStateEl.classList.remove("hidden");
    return;
  }
  planEmptyStateEl.classList.add("hidden");

  for (const p of plans) {
    const status = getPlanEffectiveStatus(p, workoutsById);
    const linkedWorkout = p.linkedWorkoutId ? workoutsById.get(p.linkedWorkoutId) : null;
    const statusClass =
      status === "done" ? "badge-status-done" : status === "missed" ? "badge-status-missed" : "badge-status-todo";
    const statusLabel = status === "done" ? "Fait" : status === "missed" ? "Rate" : "A faire";

    const item = document.createElement("div");
    item.className = "item";

    const left = document.createElement("div");
    left.innerHTML = `
      <h3>${formatDateFR(p.date)} - Cible ${p.targetDistance} m / ${p.targetDuration} min</h3>
      <p>${p.objective ? escapeHtml(p.objective) : ""}</p>
      <div class="badges">
        <span class="badge">${escapeHtml(labelType(p.type))}</span>
        <span class="badge">${escapeHtml(labelType(p.stroke))}</span>
        <span class="badge ${statusClass}">${statusLabel}</span>
      </div>
      ${linkedWorkout ? `<p>Lie a: ${linkedWorkout.distance} m / ${linkedWorkout.duration} min</p>` : ""}
    `;

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const toggleMissedBtn = document.createElement("button");
    toggleMissedBtn.className = "btn-secondary";
    toggleMissedBtn.type = "button";
    toggleMissedBtn.textContent = status === "missed" ? "Remettre a faire" : "Marquer rate";
    toggleMissedBtn.addEventListener("click", () => {
      const next = loadPlans().map((x) =>
        x.id === p.id ? { ...x, status: x.status === "missed" ? "todo" : "missed", linkedWorkoutId: null } : x
      );
      savePlans(next);
      render();
    });

    const linkBtn = document.createElement("button");
    linkBtn.className = "btn-secondary";
    linkBtn.type = "button";
    linkBtn.textContent = linkedWorkout ? "Detacher" : "Lier a une seance";
    linkBtn.addEventListener("click", () => {
      const currentPlans = loadPlans();
      const allWorkouts = loadWorkouts();
      let linkedId = null;

      if (!linkedWorkout) {
        const sameDateType = allWorkouts.find((w) => w.date === p.date && w.type === p.type);
        const sameDate = allWorkouts.find((w) => w.date === p.date);
        linkedId = sameDateType?.id || sameDate?.id || null;
        if (!linkedId) {
          showDataMessage("Aucune seance trouvee ce jour pour lier ce plan.", true);
          return;
        }
      }

      const next = currentPlans.map((x) =>
        x.id === p.id ? { ...x, linkedWorkoutId: linkedWorkout ? null : linkedId, status: "todo" } : x
      );
      savePlans(next);
      render();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "delete";
    delBtn.type = "button";
    delBtn.textContent = "Supprimer";
    delBtn.addEventListener("click", () => {
      const ok = window.confirm("Supprimer cette seance planifiee ?");
      if (!ok) return;
      savePlans(loadPlans().filter((x) => x.id !== p.id));
      render();
    });

    actions.appendChild(toggleMissedBtn);
    actions.appendChild(linkBtn);
    actions.appendChild(delBtn);

    item.appendChild(left);
    item.appendChild(actions);
    plansListEl.appendChild(item);
  }
}

function render() {
  const workouts = loadWorkouts().sort((a, b) => (a.date < b.date ? 1 : -1));
  const filtered = getFilteredWorkouts(workouts);
  const pr = getPersonalRecordIds(workouts);

  listEl.innerHTML = "";

  if (!filtered.length) {
    emptyStateEl.classList.remove("hidden");
    emptyStateEl.textContent = "Aucune seance pour ce filtre.";
  } else {
    emptyStateEl.classList.add("hidden");
    emptyStateEl.textContent = "Aucune seance pour le moment.";
  }

  for (const w of filtered) {
    const isDistancePr = pr.distanceIds.has(w.id);
    const isPacePr = pr.paceIds.has(w.id);
    const badges = [
      `<span class="badge">${escapeHtml(labelType(w.type))}</span>`,
      `<span class="badge">${escapeHtml(labelType(w.stroke || "crawl"))}</span>`,
      `<span class="badge">${escapeHtml(labelType(w.feeling || "correct"))}</span>`,
      isDistancePr ? `<span class="badge badge-pr">PR Distance</span>` : "",
      isPacePr ? `<span class="badge badge-pr">PR Allure</span>` : "",
    ].filter(Boolean).join("");

    const item = document.createElement("div");
    item.className = "item";

    const left = document.createElement("div");
    left.innerHTML = `
      <h3>${formatDateFR(w.date)} - ${w.distance} m / ${w.duration} min</h3>
      <p>${w.notes ? escapeHtml(w.notes) : ""}</p>
      <div class="badges">
        ${badges}
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "edit";
    editBtn.type = "button";
    editBtn.textContent = "Modifier";
    editBtn.addEventListener("click", () => {
      fillFormWithWorkout(w);
      setEditingMode(w.id);
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const del = document.createElement("button");
    del.className = "delete";
    del.type = "button";
    del.textContent = "Supprimer";
    del.addEventListener("click", () => {
      const ok = window.confirm("Supprimer cette seance ?");
      if (!ok) return;
      const next = loadWorkouts().filter((x) => x.id !== w.id);
      saveWorkouts(next);
      const nextPlans = loadPlans().map((p) => (p.linkedWorkoutId === w.id ? { ...p, linkedWorkoutId: null } : p));
      savePlans(nextPlans);
      if (editingWorkoutId === w.id) {
        form.reset();
        setDefaultDate();
        resetEditingMode();
      }
      render();
    });

    actions.appendChild(editBtn);
    actions.appendChild(del);
    item.appendChild(left);
    item.appendChild(actions);
    listEl.appendChild(item);
  }

  const week = workouts.filter((w) => isInCurrentWeek(w.date));
  const totalDist = week.reduce((acc, w) => acc + Number(w.distance || 0), 0);
  const totalTime = week.reduce((acc, w) => acc + Number(w.duration || 0), 0);

  weekDistanceEl.textContent = `${totalDist} m`;
  weekTimeEl.textContent = `${totalTime} min`;
  weekPaceEl.textContent = totalDist > 0 ? paceMinPer100m(totalDist, totalTime) : "-";
  weekSessionsEl.textContent = String(week.length);
  weekPaceRecordEl.textContent = formatPaceValue(getWeeklyPaceRecord(week));

  renderPlans(workouts);
  renderActiveChart(workouts);
}

function setDefaultDate() {
  dateInputEl.max = getTodayIsoLocal();
  if (!dateInputEl.value) {
    dateInputEl.value = getTodayIsoLocal();
  }
}

async function initSupabaseAuth() {
  if (!hasSupabaseConfig()) {
    showAuthStatus("Mode local: configure SUPABASE_URL et SUPABASE_ANON_KEY dans app.js pour activer la synchro.");
    updateAuthUi();
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const {
    data: { session },
    error: sessionError,
  } = await supabaseClient.auth.getSession();

  if (sessionError) {
    showAuthStatus("Erreur lors de la recuperation de session Supabase.", true);
    updateAuthUi();
    return;
  }

  currentUserId = session?.user?.id || null;
  updateAuthUi();

  if (currentUserId) {
    showAuthStatus(`Connecte: ${session.user.email || "compte Supabase"}`);
    try {
      await pullRemoteDataToLocal();
      render();
    } catch {
      showSyncStatus("Impossible de recuperer les donnees Supabase.", true);
    }
  } else {
    showAuthStatus("Non connecte: utilise ton email/mot de passe pour synchroniser.");
  }

  supabaseClient.auth.onAuthStateChange(async (_event, sessionNext) => {
    currentUserId = sessionNext?.user?.id || null;
    updateAuthUi();

    if (!currentUserId) {
      clearSyncStatus();
      showAuthStatus("Non connecte: donnees en local uniquement.");
      return;
    }

    showAuthStatus(`Connecte: ${sessionNext.user.email || "compte Supabase"}`);
    try {
      await pullRemoteDataToLocal();
      render();
    } catch {
      showSyncStatus("Impossible de recuperer les donnees Supabase.", true);
    }
  });
}

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const w = {
    id: editingWorkoutId || uid(),
    date: dateInputEl.value,
    type: typeInputEl.value,
    stroke: strokeInputEl.value,
    feeling: feelingInputEl.value,
    distance: Number(distanceInputEl.value),
    duration: Number(durationInputEl.value),
    notes: notesInputEl.value.trim(),
  };

  const validationError = validateWorkout(w);
  if (validationError) {
    showFormError(validationError);
    return;
  }

  clearFormError();

  const workouts = loadWorkouts();

  if (editingWorkoutId) {
    const index = workouts.findIndex((x) => x.id === editingWorkoutId);
    if (index !== -1) {
      workouts[index] = w;
    }
  } else {
    workouts.push(w);
  }

  saveWorkouts(workouts);
  if (!editingWorkoutId) {
    savePlans(autoLinkPlanWithWorkout(w, loadPlans()));
  }

  form.reset();
  setDefaultDate();
  resetEditingMode();
  render();
});

planFormEl.addEventListener("submit", (e) => {
  e.preventDefault();

  const plan = {
    id: uid(),
    date: planDateInputEl.value,
    type: planTypeInputEl.value,
    stroke: planStrokeInputEl.value,
    targetDistance: Number(planDistanceInputEl.value),
    targetDuration: Number(planDurationInputEl.value),
    objective: planObjectiveInputEl.value.trim(),
    status: "todo",
    linkedWorkoutId: null,
  };

  const validationError = validatePlan(plan);
  if (validationError) {
    showPlanError(validationError);
    return;
  }

  clearPlanError();
  savePlans([...loadPlans(), plan]);
  planFormEl.reset();
  if (!planDateInputEl.value) {
    planDateInputEl.value = getTodayIsoLocal();
  }
  render();
});

cancelEditBtn.addEventListener("click", () => {
  form.reset();
  setDefaultDate();
  resetEditingMode();
  clearFormError();
});

typeFilterEl.addEventListener("change", render);

clearAllBtn.addEventListener("click", () => {
  if (!loadWorkouts().length) return;
  const ok = window.confirm("Supprimer tout l'historique des seances ?");
  if (!ok) return;
  saveWorkouts([]);
  savePlans(loadPlans().map((p) => ({ ...p, linkedWorkoutId: null })));
  form.reset();
  setDefaultDate();
  resetEditingMode();
  clearFormError();
  render();
});

exportDataBtn.addEventListener("click", () => {
  const payload = {
    app: "AquaPace",
    version: 1,
    exportedAt: new Date().toISOString(),
    monthlyGoal: loadMonthlyGoal(),
    workouts: loadWorkouts(),
    plans: loadPlans(),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = toExportFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showDataMessage("Export termine.");
});

importDataBtn.addEventListener("click", () => {
  importDataInput.click();
});

importDataInput.addEventListener("change", async () => {
  const file = importDataInput.files?.[0];
  if (!file) return;

  try {
    const raw = await file.text();
    const parsed = JSON.parse(raw);

    let rawWorkouts = [];
    let rawPlans = [];
    let importedGoal = null;

    if (Array.isArray(parsed)) {
      rawWorkouts = parsed;
    } else if (parsed && typeof parsed === "object") {
      rawWorkouts = Array.isArray(parsed.workouts) ? parsed.workouts : [];
      rawPlans = Array.isArray(parsed.plans) ? parsed.plans : [];
      if (Number.isFinite(Number(parsed.monthlyGoal)) && Number(parsed.monthlyGoal) > 0) {
        importedGoal = Math.round(Number(parsed.monthlyGoal));
      }
    } else {
      throw new Error("format");
    }

    const normalized = rawWorkouts.map(normalizeImportedWorkout).filter(Boolean);
    const normalizedPlans = rawPlans.map(normalizeImportedPlan).filter(Boolean);
    if (!normalized.length && rawWorkouts.length > 0) {
      throw new Error("invalid-workouts");
    }
    if (!normalizedPlans.length && rawPlans.length > 0) {
      throw new Error("invalid-plans");
    }

    const ok = window.confirm("Importer ce fichier va remplacer l'historique actuel. Continuer ?");
    if (!ok) return;

    saveWorkouts(normalized);
    savePlans(normalizedPlans);
    if (importedGoal != null) {
      saveMonthlyGoal(importedGoal);
      monthlyGoalInput.value = String(importedGoal);
    }

    form.reset();
    setDefaultDate();
    resetEditingMode();
    clearFormError();
    render();

    const skippedCount = rawWorkouts.length - normalized.length;
    const skippedPlans = rawPlans.length - normalizedPlans.length;
    if (skippedCount > 0 || skippedPlans > 0) {
      showDataMessage(
        `Import termine: ${normalized.length} seances, ${normalizedPlans.length} plans importes (${skippedCount + skippedPlans} ignores).`,
        true
      );
    } else {
      showDataMessage(`Import termine: ${normalized.length} seances et ${normalizedPlans.length} plans importes.`);
    }
  } catch {
    showDataMessage("Import impossible: fichier JSON invalide ou incompatible.", true);
  } finally {
    importDataInput.value = "";
  }
});

signInBtn?.addEventListener("click", async () => {
  if (!supabaseClient) {
    showAuthStatus("Supabase non configure.", true);
    return;
  }

  const email = authEmailEl.value.trim();
  const password = authPasswordEl.value;
  if (!email || !password) {
    showAuthStatus("Renseigne email et mot de passe.", true);
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    showAuthStatus(`Connexion impossible: ${error.message}`, true);
    return;
  }
  authPasswordEl.value = "";
});

signUpBtn?.addEventListener("click", async () => {
  if (!supabaseClient) {
    showAuthStatus("Supabase non configure.", true);
    return;
  }

  const email = authEmailEl.value.trim();
  const password = authPasswordEl.value;
  if (!email || !password || password.length < 6) {
    showAuthStatus("Email requis et mot de passe (6+ caracteres).", true);
    return;
  }

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    showAuthStatus(`Inscription impossible: ${error.message}`, true);
    return;
  }

  showAuthStatus("Compte cree. Verifie ton email si confirmation activee.");
  authPasswordEl.value = "";
});

signOutBtn?.addEventListener("click", async () => {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    showAuthStatus(`Deconnexion impossible: ${error.message}`, true);
    return;
  }
  showAuthStatus("Deconnecte.");
});

window.addEventListener("resize", () => {
  renderActiveChart(loadWorkouts());
});

prevMonthBtn.addEventListener("click", () => {
  chartMonthOffset -= 1;
  renderActiveChart(loadWorkouts());
});

nextMonthBtn.addEventListener("click", () => {
  if (chartMonthOffset >= 0) return;
  chartMonthOffset += 1;
  renderActiveChart(loadWorkouts());
});

monthlyGoalInput.addEventListener("change", () => {
  const parsed = Math.max(100, Number(monthlyGoalInput.value) || 10000);
  monthlyGoalInput.value = String(parsed);
  saveMonthlyGoal(parsed);
  renderActiveChart(loadWorkouts());
});

distanceTabBtn.addEventListener("click", () => {
  setChartMode("distance");
  renderActiveChart(loadWorkouts());
});

paceTabBtn.addEventListener("click", () => {
  setChartMode("pace");
  renderActiveChart(loadWorkouts());
});

monthlyGoalInput.value = String(loadMonthlyGoal());
setChartMode("distance");
setDefaultDate();
planDateInputEl.value = getTodayIsoLocal();
form.addEventListener("input", clearFormError);
planFormEl.addEventListener("input", clearPlanError);
form.addEventListener("input", clearDataMessage);
render();
initSupabaseAuth();
