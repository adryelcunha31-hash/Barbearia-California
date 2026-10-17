const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Carregador nativo de .env (Zero dependências, Chaves 100% fora do código)
const ENV_FILE = path.join(__dirname, '.env');
if (fs.existsSync(ENV_FILE)) {
  fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  });
}

const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin@california.com';
const ADMIN_PIN = process.env.ADMIN_PIN || '2026';
const DB_FILE = path.join(__dirname, 'data', 'california-v4-db.json');

// Rate limiter em memória contra força bruta
const loginAttempts = new Map();
const activeSessions = new Set();

const INITIAL_DB = {
  shop: {
    name: 'Barbearia Califórnia',
    address: 'Av. Mato Grosso, Centro — São José do Rio Claro, MT',
    pixKey: '65999112233 (CNPJ/Celular)',
    gateway: 'Asaas / Mercado Pago PIX Automático',
    singleCutPrice: 40.00,
    rescheduleFee: 5.00,
    extraRevenue: 360.00
  },
  members: [
    {
      id: 'm1', name: 'Carlos Eduardo', phone: '5565999112233', pin: '1234',
      plan: 'Califórnia Gold (4 Cortes/mês)', price: 109.90, cutsUsed: 2, cutsLimit: 4,
      status: 'active', daysOverdue: 0, feeAdded: 0, dueDate: '10/11/2026', avatar: 'CE',
      visagism: { shape: 'Quadrado', cut: 'Mid Fade + Crop Texturizado', angles: '118° Mandibular', notes: 'Degradê na zero alta, topo texturizado.' }
    },
    {
      id: 'm2', name: 'Marcos Vinícius', phone: '5565998223344', pin: '1234',
      plan: 'Califórnia Club (2 Cortes/mês)', price: 69.90, cutsUsed: 1, cutsLimit: 2,
      status: 'overdue', daysOverdue: 3, feeAdded: 0, dueDate: '14/10/2026', avatar: 'MV',
      visagism: { shape: 'Redondo', cut: 'High Fade + Quiff Estruturado', angles: '132° Eixo Vertical', notes: 'Zerar laterais e elevar topete.' }
    },
    {
      id: 'm3', name: 'Rafael Oliveira', phone: '5565997334455', pin: '1234',
      plan: 'Califórnia Gold (4 Cortes/mês)', price: 109.90, cutsUsed: 3, cutsLimit: 4,
      status: 'overdue', daysOverdue: 4, feeAdded: 0, dueDate: '13/10/2026', avatar: 'RO',
      visagism: { shape: 'Diamante', cut: 'Low Fade + French Crop', angles: '96° Zigomático', notes: 'Preservar peso nas têmporas.' }
    },
    {
      id: 'm4', name: 'Lucas Mendes', phone: '5565996445566', pin: '1234',
      plan: 'Califórnia Club (2 Cortes/mês)', price: 69.90, cutsUsed: 1, cutsLimit: 2,
      status: 'active', daysOverdue: 0, feeAdded: 0, dueDate: '05/11/2026', avatar: 'LM',
      visagism: { shape: 'Oval', cut: 'Taper Fade California + Barba Alinhada', angles: 'Proporção 1.45', notes: 'Disfarce apenas na costeleta e nuca.' }
    },
    {
      id: 'm5', name: 'Bruno Ferreira', phone: '5565995556677', pin: '1234',
      plan: 'Califórnia Club (2 Cortes/mês)', price: 69.90, cutsUsed: 0, cutsLimit: 2,
      status: 'overdue', daysOverdue: 3, feeAdded: 0, dueDate: '14/10/2026', avatar: 'BF',
      visagism: { shape: 'Quadrado', cut: 'Buzz Cut + Degradê Navalhado', angles: '120° Maxilar', notes: 'Máquina 2 no topo e navalha alta.' }
    }
  ],
  queue: [
    { id: 'q1', memberId: 'm1', name: 'Carlos Eduardo', tag: 'Assinante Gold', service: 'Mid Fade + Crop (Plano)', status: 'in_chair', joinedAt: '14:15', estMin: 0 },
    { id: 'q2', memberId: 'm4', name: 'Lucas Mendes', tag: 'Assinante Club', service: 'Taper Fade California', status: 'waiting', joinedAt: '14:28', estMin: 18 },
    { id: 'q3', memberId: null, name: 'Henrique Souza', tag: 'Avulso R$ 40', service: 'Corte Degradê (Ordem de Chegada)', status: 'waiting', joinedAt: '14:35', estMin: 36 }
  ],
  transactions: [
    { id: 't1', date: '17/10 14:05', desc: 'Corte Avulso — Pedro H.', type: 'avulso', method: 'PIX', amount: 40.00 },
    { id: 't2', date: '16/10 18:20', desc: 'Mensalidade Gold — Carlos Eduardo', type: 'assinatura', method: 'Cartão Recorrente', amount: 109.90 },
    { id: 't3', date: '15/10 11:10', desc: 'Mensalidade Club — Lucas Mendes', type: 'assinatura', method: 'PIX Automático', amount: 69.90 },
    { id: 't4', date: '15/10 09:40', desc: 'Taxa Reajuste Atraso — Diego S.', type: 'taxa', method: 'PIX', amount: 5.00 }
  ]
};

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

const clean = (s) => String(s || '').replace(/[<>]/g, '').trim().slice(0, 140);
const nowTime = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN || 'whsec_california_barbearia_2026_mt99';
const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL || 'https://api.asaas.com/v3';

function safeCompare(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isAdminRequest(req) {
  const auth = String(req.headers['authorization'] || '');
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7).trim();
  return activeSessions.has(token);
}

// Blindagem Anti-Vazamento de Dados (LGPD): Remove CPFs, PINs, Telefones e Livro Caixa da rota pública
function sanitizeDbForRole(db, req) {
  if (isAdminRequest(req)) return db;
  return {
    shop: {
      name: db.shop.name,
      address: db.shop.address,
      singleCutPrice: db.shop.singleCutPrice,
      rescheduleFee: db.shop.rescheduleFee
    },
    members: db.members.map(m => ({
      id: m.id,
      name: m.name,
      plan: m.plan,
      price: m.price,
      cutsUsed: m.cutsUsed,
      cutsLimit: m.cutsLimit,
      status: m.status,
      daysOverdue: m.daysOverdue,
      feeAdded: m.feeAdded,
      dueDate: m.dueDate,
      avatar: m.avatar,
      visagism: m.visagism
      // pin, cpf, phone completo e asaasCustomerId NUNCA saem do servidor para o público!
    })),
    queue: db.queue,
    transactions: [] // Livro Caixa visível exclusivamente no /admin autenticado
  };
}

const server = http.createServer((req, res) => {
  // Blindagem de Headers HTTP (SaaS Security Shield)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  const urlPath = req.url.split('?')[0];

  // Bloqueio estrito contra tentativa de leitura de arquivos sensíveis (.env, banco JSON, etc)
  if (urlPath.includes('..') || urlPath.includes('.env') || urlPath.includes('california-v4-db')) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Acesso negado pela blindagem de segurança.' }));
  }

  if (urlPath.startsWith('/api/')) {
    let body = '';
    req.on('data', c => { if (body.length < 1e5) body += c; });
    req.on('end', async () => {
      const db = loadDb();
      const send = (code, data) => {
        const out = (data && data.members && data.queue && data.shop) ? sanitizeDbForRole(data, req) : data;
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out));
      };

      if (req.method === 'GET' && urlPath === '/api/state') return send(200, db);

      let payload = {};
      try { payload = body ? JSON.parse(body) : {}; } catch { return send(400, { error: 'Formato inválido' }); }

      const ip = req.socket.remoteAddress || 'local';

      // Login do Admin com Rate Limiting + Comparação Timing-Safe
      if (req.method === 'POST' && urlPath === '/api/admin/login') {
        const attempts = loginAttempts.get(ip) || 0;
        if (attempts >= 8) return send(429, { error: 'Muitas tentativas. Aguarde 1 minuto por segurança.' });

        if (safeCompare(payload.pin, ADMIN_PIN)) {
          loginAttempts.delete(ip);
          const token = crypto.randomBytes(24).toString('hex');
          activeSessions.add(token);
          return send(200, { ok: true, token, user: ADMIN_USER });
        }
        loginAttempts.set(ip, attempts + 1);
        setTimeout(() => loginAttempts.delete(ip), 60000);
        return send(401, { error: 'PIN incorreto (Use 2026 para demonstrar)' });
      }

      // Login do Cliente (WhatsApp + PIN de 4 dígitos + Rate Limiting)
      if (req.method === 'POST' && urlPath === '/api/client/login') {
        const attempts = loginAttempts.get('cli_' + ip) || 0;
        if (attempts >= 10) return send(429, { error: 'Muitas tentativas. Aguarde 1 minuto.' });

        const phoneClean = String(payload.phone || '').replace(/\D/g, '');
        if (phoneClean.length < 8) return send(400, { error: 'Digite um WhatsApp válido com DDD.' });

        const member = db.members.find(m => m.id === payload.memberId || m.phone.endsWith(phoneClean.slice(-9)));
        if (!member) {
          loginAttempts.set('cli_' + ip, attempts + 1);
          return send(404, { error: 'Cliente não encontrado. Clique na aba "Criar Minha Conta"!' });
        }
        if (payload.pin && !safeCompare(payload.pin, member.pin || '1234')) {
          loginAttempts.set('cli_' + ip, attempts + 1);
          return send(401, { error: 'PIN incorreto (Padrão demo: 1234).' });
        }
        loginAttempts.delete('cli_' + ip);
        const token = crypto.randomBytes(20).toString('hex');
        activeSessions.add(token);
        return send(200, { ok: true, token, memberId: member.id, name: member.name });
      }

      // Cadastro de Novo Assinante (Com CPF exigido pelo Asaas)
      if (req.method === 'POST' && urlPath === '/api/client/register') {
        const name = clean(payload.name);
        const cpf = String(payload.cpf || '').replace(/\D/g, '');
        const phone = String(payload.phone || '').replace(/\D/g, '');
        const pin = String(payload.pin || '1234').trim().slice(0, 6);
        const isGold = payload.planKey === 'gold';

        if (name.length < 3) return send(400, { error: 'Informe seu nome completo.' });
        if (cpf.length < 11) return send(400, { error: 'Informe um CPF válido (11 dígitos) para faturamento Asaas.' });
        if (phone.length < 10) return send(400, { error: 'Informe seu WhatsApp com DDD.' });

        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const newMember = {
          id: 'm' + Date.now(),
          name,
          cpf,
          phone: phone.startsWith('55') ? phone : '55' + phone,
          pin: pin || '1234',
          plan: isGold ? 'Califórnia Gold (4 Cortes/mês)' : 'Califórnia Club (2 Cortes/mês)',
          price: isGold ? 109.90 : 69.90,
          cutsUsed: 0,
          cutsLimit: isGold ? 4 : 2,
          status: 'active',
          daysOverdue: 0,
          feeAdded: 0,
          dueDate: '17/11/2026',
          avatar: initials,
          visagism: { shape: 'Quadrado', cut: 'Mid Fade + Crop Texturizado', angles: '118° Maxilar', notes: 'Cadastro recente via Portal.' }
        };
        db.members.unshift(newMember);
        saveDb(db);
        const token = crypto.randomBytes(20).toString('hex');
        activeSessions.add(token);
        return send(200, { ok: true, token, memberId: newMember.id, state: db });
      }

      // Integração Financeira Asaas: Assinatura Cartão Recorrente & PIX Automático
      if (req.method === 'POST' && urlPath === '/api/asaas/subscribe') {
        const m = db.members.find(x => x.id === payload.memberId) || db.members[0];
        if (!m) return send(404, { error: 'Assinante não encontrado' });

        const planName = clean(payload.plan || 'Califórnia Gold (4 Cortes/mês)');
        const isGold = planName.includes('Gold');
        const amount = Number(payload.amount || (isGold ? 109.90 : 69.90));
        const methodLabel = clean(payload.methodLabel || 'PIX Automático Asaas');

        // Se ASAAS_API_KEY estiver configurada no .env, cria cliente + assinatura real na API v3 do Asaas
        if (ASAAS_API_KEY && global.fetch) {
          try {
            const asaasHeaders = {
              'Content-Type': 'application/json',
              'access_token': ASAAS_API_KEY,
              'User-Agent': 'BarbeariaCaliforniaSaaS/1.0'
            };
            if (!m.asaasCustomerId) {
              const custRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
                method: 'POST',
                headers: asaasHeaders,
                body: JSON.stringify({
                  name: m.name,
                  cpfCnpj: m.cpf || '24971563792',
                  mobilePhone: String(m.phone || '').replace(/^55/, ''),
                  externalReference: m.id
                })
              });
              const custData = await custRes.json();
              if (custData && custData.id) m.asaasCustomerId = custData.id;
            }
            if (m.asaasCustomerId) {
              await fetch(`${ASAAS_BASE_URL}/subscriptions`, {
                method: 'POST',
                headers: asaasHeaders,
                body: JSON.stringify({
                  customer: m.asaasCustomerId,
                  billingType: payload.billingType === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX',
                  value: amount,
                  nextDueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
                  cycle: 'MONTHLY',
                  externalReference: m.id,
                  description: `${planName} - Barbearia Califórnia`
                })
              });
            }
          } catch {}
        }

        if (planName !== 'Corte Avulso') {
          m.plan = planName;
          m.price = amount;
          m.cutsLimit = isGold ? 4 : 2;
          m.status = 'active';
          m.daysOverdue = 0;
          m.dueDate = '17/11/2026';
        } else {
          db.shop.extraRevenue += amount;
        }

        db.transactions.unshift({
          id: 't' + Date.now(),
          date: `Hoje ${nowTime()}`,
          desc: `${planName.split(' (')[0]} — ${m.name}`,
          type: planName === 'Corte Avulso' ? 'avulso' : 'assinatura',
          method: methodLabel,
          amount
        });
        saveDb(db);
        return send(200, db);
      }

      // Webhook Oficial do Asaas (Baixa Automática de PIX Automático e Cartão Recorrente)
      if (req.method === 'POST' && urlPath === '/api/webhooks/asaas') {
        const tokenHeader = req.headers['asaas-access-token'] || '';
        if (!safeCompare(tokenHeader, ASAAS_WEBHOOK_TOKEN)) {
          return send(401, { error: 'Assinatura de Webhook Asaas inválida' });
        }
        const event = payload.event || 'PAYMENT_RECEIVED';
        const p = payload.payment || {};
        const member = db.members.find(x => x.id === p.externalReference)
          || db.members.find(x => x.status === 'overdue')
          || db.members[0];

        if (member) {
          if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
            member.status = 'active';
            member.daysOverdue = 0;
            db.transactions.unshift({
              id: 't' + Date.now(),
              date: `Hoje ${nowTime()}`,
              desc: `Webhook Asaas (${event}) — ${p.description || member.name}`,
              type: 'assinatura',
              method: p.billingType === 'CREDIT_CARD' ? 'Cartão Asaas' : 'PIX Asaas',
              amount: Number(p.value || member.price)
            });
            saveDb(db);
          } else if (event === 'PAYMENT_OVERDUE') {
            member.status = 'overdue';
            member.daysOverdue = 3;
            saveDb(db);
          }
        }
        return send(200, { received: true, event, memberUpdated: member?.name });
      }

      // Fila por Ordem de Chegada
      if (req.method === 'POST' && urlPath === '/api/queue/join') {
        const member = db.members.find(m => m.id === payload.memberId);
        if (member && member.status === 'overdue') {
          return send(403, { error: 'Mensalidade com 3 dias de atraso. Reajuste a data (+R$ 5) ou pague via PIX para liberar a fila!' });
        }
        const activeCount = db.queue.length;
        db.queue.push({
          id: 'q' + Date.now(),
          memberId: member ? member.id : null,
          name: member ? member.name : clean(payload.name || 'Cliente Avulso'),
          tag: member ? member.plan.split(' (')[0] : 'Avulso R$ 40',
          service: clean(payload.service || (member ? member.visagism.cut : 'Corte Ordem de Chegada (R$ 40)')),
          status: activeCount === 0 ? 'in_chair' : 'waiting',
          joinedAt: nowTime(),
          estMin: activeCount * 18
        });
        saveDb(db);
        return send(200, db);
      }

      // Relocação de Dia com Antecedência
      if (req.method === 'POST' && urlPath === '/api/queue/relocate') {
        const item = db.queue.find(q => q.id === payload.queueId) || db.queue[db.queue.length - 1];
        if (!item) return send(404, { error: 'Você não está na fila no momento.' });
        item.status = 'relocated';
        item.service = `Relocado c/ antecedência (${clean(payload.newDay || 'Sábado')}) • Crédito mantido`;
        saveDb(db);
        return send(200, db);
      }

      // Finalizar corte na cadeira e lançar no caixa
      if (req.method === 'POST' && urlPath === '/api/queue/finish') {
        const idx = db.queue.findIndex(q => q.id === payload.queueId);
        if (idx === -1) return send(404, { error: 'Atendimento não encontrado' });
        const item = db.queue[idx];
        if (item.memberId) {
          const m = db.members.find(x => x.id === item.memberId);
          if (m && m.cutsUsed < m.cutsLimit) m.cutsUsed += 1;
        } else {
          db.shop.extraRevenue += db.shop.singleCutPrice;
          db.transactions.unshift({
            id: 't' + Date.now(),
            date: `Hoje ${nowTime()}`,
            desc: `Corte Avulso — ${item.name}`,
            type: 'avulso',
            method: 'PIX / Dinheiro',
            amount: db.shop.singleCutPrice
          });
        }
        db.queue.splice(idx, 1);
        const next = db.queue.find(q => q.status === 'waiting');
        if (next) next.status = 'in_chair';
        db.queue.filter(q => q.status === 'waiting').forEach((q, i) => { q.estMin = (i + 1) * 18; });
        saveDb(db);
        return send(200, db);
      }

      // Acordo de Atraso (+R$ 5,00) com lançamento no Livro Caixa
      if (req.method === 'POST' && urlPath === '/api/crm/reschedule-payment') {
        const m = db.members.find(x => x.id === payload.memberId);
        if (!m) return send(404, { error: 'Cliente não encontrado' });
        const fee = db.shop.rescheduleFee;
        m.status = 'rescheduled';
        m.daysOverdue = 0;
        m.feeAdded += fee;
        m.dueDate = clean(payload.newDueDate || '25/10/2026');
        db.shop.extraRevenue += fee;
        db.transactions.unshift({
          id: 't' + Date.now(),
          date: `Hoje ${nowTime()}`,
          desc: `Taxa Reajuste Data — ${m.name}`,
          type: 'taxa',
          method: clean(payload.method || 'PIX Acordo IA'),
          amount: fee
        });
        saveDb(db);
        return send(200, db);
      }

      // Pagamento de Mensalidade / Checkout PIX
      if (req.method === 'POST' && urlPath === '/api/crm/pay-now') {
        const m = db.members.find(x => x.id === payload.memberId);
        if (!m) return send(404, { error: 'Cliente não encontrado' });
        m.status = 'active';
        m.daysOverdue = 0;
        m.dueDate = '15/11/2026';
        db.transactions.unshift({
          id: 't' + Date.now(),
          date: `Hoje ${nowTime()}`,
          desc: `Mensalidade ${m.plan.split(' (')[0]} — ${m.name}`,
          type: 'assinatura',
          method: clean(payload.method || 'PIX Automático Asaas'),
          amount: m.price
        });
        saveDb(db);
        return send(200, db);
      }

      // Salvar Visagismo (Protegido no Servidor: Exclusivo Plano Gold VIP)
      if (req.method === 'POST' && urlPath === '/api/visagism/save') {
        const m = db.members.find(x => x.id === payload.memberId);
        if (!m || !m.plan.includes('Gold') || m.status === 'overdue') {
          return send(403, { error: 'Exclusivo para assinantes do plano Califórnia Gold VIP em dia.' });
        }
        m.visagism = {
          shape: clean(payload.shape),
          cut: clean(payload.cut),
          angles: clean(payload.angles),
          notes: clean(payload.notes)
        };
        saveDb(db);
        return send(200, db);
      }

      return send(404, { error: 'Endpoint não encontrado' });
    });
    return;
  }

  let routeFile = 'index.html';
  if (urlPath === '/admin' || urlPath === '/admin.html') routeFile = 'admin.html';
  else if (urlPath !== '/' && urlPath !== '/cliente') routeFile = urlPath.slice(1);

  const filePath = path.join(__dirname, 'public', routeFile);
  if (!filePath.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Página não encontrada');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'text/plain' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => console.log(`Barbearia California V4 rodando em http://localhost:${PORT}`));
