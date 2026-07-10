require("dotenv").config({ path: require("path").join(__dirname, ".env.local") });

const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");
const db = require("./db/client");
const { requireAuth, login, logout } = require("./lib/auth");

const postsRouter = require("./routes/posts");
const creditsRouter = require("./routes/credits");
const scheduleRouter = require("./routes/schedule");
const libraryRouter = require("./routes/library");
const cronRouter = require("./routes/cron");
const statsRouter = require("./routes/stats");
const settingsRouter = require("./routes/settings");
const backendRouter = require("./routes/backend");
const telegramRouter = require("./routes/telegram");

const app = express();
const PORT = process.env.PORT || process.env.DASHBOARD_PORT || 4000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Tren Vercel serverless, app duoc import nhu 1 module (khong chay qua nhanh
// `require.main === module`), nen migrate schema phai chay o day de tu ap dung
// tren moi cold start, thay vi chi khi chay `node server.js` cuc bo.
let schemaReady = null;
function ensureSchemaOnce() {
  if (!schemaReady) {
    schemaReady = db.ensureSchema().catch((err) => {
      schemaReady = null; // cho phep thu lai o request sau neu lan nay loi
      throw err;
    });
  }
  return schemaReady;
}

app.use(async (req, res, next) => {
  try {
    await ensureSchemaOnce();
    next();
  } catch (err) {
    console.error("Khong the khoi tao schema:", err);
    res.status(500).json({ error: "Loi khoi tao schema" });
  }
});

app.get("/login", (req, res) => res.render("login", { error: null }));
app.post("/login", login);
app.post("/logout", logout);
app.use("/api/cron", cronRouter);
app.use("/api/telegram", telegramRouter);

app.use(requireAuth);

app.use("/api/posts", postsRouter);
app.use("/api/credits", creditsRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/library", libraryRouter);
app.use("/api/stats", statsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/backend", backendRouter);

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/posts/:id", async (req, res, next) => {
  try {
    const post = await db.getPost(req.params.id);
    if (!post) return res.status(404).send("Khong tim thay bai viet");
    res.render("post-detail", { postId: post.id });
  } catch (err) {
    next(err);
  }
});

app.get("/calendar", (req, res) => {
  res.render("calendar");
});

app.get("/stats", (req, res) => {
  res.render("stats");
});

app.get("/settings", (req, res) => {
  res.render("settings");
});

app.get("/backend", (req, res) => {
  res.render("backend");
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Loi khong xac dinh" });
});

if (require.main === module) {
  ensureSchemaOnce()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Dashboard dang chay tai http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error("Khong the khoi tao schema:", err);
      process.exit(1);
    });
}

module.exports = app;
