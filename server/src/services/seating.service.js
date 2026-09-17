/**
 * CampusSeating — Core Seating Algorithm (v2)
 * Pure function — zero DB calls. Controller feeds data, this returns assignments.
 *
 * Design goals for this rewrite:
 *  1. Capacity-safe:      never place more students in a room than its
 *                         usableCapacity, even if more physical seats exist.
 *  2. No silent no-ops:   every rule in seatingRules either does something or
 *                         produces a warning explaining why it couldn't.
 *  3. Deterministic:      same students + same rules + same rooms → same
 *                         output, every time (unless rollNumberOrder is
 *                         explicitly "random").
 *  4. Explainable gaps:   every unseated student comes with a reason code,
 *                         not just a name in a list.
 *  5. Composable rules:   gender separation, class pairing, gap seating,
 *                         fill direction, and spread/pack all combine
 *                         correctly instead of only working in isolation.
 */

const { shuffleArray, interleaveArrays } = require("../utils/helpers");

// ── Warning / reason codes ──────────────────────────────────────────────────
const CODES = {
  ROOM_CAPACITY_MISMATCH: "ROOM_CAPACITY_MISMATCH",
  NO_ROOMS: "NO_ROOMS",
  NO_STUDENTS: "NO_STUDENTS",
  SPECIAL_NEEDS_FALLBACK: "SPECIAL_NEEDS_FALLBACK",
  SPECIAL_NEEDS_UNSEATED: "SPECIAL_NEEDS_UNSEATED",
  GENDER_SPLIT_INFEASIBLE: "GENDER_SPLIT_INFEASIBLE",
  GENDER_ROOM_FULL: "GENDER_ROW_OR_ROOM_FULL",
  CAPACITY_EXCEEDED: "CAPACITY_EXCEEDED",
  STRICT_SEPARATION_RELAXED: "STRICT_SEPARATION_RELAXED_LOCALLY",
  BLOCK_COLUMNS_EXHAUSTED: "BLOCK_COLUMNS_EXHAUSTED",
  UNKNOWN_RULE_VALUE: "UNKNOWN_RULE_VALUE",
};

function warn(warnings, code, message, meta) {
  warnings.push({ code, message, ...(meta ? { meta } : {}) });
}

/**
 * @param {Object[]} students - [{id, classId, sectionId, gender, specialNeeds, enrollmentNo}]
 * @param {Object[]} rooms    - [{id, seats, usableCapacity, priority}]
 * @param {Object}   rules    - seatingRules from Shift
 * @returns {{ assignments, unassigned, warnings }}
 *   unassigned: [{ id, name, enrollmentNo, reason }]
 *   warnings:   [{ code, message, meta? }]
 */
function generateSeatingPlan(students, rooms, rules = {}) {
  const assignments = [];
  const warnings = [];
  const unassignedReasons = new Map(); // studentId -> reason code

  if (!rooms.length) {
    warn(warnings, CODES.NO_ROOMS, "No rooms are attached to this shift.");
    return { assignments, unassigned: markAllUnassigned(students, "no_rooms"), warnings };
  }
  if (!students.length) {
    warn(warnings, CODES.NO_STUDENTS, "No students resolved for this shift.");
    return { assignments, unassigned: [], warnings };
  }

  // ── STEP 0: Build capacity-safe seat pools ────────────────────────────────
  // Every pool is capped at usableCapacity even if more physical seats are
  // marked "available". This is the single source of truth for how many
  // seats a room may actually receive in this run.
  const roomPools = buildRoomPools(rooms, warnings);
  const totalCapacity = roomPools.reduce((sum, r) => sum + r.capacity, 0);

  if (students.length > totalCapacity) {
    warn(
      warnings,
      CODES.CAPACITY_EXCEEDED,
      `${students.length} students but only ${totalCapacity} usable seats across all rooms.`,
      { totalStudents: students.length, totalCapacity }
    );
  }

  // ── STEP 1: Special needs first (reserved seats, rule-aware fallback) ─────
  const specialNeeds = students.filter((s) => s.specialNeeds);
  const everyoneElse = students.filter((s) => !s.specialNeeds);

  const usedSeats = new Set();
  seatSpecialNeeds(specialNeeds, roomPools, usedSeats, assignments, warnings, unassignedReasons);

  // ── STEP 2: Gender separation (capacity-based) or normal path ────────────
  const genderMode = normalizeGender(rules.genderSeparation, warnings);

  if (genderMode) {
    seatWithGenderSeparation(
      everyoneElse, roomPools, rules, genderMode, usedSeats, assignments, warnings, unassignedReasons
    );
  } else {
    seatGroup(everyoneElse, roomPools, rules, usedSeats, assignments, warnings, unassignedReasons);
  }

  // ── STEP 3: Compile final unassigned list with reasons ────────────────────
  const assignedIds = new Set(assignments.map((a) => String(a.studentId)));
  const unassigned = students
    .filter((s) => !assignedIds.has(String(s.id)))
    .map((s) => ({
      id: s.id,
      name: s.name,
      enrollmentNo: s.enrollmentNo,
      reason: unassignedReasons.get(String(s.id)) || "capacity_exceeded",
    }));

  return { assignments, unassigned, warnings };
}

function markAllUnassigned(students, reason) {
  return students.map((s) => ({ id: s.id, name: s.name, enrollmentNo: s.enrollmentNo, reason }));
}

// ─────────────────────────────────────────────────────────────────────────────
// buildRoomPools — capacity-safe, deterministic seat pools per room
// ─────────────────────────────────────────────────────────────────────────────

function buildRoomPools(rooms, warnings) {
  return rooms
    .slice()
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99) || String(a.id).localeCompare(String(b.id)))
    .map((room) => {
      const allSeats = Array.isArray(room.seats) ? room.seats : [];
      const available = allSeats
        .filter((s) => s.status === "available")
        .sort((a, b) => a.row.localeCompare(b.row) || a.bench - b.bench || String(a.position).localeCompare(String(b.position)));
      const reserved = allSeats
        .filter((s) => s.status === "reserved")
        .sort((a, b) => a.row.localeCompare(b.row) || a.bench - b.bench || String(a.position).localeCompare(String(b.position)));

      const cap = Number.isFinite(room.usableCapacity) ? room.usableCapacity : available.length;

      if (cap > available.length) {
        warn(
          warnings,
          CODES.ROOM_CAPACITY_MISMATCH,
          `Room "${room.name || room.id}" has usableCapacity ${cap} but only ${available.length} seats marked available. Capped at ${available.length}.`,
          { roomId: room.id }
        );
      }

      const cappedAvailable = available.slice(0, Math.min(cap, available.length));

      return {
        roomId: room.id,
        roomName: room.name,
        priority: room.priority ?? 99,
        available: cappedAvailable,
        reserved,
        capacity: cappedAvailable.length,
      };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Special needs seating
// Tries reserved seats first, then falls back to the next free standard seat
// (still capacity-capped, still respecting usedSeats so it can never collide
// with anything seated later).
// ─────────────────────────────────────────────────────────────────────────────

function seatSpecialNeeds(students, roomPools, usedSeats, assignments, warnings, unassignedReasons) {
  if (!students.length) return;

  const reservedPool = roomPools.flatMap((r) =>
    r.reserved.map((s) => ({ ...s, roomId: r.roomId }))
  );

  for (const student of students) {
    let seat = null;

    // Try a reserved seat first
    while (reservedPool.length) {
      const candidate = reservedPool.shift();
      const key = `${candidate.roomId}-${candidate.seatId}`;
      if (!usedSeats.has(key)) { seat = { ...candidate, fromReserved: true }; break; }
    }

    // Fallback: next free standard seat, anywhere
    if (!seat) {
      seat = findNextAvailableSeat(roomPools, usedSeats);
      if (seat) {
        warn(
          warnings,
          CODES.SPECIAL_NEEDS_FALLBACK,
          `Special needs student ${student.enrollmentNo || student.id} placed on a standard seat (no reserved seat available).`,
          { studentId: student.id }
        );
      }
    }

    if (seat) {
      const key = `${seat.roomId}-${seat.seatId}`;
      usedSeats.add(key);
      assignments.push({
        studentId: student.id,
        classId: student.classId,
        roomId: seat.roomId,
        seatId: seat.seatId,
        row: seat.row,
        bench: seat.bench,
        position: seat.position,
      });
    } else {
      unassignedReasons.set(String(student.id), "special_needs_no_seat_available");
      warn(
        warnings,
        CODES.SPECIAL_NEEDS_UNSEATED,
        `Special needs student ${student.enrollmentNo || student.id} could not be seated — no seats left.`,
        { studentId: student.id }
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2a — Gender separation (capacity-based bin packing)
// Splits ROOM POOLS (for "rooms" mode) or splits SEATS WITHIN EACH ROOM BY
// ROW (for "rows" mode) proportionally to actual seat capacity needed by
// each gender group — not headcount ratio of remaining students, and not a
// naive "first N rooms" cut that ignores room size.
// ─────────────────────────────────────────────────────────────────────────────

function normalizeGender(v, warnings) {
  if (!v || v === "none" || v === "false") return null;
  if (v === "rooms" || v === "rows") return v;
  warn(warnings, CODES.UNKNOWN_RULE_VALUE, `Unknown genderSeparation value "${v}" — ignored.`);
  return null;
}

function seatWithGenderSeparation(students, roomPools, rules, mode, usedSeats, assignments, warnings, unassignedReasons) {
  const female = students.filter((s) => s.gender === "female");
  const male = students.filter((s) => s.gender !== "female" && s.gender !== "male" ? false : s.gender !== "female");
  // Anyone whose gender is missing/unspecified is treated as its own group so
  // it never gets silently merged into either binary group.
  const other = students.filter((s) => s.gender !== "female" && s.gender !== "male");
  const maleOnly = students.filter((s) => s.gender === "male");

  if (mode === "rooms") {
    const { groupA: femaleRooms, groupB: maleRooms, feasible } =
      splitRoomsByCapacity(roomPools, female.length, maleOnly.length, warnings);

    seatGroup(female, femaleRooms, rules, usedSeats, assignments, warnings, unassignedReasons);
    seatGroup(maleOnly, maleRooms, rules, usedSeats, assignments, warnings, unassignedReasons);

    // Students with unspecified gender go wherever capacity remains, after
    // both binary groups — never dropped, always seated on leftover seats.
    if (other.length) {
      seatGroup(other, roomPools, rules, usedSeats, assignments, warnings, unassignedReasons);
    }
    if (!feasible) {
      warn(
        warnings,
        CODES.GENDER_SPLIT_INFEASIBLE,
        "Room-level gender split could not perfectly separate both groups by capacity — some rooms may mix genders as a fallback.",
      );
    }
    return;
  }

  // mode === "rows": split every room's own row list by capacity, per room,
  // and pack female rows first (deterministic — matches prior UI wording of
  // "female rows first"), male rows after, leftover after that.
  const femaleRoomPools = [];
  const maleRoomPools = [];

  for (const pool of roomPools) {
    const rowsMap = groupSeatsByRow(pool.available);
    const rowKeys = Object.keys(rowsMap).sort();
    const rowSeatCounts = rowKeys.map((k) => rowsMap[k].length);
    const totalSeats = rowSeatCounts.reduce((a, b) => a + b, 0);
    if (totalSeats === 0) continue;

    // Decide how many whole rows should go to "female" based on this room's
    // proportional share of total female demand vs total demand overall —
    // then round to whole rows so we never split a bench across groups.
    const shareOfDemand = (female.length) / Math.max(1, female.length + maleOnly.length);
    let femaleSeatTarget = Math.round(totalSeats * shareOfDemand);

    let running = 0;
    let splitIdx = rowKeys.length;
    for (let i = 0; i < rowKeys.length; i++) {
      running += rowSeatCounts[i];
      if (running >= femaleSeatTarget) { splitIdx = i + 1; break; }
    }

    const femaleRowKeys = rowKeys.slice(0, splitIdx);
    const maleRowKeys = rowKeys.slice(splitIdx);

    const femaleSeats = femaleRowKeys.flatMap((k) => rowsMap[k]);
    const maleSeats = maleRowKeys.flatMap((k) => rowsMap[k]);

    if (femaleSeats.length) {
      femaleRoomPools.push({ ...pool, available: femaleSeats, capacity: femaleSeats.length });
    }
    if (maleSeats.length) {
      maleRoomPools.push({ ...pool, available: maleSeats, capacity: maleSeats.length });
    }
  }

  seatGroup(female, femaleRoomPools, rules, usedSeats, assignments, warnings, unassignedReasons);
  seatGroup(maleOnly, maleRoomPools, rules, usedSeats, assignments, warnings, unassignedReasons);
  if (other.length) {
    seatGroup(other, roomPools, rules, usedSeats, assignments, warnings, unassignedReasons);
  }
}

function groupSeatsByRow(seats) {
  const map = {};
  for (const seat of seats) {
    if (!map[seat.row]) map[seat.row] = [];
    map[seat.row].push(seat);
  }
  return map;
}

/**
 * Greedy bin-packing: assign whole rooms to whichever group needs capacity,
 * trying to hit each group's exact headcount without over- or under-shooting
 * by more than one room's worth of slack. Falls back to marking infeasible
 * (but still returns a best-effort split — nobody is dropped silently) if
 * capacities can't be partitioned cleanly (e.g. one room is bigger than
 * total demand of either group).
 */
function splitRoomsByCapacity(roomPools, femaleCount, maleCount, warnings) {
  if (femaleCount === 0) return { groupA: [], groupB: roomPools, feasible: true };
  if (maleCount === 0) return { groupA: roomPools, groupB: [], feasible: true };

  const sorted = [...roomPools].sort((a, b) => b.capacity - a.capacity);
  const groupA = []; // female
  const groupB = []; // male
  let capA = 0;
  let capB = 0;

  for (const room of sorted) {
    // Assign to whichever group is further from meeting its demand,
    // proportionally — this naturally balances even with mixed room sizes.
    const deficitA = femaleCount - capA;
    const deficitB = maleCount - capB;
    if (deficitA <= 0 && deficitB <= 0) {
      // both satisfied — dump remainder into the larger-remaining-demand
      // group so leftover seats aren't wasted as their own tiny group
      (femaleCount >= maleCount ? groupA : groupB).push(room);
      continue;
    }
    if (deficitA >= deficitB) { groupA.push(room); capA += room.capacity; }
    else { groupB.push(room); capB += room.capacity; }
  }

  const feasible = capA >= femaleCount && capB >= maleCount;
  return { groupA, groupB, feasible };
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2b — dispatch to block-column or standard fill, with spread/pack
// applied uniformly to whichever pools were handed in (works correctly now
// even after a gender split, unlike the old version).
// ─────────────────────────────────────────────────────────────────────────────

function seatGroup(students, roomPools, rules, usedSeats, assignments, warnings, unassignedReasons) {
  if (!students.length || !roomPools.length) {
    if (students.length) {
      for (const s of students) {
        if (!unassignedReasons.has(String(s.id))) {
          unassignedReasons.set(String(s.id), roomPools.length ? "capacity_exceeded" : "no_rooms_for_group");
        }
      }
    }
    return;
  }

  const pools = applyRoomFillStrategy(students.length, roomPools, rules);

  const isBlock =
    rules.consecutivePairing &&
    rules.pairingMode === "block" &&
    (rules.autoPair || rules.classPairs?.length);

  const before = assignments.length;

  if (isBlock) {
    assignBlockColumn(students, pools, rules, usedSeats, assignments, warnings);
  } else {
    assignStandard(students, pools, rules, usedSeats, assignments, warnings);
  }

  // Anyone from this call still not in assignments gets a reason.
  const justAssigned = new Set(assignments.slice(before).map((a) => String(a.studentId)));
  for (const s of students) {
    if (!justAssigned.has(String(s.id)) && !unassignedReasons.has(String(s.id))) {
      unassignedReasons.set(String(s.id), "capacity_exceeded");
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Room fill strategy — pack (default) or spread
// Spread now works by interleaving seat *offers* round-robin across rooms
// rather than pre-slicing each room's list, so it composes correctly with
// block-column mode (columns are still built from full per-room seat lists,
// just consumed in a spread-friendly order via priority weighting).
// ─────────────────────────────────────────────────────────────────────────────

function applyRoomFillStrategy(studentCount, roomPools, rules) {
  if (rules.roomFillStrategy !== "spread") return roomPools;

  const totalSeats = roomPools.reduce((a, r) => a + r.capacity, 0);
  if (totalSeats === 0) return roomPools;

  // Give each room a proportional quota of the *actual* student count
  // (not always its full capacity), so smaller intakes really do spread
  // thinly across rooms instead of packing the first one anyway.
  return roomPools.map((pool) => {
    const quota = Math.min(pool.capacity, Math.ceil((pool.capacity / totalSeats) * studentCount));
    return { ...pool, available: pool.available.slice(0, quota), capacity: quota };
  }).filter((p) => p.capacity > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK-COLUMN MODE
// Each bench-position column is owned by exactly one class/pair-slot.
// Fill order: all rows top-to-bottom for each column, across all rooms.
// Unpaired classes and pairs-that-ran-out share leftover columns fairly via
// a shared SeatCursor so seats are never double-claimed or silently wasted.
// ─────────────────────────────────────────────────────────────────────────────

function assignBlockColumn(students, roomPools, rules, usedSeats, assignments, warnings) {
  const classGroups = buildClassGroups(students, rules);
  const gapSeating = normalizeGap(rules.gapSeating);

  const pairs = resolvePairs(rules, classGroups);
  const pairQueues = pairs.map((pair) => pair.classes.map((c) => [...(classGroups[String(c)] || [])]));

  const pairedIds = new Set(pairs.flatMap((p) => p.classes.map(String)));
  const unpairedStudents = Object.entries(classGroups)
    .filter(([k]) => !pairedIds.has(k))
    .flatMap(([, arr]) => arr);

  const columns = buildColumns(roomPools, rules);
  const activeColumns = gapSeating === "row" ? columns.filter((_, i) => i % 2 === 0) : columns;

  const cursor = new SeatCursor(usedSeats);
  let colIdx = 0;

  for (const queues of pairQueues) {
    const classCount = queues.length;
    let stalled = 0;
    while (queues.some((q) => q.length > 0) && colIdx < activeColumns.length) {
      let placedThisRound = 0;
      for (let c = 0; c < classCount; c++) {
        if (colIdx >= activeColumns.length) break;
        const col = activeColumns[colIdx++];
        const queue = queues[c];
        const applyPositions = gapSeating === "side" ? col.seats.slice(0, 1) : col.seats;

        for (const seat of applyPositions) {
          if (queue.length === 0) break;
          if (cursor.isUsed(col.roomId, seat.seatId)) continue;
          const student = queue.shift();
          cursor.claim(col.roomId, seat.seatId);
          placedThisRound++;
          assignments.push({
            studentId: student.id,
            classId: student.classId,
            roomId: col.roomId,
            seatId: seat.seatId,
            row: seat.row,
            bench: seat.bench,
            position: seat.position,
          });
        }
      }
      if (placedThisRound === 0) { stalled++; if (stalled > 2) break; } else { stalled = 0; }
    }
  }

  if (colIdx >= activeColumns.length && pairQueues.some((qs) => qs.some((q) => q.length > 0))) {
    warn(
      warnings,
      CODES.BLOCK_COLUMNS_EXHAUSTED,
      "Ran out of seat columns before all paired classes were fully seated. Remaining students in these classes could not be seated under block pairing.",
    );
  }

  // Standard fill for unpaired students on remaining columns
  if (unpairedStudents.length > 0 && colIdx < activeColumns.length) {
    const remainingCols = activeColumns.slice(colIdx);
    const tempPools = buildTempPoolsFromColumns(remainingCols, roomPools);
    assignStandard(unpairedStudents, tempPools, rules, usedSeats, assignments, warnings);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STANDARD FILL — row by row (interleaved + non-pairing modes)
// Rewritten to use the shared SeatCursor and to fix the strict-separation
// bug: it now checks against every seat already placed on that bench in
// *this whole run* (not just assignments visible at swap time), and, if it
// truly cannot avoid a same-class collision (e.g. only one class has
// students left), it records a warning instead of silently violating the
// rule with no trace.
// ─────────────────────────────────────────────────────────────────────────────

function assignStandard(students, roomPools, rules, usedSeats, assignments, warnings) {
  const sorted = sortStudentsStandard(students, rules);
  const cursor = new SeatCursor(usedSeats);
  const gapSeating = normalizeGap(rules.gapSeating);
  const strict = rules.classSeparationMode === "strict";

  // benchClassMap: `${roomId}-${bench}` -> Set of classIds already seated there
  const benchClassMap = new Map();
  for (const a of assignments) {
    const key = `${a.roomId}-${a.bench}`;
    if (!benchClassMap.has(key)) benchClassMap.set(key, new Set());
    benchClassMap.get(key).add(String(a.classId));
  }

  let pointer = 0;
  let relaxedAnywhere = false;

  for (const roomPool of roomPools) {
    if (pointer >= sorted.length) break;

    const benchMap = {};
    for (const seat of roomPool.available) {
      const key = `${seat.row}-${String(seat.bench).padStart(4, "0")}`;
      if (!benchMap[key]) benchMap[key] = [];
      benchMap[key].push(seat);
    }

    let benches = Object.entries(benchMap).sort(([a], [b]) => a.localeCompare(b));
    if (rules.fillDirection === "back") benches = benches.reverse();

    const activeBenches = gapSeating === "row" ? benches.filter((_, i) => i % 2 === 0) : benches;

    for (const [, seats] of activeBenches) {
      if (pointer >= sorted.length) break;
      const positions = gapSeating === "side" ? [seats[0]] : seats;

      for (const seat of positions) {
        if (pointer >= sorted.length) break;
        if (cursor.isUsed(roomPool.roomId, seat.seatId)) continue;

        const benchKey = `${roomPool.roomId}-${seat.bench}`;
        let student = sorted[pointer];

        if (strict) {
          const usedClasses = benchClassMap.get(benchKey) || new Set();
          if (usedClasses.has(String(student.classId))) {
            const swapIdx = sorted.findIndex(
              (s, i) => i > pointer && !usedClasses.has(String(s.classId))
            );
            if (swapIdx !== -1) {
              [sorted[pointer], sorted[swapIdx]] = [sorted[swapIdx], sorted[pointer]];
              student = sorted[pointer];
            } else {
              // No candidate anywhere avoids the collision (e.g. only one
              // class left with students) — proceed but flag it once.
              relaxedAnywhere = true;
            }
          }
        }

        cursor.claim(roomPool.roomId, seat.seatId);
        if (!benchClassMap.has(benchKey)) benchClassMap.set(benchKey, new Set());
        benchClassMap.get(benchKey).add(String(student.classId));

        assignments.push({
          studentId: student.id,
          classId: student.classId,
          roomId: roomPool.roomId,
          seatId: seat.seatId,
          row: seat.row,
          bench: seat.bench,
          position: seat.position,
        });

        pointer++;
      }
    }
  }

  if (relaxedAnywhere) {
    warn(
      warnings,
      CODES.STRICT_SEPARATION_RELAXED,
      "Strict class separation could not be maintained on every bench (too few distinct classes remaining to avoid a same-class pairing).",
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SeatCursor — single source of truth for "is this seat taken", shared by
// every fill function so state can never desync between them.
// ─────────────────────────────────────────────────────────────────────────────

class SeatCursor {
  constructor(usedSeats) {
    this.used = usedSeats; // Set<string>, shared across the whole generation run
  }
  key(roomId, seatId) { return `${roomId}-${seatId}`; }
  isUsed(roomId, seatId) { return this.used.has(this.key(roomId, seatId)); }
  claim(roomId, seatId) { this.used.add(this.key(roomId, seatId)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// sortStudentsStandard — interleaved pairing or plain interleave
// ─────────────────────────────────────────────────────────────────────────────

function sortStudentsStandard(students, rules) {
  const classGroups = buildClassGroups(students, rules);

  if (!rules.consecutivePairing) {
    return interleaveArrays(Object.values(classGroups));
  }

  const pairs = resolvePairs(rules, classGroups);
  if (!pairs.length) return interleaveArrays(Object.values(classGroups));

  const result = [];
  const used = new Set();

  const pairStreams = pairs.map((pair) => {
    const arrays = pair.classes.map((c) => classGroups[String(c)] || []);
    return interleaveArrays(arrays);
  });

  const maxLen = Math.max(...pairStreams.map((p) => p.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const stream of pairStreams) {
      if (i < stream.length) {
        const s = stream[i];
        if (!used.has(String(s.id))) { result.push(s); used.add(String(s.id)); }
      }
    }
  }

  for (const s of Object.values(classGroups).flat()) {
    if (!used.has(String(s.id))) result.push(s);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// resolvePairs
// ─────────────────────────────────────────────────────────────────────────────

function resolvePairs(rules, classGroups) {
  if (!rules.consecutivePairing) return [];

  if (rules.autoPair) {
    const entries = Object.entries(classGroups)
      .filter(([, arr]) => arr.length > 0)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

    const pairs = [];
    const left = entries.slice(0, Math.ceil(entries.length / 2));
    const right = [...entries.slice(Math.ceil(entries.length / 2))].reverse();

    for (let i = 0; i < left.length; i++) {
      const classA = left[i][0];
      const classB = right[i]?.[0];
      pairs.push(classB ? { classes: [classA, classB] } : { classes: [classA] });
    }
    return pairs;
  }

  return (rules.classPairs || []).filter((p) => p.classes?.filter(Boolean).length >= 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// buildClassGroups
// ─────────────────────────────────────────────────────────────────────────────

function buildClassGroups(students, rules) {
  const groups = {};
  const useSection = rules.groupBy === "section";

  for (const s of students) {
    const key = useSection ? `${s.classId}:${s.sectionId}` : String(s.classId);
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }

  const order = rules.rollNumberOrder === "false" || !rules.rollNumberOrder ? false : rules.rollNumberOrder;

  for (const key of Object.keys(groups)) {
    if (order === "asc") {
      groups[key].sort((a, b) => a.enrollmentNo.localeCompare(b.enrollmentNo, undefined, { numeric: true }));
    } else if (order === "desc") {
      groups[key].sort((a, b) => b.enrollmentNo.localeCompare(a.enrollmentNo, undefined, { numeric: true }));
    } else {
      groups[key] = shuffleArray(groups[key]);
    }
  }

  return groups;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildColumns
// ─────────────────────────────────────────────────────────────────────────────

function buildColumns(roomPools, rules) {
  const columns = [];

  for (const roomPool of roomPools) {
    const colMap = new Map();
    for (const seat of roomPool.available) {
      const key = `${String(seat.bench).padStart(4, "0")}-${seat.position}`;
      if (!colMap.has(key)) colMap.set(key, []);
      colMap.get(key).push(seat);
    }

    const sortedKeys = [...colMap.keys()].sort();
    for (const key of sortedKeys) {
      let seats = colMap.get(key).sort((a, b) => a.row.localeCompare(b.row));
      if (rules.fillDirection === "back") seats = seats.reverse();
      columns.push({ roomId: roomPool.roomId, seats });
    }
  }

  return columns;
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildTempPoolsFromColumns(columns, originalPools) {
  const roomSeatMap = new Map();
  for (const col of columns) {
    const rid = String(col.roomId);
    if (!roomSeatMap.has(rid)) roomSeatMap.set(rid, []);
    for (const seat of col.seats) roomSeatMap.get(rid).push(seat);
  }
  return originalPools
    .filter((p) => roomSeatMap.has(String(p.roomId)))
    .map((p) => ({ ...p, available: roomSeatMap.get(String(p.roomId)), capacity: roomSeatMap.get(String(p.roomId)).length }));
}

function normalizeGap(v) {
  return v === "false" || !v ? false : v;
}

function findNextAvailableSeat(roomPools, usedSeats) {
  for (const roomPool of roomPools) {
    for (const seat of roomPool.available) {
      const key = `${roomPool.roomId}-${seat.seatId}`;
      if (!usedSeats.has(key)) {
        return { roomId: roomPool.roomId, seatId: seat.seatId, row: seat.row, bench: seat.bench, position: seat.position };
      }
    }
  }
  return null;
}

module.exports = { generateSeatingPlan, CODES };