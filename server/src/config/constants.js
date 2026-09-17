module.exports = {
  JWT_EXPIRY: process.env.JWT_EXPIRY || "8h",
  COOKIE_OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
  ADMIN_COOKIE_NAME: "admin_token",
  SUPERADMIN_COOKIE_NAME: "superadmin_token",
  LOGIN_RATE_LIMIT: { windowMs: 15 * 60 * 1000, max: 500 },
  PUBLIC_RATE_LIMIT: { windowMs: 60 * 1000, max: 60 },
  CSV_SIZE_LIMIT: 5 * 1024 * 1024, // 5MB
  SEAT_POSITIONS: ["L", "M", "R"],
  EXAM_STATUS: ["draft", "published", "ongoing", "completed"],
  GENDER_SEP: ["none", "rows", "rooms"],
  CLASS_SEP: ["strict", "relaxed"], // was BRANCH_SEP
  // Update this list to match designations your schools actually use
  // (Principal, Vice Principal, PGT, TGT, PRT, etc.) — left as a starting
  // point since the college list (Professor/HOD/Lab Assistant) doesn't fit.
  DESIGNATIONS: ["Principal", "Vice Principal", "PGT", "TGT", "PRT", "Lab Assistant"],
};
