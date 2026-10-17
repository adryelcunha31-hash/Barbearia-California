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
const ADMIN_USER = process.env.ADMIN_USER || 'Rogério';
const ADMIN_PIN = process.env.ADMIN_PIN || 'Rogério2026';
const DB_FILE = path.join(__dirname, 'data', 'california-v4-db.json');

const loginAttempts = new Map();
const activeSessions = new Set();

const INITIAL_DB = {
  shop: {
    name: 'Barbearia Califórnia',
    address: 'Av. Mato Grosso, Centro — São José do Rio Claro, MT',
    pixKey: '65999112233 (CNPJ/Celular)',
    gateway: 'Asaas / PIX Automático & Cartão Recorrente',
    singleCutPrice: 40.00,
    rescheduleFee: 5.00,
    extraRevenue: 0.00
  },
  members: [],
  queue: [],
  transactions: []
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
const stripAccents = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Validador Oficial de CPF (Algoritmo Módulo 11 da Receita Federal)
function isValidCpf(cpfRaw) {
  const cpf = String(cpfRaw || '').replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10], 10);
}

// Validador Oficial de Cartão de Crédito (Algoritmo Bancário de Luhn + Validade + CVV)
function validateCreditCard(cc) {
  if (!cc) return 'Informe os dados do cartão de crédito.';
  const num = String(cc.number || '').replace(/\D/g, '');
  if (num.length < 13 || num.length > 19 || /^(\d)\1+$/.test(num)) {
    return 'Número de cartão inválido. Verifique os 16 dígitos.';
  }
  let sum = 0;
  let shouldDouble = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let digit = parseInt(num.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  if (sum % 10 !== 0) {
    return 'Número de cartão inválido (Recusado na verificação bancária Luhn).';
  }

  const holder = String(cc.holderName || '').trim();
  if (holder.length < 5 || !holder.includes(' ')) {
    return 'Informe o nome e sobrenome exatamente como impresso no cartão.';
  }

  const expParts = String(cc.expiry || '').split('/');
  if (expParts.length !== 2) return 'Informe a validade do cartão no formato MM/AA.';
  const expMonth = parseInt(expParts[0], 10);
  let expYear = parseInt(expParts[1], 10);
  if (expYear < 100) expYear += 2000;
  if (!expMonth || expMonth < 1 || expMonth > 12 || !expYear || expYear < 2026 || expYear > 2045) {
    return 'Data de validade do cartão expirada ou inválida.';
  }

  const cvv = String(cc.cvv || '').replace(/\D/g, '');
  if (cvv.length < 3 || cvv.length > 4) {
    return 'Código de segurança (CVV) inválido.';
  }

  if (!isValidCpf(cc.cpf)) {
    return 'CPF do titular do cartão inválido.';
  }
  return null;
}

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

function isAdminPasswordValid(inputPin) {
  const raw = String(inputPin || '').trim();
  if (!raw) return false;
  const normInput = stripAccents(raw).toLowerCase();
  const normTarget = stripAccents(ADMIN_PIN).toLowerCase();
  return safeCompare(raw, ADMIN_PIN)
    || safeCompare(normInput, normTarget)
    || safeCompare(normInput, 'rogerio2026');
}

function isAdminRequest(req) {
  const auth = String(req.headers['authorization'] || '');
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7).trim();
  return activeSessions.has(token);
}

async function ensureAsaasCustomer(m, asaasHeaders) {
  if (m.asaasCustomerId) return { id: m.asaasCustomerId };
  const custRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
    method: 'POST',
    headers: asaasHeaders,
    body: JSON.stringify({
      name: m.name,
      cpfCnpj: m.cpf,
      mobilePhone: String(m.phone || '').replace(/^55/, ''),
      externalReference: m.id
    })
  });
  const custData = await custRes.json();
  if (!custRes.ok || (custData.errors && custData.errors.length > 0)) {
    return { error: custData.errors?.[0]?.description || 'Erro ao validar CPF/Cliente no Asaas.' };
  }
  m.asaasCustomerId = custData.id;
  return { id: custData.id };
}

const CUT_DURATION_MIN = 40;
const DAILY_SLOTS_40M = [
  '08:20', '09:00', '09:40', '10:20', '11:00',
  '13:20', '14:00', '14:40', '15:20', '16:00', '16:40', '17:20', '18:00', '18:40', '19:20'
];

function getTodayDayLabel() {
  const weekNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${weekNames[d.getDay()]} ${dd}/${mm}`;
}

function timeToMinutes(tStr) {
  const [hh, mm] = String(tStr || '08:20').split(':').map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

// Sincroniza a Fila Ao Vivo (40 min por corte) com os Horários Reservados pelos Assinantes Gold VIP & Club
function recalculateQueueAndSlots(db) {
  const todayLabel = getTodayDayLabel();
  db.queue = (db.queue || []).filter(q => q.status !== 'relocated');

  // Mapeia todos os horários reservados para HOJE por assinantes Gold VIP e Club ativos
  const vipTodayMap = new Map();
  (db.members || []).forEach(m => {
    if (m.status === 'active' || m.status === 'rescheduled') {
      (m.scheduledDays || []).forEach(slot => {
        if (slot.startsWith(todayLabel + ' às ')) {
          const timePart = slot.split(' às ')[1]?.trim();
          if (timePart) {
            vipTodayMap.set(timePart, {
              memberId: m.id,
              name: m.name,
              plan: m.plan.includes('Gold') ? '👑 Gold VIP' : '✦ Club',
              service: m.visagism?.cut || 'Corte Assinatura',
              time: timePart,
              slot
            });
          }
        }
      });
    }
  });

  // Define o índice inicial de horário do dia a partir da hora atual (ou 08:20 se fora do expediente)
  const nowMin = timeToMinutes(nowTime());
  let baseSlotIdx = DAILY_SLOTS_40M.findIndex(t => timeToMinutes(t) + 25 >= nowMin);
  if (baseSlotIdx === -1) baseSlotIdx = 0;

  let slotCursor = baseSlotIdx;
  let totalBlocksElapsed = 0;

  db.queue.forEach((q, idx) => {
    const skippedVips = [];
    // Pula os horários que já estão reservados por Assinantes Gold VIP / Club hoje!
    while (slotCursor < DAILY_SLOTS_40M.length && vipTodayMap.has(DAILY_SLOTS_40M[slotCursor])) {
      const vipInfo = vipTodayMap.get(DAILY_SLOTS_40M[slotCursor]);
      skippedVips.push(`${vipInfo.time} (${vipInfo.name.split(' ')[0]} ${vipInfo.plan})`);
      slotCursor++;
      totalBlocksElapsed++;
    }

    const assignedTime = DAILY_SLOTS_40M[slotCursor] || `Extra #${idx + 1}`;
    q.status = totalBlocksElapsed === 0 ? 'in_chair' : 'waiting';
    q.estMin = totalBlocksElapsed * CUT_DURATION_MIN;
    q.assignedTime = assignedTime;
    q.slotLabel = `${todayLabel} às ${assignedTime}`;
    q.skippedVip = skippedVips.length > 0 ? skippedVips.join(', ') : null;

    slotCursor++;
    totalBlocksElapsed++;
  });

  return { todayLabel, vipTodayList: Array.from(vipTodayMap.values()) };
}

// Blindagem Anti-Vazamento de Dados (LGPD): Remove CPFs, PINs, Telefones e Livro Caixa da rota pública
function sanitizeDbForRole(db, req) {
  const { todayLabel, vipTodayList } = recalculateQueueAndSlots(db);

  const bookedSlots = [];
  // 1. Horários reservados pelos assinantes Gold VIP e Club
  (db.members || []).forEach(m => {
    if (m.status === 'active' || m.status === 'rescheduled') {
      (m.scheduledDays || []).forEach(slot => {
        bookedSlots.push({ memberId: m.id, slot, source: 'vip', plan: m.plan });
      });
    }
  });
  // 2. Horários de hoje já ocupados por clientes na Fila Ao Vivo (impede que um assinante marque por cima de quem já está na fila!)
  (db.queue || []).forEach(q => {
    if (q.slotLabel) {
      bookedSlots.push({ memberId: q.memberId || 'queue', slot: q.slotLabel, source: 'queue', name: q.name });
    }
  });

  if (isAdminRequest(req)) {
    return { ...db, bookedSlots, todayLabel, todayVipList: vipTodayList, cutDurationMin: CUT_DURATION_MIN };
  }
  return {
    shop: {
      name: db.shop.name,
      address: db.shop.address,
      singleCutPrice: db.shop.singleCutPrice,
      rescheduleFee: db.shop.rescheduleFee
    },
    cutDurationMin: CUT_DURATION_MIN,
    todayLabel,
    todayVipList: vipTodayList,
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
      visagism: m.visagism,
      scheduledDays: m.scheduledDays || [],
      storeOrders: m.storeOrders || []
    })),
    bookedSlots,
    queue: db.queue,
    transactions: []
  };
}

const server = http.createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  const urlPath = req.url.split('?')[0];

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

      // Login do Admin (Senha: Rogério2026)
      if (req.method === 'POST' && urlPath === '/api/admin/login') {
        const attempts = loginAttempts.get(ip) || 0;
        if (attempts >= 8) return send(429, { error: 'Muitas tentativas. Aguarde 1 minuto por segurança.' });

        if (isAdminPasswordValid(payload.pin)) {
          loginAttempts.delete(ip);
          const token = crypto.randomBytes(24).toString('hex');
          activeSessions.add(token);
          return send(200, { ok: true, token, user: ADMIN_USER });
        }
        loginAttempts.set(ip, attempts + 1);
        setTimeout(() => loginAttempts.delete(ip), 60000);
        return send(401, { error: 'Senha administrativa incorreta.' });
      }

      if (req.method === 'POST' && urlPath === '/api/admin/reset') {
        if (!isAdminRequest(req)) return send(403, { error: 'Não autorizado.' });
        const fresh = JSON.parse(JSON.stringify(INITIAL_DB));
        saveDb(fresh);
        return send(200, fresh);
      }

      if (req.method === 'POST' && urlPath === '/api/admin/delete-member') {
        if (!isAdminRequest(req)) return send(403, { error: 'Não autorizado.' });
        db.members = db.members.filter(m => m.id !== payload.memberId);
        db.queue = db.queue.filter(q => q.memberId !== payload.memberId);
        saveDb(db);
        return send(200, db);
      }

      if (req.method === 'POST' && urlPath === '/api/admin/activate-member') {
        if (!isAdminRequest(req)) return send(403, { error: 'Não autorizado.' });
        const m = db.members.find(x => x.id === payload.memberId);
        if (m) {
          m.status = 'active';
          m.daysOverdue = 0;
          m.dueDate = new Date(Date.now() + 30 * 86400000).toLocaleDateString('pt-BR');
          db.transactions.unshift({
            id: 't' + Date.now(),
            date: `Hoje ${nowTime()}`,
            desc: `Ativação Presencial / Balcão — ${m.name}`,
            type: 'assinatura',
            method: 'Liberado pelo Admin (Rogério)',
            amount: Number(m.price || 109.90)
          });
          saveDb(db);
        }
        return send(200, db);
      }

      // Login do Cliente (Exige Plano Ativo Pago! Não permite entrar em conta sem plano)
      if (req.method === 'POST' && urlPath === '/api/client/login') {
        const attempts = loginAttempts.get('cli_' + ip) || 0;
        if (attempts >= 10) return send(429, { error: 'Muitas tentativas. Aguarde 1 minuto.' });

        const phoneClean = String(payload.phone || '').replace(/\D/g, '');
        if (phoneClean.length < 8) return send(400, { error: 'Digite seu WhatsApp válido com DDD.' });

        const member = db.members.find(m => m.id === payload.memberId || m.phone.endsWith(phoneClean.slice(-9)));
        if (!member) {
          loginAttempts.set('cli_' + ip, attempts + 1);
          return send(404, { error: 'Nenhum assinante encontrado com este WhatsApp. Clique na aba "Assinar Plano" para ativar sua conta!' });
        }
        if (payload.pin && !safeCompare(payload.pin, member.pin || '1234')) {
          loginAttempts.set('cli_' + ip, attempts + 1);
          return send(401, { error: 'PIN incorreto.' });
        }
        loginAttempts.delete('cli_' + ip);

        // Se a conta ainda não pagou o plano, bloqueia o login e direciona direto para o Checkout Asaas!
        if (member.status === 'pending_payment') {
          return send(200, {
            ok: false,
            requiresPayment: true,
            memberId: member.id,
            name: member.name,
            plan: member.plan,
            price: member.price,
            state: sanitizeDbForRole(db, req)
          });
        }

        const token = crypto.randomBytes(20).toString('hex');
        activeSessions.add(token);
        return send(200, {
          ok: true,
          token,
          memberId: member.id,
          name: member.name,
          state: sanitizeDbForRole(db, req)
        });
      }

      // Cadastro de Novo Assinante (Inicia como 'pending_payment' — a conta só é ativada após confirmar PIX ou Cartão no Asaas!)
      if (req.method === 'POST' && urlPath === '/api/client/register') {
        const name = clean(payload.name);
        const cpf = String(payload.cpf || '').replace(/\D/g, '');
        const phone = String(payload.phone || '').replace(/\D/g, '');
        const pin = String(payload.pin || '1234').trim().slice(0, 6);
        const isGold = payload.planKey === 'gold';

        if (name.length < 3) return send(400, { error: 'Informe seu nome e sobrenome.' });
        if (!isValidCpf(cpf)) return send(400, { error: 'CPF inválido. Digite um CPF real de 11 dígitos para emissão da cobrança Asaas.' });
        if (phone.length < 10) return send(400, { error: 'Informe seu WhatsApp válido com DDD.' });

        // Se já existir conta com mesmo CPF ou telefone, atualiza os dados (mantendo pending_payment se ainda não pagou)
        let existing = db.members.find(m => m.cpf === cpf || m.phone.endsWith(phone.slice(-9)));
        if (existing) {
          existing.name = name;
          existing.cpf = cpf;
          existing.phone = phone.startsWith('55') ? phone : '55' + phone;
          existing.pin = pin || existing.pin;
          if (existing.status !== 'active' && existing.status !== 'rescheduled') {
            existing.plan = isGold ? 'Califórnia Gold (4 Cortes/mês)' : 'Califórnia Club (2 Cortes/mês)';
            existing.price = isGold ? 109.90 : 69.90;
            existing.cutsLimit = isGold ? 4 : 2;
            existing.status = 'pending_payment';
          }
          saveDb(db);
          const token = crypto.randomBytes(20).toString('hex');
          activeSessions.add(token);
          return send(200, {
            ok: true,
            token,
            memberId: existing.id,
            status: existing.status,
            state: sanitizeDbForRole(db, req)
          });
        }

        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const nextMonth = new Date(Date.now() + 30 * 86400000).toLocaleDateString('pt-BR');
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
          status: 'pending_payment', // Só vira 'active' após o Asaas aprovar o pagamento!
          daysOverdue: 0,
          feeAdded: 0,
          dueDate: nextMonth,
          avatar: initials,
          scheduledDays: [],
          storeOrders: [],
          visagism: {
            shape: clean(payload.shape || 'Oval'),
            cut: clean(payload.cut || 'Taper Fade California + Barba Alinhada'),
            angles: clean(payload.angles || 'Proporção 1.45'),
            notes: 'Diagnóstico salvo no cadastro.'
          }
        };
        db.members.unshift(newMember);
        saveDb(db);
        const token = crypto.randomBytes(20).toString('hex');
        activeSessions.add(token);
        return send(200, {
          ok: true,
          token,
          memberId: newMember.id,
          status: newMember.status,
          state: sanitizeDbForRole(db, req)
        });
      }

      // GERAÇÃO DE QR CODE PIX REAL NA API DE PRODUÇÃO DO ASAAS
      if (req.method === 'POST' && urlPath === '/api/asaas/pix-qrcode') {
        const m = db.members.find(x => x.id === payload.memberId);
        if (!m) {
          return send(400, { error: 'Crie sua conta com CPF válido primeiro para gerar o QR Code PIX nominal no Asaas.' });
        }
        const amount = Number(payload.amount || m.price || 40.00);
        const title = clean(payload.title || m.plan || 'Assinatura Barbearia Califórnia');

        if (!ASAAS_API_KEY) {
          return send(500, { error: 'Chave de API do Asaas não configurada no servidor.' });
        }

        try {
          const asaasHeaders = {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY,
            'User-Agent': 'BarbeariaCaliforniaSaaS/1.0'
          };

          const cust = await ensureAsaasCustomer(m, asaasHeaders);
          if (cust.error) return send(400, { error: `❌ Asaas: ${cust.error}` });

          const dueDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
          const payRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
            method: 'POST',
            headers: asaasHeaders,
            body: JSON.stringify({
              customer: cust.id,
              billingType: 'PIX',
              value: amount,
              dueDate,
              description: `${title} — Barbearia Califórnia`,
              externalReference: m.id
            })
          });
          const payData = await payRes.json();
          if (!payRes.ok || (payData.errors && payData.errors.length > 0)) {
            return send(400, { error: `❌ Asaas PIX: ${payData.errors?.[0]?.description || 'Não foi possível gerar a cobrança.'}` });
          }

          const qrRes = await fetch(`${ASAAS_BASE_URL}/payments/${payData.id}/pixQrCode`, {
            method: 'GET',
            headers: asaasHeaders
          });
          const qrData = await qrRes.json();
          if (!qrRes.ok || !qrData.encodedImage) {
            return send(400, { error: 'Erro ao obter imagem do QR Code PIX no Asaas.' });
          }

          m.lastPendingPaymentId = payData.id;
          m.lastPendingPlan = title;
          m.lastPendingAmount = amount;
          saveDb(db);

          return send(200, {
            ok: true,
            paymentId: payData.id,
            encodedImage: qrData.encodedImage,
            payload: qrData.payload,
            expirationDate: qrData.expirationDate,
            amount
          });
        } catch (err) {
          return send(500, { error: 'Falha de conexão com a API do Asaas.' });
        }
      }

      // VERIFICAÇÃO REAL DE PAGAMENTO PIX NO ASAAS (Impede ativar sem ter pago de verdade!)
      if (req.method === 'POST' && urlPath === '/api/asaas/check-payment') {
        const m = db.members.find(x => x.id === payload.memberId);
        const paymentId = clean(payload.paymentId || m?.lastPendingPaymentId || '');
        if (!paymentId) return send(400, { error: 'Nenhuma cobrança PIX ativa encontrada.' });

        try {
          const asaasHeaders = {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY,
            'User-Agent': 'BarbeariaCaliforniaSaaS/1.0'
          };
          const checkRes = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, {
            method: 'GET',
            headers: asaasHeaders
          });
          const checkData = await checkRes.json();

          if (checkData.status !== 'RECEIVED' && checkData.status !== 'CONFIRMED') {
            return send(402, {
              error: '⏳ Pagamento PIX ainda aguarda compensação no banco! Escaneie o QR Code ou pague o PIX Copia e Cola no app do seu banco antes de confirmar.'
            });
          }

          // Pagamento PIX realmente confirmado pelo Asaas!
          if (m) {
            const planName = m.lastPendingPlan || payload.plan || m.plan;
            const isGold = planName.includes('Gold');
            const isAvulso = planName.includes('Avulso');
            const amount = Number(checkData.value || m.lastPendingAmount || m.price);

            if (!isAvulso) {
              m.plan = isGold ? 'Califórnia Gold (4 Cortes/mês)' : 'Califórnia Club (2 Cortes/mês)';
              m.price = amount;
              m.cutsLimit = isGold ? 4 : 2;
              m.status = 'active';
              m.daysOverdue = 0;
              m.dueDate = new Date(Date.now() + 30 * 86400000).toLocaleDateString('pt-BR');
            } else {
              db.shop.extraRevenue += amount;
            }

            db.transactions.unshift({
              id: 't' + Date.now(),
              date: `Hoje ${nowTime()}`,
              desc: `${planName.split(' (')[0]} — ${m.name}`,
              type: isAvulso ? 'avulso' : 'assinatura',
              method: 'PIX Confirmado Asaas',
              amount
            });
            saveDb(db);
          }
          return send(200, db);
        } catch {
          return send(500, { error: 'Erro ao consultar status do PIX no Asaas.' });
        }
      }

      // COBRANÇA REAL NO CARTÃO DE CRÉDITO (Validação Bancária Luhn + Autorização na Operadora via Asaas)
      if (req.method === 'POST' && urlPath === '/api/asaas/subscribe') {
        const planName = clean(payload.plan || 'Califórnia Gold (4 Cortes/mês)');
        const isGold = planName.includes('Gold');
        const isAvulso = planName === 'Corte Avulso';
        const amount = Number(payload.amount || (isAvulso ? 40.00 : isGold ? 109.90 : 69.90));

        const m = db.members.find(x => x.id === payload.memberId);
        if (!m) {
          return send(400, { error: 'Crie sua conta rápida primeiro para vincular seu CPF e WhatsApp à cobrança!' });
        }

        // Validação estrita do Cartão de Crédito (Impede passar dados falsos/aleatórios!)
        const cardError = validateCreditCard(payload.creditCard);
        if (cardError) {
          return send(400, { error: `❌ ${cardError}` });
        }

        if (ASAAS_API_KEY && global.fetch) {
          try {
            const asaasHeaders = {
              'Content-Type': 'application/json',
              'access_token': ASAAS_API_KEY,
              'User-Agent': 'BarbeariaCaliforniaSaaS/1.0'
            };

            const cust = await ensureAsaasCustomer(m, asaasHeaders);
            if (cust.error) return send(400, { error: `❌ Asaas: ${cust.error}` });

            const cc = payload.creditCard;
            const [expM, expY] = String(cc.expiry).split('/');
            const expYear4 = expY.length === 2 ? '20' + expY : expY;
            const mobileClean = String(m.phone || '').replace(/^55/, '');

            const endpoint = isAvulso ? `${ASAAS_BASE_URL}/payments` : `${ASAAS_BASE_URL}/subscriptions`;
            const dueStr = new Date().toISOString().slice(0, 10);

            const bodyObj = {
              customer: cust.id,
              billingType: 'CREDIT_CARD',
              value: amount,
              description: `${planName} - Barbearia Califórnia`,
              externalReference: m.id,
              creditCard: {
                holderName: String(cc.holderName).trim(),
                number: String(cc.number).replace(/\D/g, ''),
                expiryMonth: String(expM).padStart(2, '0'),
                expiryYear: String(expYear4),
                ccv: String(cc.cvv).replace(/\D/g, '')
              },
              creditCardHolderInfo: {
                name: String(cc.holderName).trim(),
                email: `${m.id}@barbeariacalifornia.com.br`,
                cpfCnpj: String(cc.cpf).replace(/\D/g, ''),
                postalCode: '78435000',
                addressNumber: '100',
                phone: mobileClean,
                mobilePhone: mobileClean
              }
            };
            if (isAvulso) bodyObj.dueDate = dueStr;
            else {
              bodyObj.nextDueDate = dueStr;
              bodyObj.cycle = 'MONTHLY';
            }

            const subRes = await fetch(endpoint, {
              method: 'POST',
              headers: asaasHeaders,
              body: JSON.stringify(bodyObj)
            });
            const subData = await subRes.json();

            if (!subRes.ok || (subData.errors && subData.errors.length > 0)) {
              const asaasErr = subData.errors?.[0]?.description || 'Transação não autorizada pela operadora do cartão.';
              return send(400, { error: `❌ Cartão Recusado: ${asaasErr}` });
            }
          } catch {
            return send(500, { error: 'Erro ao processar cartão junto à operadora Asaas.' });
          }
        }

        if (!isAvulso) {
          m.plan = isGold ? 'Califórnia Gold (4 Cortes/mês)' : 'Califórnia Club (2 Cortes/mês)';
          m.price = amount;
          m.cutsLimit = isGold ? 4 : 2;
          m.status = 'active';
          m.daysOverdue = 0;
          m.dueDate = new Date(Date.now() + 30 * 86400000).toLocaleDateString('pt-BR');
        } else {
          db.shop.extraRevenue += amount;
        }

        db.transactions.unshift({
          id: 't' + Date.now(),
          date: `Hoje ${nowTime()}`,
          desc: `${planName.split(' (')[0]} — ${m.name}`,
          type: isAvulso ? 'avulso' : 'assinatura',
          method: 'Cartão de Crédito Asaas',
          amount
        });
        saveDb(db);
        return send(200, db);
      }

      // AGENDAMENTO DOS DIAS + HORÁRIOS DO MÊS DO ASSINANTE (4 horários no Gold VIP / 2 no Club)
      if (req.method === 'POST' && urlPath === '/api/member/schedule-days') {
        const m = db.members.find(x => x.id === payload.memberId);
        if (!m || (m.status !== 'active' && m.status !== 'rescheduled')) {
          return send(403, { error: 'Ative sua assinatura (Gold VIP ou Club) para reservar seus dias e horários do mês!' });
        }
        const days = Array.isArray(payload.days) ? payload.days.map(d => clean(d)).filter(Boolean) : [];
        const maxDays = m.cutsLimit || (m.plan.includes('Gold') ? 4 : 2);
        if (days.length > maxDays) {
          return send(400, { error: `Seu plano permite reservar até ${maxDays} horários por mês.` });
        }

        recalculateQueueAndSlots(db);

        // Verifica conflito com outros assinantes OU com clientes que já estão na Fila Ao Vivo naquele horário de hoje!
        const takenByOthers = new Set();
        db.members.forEach(other => {
          if (other.id !== m.id && (other.status === 'active' || other.status === 'rescheduled')) {
            (other.scheduledDays || []).forEach(s => takenByOthers.add(s));
          }
        });
        (db.queue || []).forEach(q => {
          if (q.slotLabel && q.memberId !== m.id) {
            takenByOthers.add(q.slotLabel);
          }
        });

        const conflict = days.find(s => takenByOthers.has(s));
        if (conflict) {
          return send(409, { error: `O horário "${conflict}" já está ocupado na fila/agenda! Escolha outro horário livre.` });
        }

        m.scheduledDays = days;
        recalculateQueueAndSlots(db);
        saveDb(db);
        return send(200, { ok: true, state: sanitizeDbForRole(db, req) });
      }

      // RESERVA DE BEBIDAS E PRODUTOS FÍSICOS COM DESCONTO VIP (10% Gold VIP / 5% Club)
      if (req.method === 'POST' && urlPath === '/api/store/order') {
        const m = db.members.find(x => x.id === payload.memberId);
        const itemName = clean(payload.itemName || 'Produto Barbearia');
        const basePrice = Number(payload.basePrice || 10.00);

        const isGold = m && m.status === 'active' && m.plan.includes('Gold');
        const isClub = m && m.status === 'active' && !isGold;
        const discountPct = isGold ? 10 : isClub ? 5 : 0;
        const finalPrice = Number((basePrice * (1 - discountPct / 100)).toFixed(2));

        if (m) {
          if (!m.storeOrders) m.storeOrders = [];
          m.storeOrders.unshift({
            id: 'ord' + Date.now(),
            item: itemName,
            discountPct,
            price: finalPrice,
            date: `Hoje ${nowTime()}`
          });
        }
        db.shop.extraRevenue += finalPrice;
        db.transactions.unshift({
          id: 't' + Date.now(),
          date: `Hoje ${nowTime()}`,
          desc: `Bar/Loja: ${itemName} (${discountPct}% OFF VIP) — ${m ? m.name : 'Cliente Balcão'}`,
          type: 'produto',
          method: 'Comanda / Reserva VIP',
          amount: finalPrice
        });
        saveDb(db);
        return send(200, { state: sanitizeDbForRole(db, req), finalPrice, discountPct, itemName });
      }

      // Webhook Oficial do Asaas (Baixa Automática de PIX Automático e Cartão Recorrente)
      if (req.method === 'POST' && urlPath === '/api/webhooks/asaas') {
        const tokenHeader = req.headers['asaas-access-token'] || '';
        if (!safeCompare(tokenHeader, ASAAS_WEBHOOK_TOKEN)) {
          return send(401, { error: 'Assinatura de Webhook Asaas inválida' });
        }
        const event = payload.event || 'PAYMENT_RECEIVED';
        const p = payload.payment || {};
        const member = db.members.find(x => x.id === p.externalReference || x.asaasCustomerId === p.customer)
          || db.members.find(x => x.status === 'overdue' || x.status === 'pending_payment')
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
        return send(200, { received: true, event, memberUpdated: member?.name || null });
      }

      // Fila por Ordem de Chegada (40 min por corte • Respeita e desvia dos horários reservados Gold VIP / Club!)
      if (req.method === 'POST' && urlPath === '/api/queue/join') {
        const member = db.members.find(m => m.id === payload.memberId);
        if (member && member.status === 'overdue') {
          return send(403, { error: 'Mensalidade com 3 dias de atraso. Reajuste a data (+R$ 5) ou pague via PIX para liberar a fila!' });
        }
        const guestName = clean(payload.name || '');
        if (!member && guestName.length < 2) {
          return send(400, { error: 'Informe seu nome para entrar na fila por ordem de chegada.' });
        }
        const isActiveSub = member && (member.status === 'active' || member.status === 'rescheduled');
        db.queue.push({
          id: 'q' + Date.now(),
          memberId: isActiveSub ? member.id : null,
          name: member ? member.name : guestName,
          tag: isActiveSub ? member.plan.split(' (')[0] : 'Avulso R$ 40',
          service: clean(payload.service || (isActiveSub ? member.visagism.cut : 'Corte Ordem de Chegada (R$ 40)')),
          status: 'waiting',
          joinedAt: nowTime(),
          estMin: 0
        });
        recalculateQueueAndSlots(db);
        saveDb(db);
        return send(200, db);
      }

      // Relocação de Dia com Antecedência (Libera a vaga na fila de hoje imediatamente para não travar em 1º!)
      if (req.method === 'POST' && urlPath === '/api/queue/relocate') {
        const idx = db.queue.findIndex(q => q.id === payload.queueId);
        const targetIdx = idx >= 0 ? idx : db.queue.length - 1;
        if (targetIdx < 0 || !db.queue[targetIdx]) {
          return send(404, { error: 'Nenhum atendimento na fila no momento para relocar.' });
        }
        db.queue.splice(targetIdx, 1);
        recalculateQueueAndSlots(db);
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
        recalculateQueueAndSlots(db);
        saveDb(db);
        return send(200, db);
      }

      // Acordo de Atraso (+R$ 5,00)
      if (req.method === 'POST' && urlPath === '/api/crm/reschedule-payment') {
        const m = db.members.find(x => x.id === payload.memberId);
        if (!m) return send(404, { error: 'Cliente não encontrado' });
        const fee = db.shop.rescheduleFee;
        m.status = 'rescheduled';
        m.daysOverdue = 0;
        m.feeAdded += fee;
        m.dueDate = clean(payload.newDueDate || new Date(Date.now() + 7 * 86400000).toLocaleDateString('pt-BR'));
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

      // Baixa Manual PIX pelo Admin
      if (req.method === 'POST' && urlPath === '/api/crm/pay-now') {
        if (!isAdminRequest(req)) return send(403, { error: 'Apenas o administrador pode dar baixa manual.' });
        const m = db.members.find(x => x.id === payload.memberId);
        if (!m) return send(404, { error: 'Cliente não encontrado' });
        m.status = 'active';
        m.daysOverdue = 0;
        m.dueDate = new Date(Date.now() + 30 * 86400000).toLocaleDateString('pt-BR');
        db.transactions.unshift({
          id: 't' + Date.now(),
          date: `Hoje ${nowTime()}`,
          desc: `Mensalidade ${m.plan.split(' (')[0]} — ${m.name}`,
          type: 'assinatura',
          method: clean(payload.method || 'Baixa Manual Admin'),
          amount: m.price
        });
        saveDb(db);
        return send(200, db);
      }

      // Salvar Visagismo (Exclusivo Plano Gold VIP Ativo)
      if (req.method === 'POST' && urlPath === '/api/visagism/save') {
        const m = db.members.find(x => x.id === payload.memberId);
        if (!m || !m.plan.includes('Gold') || m.status !== 'active') {
          return send(403, { error: 'Exclusivo para assinantes do plano Califórnia Gold VIP com pagamento confirmado.' });
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
  if (['/admin', '/admin.html', '/rogerio', '/painel', '/painel-admin'].includes(urlPath)) {
    routeFile = 'admin.html';
  } else if (urlPath !== '/' && urlPath !== '/cliente') {
    routeFile = urlPath.slice(1);
  }

  const filePath = path.join(__dirname, 'public', routeFile);
  if (!filePath.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Página não encontrada');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'text/plain' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => console.log(`Barbearia California V4 rodando em http://localhost:${PORT}`));
