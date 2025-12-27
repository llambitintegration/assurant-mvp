import session from "express-session";
import db from "../config/db";
import { isProduction } from "../shared/utils";
import * as cookieSignature from "cookie-signature";
import { randomBytes } from "crypto";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pgSession = require("connect-pg-simple")(session);

type PgStore = session.Store & {
  pruneSessions?: (callback?: (err?: unknown) => void) => void;
};

const SESSION_PRUNE_INTERVAL_MINUTES = Number(process.env.SESSION_PRUNE_INTERVAL_MINUTES || "60");
const SESSION_PRUNE_INTERVAL_MS = SESSION_PRUNE_INTERVAL_MINUTES > 0 ? SESSION_PRUNE_INTERVAL_MINUTES * 60 * 1000 : 0;

const pgStore: PgStore = new pgSession({
  pool: db.pool,
  tableName: "pg_sessions",
  createTableIfMissing: true,
  pruneSessionInterval: false
});

let sessionPruneTimer: NodeJS.Timeout | null = null;

const startSessionPruneLoop = () => {
  if (!SESSION_PRUNE_INTERVAL_MS || sessionPruneTimer || typeof pgStore.pruneSessions !== "function") {
    return;
  }

  sessionPruneTimer = setInterval(() => {
    pgStore.pruneSessions?.((err?: unknown) => {
      if (err) {
        console.error("pg_sessions prune failed:", err);
      }
    });
  }, SESSION_PRUNE_INTERVAL_MS);
};

const ensurePgSessionsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS pg_sessions (
        sid    VARCHAR      NOT NULL        PRIMARY KEY,
        sess   JSON         NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_pg_sessions_expire ON pg_sessions (expire);
    `);
    console.log("pg_sessions table ready.");
    startSessionPruneLoop();
  } catch (error) {
    console.error("Failed to ensure pg_sessions table exists:", error);
  }
};

ensurePgSessionsTable().catch((error) => {
  console.error("Unexpected error while preparing pg_sessions:", error);
});

const sessionConfig = {
  name: process.env.SESSION_NAME,
  secret: process.env.SESSION_SECRET || "development-secret-key",
  proxy: false,
  resave: false,
  saveUninitialized: true,
  rolling: true,
  store: pgStore,
  cookie: {
    path: "/",
    httpOnly: true,
    // For mobile app support in production, use "none", for local development use "lax"
    sameSite: "lax" as const,
    // Secure only in production (HTTPS required for sameSite: "none")
    secure: isProduction(),
    domain: undefined,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  },
  // Custom session ID handling for mobile apps
  genid: () => {
    return randomBytes(24).toString("base64url");
  }
};

const sessionMiddleware = session(sessionConfig);

// Enhanced session middleware that supports both cookies and headers for mobile apps
export default (req: any, res: any, next: any) => {
  // Check if mobile app is sending session ID via header (fallback for cookie issues)
  const headerSessionId = req.headers["x-session-id"];
  const headerSessionName = req.headers["x-session-name"];
  
  // Only process headers if they exist AND there's no existing valid session cookie
  if (headerSessionId && headerSessionName) {
    const secret = process.env.SESSION_SECRET || "development-secret-key";
    
    try {
      // Create a signed cookie using the session secret
      const signedSessionId = `s:${cookieSignature.sign(headerSessionId, secret)}`;
      const encodedSignedId = encodeURIComponent(signedSessionId);
      const sessionCookie = `${headerSessionName}=${encodedSignedId}`;
      
      if (req.headers.cookie) {
        // Replace existing session cookie while keeping other cookies
        req.headers.cookie = req.headers.cookie
          .split(";")
          .filter((cookie: string) => !cookie.trim().startsWith(headerSessionName))
          .concat(sessionCookie)
          .join(";");
      } else {
        // Set the session cookie from header
        req.headers.cookie = sessionCookie;
      }
    } catch (error) {
      // Fallback to the old method
      const sessionCookie = `${headerSessionName}=s%3A${headerSessionId}`;
      req.headers.cookie = sessionCookie;
    }
  }
  
  // Always call the original session middleware (handles both cookie and header-converted cases)
  sessionMiddleware(req, res, next);
};