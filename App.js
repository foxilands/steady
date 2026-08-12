import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Plus,
  Minus,
  TrendingUp,
  Check,
  Timer as TimerIcon,
  Square,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react-native";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseIntValue = (rawValue, fallback, min, max) => {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
};

const parseFloatValue = (rawValue, fallback, min, max) => {
  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
};

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatElapsed(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function last7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ key: dateKey(d), label: d.toLocaleDateString(undefined, { weekday: "short" }) });
  }
  return days;
}

function daysInMonthCount(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function startWeekday(year, month) {
  return new Date(year, month, 1).getDay();
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function initialQuincena() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), half: d.getDate() <= 15 ? 1 : 2 };
}

function quincenaRange({ year, month, half }) {
  const start = half === 1 ? 1 : 16;
  const end = half === 1 ? 15 : daysInMonthCount(year, month);
  return { start, end };
}

function quincenaLabel(q) {
  const { start, end } = quincenaRange(q);
  const monthName = new Date(q.year, q.month, 1).toLocaleDateString(undefined, { month: "short" });
  return `${monthName} ${start}–${end}`;
}

function nextQuincena(q) {
  if (q.half === 1) return { ...q, half: 2 };
  let month = q.month + 1;
  let year = q.year;
  if (month > 11) {
    month = 0;
    year += 1;
  }
  return { year, month, half: 1 };
}

function prevQuincena(q) {
  if (q.half === 2) return { ...q, half: 1 };
  let month = q.month - 1;
  let year = q.year;
  if (month < 0) {
    month = 11;
    year -= 1;
  }
  return { year, month, half: 2 };
}

function quincenaDays(q) {
  const { start, end } = quincenaRange(q);
  const days = [];
  for (let day = start; day <= end; day++) {
    days.push({ key: dateKey(new Date(q.year, q.month, day)), day });
  }
  return days;
}

function monthDays(year, month) {
  const total = daysInMonthCount(year, month);
  const days = [];
  for (let day = 1; day <= total; day++) {
    days.push({ key: dateKey(new Date(year, month, day)), day });
  }
  return days;
}

function DayChip({ day, count, logged, limit, isToday, selected, onClick }) {
  const over = count > limit;
  return (
    <TouchableOpacity
      onPress={onClick}
      style={[
        styles.dayChip,
        over ? styles.chipOver : logged ? styles.chipLogged : styles.chipDefault,
        isToday && styles.chipToday,
        selected && styles.chipSelected,
      ]}
    >
      <Text style={[styles.dayChipText, over && { color: "#fff" }, logged && !over && { color: "#1d4ed8" }]}>
        {day}
      </Text>
      {logged && (
        <Text style={[styles.dayChipCount, over && { color: "#fff" }, logged && !over && { color: "#1d4ed8" }]}>
          {count}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [log, setLog] = useState({});
  const [limit, setLimit] = useState(6);
  const [showLimitEdit, setShowLimitEdit] = useState(false);
  const [canPrice, setCanPrice] = useState(85);
  const [canSize, setCanSize] = useState(15);
  const [showCostEdit, setShowCostEdit] = useState(false);
  const [timerLimit, setTimerLimit] = useState(60);
  const [showTimerEdit, setShowTimerEdit] = useState(false);
  const [timerStart, setTimerStart] = useState(null);
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef(null);

  const [showCalendar, setShowCalendar] = useState(false);
  const [calMode, setCalMode] = useState("quincena");
  const [quincena, setQuincena] = useState(initialQuincena());
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(null);

  const key = dateKey();
  const days = last7Days();

  useEffect(() => {
    if (timerStart) {
      tickRef.current = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(tickRef.current);
    }
  }, [timerStart]);

  useEffect(() => {
    async function loadData() {
      try {
        const savedLog = await AsyncStorage.getItem("pouch-log");
        if (savedLog) {
          try {
            const parsed = JSON.parse(savedLog);
            if (typeof parsed === "object" && parsed !== null) setLog(parsed);
          } catch (e) {
            // Corrupted JSON fallback
          }
        }

        const savedLimit = await AsyncStorage.getItem("pouch-limit");
        if (savedLimit && !isNaN(Number(savedLimit))) setLimit(Math.max(0, Number(savedLimit)));

        const savedPrice = await AsyncStorage.getItem("pouch-can-price");
        if (savedPrice && !isNaN(Number(savedPrice))) setCanPrice(Math.max(0, Number(savedPrice)));

        const savedSize = await AsyncStorage.getItem("pouch-can-size");
        if (savedSize && !isNaN(Number(savedSize))) setCanSize(Math.max(1, Number(savedSize)));

        const savedTimerLimit = await AsyncStorage.getItem("pouch-timer-limit");
        if (savedTimerLimit && !isNaN(Number(savedTimerLimit))) {
          setTimerLimit(Math.min(60, Math.max(5, Number(savedTimerLimit))));
        }

        const savedTimerStart = await AsyncStorage.getItem("pouch-timer-start");
        if (savedTimerStart && !isNaN(Number(savedTimerStart))) setTimerStart(Number(savedTimerStart));
      } catch (e) {
        // Safe catch
      } finally {
        setLoaded(true);
      }
    }
    loadData();
  }, []);

  const saveLog = async (newLog) => {
    setLog(newLog);
    try {
      await AsyncStorage.setItem("pouch-log", JSON.stringify(newLog));
    } catch (e) {}
  };

  const saveLimit = async (rawVal) => {
    const safeValue = parseIntValue(rawVal, 0, 0, 99);
    setLimit(safeValue);
    try {
      await AsyncStorage.setItem("pouch-limit", String(safeValue));
    } catch (e) {}
  };

  const saveCanPrice = async (rawVal) => {
    const safeValue = parseFloatValue(rawVal, 0, 0, 5000);
    setCanPrice(safeValue);
    try {
      await AsyncStorage.setItem("pouch-can-price", String(safeValue));
    } catch (e) {}
  };

  const saveCanSize = async (rawVal) => {
    const safeValue = parseIntValue(rawVal, 1, 1, 100);
    setCanSize(safeValue);
    try {
      await AsyncStorage.setItem("pouch-can-size", String(safeValue));
    } catch (e) {}
  };

  const saveTimerLimit = async (rawVal) => {
    const safeValue = parseIntValue(rawVal, 60, 5, 60);
    setTimerLimit(safeValue);
    try {
      await AsyncStorage.setItem("pouch-timer-limit", String(safeValue));
    } catch (e) {}
  };

  // Safe division guard
  const costFor = (count) => {
    if (!canSize || canSize <= 0) return 0;
    return (count / canSize) * canPrice;
  };

  const adjustDay = (dayKey, delta) => {
    const current = log[dayKey] || 0;
    const next = Math.max(0, current + delta);
    saveLog({ ...log, [dayKey]: next });
  };

  const adjust = (delta) => adjustDay(key, delta);

  const startTimer = async (alsoLog) => {
    const start = Date.now();
    setTimerStart(start);
    setNow(start);
    try {
      await AsyncStorage.setItem("pouch-timer-start", String(start));
    } catch (e) {}
    if (alsoLog) adjust(1);
  };

  const stopTimer = async () => {
    setTimerStart(null);
    try {
      await AsyncStorage.removeItem("pouch-timer-start");
    } catch (e) {}
  };

  const elapsedMs = timerStart ? now - timerStart : 0;
  const elapsedMin = elapsedMs / 60000;
  const timerOver = elapsedMin >= timerLimit;
  const timerNear = elapsedMin >= timerLimit - 10 && !timerOver;

  const todayCount = log[key] || 0;
  const overLimit = todayCount > limit;
  const atLimit = todayCount === limit && limit > 0;

  const weekCounts = days.map((d) => log[d.key] || 0);
  const weekTotal = weekCounts.reduce((a, b) => a + b, 0);
  const daysLogged = days.filter((d) => log[d.key] !== undefined).length;
  const weekAvg = daysLogged > 0 ? (weekTotal / daysLogged).toFixed(1) : "0.0";
  const maxCount = Math.max(...weekCounts, limit, 1);
  const weekCost = costFor(weekTotal);

  const loggedVals = days.map((d) => log[d.key]).filter((v) => v !== undefined);
  let trendUp = false;
  if (loggedVals.length >= 4) {
    const mid = Math.floor(loggedVals.length / 2);
    const firstAvg = loggedVals.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const secondAvg = loggedVals.slice(mid).reduce((a, b) => a + b, 0) / (loggedVals.length - mid);
    trendUp = secondAvg > firstAvg + 0.5;
  }

  const qDays = quincenaDays(quincena);
  const mDays = monthDays(calMonth.year, calMonth.month);
  const mLead = startWeekday(calMonth.year, calMonth.month);

  if (!loaded) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>loading…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fafaf9" />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </Text>
          <Text style={styles.headerTitle}>Pouch count</Text>
        </View>

        {/* Timer Card */}
        <View
          style={[
            styles.card,
            timerOver ? styles.cardTimerOver : timerNear ? styles.cardTimerNear : styles.cardWhite,
          ]}
        >
          {timerStart === null ? (
            <View style={styles.rowBetween}>
              <View style={styles.rowGap}>
                <TimerIcon size={15} color="#78716c" />
                <Text style={styles.subtext}>No pouch in right now</Text>
              </View>
              <View style={styles.rowGap}>
                <TouchableOpacity onPress={() => startTimer(false)}>
                  <Text style={styles.linkText}>time it</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => startTimer(true)} style={styles.btnPrimary}>
                  <Text style={styles.btnPrimaryText}>Start & log</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.rowBetween}>
              <View>
                <Text style={[styles.timerDigits, timerOver && { color: "#92400e" }]}>
                  {formatElapsed(elapsedMs)}
                </Text>
                <Text style={[styles.subtext, timerOver && { color: "#92400e", fontWeight: "600" }]}>
                  {timerOver ? `Past ${timerLimit} min — take it out` : "in your mouth"}
                </Text>
              </View>
              <TouchableOpacity onPress={stopTimer} style={styles.btnSecondary}>
                <Square size={12} color="#44403c" />
                <Text style={styles.btnSecondaryText}>Took it out</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Counter Card */}
        <View style={[styles.card, overLimit ? styles.cardOver : atLimit ? styles.cardAtLimit : styles.cardWhite]}>
          <View style={styles.rowBetween}>
            <TouchableOpacity onPress={() => adjust(-1)} style={styles.btnRoundSecondary}>
              <Minus size={20} color="#78716c" />
            </TouchableOpacity>

            <View style={styles.alignCenter}>
              <Text style={[styles.counterNumber, overLimit && { color: "#b45309" }]}>{todayCount}</Text>
              <Text style={styles.subtext}>of {limit} today</Text>
              <Text style={styles.subtext}>{mxn.format(costFor(todayCount))}</Text>
            </View>

            <TouchableOpacity onPress={() => adjust(1)} style={styles.btnRoundPrimary}>
              <Plus size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {overLimit && (
            <Text style={styles.warningText}>Over your limit today — no judgment, just noting it.</Text>
          )}
          {atLimit && !overLimit && (
            <View style={styles.rowCenterGap}>
              <Check size={12} color="#78716c" />
              <Text style={styles.subtext}>At your limit for today</Text>
            </View>
          )}
        </View>

        {/* Week Chart Card */}
        <View style={[styles.card, styles.cardWhite]}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Last 7 days</Text>
            <Text style={styles.subtext}>avg {weekAvg}/day</Text>
          </View>

          <View style={styles.chartContainer}>
            {days.map((d) => {
              const val = log[d.key] || 0;
              const h = Math.max(4, (val / maxCount) * 100);
              const isToday = d.key === key;
              const over = val > limit;
              return (
                <View key={d.key} style={styles.chartColumn}>
                  <Text style={styles.chartValue}>{val || ""}</Text>
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        { height: `${h}%` },
                        over ? styles.barOver : isToday ? styles.barToday : styles.barDefault,
                      ]}
                    />
                  </View>
                  <Text style={[styles.chartLabel, isToday && styles.chartLabelToday]}>{d.label}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.dividerRow}>
            <Text style={styles.subtextSmall}>Amber bars = days over your limit of {limit}</Text>
            <Text style={styles.subtextSmall}>{mxn.format(weekCost)}</Text>
          </View>
        </View>

        {trendUp && (
          <View style={styles.trendBox}>
            <TrendingUp size={16} color="#d97706" />
            <Text style={styles.trendText}>
              Your daily count has been trending up this week. Worth noticing before it becomes the new normal.
            </Text>
          </View>
        )}

        {/* Calendar Card */}
        <View style={[styles.card, styles.cardWhite, { padding: 0 }]}>
          <TouchableOpacity onPress={() => setShowCalendar(!showCalendar)} style={styles.accordionHeader}>
            <View style={styles.rowGap}>
              <CalendarIcon size={16} color="#a8a29e" />
              <Text style={styles.cardTitle}>Calendar</Text>
            </View>
            {showCalendar ? <ChevronUp size={18} color="#a8a29e" /> : <ChevronDown size={18} color="#a8a29e" />}
          </TouchableOpacity>

          {showCalendar && (
            <View style={styles.accordionBody}>
              <View style={styles.rowBetween}>
                <View style={styles.segmentedControl}>
                  <TouchableOpacity
                    onPress={() => setCalMode("quincena")}
                    style={[styles.segmentBtn, calMode === "quincena" && styles.segmentBtnActive]}
                  >
                    <Text style={[styles.segmentText, calMode === "quincena" && styles.segmentTextActive]}>
                      Quincena
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCalMode("month")}
                    style={[styles.segmentBtn, calMode === "month" && styles.segmentBtnActive]}
                  >
                    <Text style={[styles.segmentText, calMode === "month" && styles.segmentTextActive]}>
                      Month
                    </Text>
                  </TouchableOpacity>
                </View>

                {calMode === "quincena" ? (
                  <View style={styles.rowGap}>
                    <TouchableOpacity onPress={() => setQuincena(prevQuincena)}>
                      <ChevronLeft size={16} color="#78716c" />
                    </TouchableOpacity>
                    <Text style={styles.calNavTitle}>{quincenaLabel(quincena)}</Text>
                    <TouchableOpacity onPress={() => setQuincena(nextQuincena)}>
                      <ChevronRight size={16} color="#78716c" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.rowGap}>
                    <TouchableOpacity
                      onPress={() =>
                        setCalMonth((c) =>
                          c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 }
                        )
                      }
                    >
                      <ChevronLeft size={16} color="#78716c" />
                    </TouchableOpacity>
                    <Text style={styles.calNavTitle}>{monthLabel(calMonth.year, calMonth.month)}</Text>
                    <TouchableOpacity
                      onPress={() =>
                        setCalMonth((c) =>
                          c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 }
                        )
                      }
                    >
                      <ChevronRight size={16} color="#78716c" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {calMode === "quincena" ? (
                <View style={styles.grid5}>
                  {qDays.map((d) => (
                    <DayChip
                      key={d.key}
                      day={d.day}
                      count={log[d.key] || 0}
                      logged={log[d.key] !== undefined}
                      limit={limit}
                      isToday={d.key === key}
                      selected={selectedDay === d.key}
                      onClick={() => setSelectedDay(selectedDay === d.key ? null : d.key)}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.grid7}>
                  {["S", "M", "T", "W", "T", "F", "S"].map((dayName, idx) => (
                    <Text key={idx} style={styles.gridHeader}>
                      {dayName}
                    </Text>
                  ))}
                  {Array.from({ length: mLead }).map((_, i) => (
                    <View key={`blank-${i}`} style={styles.dayChip} />
                  ))}
                  {mDays.map((d) => (
                    <DayChip
                      key={d.key}
                      day={d.day}
                      count={log[d.key] || 0}
                      logged={log[d.key] !== undefined}
                      limit={limit}
                      isToday={d.key === key}
                      selected={selectedDay === d.key}
                      onClick={() => setSelectedDay(selectedDay === d.key ? null : d.key)}
                    />
                  ))}
                </View>
              )}

              {selectedDay && (
                <View style={styles.selectedDayBar}>
                  <Text style={styles.subtext}>{selectedDay}</Text>
                  <View style={styles.rowGap}>
                    <TouchableOpacity onPress={() => adjustDay(selectedDay, -1)} style={styles.btnSmallRound}>
                      <Text style={styles.btnSmallText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.boldText}>{log[selectedDay] || 0}</Text>
                    <TouchableOpacity onPress={() => adjustDay(selectedDay, 1)} style={styles.btnSmallRoundBlue}>
                      <Text style={styles.btnSmallTextWhite}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Edit Settings */}
        <View style={styles.settingsGroup}>
          <View style={[styles.card, styles.cardWhite]}>
            {!showLimitEdit ? (
              <View style={styles.rowBetween}>
                <Text style={styles.settingText}>
                  Daily limit: <Text style={styles.boldText}>{limit} pouches</Text>
                </Text>
                <TouchableOpacity onPress={() => setShowLimitEdit(true)}>
                  <Text style={styles.linkText}>tap to edit</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.rowBetween}>
                <Text style={styles.subtext}>Daily limit:</Text>
                <View style={styles.rowGap}>
                  <TextInput
                    keyboardType="numeric"
                    value={String(limit)}
                    onChangeText={saveLimit}
                    style={styles.inputStyle}
                  />
                  <TouchableOpacity onPress={() => setShowLimitEdit(false)}>
                    <Text style={styles.doneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <View style={[styles.card, styles.cardWhite]}>
            {!showCostEdit ? (
              <View style={styles.rowBetween}>
                <Text style={styles.settingText}>
                  <Text style={styles.boldText}>${canPrice.toFixed(2)}</Text> per can of{" "}
                  <Text style={styles.boldText}>{canSize}</Text>
                </Text>
                <TouchableOpacity onPress={() => setShowCostEdit(true)}>
                  <Text style={styles.linkText}>tap to edit</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.rowBetween}>
                  <Text style={styles.subtext}>Price per can (MXN):</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={String(canPrice)}
                    onChangeText={saveCanPrice}
                    style={styles.inputStyle}
                  />
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.subtext}>Pouches per can:</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={String(canSize)}
                    onChangeText={saveCanSize}
                    style={styles.inputStyle}
                  />
                </View>
                <TouchableOpacity onPress={() => setShowCostEdit(false)} style={{ alignItems: "flex-end" }}>
                  <Text style={styles.doneText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={[styles.card, styles.cardWhite]}>
            {!showTimerEdit ? (
              <View style={styles.rowBetween}>
                <View style={styles.rowGap}>
                  <TimerIcon size={14} color="#a8a29e" />
                  <Text style={styles.settingText}>
                    Timer flags at <Text style={styles.boldText}>{timerLimit} min</Text>
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowTimerEdit(true)}>
                  <Text style={styles.linkText}>tap to edit</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.rowBetween}>
                <Text style={styles.subtext}>Timer alert (min):</Text>
                <View style={styles.rowGap}>
                  <TextInput
                    keyboardType="numeric"
                    value={String(timerLimit)}
                    onChangeText={saveTimerLimit}
                    style={styles.inputStyle}
                  />
                  <TouchableOpacity onPress={() => setShowTimerEdit(false)}>
                    <Text style={styles.doneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.footerText}>Saved on this device only. Just for you.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fafaf9",
    paddingTop: statusBarInset + 16,
  },
  container: { paddingHorizontal: 16, paddingBottom: 24, maxWidth: 400, alignSelf: "center", width: "100%" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fafaf9" },
  loadingText: { color: "#a8a29e", fontSize: 14 },
  header: { marginBottom: 20 },
  headerSubtitle: { color: "#60a5fa", fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#1c1917" },
  card: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#e7e5e4" },
  cardWhite: { backgroundColor: "#ffffff" },
  cardTimerOver: { backgroundColor: "#fef3c7", borderColor: "#f59e0b" },
  cardTimerNear: { backgroundColor: "#fffbeb", borderColor: "#fcd34d" },
  cardOver: { backgroundColor: "#fffbeb", borderColor: "#fcd34d" },
  cardAtLimit: { backgroundColor: "#f5f5f4", borderColor: "#d6d3d1" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowGap: { flexDirection: "row", alignItems: "center" },
  rowCenterGap: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 12 },
  alignCenter: { alignItems: "center" },
  subtext: { fontSize: 12, color: "#78716c" },
  subtextSmall: { fontSize: 11, color: "#a8a29e" },
  linkText: { fontSize: 12, color: "#a8a29e" },
  btnPrimary: { backgroundColor: "#3b82f6", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  btnPrimaryText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  btnSecondary: { backgroundColor: "#f5f5f4", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center" },
  btnSecondaryText: { color: "#44403c", fontSize: 12, fontWeight: "600" },
  timerDigits: { fontSize: 32, fontWeight: "600", color: "#292524" },
  counterNumber: { fontSize: 60, fontWeight: "300", color: "#1c1917" },
  btnRoundPrimary: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#3b82f6", justifyContent: "center", alignItems: "center" },
  btnRoundSecondary: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#f5f5f4", justifyContent: "center", alignItems: "center" },
  warningText: { fontSize: 12, color: "#b45309", textAlign: "center", marginTop: 12 },
  cardTitle: { fontSize: 14, fontWeight: "500", color: "#292524" },
  chartContainer: { flexDirection: "row", alignItems: "flex-end", height: 112, marginTop: 16 },
  chartColumn: { flex: 1, alignItems: "center" },
  chartValue: { fontSize: 10, color: "#a8a29e" },
  barWrapper: { width: "100%", height: 80, justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 6 },
  barDefault: { backgroundColor: "#e7e5e4" },
  barToday: { backgroundColor: "#60a5fa" },
  barOver: { backgroundColor: "#fbbf24" },
  chartLabel: { fontSize: 11, color: "#a8a29e" },
  chartLabelToday: { color: "#1c1917", fontWeight: "bold" },
  dividerRow: { borderTopWidth: 1, borderTopColor: "#f5f5f4", paddingTop: 12, marginTop: 16, flexDirection: "row", justifyContent: "space-between" },
  trendBox: { backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a", borderRadius: 16, padding: 16, marginBottom: 16, flexDirection: "row" },
  trendText: { flex: 1, fontSize: 12, color: "#92400e", lineHeight: 18 },
  accordionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  accordionBody: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: "#f5f5f4" },
  segmentedControl: { flexDirection: "row", backgroundColor: "#f5f5f4", padding: 2, borderRadius: 8 },
  segmentBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  segmentBtnActive: { backgroundColor: "#ffffff" },
  segmentText: { fontSize: 12, color: "#78716c" },
  segmentTextActive: { color: "#1c1917", fontWeight: "600" },
  calNavTitle: { fontSize: 12, fontWeight: "500", color: "#44403c" },
  grid5: { flexDirection: "row", flexWrap: "wrap", marginTop: 12 },
  grid7: { flexDirection: "row", flexWrap: "wrap", width: "100%", marginTop: 12 },
  gridHeader: { width: `${100 / 7}%`, textAlign: "center", fontSize: 10, color: "#a8a29e", marginBottom: 4 },
  dayChip: { width: `${100 / 7 - 2}%`, aspectRatio: 1, borderRadius: 8, justifyContent: "center", alignItems: "center", margin: "1%" },
  chipDefault: { backgroundColor: "#fafaf9" },
  chipLogged: { backgroundColor: "#eff6ff" },
  chipOver: { backgroundColor: "#fbbf24" },
  chipToday: { borderWidth: 2, borderColor: "#93c5fd" },
  chipSelected: { borderWidth: 2, borderColor: "#a8a29e" },
  dayChipText: { fontSize: 12, fontWeight: "500", color: "#d6d3d1" },
  dayChipCount: { fontSize: 9, opacity: 0.8 },
  selectedDayBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f5f5f4" },
  btnSmallRound: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#f5f5f4", justifyContent: "center", alignItems: "center" },
  btnSmallRoundBlue: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#3b82f6", justifyContent: "center", alignItems: "center" },
  btnSmallText: { color: "#44403c", fontWeight: "bold" },
  btnSmallTextWhite: { color: "#ffffff", fontWeight: "bold" },
  settingsGroup: { marginBottom: 24 },
  settingText: { fontSize: 14, color: "#44403c" },
  boldText: { fontWeight: "bold", color: "#1c1917" },
  doneText: { fontSize: 12, color: "#3b82f6", fontWeight: "600" },
  inputStyle: { borderWidth: 1, borderColor: "#e7e5e4", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, textAlign: "center", width: 60, fontSize: 12 },
  footerText: { textAlign: "center", fontSize: 11, color: "#a8a29e" },
});
