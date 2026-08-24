import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { db } from "./db.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_COOKIE = "reading_race_session";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

if (!GOOGLE_CLIENT_ID) {
  console.warn(
    "[auth] GOOGLE_CLIENT_ID is not set — Google sign-in will fail. See README for setup.",
  );
}
if (!JWT_SECRET) {
  console.warn(
    "[auth] JWT_SECRET is not set — using an insecure generated secret for this process only. Set JWT_SECRET in your environment for real deployments.",
  );
}
const sessionSecret = JWT_SECRET || crypto.randomBytes(32).toString("hex");

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const upsertTeacher = db.prepare(`
  INSERT INTO teachers (id, google_sub, email, name)
  VALUES (@id, @googleSub, @email, @name)
  ON CONFLICT(google_sub) DO UPDATE SET email = excluded.email, name = excluded.name
`);
const getTeacherBySub = db.prepare("SELECT * FROM teachers WHERE google_sub = ?");
const getTeacherById = db.prepare("SELECT * FROM teachers WHERE id = ?");

export async function verifyGoogleCredential(credential) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Server is missing GOOGLE_CLIENT_ID configuration");
  }
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error("Google token did not include the expected profile fields");
  }
  return payload;
}

export function upsertTeacherFromGoogle(payload) {
  const existing = getTeacherBySub.get(payload.sub);
  const id = existing?.id || crypto.randomUUID();
  upsertTeacher.run({
    id,
    googleSub: payload.sub,
    email: payload.email,
    name: payload.name || payload.email,
  });
  return getTeacherById.get(id);
}

export function issueSessionCookie(res, teacherId) {
  const token = jwt.sign({ teacherId }, sessionSecret, { expiresIn: "30d" });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: "Not signed in" });
  try {
    const { teacherId } = jwt.verify(token, sessionSecret);
    const teacher = getTeacherById.get(teacherId);
    if (!teacher) return res.status(401).json({ error: "Not signed in" });
    req.teacher = teacher;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired" });
  }
}
