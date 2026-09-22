import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const currentDir = process.cwd();
const DATA_DIR = path.join(currentDir, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Persistent File-Backed Database Schema
interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

interface StoredDb {
  users: StoredUser[];
  strategies: any[];
  tokens: Record<string, string>; // token -> userId
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

function initDb(): StoredDb {
  const salt1 = crypto.randomBytes(16).toString("hex");
  const salt2 = crypto.randomBytes(16).toString("hex");

  const initialUsers: StoredUser[] = [
    {
      id: "user-trader-1",
      name: "Carlos Silva (Trader B3)",
      email: "trader1@b3.com.br",
      passwordHash: hashPassword("senha123", salt1),
      salt: salt1,
      createdAt: new Date().toISOString(),
    },
    {
      id: "user-trader-2",
      name: "Mariana Costa (Opções Pro)",
      email: "trader2@b3.com.br",
      passwordHash: hashPassword("senha123", salt2),
      salt: salt2,
      createdAt: new Date().toISOString(),
    },
  ];

  const initialStrategies = [
    {
      id: "pos-user1-petr4",
      userId: "user-trader-1",
      name: "Venda Coberta Mensal PETR4",
      ticker: "PETR4",
      spotPriceAtEntry: 37.8,
      initialNetCashflow: -36650.0,
      currentNetValue: -36100.0,
      unrealizedPnL: 550.0,
      targetProfit: 1150.0,
      stopLoss: -1500.0,
      lastUpdated: new Date().toISOString(),
      legs: [
        {
          id: "l1",
          type: "STOCK",
          side: "BUY",
          strike: 37.8,
          premium: 37.8,
          currentPrice: 38.1,
          quantity: 1000,
          daysToExpiry: 0,
          ticker: "PETR4",
          exerciseStyle: "AMERICAN",
        },
        {
          id: "l2",
          type: "CALL",
          side: "SELL",
          strike: 39.0,
          premium: 1.15,
          currentPrice: 0.6,
          quantity: 1000,
          daysToExpiry: 14,
          ticker: "PETRJ390",
          exerciseStyle: "AMERICAN",
        },
      ],
      createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
      status: "OPEN",
      notes: "Lançamento coberto para capturar taxa com objetivo de exercício ou rolagem em caso de alta moderada.",
      history: [
        { date: "Dia 0 (Entrada)", spotPrice: 37.8, strategyValue: -36650, unrealizedPnL: 0, roiPercent: 0 },
        { date: "Dia 3", spotPrice: 37.6, strategyValue: -36500, unrealizedPnL: 150, roiPercent: 0.41 },
        { date: "Dia 5", spotPrice: 37.95, strategyValue: -36320, unrealizedPnL: 330, roiPercent: 0.9 },
        { date: "Hoje (Atual)", spotPrice: 38.1, strategyValue: -36100, unrealizedPnL: 550, roiPercent: 1.5 },
      ],
    },
    {
      id: "pos-user2-vale3",
      userId: "user-trader-2",
      name: "Trava de Alta com CALL em VALE3",
      ticker: "VALE3",
      spotPriceAtEntry: 61.5,
      initialNetCashflow: -675.0,
      currentNetValue: -325.0,
      unrealizedPnL: 350.0,
      targetProfit: 1325.0,
      stopLoss: -400.0,
      lastUpdated: new Date().toISOString(),
      legs: [
        {
          id: "l3",
          type: "CALL",
          side: "BUY",
          strike: 62.0,
          premium: 2.1,
          currentPrice: 2.45,
          quantity: 500,
          daysToExpiry: 12,
          ticker: "VALEJ620",
          exerciseStyle: "AMERICAN",
        },
        {
          id: "l4",
          type: "CALL",
          side: "SELL",
          strike: 66.0,
          premium: 0.75,
          currentPrice: 0.7,
          quantity: 500,
          daysToExpiry: 12,
          ticker: "VALEJ660",
          exerciseStyle: "AMERICAN",
        },
      ],
      createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
      status: "OPEN",
      notes: "Tese de recuperação de curto prazo na Vale com risco travado na diferença dos prêmios.",
      history: [
        { date: "Dia 0 (Entrada)", spotPrice: 61.5, strategyValue: -675, unrealizedPnL: 0, roiPercent: 0 },
        { date: "Dia 4", spotPrice: 60.8, strategyValue: -750, unrealizedPnL: -75, roiPercent: -11.1 },
        { date: "Hoje (Atual)", spotPrice: 62.4, strategyValue: -325, unrealizedPnL: 350, roiPercent: 51.8 },
      ],
    },
  ];

  const db: StoredDb = {
    users: initialUsers,
    strategies: initialStrategies,
    tokens: {},
  };

  saveDb(db);
  return db;
}

function loadDb(): StoredDb {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.strategies)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Erro ao ler db.json, inicializando banco padrão:", err);
  }
  return initDb();
}

function saveDb(data: StoredDb) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = path.join(DATA_DIR, `db.tmp.${Date.now()}.${Math.random().toString(36).substr(2, 4)}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error("Erro ao salvar db.json atomicamente:", err);
  }
}

// In-memory cache for high-speed responsiveness
const apiCache = new Map<string, { data: any; expiry: number }>();
function getCached(key: string) {
  const item = apiCache.get(key);
  if (item && item.expiry > Date.now()) return item.data;
  return null;
}
function setCached(key: string, data: any, ttlMs = 45000) {
  apiCache.set(key, { data, expiry: Date.now() + ttlMs });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Market API: Get Option Details by symbol
  app.get("/api/oplab/option/:symbol", async (req, res) => {
    const symbol = (req.params.symbol || "").trim().toUpperCase();
    const cacheKey = `opt:${symbol}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const token = process.env.OPLAB_ACCESS_TOKEN;

    if (token && token.length > 5) {
      try {
        const oplabUrl = `https://api.oplab.com.br/v3/market/options/details/${encodeURIComponent(symbol)}`;
        const response = await fetch(oplabUrl, {
          headers: {
            "Access-Token": token,
            "Accept": "application/json",
          },
          signal: AbortSignal.timeout(3500),
        });

        if (response.ok) {
          const data = await response.json();
          const result = {
            success: true,
            source: "market_api",
            data: {
              symbol: data.symbol || symbol,
              name: data.name || symbol,
              parentSymbol: data.parent_symbol || guessParentSymbol(symbol),
              category: (data.category || data.type || (isCallLetter(symbol[4]) ? "CALL" : "PUT")).toUpperCase(),
              maturityType: (data.maturity_type || (isCallLetter(symbol[4]) ? "AMERICAN" : "EUROPEAN")).toUpperCase(),
              strike: Number(data.strike || 0),
              spotPrice: Number(data.spot_price || 0),
              close: Number(data.close || data.bid || data.ask || 0),
              bid: Number(data.bid || 0),
              ask: Number(data.ask || 0),
              daysToMaturity: Number(data.days_to_maturity || 0),
              dueDate: data.due_date,
              volume: Number(data.volume || 0),
              financialVolume: Number(data.financial_volume || 0),
              variation: Number(data.variation || 0),
            },
          };
          setCached(cacheKey, result, 60000);
          return res.json(result);
        }
      } catch (_err) {
        // Fallback to high-fidelity B3 parser gracefully
      }
    }

    // High-fidelity B3 Option Code Parser & Estimator Fallback (Instant 0ms)
    const parsed = parseB3OptionTicker(symbol);
    const result = {
      success: true,
      source: "b3_parser",
      isLive: false,
      data: parsed,
    };
    setCached(cacheKey, result, 30000);
    return res.json(result);
  });

  // Market API: Get Instrument Quotes (multiple tickers)
  app.get("/api/oplab/quote", async (req, res) => {
    const tickers = String(req.query.tickers || "").trim().toUpperCase();
    const cacheKey = `quote:${tickers}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const token = process.env.OPLAB_ACCESS_TOKEN;

    if (token && token.length > 5 && tickers) {
      try {
        const oplabUrl = `https://api.oplab.com.br/v3/market/quote?tickers=${encodeURIComponent(tickers)}`;
        const response = await fetch(oplabUrl, {
          headers: {
            "Access-Token": token,
            "Accept": "application/json",
          },
          signal: AbortSignal.timeout(3500),
        });

        if (response.ok) {
          const quotes = await response.json();
          const result = {
            success: true,
            source: "market_api",
            data: quotes,
          };
          setCached(cacheKey, result, 30000);
          return res.json(result);
        }
      } catch (_err) {
        // Fallback to B3 estimator gracefully
      }
    }

    // Fallback: estimate quotes for requested tickers (Instant)
    const tickerList = tickers.split(",").map((t) => t.trim()).filter(Boolean);
    const simulatedQuotes = tickerList.map((t) => {
      const parsed = parseB3OptionTicker(t);
      return {
        symbol: t,
        close: parsed.close,
        bid: parsed.bid,
        ask: parsed.ask,
        strike: parsed.strike,
        spotPrice: parsed.spotPrice,
        variation: 0,
        time: Date.now(),
      };
    });

    const result = {
      success: true,
      source: "b3_estimator",
      data: simulatedQuotes,
    };
    setCached(cacheKey, result, 30000);
    return res.json(result);
  });

  // Market API: Search instruments
  app.get("/api/oplab/search", async (req, res) => {
    const expr = String(req.query.expr || "").trim().toUpperCase();
    const cacheKey = `search:${expr}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const token = process.env.OPLAB_ACCESS_TOKEN;

    if (token && token.length > 5 && expr) {
      try {
        const oplabUrl = `https://api.oplab.com.br/v3/market/instruments/search?expr=${encodeURIComponent(expr)}&limit=10&type=OPTION,STOCK`;
        const response = await fetch(oplabUrl, {
          headers: {
            "Access-Token": token,
            "Accept": "application/json",
          },
          signal: AbortSignal.timeout(3500),
        });

        if (response.ok) {
          const results = await response.json();
          const resPayload = {
            success: true,
            source: "market_api",
            data: results,
          };
          setCached(cacheKey, resPayload, 60000);
          return res.json(resPayload);
        }
      } catch (_err) {
        // Fallback to local suggestions gracefully
      }
    }

    // Fallback local search suggestions (Instant)
    const resPayload = {
      success: true,
      source: "local",
      data: [
        { symbol: `${expr}4`, type: "STOCK", description: `${expr} PN` },
        { symbol: `${expr}3`, type: "STOCK", description: `${expr} ON` },
        { symbol: `${expr}J380`, type: "CALL", description: `${expr} CALL Outubro K=38.00` },
        { symbol: `${expr}V380`, type: "PUT", description: `${expr} PUT Outubro K=38.00` },
      ],
    };
    setCached(cacheKey, resPayload, 60000);
    return res.json(resPayload);
  });

  // AI Market Scenario Analysis for B3 Options
  app.post("/api/gemini/analyze-scenario", async (req, res) => {
    try {
      const {
        ticker = "PETR4",
        spotPrice = 38.5,
        strategyName = "Estratégia Personalizada",
        legs = [],
        scenarioDescription = "",
        interestRate = 0.1325, // Selic / CDI
      } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        // Fallback intelligent quantitative response if key is not configured yet
        return res.json({
          source: "deterministic_engine",
          analysis: generateDeterministicAnalysis(ticker, spotPrice, strategyName, legs, scenarioDescription, interestRate)
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const prompt = `Você é um especialista sênior em derivativos e opções de ações da B3 (mercado financeiro brasileiro), com profundo conhecimento das regras da B3 (exercício automático, americanas vs europeias, margem pelo sistema CORE B3, impacto da taxa Selic/CDI alta e liquidez no Brasil).

Analise o seguinte cenário para a estrutura de opções do investidor:
- Ativo-Objeto: ${ticker} (Preço Spot atual: R$ ${spotPrice.toFixed(2)})
- Estratégia Montada: ${strategyName}
- Pernas da Operação: ${JSON.stringify(legs, null, 2)}
- Taxa Selic/CDI de referência: ${(interestRate * 100).toFixed(2)}% a.a.
- Cenário de Mercado Solicitado: "${scenarioDescription || "Cenário de estresse de mercado (alta/baixa de 10% com variação de volatilidade e passagem do tempo)"}"

Forneça uma resposta detalhada em Português do Brasil com:
1. 🎯 **Impacto no Payoff e Gregas**: Como o cenário afeta o Delta, Gamma, Theta (efeito DU 252) e Vega da posição.
2. ⚠️ **Riscos Críticos na B3**: Risco de cauda, chamada de margem no sistema CORE B3 (se houver pernas vendidas a seco ou travas), risco de exercício antecipado (atenção: Calls na B3 costumam ser de estilo americano, Puts quase sempre europeias).
3. 🔄 **Alternativas de Rolagem e Manejo**: Se o mercado se mover contra a posição, qual é o protocolo de rolagem recomendado na B3 (rolagem no tempo série atual para a seguinte, ajuste de strike para crédito, desmonte parcial, ou montagem de asa de proteção).
4. 💡 **Dica Prática para o Investidor**: Regra de ouro de stop loss e gestão de capital para esta operação específica.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
      });

      return res.json({
        source: "gemini_ai",
        analysis: response.text || "Análise concluída com sucesso.",
      });
    } catch (error: any) {
      console.error("Erro na análise de cenário:", error);
      res.status(500).json({
        error: "Falha ao processar análise com IA",
        details: error?.message || String(error),
      });
    }
  });

  // ==========================================
  // MULTI-USER AUTHENTICATION & PRIVATE STRATEGY STORAGE
  // ==========================================

  // Authentication Middleware
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Não autorizado: Sessão não encontrada." });
    }
    const token = authHeader.substring(7).trim();
    const db = loadDb();
    const userId = db.tokens ? db.tokens[token] : null;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Sessão expirada ou inválida. Por favor, faça login." });
    }
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      return res.status(401).json({ success: false, error: "Usuário não encontrado." });
    }
    (req as any).user = {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
    next();
  };

  // Auth: Register new user
  app.post("/api/auth/register", (req, res) => {
    try {
      const { name, email, password } = req.body || {};
      if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: "Nome, e-mail e senha são obrigatórios." });
      }
      if (password.length < 5) {
        return res.status(400).json({ success: false, error: "A senha deve ter pelo menos 5 caracteres." });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const db = loadDb();

      if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
        return res.status(400).json({ success: false, error: "Já existe uma conta cadastrada com este e-mail." });
      }

      const salt = crypto.randomBytes(16).toString("hex");
      const passwordHash = hashPassword(password, salt);
      const newUser: StoredUser = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash,
        salt,
        createdAt: new Date().toISOString(),
      };

      const token = `b3_${newUser.id}_${crypto.randomBytes(24).toString("hex")}`;
      db.users.push(newUser);
      if (!db.tokens) db.tokens = {};
      db.tokens[token] = newUser.id;

      saveDb(db);

      return res.json({
        success: true,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          createdAt: newUser.createdAt,
        },
        token,
      });
    } catch (err: any) {
      console.error("Erro no registro:", err);
      return res.status(500).json({ success: false, error: "Falha interna no registro de usuário." });
    }
  });

  // Auth: Login existing user
  app.post("/api/auth/login", (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ success: false, error: "E-mail e senha são obrigatórios." });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const db = loadDb();
      const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);

      if (!user) {
        return res.status(401).json({ success: false, error: "E-mail ou senha incorretos." });
      }

      const attemptHash = hashPassword(password, user.salt);
      if (attemptHash !== user.passwordHash) {
        return res.status(401).json({ success: false, error: "E-mail ou senha incorretos." });
      }

      const token = `b3_${user.id}_${crypto.randomBytes(24).toString("hex")}`;
      if (!db.tokens) db.tokens = {};
      db.tokens[token] = user.id;
      saveDb(db);

      return res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
        token,
      });
    } catch (err: any) {
      console.error("Erro no login:", err);
      return res.status(500).json({ success: false, error: "Falha interna ao autenticar usuário." });
    }
  });

  // Auth: Social Login & Register (Google / iCloud / Apple)
  app.post("/api/auth/social", (req, res) => {
    try {
      const { provider, email, name } = req.body || {};
      const prov = String(provider || "").toLowerCase();
      if (!prov || !["google", "icloud", "apple"].includes(prov)) {
        return res.status(400).json({ success: false, error: "Provedor social inválido." });
      }

      const provLabel = prov === "google" ? "Google" : "iCloud";
      const normalizedEmail =
        email && String(email).includes("@")
          ? String(email).trim().toLowerCase()
          : `operador.${prov === "google" ? "google" : "icloud"}@${prov === "google" ? "gmail.com" : "icloud.com"}`;
      const displayName =
        name && String(name).trim()
          ? String(name).trim()
          : `Operador ${provLabel}`;

      const db = loadDb();
      let user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);

      if (!user) {
        const salt = crypto.randomBytes(16).toString("hex");
        const passwordHash = hashPassword(crypto.randomBytes(24).toString("hex"), salt);
        user = {
          id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          name: displayName,
          email: normalizedEmail,
          passwordHash,
          salt,
          createdAt: new Date().toISOString(),
        };
        db.users.push(user);
      } else if (name && String(name).trim()) {
        user.name = String(name).trim();
      }

      const token = `b3_${user.id}_${crypto.randomBytes(24).toString("hex")}`;
      if (!db.tokens) db.tokens = {};
      db.tokens[token] = user.id;
      saveDb(db);

      return res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
        token,
      });
    } catch (_err) {
      return res.status(500).json({ success: false, error: "Falha na autenticação social." });
    }
  });

  // Auth: Get current logged-in user profile
  app.get("/api/auth/me", requireAuth, (req, res) => {
    return res.json({
      success: true,
      user: (req as any).user,
    });
  });

  // Auth: Logout
  app.post("/api/auth/logout", requireAuth, (req, res) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.substring(7).trim();
    const db = loadDb();
    if (db.tokens && db.tokens[token]) {
      delete db.tokens[token];
      saveDb(db);
    }
    return res.json({ success: true, message: "Desconectado com sucesso." });
  });

  // Strategies: Get ONLY strategies for current authenticated user (STRICT ISOLATION)
  app.get("/api/strategies", requireAuth, (req, res) => {
    try {
      const userId = (req as any).user.id;
      const db = loadDb();
      const userStrategies = db.strategies.filter((s) => s.userId === userId);
      return res.json({
        success: true,
        data: userStrategies,
      });
    } catch (err: any) {
      console.error("Erro ao listar estratégias do usuário:", err);
      return res.status(500).json({ success: false, error: "Falha ao carregar estratégias." });
    }
  });

  // Strategies: Create a new strategy for current authenticated user
  app.post("/api/strategies", requireAuth, (req, res) => {
    try {
      const userId = (req as any).user.id;
      const db = loadDb();
      const payload = req.body;

      if (!payload || !payload.name) {
        return res.status(400).json({ success: false, error: "Nome da estratégia é obrigatório." });
      }

      const newStrategy = {
        ...payload,
        id: payload.id || `pos-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        userId,
        createdAt: payload.createdAt || new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      // If already exists with same ID for this user, replace it, else push
      const existingIdx = db.strategies.findIndex((s) => s.id === newStrategy.id && s.userId === userId);
      if (existingIdx >= 0) {
        db.strategies[existingIdx] = newStrategy;
      } else {
        db.strategies.unshift(newStrategy);
      }

      saveDb(db);
      return res.json({
        success: true,
        data: newStrategy,
      });
    } catch (err: any) {
      console.error("Erro ao salvar estratégia:", err);
      return res.status(500).json({ success: false, error: "Falha ao salvar estratégia no banco de dados." });
    }
  });

  // Strategies: Update strategy for current authenticated user
  app.put("/api/strategies/:id", requireAuth, (req, res) => {
    try {
      const userId = (req as any).user.id;
      const id = req.params.id;
      const db = loadDb();

      const idx = db.strategies.findIndex((s) => s.id === id && s.userId === userId);
      if (idx === -1) {
        return res.status(404).json({ success: false, error: "Estratégia não encontrada para este usuário." });
      }

      const updated = {
        ...db.strategies[idx],
        ...req.body,
        id,
        userId, // Never allow changing ownership!
        lastUpdated: new Date().toISOString(),
      };

      db.strategies[idx] = updated;
      saveDb(db);

      return res.json({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      console.error("Erro ao atualizar estratégia:", err);
      return res.status(500).json({ success: false, error: "Falha ao atualizar estratégia." });
    }
  });

  // Strategies: Delete strategy for current authenticated user
  app.delete("/api/strategies/:id", requireAuth, (req, res) => {
    try {
      const userId = (req as any).user.id;
      const id = req.params.id;
      const db = loadDb();

      const idx = db.strategies.findIndex((s) => s.id === id && s.userId === userId);
      if (idx === -1) {
        return res.status(404).json({ success: false, error: "Estratégia não encontrada para este usuário." });
      }

      db.strategies.splice(idx, 1);
      saveDb(db);

      return res.json({
        success: true,
        message: "Estratégia excluída com sucesso.",
      });
    } catch (err: any) {
      console.error("Erro ao excluir estratégia:", err);
      return res.status(500).json({ success: false, error: "Falha ao excluir estratégia." });
    }
  });

  // Strategies: Bulk sync (merges local/offline strategies into user's account)
  app.post("/api/strategies/bulk-sync", requireAuth, (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { strategies = [] } = req.body;
      const db = loadDb();

      let addedCount = 0;
      strategies.forEach((st: any) => {
        if (!st.id) return;
        const exists = db.strategies.some((s) => s.id === st.id && s.userId === userId);
        if (!exists) {
          db.strategies.unshift({
            ...st,
            userId,
            lastUpdated: new Date().toISOString(),
          });
          addedCount++;
        }
      });

      if (addedCount > 0) {
        saveDb(db);
      }

      const finalUserStrategies = db.strategies.filter((s) => s.userId === userId);
      return res.json({
        success: true,
        syncedCount: addedCount,
        total: finalUserStrategies.length,
        data: finalUserStrategies,
      });
    } catch (err: any) {
      console.error("Erro na sincronização de estratégias:", err);
      return res.status(500).json({ success: false, error: "Falha ao sincronizar estratégias." });
    }
  });

  // Strategies: Export backup as JSON
  app.get("/api/strategies/export", requireAuth, (req, res) => {
    const userId = (req as any).user.id;
    const db = loadDb();
    const userStrategies = db.strategies.filter((s) => s.userId === userId);
    return res.json({
      exportDate: new Date().toISOString(),
      user: (req as any).user,
      strategiesCount: userStrategies.length,
      strategies: userStrategies,
    });
  });

  // Production static serving vs Vite dev server
  const distPath = path.join(process.cwd(), "dist");
  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(path.join(distPath, "index.html"));

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor de Opções B3 ativo em http://0.0.0.0:${PORT}`);
  });
}

function generateDeterministicAnalysis(
  ticker: string,
  spotPrice: number,
  strategyName: string,
  legs: any[],
  scenario: string,
  interestRate: number
) {
  const hasSoldCalls = legs.some((l: any) => l.type === "CALL" && l.side === "SELL");
  const hasSoldPuts = legs.some((l: any) => l.type === "PUT" && l.side === "SELL");
  const netDelta = legs.reduce((acc: number, l: any) => {
    const sign = l.side === "BUY" ? 1 : -1;
    const typeFactor = l.type === "CALL" ? 0.5 : -0.5;
    return acc + sign * typeFactor * (l.quantity || 100);
  }, 0);

  return `### Análise Técnica Quantitativa para ${ticker} (${strategyName})

**Cenário Analisado:** ${scenario || "Estresse geral de mercado"}
- **Preço Spot Base:** R$ ${spotPrice.toFixed(2)} | **Taxa Selic Base:** ${(interestRate * 100).toFixed(2)}% a.a.

1. **Impacto Estrutural e Gregas:**
   - **Delta Direcional:** A posição apresenta exposição ${netDelta > 50 ? "altista (Delta Positivo)" : netDelta < -50 ? "baixista (Delta Negativo)" : "neutra/lateral (Delta Delta-Hedge)"}. Movimentos rápidos no ativo base impactarão o P&L não-linearmente devido ao Gamma das opções ATM.
   - **Theta (Decaimento Temporal):** Na B3, o decaimento é calculado sobre dias úteis (base 252). Pernas vendidas colhem valor extrínseco continuamente, com aceleração nas últimas 2 semanas do vencimento.
   - **Vega:** Em momentos de estresse de mercado, o aumento da volatilidade implícita (IV Spike) beneficia quem está comprado em volatilidade (Straddles, Travas de Débito) e penaliza vendas curtas.

2. **Riscos e Sistema de Margem CORE B3:**
   ${hasSoldCalls ? "⚠️ **Atenção à Venda de CALLs:** Se as Calls não forem 100% cobertas pelas ações em custódia na corretora, a B3 exigirá margem dinâmica substancial no sistema CORE B3. Lembre-se que as Calls líquidas da B3 (como Petrobras e Vale) são de estilo Americano, sujeitas a exercício antecipado a qualquer momento se ficarem deep ITM." : "✅ Sem risco de chamada de margem excessiva por venda descoberta de CALL."}
   ${hasSoldPuts ? "⚠️ **Venda de PUTs:** Na B3, as PUTs são em sua quase totalidade de estilo Europeu (exercício somente no dia do vencimento). Tenha disponível garantia alocada (Tesouro Selic ou CDB com liquidez diária) para suportar o nocional total de exercício." : ""}

3. **Diretrizes de Rolagem e Manejo na B3:**
   - **Regra dos 50% de Lucro:** Se a operação capturar mais de 50% do prêmio máximo em menos de metade do tempo, considere o fechamento antecipado para eliminar risco residual de cauda.
   - **Rolagem para Crédito:** Se for necessário defender a posição contra a tendência, execute a rolagem para a série seguinte (exemplo: série A para B nas Calls, ou M para N nas Puts), mantendo o strike ou rolando no tempo sempre obtendo crédito líquido financeiro.`;
}

function isCallLetter(letter: string): boolean {
  if (!letter) return true;
  const upper = letter.toUpperCase();
  return upper >= "A" && upper <= "L";
}

function guessParentSymbol(ticker: string): string {
  const clean = ticker.trim().toUpperCase();
  if (clean.startsWith("BOVA")) return "BOVA11";
  if (clean.startsWith("PETR")) return "PETR4";
  if (clean.startsWith("VALE")) return "VALE3";
  if (clean.startsWith("ITUB")) return "ITUB4";
  if (clean.startsWith("BBDC")) return "BBDC4";
  if (clean.startsWith("BBAS")) return "BBAS3";
  if (clean.startsWith("MGLU")) return "MGLU3";
  if (clean.startsWith("WEGE")) return "WEGE3";
  if (clean.startsWith("PRIO")) return "PRIO3";
  if (clean.startsWith("ABEV")) return "ABEV3";
  const prefix = clean.slice(0, 4);
  return `${prefix}4`;
}

function parseB3OptionTicker(symbol: string) {
  const clean = symbol.trim().toUpperCase();
  
  // Stock check
  if (/^[A-Z]{4}\d{1,2}$/.test(clean)) {
    const baseSpot = getApproximateSpotPrice(clean);
    return {
      symbol: clean,
      name: `${clean} Ação à Vista`,
      parentSymbol: clean,
      category: "STOCK",
      maturityType: "AMERICAN",
      strike: baseSpot,
      spotPrice: baseSpot,
      close: baseSpot,
      bid: Math.round((baseSpot - 0.02) * 100) / 100,
      ask: Math.round((baseSpot + 0.02) * 100) / 100,
      daysToMaturity: 0,
      dueDate: null,
      volume: 500000,
      financialVolume: 500000 * baseSpot,
      variation: 0,
    };
  }

  // Options format: [XXXX][M][0-9...]
  const match = clean.match(/^([A-Z]{4})([A-X])(\d{1,4})$/);
  const parent = guessParentSymbol(clean);
  const spot = getApproximateSpotPrice(parent);

  if (!match) {
    return {
      symbol: clean,
      name: clean,
      parentSymbol: parent,
      category: "CALL",
      maturityType: "AMERICAN",
      strike: spot,
      spotPrice: spot,
      close: 1.0,
      bid: 0.98,
      ask: 1.02,
      daysToMaturity: 22,
      dueDate: getNext3rdFriday(new Date()),
      volume: 10000,
      financialVolume: 10000,
      variation: 0,
    };
  }

  const [, , monthLetter, strikeDigits] = match;
  const isCall = isCallLetter(monthLetter);
  const category = isCall ? "CALL" : "PUT";
  const maturityType = isCall ? "AMERICAN" : "EUROPEAN";

  // Parse strike from digits (e.g. 385 -> 38.50, 38 -> 38.00, 130 -> 130.00)
  let rawStrike = parseInt(strikeDigits, 10);
  let strike = rawStrike;
  if (spot < 10 && rawStrike > 50) {
    strike = rawStrike / 10;
  } else if (spot >= 10 && spot < 100) {
    if (rawStrike >= 100 && rawStrike < 1000) {
      strike = rawStrike / 10;
    } else if (rawStrike >= 1000) {
      strike = rawStrike / 100;
    }
  }

  // Calculate expiration month (1 to 12)
  const callLetters = "ABCDEFGHIJKL";
  const putLetters = "MNOPQRSTUVWX";
  const monthIndex = isCall ? callLetters.indexOf(monthLetter) : putLetters.indexOf(monthLetter);
  
  const now = new Date();
  let expiryYear = now.getFullYear();
  if (monthIndex < now.getMonth()) {
    expiryYear += 1;
  }
  const dueDate = get3rdFriday(expiryYear, monthIndex);
  const daysToMaturity = Math.max(1, Math.round((dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24)));

  // Approximate theoretical premium
  const moneyness = isCall ? spot - strike : strike - spot;
  const intrinsic = Math.max(0, moneyness);
  const timeValue = Math.max(0.05, Math.round(spot * 0.03 * Math.sqrt(daysToMaturity / 22) * 100) / 100);
  const close = Math.round((intrinsic + timeValue) * 100) / 100;
  const bid = Math.max(0.01, Math.round((close - 0.04) * 100) / 100);
  const ask = Math.round((close + 0.04) * 100) / 100;

  return {
    symbol: clean,
    name: `${parent} ${category} K=${strike.toFixed(2)} (${dueDate.toISOString().slice(0, 10)})`,
    parentSymbol: parent,
    category,
    maturityType,
    strike,
    spotPrice: spot,
    close,
    bid,
    ask,
    daysToMaturity,
    dueDate: dueDate.toISOString().slice(0, 10),
    volume: 15400,
    financialVolume: Math.round(15400 * close),
    variation: 0,
  };
}

function getApproximateSpotPrice(ticker: string): number {
  const map: Record<string, number> = {
    PETR4: 48.2,
    PETR3: 51.5,
    VALE3: 72.5,
    BOVA11: 184.2,
    ITUB4: 43.3,
    BBDC4: 18.4,
    BBAS3: 22.5,
    MGLU3: 9.4,
    WEGE3: 54.2,
    PRIO3: 42.1,
    ABEV3: 12.8,
  };
  return map[ticker.toUpperCase()] || 35.0;
}

function get3rdFriday(year: number, month: number): Date {
  const date = new Date(year, month, 1);
  let fridayCount = 0;
  while (date.getMonth() === month) {
    if (date.getDay() === 5) {
      fridayCount++;
      if (fridayCount === 3) return new Date(date);
    }
    date.setDate(date.getDate() + 1);
  }
  return new Date(year, month, 15);
}

function getNext3rdFriday(from: Date): string {
  let target = new Date(from.getFullYear(), from.getMonth(), 1);
  const thirdFriday = get3rdFriday(target.getFullYear(), target.getMonth());
  if (thirdFriday.getTime() <= from.getTime()) {
    target = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    return get3rdFriday(target.getFullYear(), target.getMonth()).toISOString().slice(0, 10);
  }
  return thirdFriday.toISOString().slice(0, 10);
}

startServer();

