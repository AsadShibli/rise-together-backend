import { Router, type NextFunction, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "./models";

// Shared by register and login. Null when JWT_SECRET is missing.
function signToken(userId: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return jwt.sign({ userId }, secret, { expiresIn: "7d" });
}

type AuthedRequest = Request & { userId?: string };

// Checks the Bearer token and stores userId for protected routes.
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) {
    res.status(401).json({ error: "login required" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as { userId?: string };
    if (!payload.userId) {
      res.status(401).json({ error: "login required" });
      return;
    }
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "login required" });
  }
}

// Login first, then allow the route only when the account role is admin.
export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    User.findById(req.userId)
      .select("role")
      .then((user) => {
        if (!user || user.role !== "admin") {
          res.status(403).json({ error: "admin required" });
          return;
        }
        next();
      })
      .catch(() => {
        res.status(403).json({ error: "admin required" });
      });
  });
}

// Register, login, and the current user. Never return the password hash.
export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const { name, email, phone, password } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
  };

  if (!name || !password || (!email && !phone)) {
    res.status(400).json({ error: "name, password, and email or phone are required" });
    return;
  }

  const matches: { email?: string; phone?: string }[] = [];
  if (email) matches.push({ email });
  if (phone) matches.push({ phone });
  const existing = await User.findOne({ $or: matches });
  if (existing) {
    res.status(409).json({ error: "account already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, phone, passwordHash });
  const token = signToken(user.id);
  if (!token) {
    res.status(500).json({ error: "JWT_SECRET is missing" });
    return;
  }
  res.status(201).json({ token });
});

authRouter.post("/login", async (req, res) => {
  const { email, phone, password } = req.body as {
    email?: string;
    phone?: string;
    password?: string;
  };

  if (!password || (!email && !phone)) {
    res.status(400).json({ error: "password and email or phone are required" });
    return;
  }

  const user = await User.findOne(email ? { email } : { phone });
  const passwordOk = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !passwordOk) {
    res.status(401).json({ error: "invalid login" });
    return;
  }

  const token = signToken(user.id);
  if (!token) {
    res.status(500).json({ error: "JWT_SECRET is missing" });
    return;
  }
  res.json({ token });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await User.findById(req.userId).select("name email phone role");
  if (!user) {
    res.status(401).json({ error: "login required" });
    return;
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  });
});

// Replaces the password after the current one matches. The hash is never returned.
authRouter.post("/password", requireAuth, async (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "current password and new password are required" });
    return;
  }
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(401).json({ error: "login required" });
    return;
  }
  const passwordOk = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordOk) {
    res.status(401).json({ error: "current password is wrong" });
    return;
  }
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ ok: true });
});
