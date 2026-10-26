
const express = require("express");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const app = express();
app.use(express.json({ limit: "32kb" }));

const PORT = Number(process.env.PORT || 8003);
const CHROME_PATH =
  process.env.CHROME_PATH || "/usr/bin/google-chrome";
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT || 3);
const TIMEOUT_MS = 240_000;

let active = 0;

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "lighthouse" });
});

app.post("/audit", async (req, res) => {
  const { url, strategy = "mobile" } = req.body || {};

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: "A valid URL is required" });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: "Only HTTP and HTTPS URLs are allowed" });
  }

  if (!["mobile", "desktop"].includes(strategy)) {
    return res.status(400).json({ error: "Strategy must be mobile or desktop" });
  }

  if (active >= MAX_CONCURRENT) {
    return res.status(503).json({ error: "Lighthouse capacity reached" });
  }

  active++;
  const runDir = path.join(os.tmpdir(), `lh-${randomUUID()}`);

  try {
    await fs.mkdir(runDir, { recursive: true });

    const chromeFlags = [
      "--headless",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      `--user-data-dir=${path.join(runDir, "chrome")}`,
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ].join(" ");

    const args = [
      url,
      "--output=json",
      "--output-path=stdout",
      "--only-categories=performance",
      `--form-factor=${strategy}`,
      `--chrome-path=${CHROME_PATH}`,
      `--chrome-flags=${chromeFlags}`,
      "--quiet"
    ];

    const report = await new Promise((resolve, reject) => {
      const child = spawn(
        path.join(__dirname, "node_modules/.bin/lighthouse"),
        args,
        {
          env: {
            ...process.env,
            TMPDIR: runDir,
            TMP: runDir,
            TEMP: runDir
          },
          stdio: ["ignore", "pipe", "pipe"]
        }
      );

      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");

      child.stdout.on("data", chunk => {
        stdout += chunk;
        if (stdout.length > 30 * 1024 * 1024) {
          child.kill("SIGKILL");
          reject(new Error("Lighthouse report exceeded size limit"));
        }
      });

      child.stderr.on("data", chunk => {
        stderr += chunk;
        if (stderr.length > 100_000) {
          stderr = stderr.slice(-100_000);
        }
      });

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("Lighthouse timed out after 240 seconds"));
      }, TIMEOUT_MS);

      child.once("error", error => {
        clearTimeout(timer);
        reject(error);
      });

      child.once("close", code => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(stderr.slice(-2000) || `Lighthouse exited with code ${code}`));
          return;
        }

        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error("Lighthouse returned invalid JSON"));
        }
      });
    });

    return res.json(report);
  } catch (error) {
    console.error("Lighthouse audit failed:", error.message);
    return res.status(500).json({
      error: error.message || "Lighthouse audit failed"
    });
  } finally {
    active--;
    await fs.rm(runDir, { recursive: true, force: true }).catch(() => {});
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Lighthouse service listening on port ${PORT}`);
});
