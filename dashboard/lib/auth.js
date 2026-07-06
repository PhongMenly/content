const crypto = require("crypto");

const COOKIE_NAME = "dashboard_auth";

function getSecret() {
  return process.env.DASHBOARD_PASSWORD || "";
}

function signToken() {
  const secret = getSecret();
  return crypto.createHmac("sha256", secret).update("authenticated").digest("hex");
}

function checkPassword(password) {
  return password === getSecret() && getSecret().length > 0;
}

function checkApiToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/);
  if (!match) return false;
  const token = match[1];
  return process.env.API_TOKEN && token === process.env.API_TOKEN;
}

function requireAuth(req, res, next) {
  if (req.path.startsWith("/api/") && checkApiToken(req)) {
    return next();
  }
  const token = req.cookies[COOKIE_NAME];
  if (token && token === signToken()) {
    return next();
  }
  if (req.path.startsWith("/api/")) {
    return res.status(401).json({ error: "Chua dang nhap" });
  }
  if (req.path === "/login") {
    return next();
  }
  return res.redirect("/login");
}

function login(req, res) {
  const { password } = req.body;
  if (checkPassword(password)) {
    res.cookie(COOKIE_NAME, signToken(), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
    return res.redirect("/");
  }
  return res.render("login", { error: "Sai mat khau" });
}

function logout(req, res) {
  res.clearCookie(COOKIE_NAME);
  res.redirect("/login");
}

module.exports = { requireAuth, login, logout, COOKIE_NAME };
