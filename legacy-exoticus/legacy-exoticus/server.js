// Legacy Exoticus — servidor (sem dependências externas)
// Requer Node.js 22.5 ou superior (usa o SQLite embutido do Node).
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "data", "legacy.db");
const SECURE_COOKIE = process.env.NODE_ENV === "production"; // exige HTTPS em produção

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expira_em INTEGER NOT NULL
  );
`);

/* ---------- Senhas ---------- */
function hashSenha(senha) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(senha, salt, 64);
  return salt.toString("hex") + ":" + hash.toString("hex");
}
function confereSenha(senha, guardado) {
  const [saltHex, hashHex] = guardado.split(":");
  const esperado = Buffer.from(hashHex, "hex");
  const calculado = crypto.scryptSync(senha, Buffer.from(saltHex, "hex"), 64);
  return crypto.timingSafeEqual(esperado, calculado);
}
const DUMMY_HASH = hashSenha("senha-falsa-para-igualar-tempo");

/* ---------- Sessões ---------- */
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");

function criaSessao(userId, lembrar) {
  const token = crypto.randomBytes(32).toString("hex");
  const duracao = lembrar ? 30 * 24 * 3600 : 24 * 3600; // segundos
  db.prepare("INSERT INTO sessions (token_hash, user_id, expira_em) VALUES (?, ?, ?)")
    .run(sha(token), userId, Date.now() + duracao * 1000);
  return { token, duracao };
}

function cookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function setCookie(res, token, maxAge) {
  const partes = [`sid=${token}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (maxAge !== null) partes.push(`Max-Age=${maxAge}`);
  if (SECURE_COOKIE) partes.push("Secure");
  res.setHeader("Set-Cookie", partes.join("; "));
}

function usuarioLogado(req) {
  const token = cookies(req).sid;
  if (!token) return null;
  const row = db.prepare(
    `SELECT u.id, u.nome, u.email, s.expira_em FROM sessions s
     JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`
  ).get(sha(token));
  if (!row) return null;
  if (row.expira_em < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
    return null;
  }
  return { id: row.id, nome: row.nome, email: row.email };
}

/* ---------- Limite de tentativas (em memória, por IP) ---------- */
const tentativas = new Map();
function limitado(ip, max = 10, janelaMs = 15 * 60 * 1000) {
  const agora = Date.now();
  const lista = (tentativas.get(ip) || []).filter((t) => agora - t < janelaMs);
  lista.push(agora);
  tentativas.set(ip, lista);
  return lista.length > max;
}
setInterval(() => tentativas.clear(), 60 * 60 * 1000).unref();

/* ---------- Utilidades HTTP ---------- */
function json(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

function lerJson(req) {
  return new Promise((resolve, reject) => {
    if (!(req.headers["content-type"] || "").startsWith("application/json")) {
      return reject(Object.assign(new Error("Tipo de conteúdo inválido."), { status: 415 }));
    }
    let tamanho = 0;
    const partes = [];
    req.on("data", (c) => {
      tamanho += c.length;
      if (tamanho > 10_000) {
        reject(Object.assign(new Error("Requisição muito grande."), { status: 413 }));
        req.destroy();
      } else partes.push(c);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(partes).toString("utf8"))); }
      catch { reject(Object.assign(new Error("JSON inválido."), { status: 400 })); }
    });
    req.on("error", reject);
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- Rotas da API ---------- */
async function api(req, res, rota) {
  const ip = req.socket.remoteAddress || "?";

  if (req.method === "GET" && rota === "/api/me") {
    const u = usuarioLogado(req);
    return json(res, 200, { usuario: u });
  }

  if (req.method !== "POST") return json(res, 405, { erro: "Método não permitido." });

  if (rota === "/api/cadastro") {
    if (limitado(ip + ":cad", 20)) return json(res, 429, { erro: "Muitas tentativas. Tente mais tarde." });
    const b = await lerJson(req);
    const nome = String(b.nome || "").trim();
    const email = String(b.email || "").trim().toLowerCase();
    const senha = String(b.senha || "");
    if (!nome || nome.length > 120) return json(res, 400, { erro: "Informe seu nome completo." });
    if (!EMAIL_RE.test(email) || email.length > 200) return json(res, 400, { erro: "Informe um e-mail válido." });
    if (senha.length < 8 || senha.length > 200) return json(res, 400, { erro: "A senha deve ter pelo menos 8 caracteres." });
    if (b.termos !== true) return json(res, 400, { erro: "É preciso aceitar os Termos de uso." });

    if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) {
      return json(res, 409, { erro: "Este e-mail já está cadastrado." });
    }
    const info = db.prepare("INSERT INTO users (nome, email, senha_hash) VALUES (?, ?, ?)")
      .run(nome, email, hashSenha(senha));
    const { token, duracao } = criaSessao(Number(info.lastInsertRowid), false);
    setCookie(res, token, duracao);
    return json(res, 201, { ok: true });
  }

  if (rota === "/api/login") {
    if (limitado(ip + ":login")) return json(res, 429, { erro: "Muitas tentativas. Tente novamente em alguns minutos." });
    const b = await lerJson(req);
    const email = String(b.email || "").trim().toLowerCase();
    const senha = String(b.senha || "");
    const u = db.prepare("SELECT id, senha_hash FROM users WHERE email = ?").get(email);
    const ok = confereSenha(senha, u ? u.senha_hash : DUMMY_HASH) && !!u;
    if (!ok) return json(res, 401, { erro: "E-mail ou senha incorretos." });
    const { token, duracao } = criaSessao(u.id, b.lembrar === true);
    // "Lembrar de mim" desmarcado: cookie de sessão (some ao fechar o navegador)
    setCookie(res, token, b.lembrar === true ? duracao : null);
    return json(res, 200, { ok: true });
  }

  if (rota === "/api/logout") {
    const token = cookies(req).sid;
    if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
    setCookie(res, "", 0);
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { erro: "Rota não encontrada." });
}

/* ---------- Arquivos estáticos ---------- */
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};

function estatico(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { res.writeHead(400); return res.end(); }
  if (rel === "/") rel = "/index.html";
  const arquivo = path.normalize(path.join(PUBLIC_DIR, rel));
  if (arquivo !== PUBLIC_DIR && !arquivo.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(arquivo, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Página não encontrada.");
    }
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(arquivo).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(arquivo).pipe(res);
  });
}

/* ---------- Servidor ---------- */
const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  try {
    if (pathname.startsWith("/api/")) return await api(req, res, pathname);
    return estatico(req, res, pathname);
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (!res.headersSent) json(res, status, { erro: status === 500 ? "Erro interno do servidor." : e.message });
  }
});

// Limpa sessões vencidas a cada hora
setInterval(() => db.prepare("DELETE FROM sessions WHERE expira_em < ?").run(Date.now()), 3600 * 1000).unref();

server.listen(PORT, () => console.log(`Legacy Exoticus rodando em http://localhost:${PORT}`));
