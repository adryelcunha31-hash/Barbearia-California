let state = { shop: {}, members: [], queue: [], transactions: [] };
let currentMemberId = 'm2';
let currentShape = 'Quadrado';
let pendingCheckoutAction = null;

// ================= LENIS SMOOTH SCROLL + GSAP SCROLLTRIGGER (STACK LANDO NORRIS) =================
const tlImages = [];
const TL_SOURCES = [
  '/assets/timelapse-1.png',
  '/assets/timelapse-2.png',
  '/assets/timelapse-3.png',
  '/assets/timelapse-4.png'
];
let targetProgress = 0; // 0.0 to 1.0
let smoothProgress = 0; // 0.0 to 1.0
let mouseX = 0;
let mouseY = 0;

function initLenisAndScroll() {
  if (window.Lenis) {
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  window.addEventListener('scroll', () => {
    // Completa 100% da transição do corte nos primeiros 280px de scroll (enquanto o Hero está fixo!)
    const maxScroll = Math.max(220, window.innerHeight * 0.35);
    targetProgress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
  }, { passive: true });

  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 18;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 12;
  }, { passive: true });
}

function preloadHeroFrames() {
  TL_SOURCES.forEach((src, i) => {
    const img = new Image();
    img.src = src;
    tlImages[i] = img;
  });
}

// Função que desenha imagem mantendo 100% da proporção original (object-fit: cover — ZERO ESTICAMENTO!)
function drawImageCover(ctx, img, x, y, w, h, offsetX = 0, offsetY = 0) {
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const canvasRatio = w / h;
  let drawW, drawH, drawX, drawY;

  if (canvasRatio > imgRatio) {
    drawW = w;
    drawH = w / imgRatio;
    drawX = x;
    drawY = y + (h - drawH) * 0.35; // Foca no rosto e cabelo
  } else {
    drawH = h;
    drawW = h * imgRatio;
    drawX = x + (w - drawW) * 0.55;
    drawY = y;
  }
  ctx.drawImage(img, drawX + offsetX, drawY + offsetY, drawW, drawH);
}

function renderSeamlessHeroCanvas() {
  smoothProgress += (targetProgress - smoothProgress) * 0.12;

  const canvas = document.getElementById('hero-seamless-canvas');
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    }

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Interpolação contínua entre os 4 frames sem esticar (Proporção 1:1 preservada via drawImageCover)
    const stageFloat = smoothProgress * 3;
    const idxA = Math.min(3, Math.floor(stageFloat));
    const idxB = Math.min(3, idxA + 1);
    const alpha = stageFloat - idxA;

    const scale = 1.02 + smoothProgress * 0.04;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);

    ctx.globalAlpha = 1;
    drawImageCover(ctx, tlImages[idxA], 0, 0, w, h, mouseX, mouseY);

    if (alpha > 0.005) {
      ctx.globalAlpha = alpha;
      drawImageCover(ctx, tlImages[idxB], 0, 0, w, h, mouseX, mouseY);
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Linhas Geométricas Sutis de Visagismo 3D que acompanham o rosto (Sem caixa, puro efeito visual)
    const cx = w * 0.52 + mouseX;
    const cy = h * 0.42 + mouseY;
    const radius = Math.min(w, h) * 0.28;

    ctx.strokeStyle = 'rgba(217, 107, 67, 0.32)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.setLineDash([6 * dpr, 6 * dpr]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius * 1.22, smoothProgress * 0.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  requestAnimationFrame(renderSeamlessHeroCanvas);
}

// ================= BANCO DE VISAGISMO (3 PERSPECTIVAS COERENTES: FRENTE, LADO E COSTAS) =================
const VISAGISM_DB = {
  Quadrado: {
    cut: 'Mid Fade + Crop Texturizado',
    angle: '118° Maxilar',
    harmony: '98.8% Compatibilidade',
    desc: 'Rostos quadrados possuem maxilar forte e testa reta. O Mid Fade limpa as laterais na medida certa, enquanto o topo texturizado na tesoura suaviza as linhas superiores.',
    tags: ['Degradê Médio (Zero Alta)', 'Crop Texturizado', 'Pomada Matte'],
    angles: [
      { view: '1. Frente (Frontal 0°)', badge: 'Simetria Frontal', text: 'Topo desconectado equilibrando a linha da testa com o maxilar quadrado.', img: '/assets/vis-front.png', type: 'front' },
      { view: '2. Lado (Perfil 90°)', badge: 'Mid Fade Lateral', text: 'Transição suave na lateral valorizando a aresta mandibular de 118°.', img: '/assets/vis-side.png', type: 'side' },
      { view: '3. Costas (Nuca 180°)', badge: 'Taper Nuca', text: 'Acabamento esfumado na nuca acompanhando a curvatura da coroa.', img: '/assets/vis-back.png', type: 'back' }
    ]
  },
  Redondo: {
    cut: 'High Fade + Quiff Estruturado',
    angle: '132° Curvatura',
    harmony: '98.2% Compatibilidade',
    desc: 'Para rostos redondos, o visagismo cria verticalidade: subimos o degradê na lateral (High Fade) para afinar as bochechas e estruturamos o topete frontal.',
    tags: ['High Fade Navalhado', 'Topete Quiff Alto', 'Alongamento Vertical'],
    angles: [
      { view: '1. Frente (Frontal 0°)', badge: 'Efeito Alongado', text: 'Volume elevado no topete criando linhas verticais que afinam a face.', img: '/assets/vis-front.png', type: 'front' },
      { view: '2. Lado (Perfil 90°)', badge: 'High Fade Alto', text: 'Subida alta do degradê eliminando volume lateral excessivo.', img: '/assets/vis-side.png', type: 'side' },
      { view: '3. Costas (Nuca 180°)', badge: 'Nuca Alta Limpa', text: 'Disfarce alto na zero alongando visualmente a linha do pescoço.', img: '/assets/vis-back.png', type: 'back' }
    ]
  },
  Diamante: {
    cut: 'Low Fade + French Crop',
    angle: '96° Zigomático',
    harmony: '99.1% Compatibilidade',
    desc: 'Com maçãs do rosto marcadas e queixo angular, preservamos densidade nas têmporas com um Low Fade em arco e franja curta texturizada.',
    tags: ['Low Fade em Arco', 'Têmporas Cheias', 'French Crop'],
    angles: [
      { view: '1. Frente (Frontal 0°)', badge: 'Equilíbrio Testa', text: 'Franja curta texturizada preenchendo a testa em harmonia com as maçãs.', img: '/assets/vis-front.png', type: 'front' },
      { view: '2. Lado (Perfil 90°)', badge: 'Low Fade em Arco', text: 'Degradê baixo contornando a orelha sem esvaziar as têmporas.', img: '/assets/vis-side.png', type: 'side' },
      { view: '3. Costas (Nuca 180°)', badge: 'Coroa Encorpada', text: 'Caimento encorpado no osso occipital com base da nuca disfarçada.', img: '/assets/vis-back.png', type: 'back' }
    ]
  },
  Oval: {
    cut: 'Taper Fade California + Barba Alinhada',
    angle: 'Proporção 1.45',
    harmony: '99.5% Compatibilidade',
    desc: 'Proporções naturalmente simétricas. O clássico Taper Fade California limpa apenas costeletas e nuca, mantendo estrutura clássica.',
    tags: ['Taper Fade Clássico', 'Tesoura nas Laterais', 'Navalha de Precisão'],
    angles: [
      { view: '1. Frente (Frontal 0°)', badge: 'Proporção Áurea', text: 'Simetria limpa com topo penteado natural e barba esquadrejada.', img: '/assets/vis-front.png', type: 'front' },
      { view: '2. Lado (Perfil 90°)', badge: 'Taper Costeleta', text: 'Disfarce localizado apenas na costeleta preservando a lateral.', img: '/assets/vis-side.png', type: 'side' },
      { view: '3. Costas (Nuca 180°)', badge: 'Nuca Americana', text: 'Nuca esfumada limpa com contornos laterais feitos na navalha.', img: '/assets/vis-back.png', type: 'back' }
    ]
  }
};

const REVIEWS = [
  { name: 'Gabriel Nogueira', cut: 'Assinante Califórnia Gold', stars: '★★★★★', date: 'Há 2 dias • São José do Rio Claro', text: 'Melhor corte da cidade! Como trabalho o dia todo, entrar na fila pelo celular mantendo a ordem de chegada salvou minha rotina. Pago R$ 27 por corte no plano.' },
  { name: 'Matheus Almeida', cut: 'Visagismo IA + Mid Fade', stars: '★★★★★', date: 'Há 5 dias • Google Maps', text: 'O scanner de visagismo recomendou o Mid Fade com topo texturizado pro meu rosto quadrado e ficou surreal. Atendimento nota 10 na Av. Mato Grosso!' },
  { name: 'Rodrigo Cavalcante', cut: 'Assinante Califórnia Club', stars: '★★★★★', date: 'Há 1 semana • Google Maps', text: 'Tive um imprevisto no sábado, avisei pelo botão de relocar dia com antecedência e não perdi meu corte do mês. Sistema muito justo e prático.' }
];

function toast(msg) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>✦ ${msg}</span><button onclick="this.parentElement.classList.add('hidden')" class="opacity-60 hover:opacity-100">✕</button>`;
  el.classList.remove('hidden');
  clearTimeout(window._t);
  window._t = setTimeout(() => el.classList.add('hidden'), 3800);
}

// ================= TEMA CLARO / ESCURO =================
function initTheme() {
  if (new URLSearchParams(window.location.search).get('embed') === '1') {
    const b916 = document.getElementById('btn-916');
    if (b916) b916.remove();
  }
  const saved = localStorage.getItem('cal_theme') || 'dark';
  applyTheme(saved);
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'light' ? 'dark' : 'light';
  localStorage.setItem('cal_theme', next);
  applyTheme(next);
  toast(next === 'light' ? 'Modo Claro Editorial ativado!' : 'Modo Escuro Carbon ativado!');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-icon').textContent = theme === 'light' ? '🌙' : '☀️';
  document.getElementById('theme-label').textContent = theme === 'light' ? 'Escuro' : 'Claro';
}

// ================= LOGIN, CADASTRO & SESSÃO DO CLIENTE =================
let selectedPaymentMethod = 'PIX_AUTOMATICO';
let clientAuthToken = localStorage.getItem('cal_client_token') || '';

function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('auth-form-login').classList.toggle('hidden', !isLogin);
  document.getElementById('auth-form-register').classList.toggle('hidden', isLogin);
  document.getElementById('tab-btn-login').className = isLogin
    ? 'py-2 rounded-xl btn-ln-primary transition'
    : 'py-2 rounded-xl opacity-75 hover:opacity-100 transition';
  document.getElementById('tab-btn-register').className = !isLogin
    ? 'py-2 rounded-xl btn-ln-primary transition'
    : 'py-2 rounded-xl opacity-75 hover:opacity-100 transition';
}

function openLoginModal() {
  switchAuthTab('login');
  const list = document.getElementById('demo-accounts-list');
  list.innerHTML = state.members.map(m => {
    const isGold = m.plan.includes('Gold');
    return `
      <button onclick="selectDemoAccount('${m.id}')" class="w-full p-2.5 rounded-xl subtle-ln hover:border-[#d96b43] flex items-center justify-between text-xs transition">
        <span class="font-bold flex items-center gap-1.5">
          <span>${isGold ? '👑' : '👤'}</span>
          <span>${m.name}</span>
          <span class="text-[10px] opacity-65">(${isGold ? 'Gold VIP' : 'Club 2x'})</span>
        </span>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${m.status === 'overdue' ? 'bg-rose-500/20 text-rose-400' : 'text-emerald-400'}">
          ${m.status === 'overdue' ? `${m.daysOverdue}d Atraso` : 'Em Dia'}
        </span>
      </button>
    `;
  }).join('') + `
    <button onclick="selectDemoAccount('avulso')" class="w-full p-2.5 rounded-xl subtle-ln hover:border-[#d96b43] flex items-center justify-between text-xs transition">
      <span class="font-bold">👤 Visitante Sem Plano (Amostra Grátis)</span>
      <span class="text-[10px] opacity-75">Corte Avulso R$ 40</span>
    </button>
  `;
  document.getElementById('client-login-modal').classList.remove('hidden');
}

function closeLoginModal() {
  document.getElementById('client-login-modal').classList.add('hidden');
}

function selectDemoAccount(id) {
  currentMemberId = id;
  closeLoginModal();
  renderAll();
  const m = state.members.find(x => x.id === id);
  const isVip = m && m.plan.includes('Gold') && m.status !== 'overdue';
  toast(m
    ? `Conta ativa: ${m.name} • ${isVip ? '👑 Visagismo 3D Liberado' : '🔒 Visagismo em Modo Amostra'}`
    : 'Modo Visitante • Visagismo em Amostra Grátis (1 ângulo)');
}

async function submitClientLogin() {
  try {
    const phone = document.getElementById('login-phone').value;
    const pin = document.getElementById('login-pin').value;
    const res = await api('/api/client/login', { phone, pin });
    currentMemberId = res.memberId;
    if (res.token) {
      clientAuthToken = res.token;
      localStorage.setItem('cal_client_token', res.token);
    }
    closeLoginModal();
    renderAll();
    toast(`Bem-vindo de volta, ${res.name}!`);
  } catch (e) {
    toast(e.message);
  }
}

async function submitClientRegister() {
  try {
    const name = document.getElementById('reg-name').value;
    const cpf = document.getElementById('reg-cpf').value;
    const phone = document.getElementById('reg-phone').value;
    const pin = document.getElementById('reg-pin').value;
    const planKey = document.getElementById('reg-plan').value;
    const res = await api('/api/client/register', { name, cpf, phone, pin, planKey });
    state = res.state;
    currentMemberId = res.memberId;
    if (res.token) {
      clientAuthToken = res.token;
      localStorage.setItem('cal_client_token', res.token);
    }
    closeLoginModal();
    renderAll();
    const isGold = planKey === 'gold';
    openCheckoutModal(
      isGold ? 'Califórnia Gold VIP (4x/mês)' : 'Califórnia Club (2x/mês)',
      isGold ? 109.90 : 69.90,
      isGold ? 'plan_gold' : 'plan_club',
      currentMemberId
    );
    toast('Cadastro criado! Conclua a assinatura via PIX Automático ou Cartão.');
  } catch (e) {
    toast(e.message);
  }
}

// ================= CHECKOUT FINANCEIRO ASAAS (CARTÃO RECORRENTE & PIX AUTOMÁTICO) =================
function switchPaymentMethod(method) {
  selectedPaymentMethod = method;
  const isPix = method === 'PIX_AUTOMATICO';
  document.getElementById('pay-panel-pix').classList.toggle('hidden', !isPix);
  document.getElementById('pay-panel-card').classList.toggle('hidden', isPix);
  document.getElementById('pay-tab-pix').className = isPix
    ? 'py-2.5 rounded-xl btn-ln-primary transition'
    : 'py-2.5 rounded-xl opacity-75 hover:opacity-100 transition';
  document.getElementById('pay-tab-card').className = !isPix
    ? 'py-2.5 rounded-xl btn-ln-primary transition'
    : 'py-2.5 rounded-xl opacity-75 hover:opacity-100 transition';
  document.getElementById('btn-confirm-checkout').textContent = isPix
    ? 'Confirmar Pagamento PIX Automático'
    : 'Ativar Assinatura no Cartão de Crédito';
}

function openCheckoutModal(title, amount, actionType, memberId = null) {
  document.getElementById('chk-title').textContent = title;
  document.getElementById('chk-desc').textContent = 'Asaas Pagamentos • PIX Automático ou Cartão';
  document.getElementById('chk-amount').textContent = `R$ ${Number(amount).toFixed(2)}`;
  pendingCheckoutAction = { title, amount: Number(amount), actionType, memberId: memberId || currentMemberId };
  switchPaymentMethod('PIX_AUTOMATICO');
  document.getElementById('checkout-modal').classList.remove('hidden');
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.add('hidden');
}

async function confirmCheckoutPayment() {
  if (!pendingCheckoutAction) return closeCheckoutModal();
  const { title, amount, actionType, memberId } = pendingCheckoutAction;
  const methodLabel = selectedPaymentMethod === 'CREDIT_CARD' ? 'Cartão Recorrente Asaas' : 'PIX Automático Asaas';
  closeCheckoutModal();

  try {
    if (actionType === 'reschedule') {
      state = await api('/api/crm/reschedule-payment', { memberId, newDueDate: '25/10/2026', method: methodLabel });
      renderAll();
      toast('Taxa de R$ 5,00 confirmada! Vencimento reajustado e fila liberada.');
    } else if (actionType === 'pay_overdue') {
      state = await api('/api/crm/pay-now', { memberId, method: methodLabel });
      renderAll();
      toast(`Pagamento via ${methodLabel} confirmado! Sua assinatura está em dia.`);
    } else {
      const targetPlan = (actionType === 'plan_gold' || title.includes('Gold'))
        ? 'Califórnia Gold (4 Cortes/mês)'
        : title.includes('Club')
        ? 'Califórnia Club (2 Cortes/mês)'
        : 'Corte Avulso';
      state = await api('/api/asaas/subscribe', {
        memberId: memberId === 'avulso' ? 'm1' : memberId,
        plan: targetPlan,
        amount,
        billingType: selectedPaymentMethod,
        methodLabel
      });
      if (memberId === 'avulso') currentMemberId = 'm1';
      renderAll();
      toast(targetPlan.includes('Gold')
        ? `👑 Plano Gold VIP ativado via ${methodLabel}! Visagismo 3D 100% liberado!`
        : `Assinatura confirmada via ${methodLabel}!`);
    }
  } catch (e) {
    toast(e.message);
  }
}

// ================= SIMULADOR 9:16 REAL =================
function open916Simulator() {
  const overlay = document.getElementById('mobile-916-overlay');
  const iframe = document.getElementById('mobile-916-iframe');
  iframe.src = '/?embed=1';
  overlay.classList.remove('hidden');
}

function close916Simulator() {
  const overlay = document.getElementById('mobile-916-overlay');
  const iframe = document.getElementById('mobile-916-iframe');
  iframe.src = 'about:blank';
  overlay.classList.add('hidden');
}

// ================= API & ESTADO =================
async function api(url, body) {
  const res = await fetch(url, body ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  } : undefined);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro');
  return data;
}

async function init() {
  initTheme();
  preloadHeroFrames();
  initLenisAndScroll();
  requestAnimationFrame(renderSeamlessHeroCanvas);
  state = await api('/api/state');
  renderAll();
}

function renderAll() {
  renderQueueAndMember();
  renderVisagism();
  renderPlans();
  renderReviews();
}

function renderQueueAndMember() {
  const m = state.members.find(x => x.id === currentMemberId);
  const banner = document.getElementById('overdue-banner');
  const navName = document.getElementById('nav-user-name');

  if (!m) {
    navName.textContent = 'Visitante';
    document.getElementById('card-member-name').textContent = 'Visitante (Sem Plano)';
    document.getElementById('card-member-avatar').textContent = 'VA';
    document.getElementById('card-member-plan').textContent = 'Corte Avulso (R$ 40,00)';
    document.getElementById('card-member-cuts').textContent = 'Assine para pagar R$ 27/corte';
    document.getElementById('card-member-bar').style.width = '15%';
    document.getElementById('card-member-cut').textContent = 'Use o Scanner de Visagismo abaixo';
    document.getElementById('card-member-due').textContent = 'Pagamento por visita';
    document.getElementById('card-member-status').className = 'px-3 py-1 rounded-full font-bold text-[11px] subtle-ln';
    document.getElementById('card-member-status').textContent = 'Visitante';
    banner.classList.add('hidden');
  } else {
    navName.textContent = m.name.split(' ')[0];
    const left = Math.max(0, m.cutsLimit - m.cutsUsed);
    document.getElementById('card-member-name').textContent = m.name;
    document.getElementById('card-member-avatar').textContent = m.avatar;
    document.getElementById('card-member-plan').textContent = m.plan;
    document.getElementById('card-member-cuts').textContent = `${left} de ${m.cutsLimit} disponíveis`;
    document.getElementById('card-member-bar').style.width = `${(left / m.cutsLimit) * 100}%`;
    document.getElementById('card-member-cut').textContent = `${m.visagism.cut} (${m.visagism.shape})`;
    document.getElementById('card-member-due').textContent = `Vencimento: ${m.dueDate}`;

    const st = document.getElementById('card-member-status');
    if (m.status === 'overdue') {
      st.className = 'px-3 py-1 rounded-full font-bold text-[11px] bg-rose-500/20 text-rose-500';
      st.textContent = `${m.daysOverdue} dias em atraso`;
      banner.classList.remove('hidden');
      banner.innerHTML = `
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div class="space-y-1">
            <span class="text-xs font-mono-ln font-bold uppercase tracking-wider text-[var(--accent)]">🤖 Assistente Financeiro Califórnia</span>
            <h3 class="text-base sm:text-lg font-extrabold">Olá, ${m.name.split(' ')[0]}! Vi que você está há ${m.daysOverdue} dias com o pagamento atrasado.</h3>
            <p class="text-xs sm:text-sm opacity-80">Podemos <strong>reajustar a parte do pagamento em atraso para outro dia</strong> por uma taxinha de <strong>R$ 5,00</strong>? Assim você mantém seu desconto e libera sua fila agora.</p>
          </div>
          <div class="flex flex-wrap gap-2.5 shrink-0">
            <button onclick="openCheckoutModal('Taxa de Reajuste de Vencimento (+7 dias)', 5.00, 'reschedule', '${m.id}')" class="btn-ln-primary px-4 py-3 rounded-2xl text-xs font-bold">
              📅 Reajustar Dia (+R$ 5,00)
            </button>
            <button onclick="openCheckoutModal('Quitar Mensalidade ${m.plan}', ${m.price}, 'pay_overdue', '${m.id}')" class="btn-ln-ghost px-4 py-3 rounded-2xl text-xs font-bold">
              💠 Pagar PIX (R$ ${m.price.toFixed(2)})
            </button>
          </div>
        </div>`;
    } else if (m.status === 'rescheduled') {
      st.className = 'px-3 py-1 rounded-full font-bold text-[11px] subtle-ln text-[var(--accent)]';
      st.textContent = `Reajustado (+R$ 5)`;
      banner.classList.add('hidden');
    } else {
      st.className = 'px-3 py-1 rounded-full font-bold text-[11px] bg-emerald-500/15 text-emerald-500';
      st.textContent = 'Em Dia';
      banner.classList.add('hidden');
    }
  }

  document.getElementById('hero-queue-count').textContent = `${state.queue.length} na fila`;
  const waitMin = state.queue.filter(q => q.status === 'waiting').length * 18;
  document.getElementById('queue-est-label').textContent = waitMin === 0 ? 'Sem espera' : `~${waitMin} min`;

  document.getElementById('live-queue-container').innerHTML = state.queue.map((q, idx) => `
    <div class="p-3.5 sm:p-4 rounded-2xl flex items-center justify-between gap-3 subtle-ln">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-xl font-mono-ln font-bold text-xs flex items-center justify-center shrink-0 ${
          q.status === 'in_chair' ? 'btn-ln-primary' : 'card-ln'
        }">
          ${q.status === 'in_chair' ? '✂' : `${idx + 1}º`}
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm truncate">${q.name}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full card-ln font-semibold shrink-0">${q.tag}</span>
          </div>
          <p class="text-xs opacity-75 truncate">${q.service} • Chegada às ${q.joinedAt}</p>
        </div>
      </div>
      <span class="font-mono-ln text-xs font-bold shrink-0 ${q.status === 'in_chair' ? 'text-[var(--accent)]' : ''}">
        ${q.status === 'in_chair' ? 'Na Cadeira' : q.status === 'relocated' ? 'Relocado' : `~${q.estMin}m`}
      </span>
    </div>
  `).join('');
}

async function handleJoinQueue() {
  try {
    const m = state.members.find(x => x.id === currentMemberId);
    state = await api('/api/queue/join', {
      memberId: m ? m.id : null,
      name: m ? m.name : 'Cliente Avulso',
      service: m ? `${m.visagism.cut} (Assinatura)` : 'Corte Ordem de Chegada (R$ 40)'
    });
    renderQueueAndMember();
    toast('Você entrou na fila por ordem de chegada!');
  } catch (e) {
    toast(e.message);
  }
}

async function handleRelocateDay() {
  try {
    const qItem = state.queue.find(q => q.memberId === currentMemberId) || state.queue[state.queue.length - 1];
    state = await api('/api/queue/relocate', { queueId: qItem?.id, newDay: 'Sábado (Manhã)' });
    renderQueueAndMember();
    toast('Dia relocado com antecedência! Crédito do mês preservado.');
  } catch (e) {
    toast(e.message);
  }
}

// ================= VISAGISMO IA 3D (AMOSTRA GRÁTIS VS EXCLUSIVO GOLD VIP) =================
function isCurrentUserGoldVip() {
  const m = state.members.find(x => x.id === currentMemberId);
  return Boolean(m && m.plan.includes('Gold') && m.status !== 'overdue');
}

function renderVisagism() {
  const isVip = isCurrentUserGoldVip();
  const shapes = Object.keys(VISAGISM_DB);
  document.getElementById('shape-buttons-grid').innerHTML = shapes.map(s => `
    <button onclick="selectFaceShape('${s}')" class="py-2.5 px-1 rounded-xl text-xs font-bold transition truncate ${
      currentShape === s ? 'btn-ln-primary' : 'subtle-ln hover:opacity-80'
    }">${s}</button>
  `).join('');

  // Atualiza Badge de Status (Amostra Grátis vs Oficial Gold VIP)
  const accessBadge = document.getElementById('vis-access-badge');
  const actionBtn = document.getElementById('btn-vis-action');
  if (accessBadge) {
    if (isVip) {
      accessBadge.className = 'text-[11px] font-bold px-3 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400';
      accessBadge.textContent = '👑 OFICIAL GOLD VIP LIBERADO (3 Ângulos HD)';
    } else {
      accessBadge.className = 'text-[11px] font-bold px-3 py-0.5 rounded-full subtle-ln text-[var(--accent)]';
      accessBadge.textContent = '🔒 MODO AMOSTRA GRÁTIS (1 de 3 Ângulos)';
    }
  }
  if (actionBtn) {
    actionBtn.textContent = isVip
      ? '💾 Salvar Corte na Minha Ficha VIP'
      : '👑 Assinar Gold VIP p/ Liberar Tudo';
  }

  const data = VISAGISM_DB[currentShape];
  document.getElementById('vis-angle-pill').textContent = data.angle;
  document.getElementById('vis-harmony-badge').textContent = data.harmony;
  document.getElementById('vis-recommended-cut').textContent = data.cut;
  document.getElementById('vis-recommended-desc').textContent = data.desc;
  document.getElementById('vis-recommended-tags').innerHTML = data.tags.map(t =>
    `<span class="px-3 py-1 rounded-xl card-ln font-bold text-[var(--accent)]">${t}</span>`
  ).join('');

  document.getElementById('vis-3-angles-grid').innerHTML = data.angles.map((a, idx) => {
    const isLocked = !isVip && idx > 0; // Libera apenas 1º ângulo (Frente) como amostra para quem não tem Gold VIP
    if (isLocked) {
      return `
        <div class="subtle-ln rounded-2xl overflow-hidden flex flex-col justify-between relative border border-dashed border-[#d96b43]/50">
          <div class="relative aspect-square bg-zinc-950 overflow-hidden">
            <img src="${a.img}" alt="${a.view}" class="w-full h-full object-cover object-center blur-md scale-110 opacity-30 select-none pointer-events-none" />
            <div class="absolute inset-0 bg-black/65 backdrop-blur-[3px] flex flex-col items-center justify-center p-4 text-center space-y-2.5">
              <div class="w-10 h-10 rounded-2xl btn-ln-primary flex items-center justify-center text-base shadow-lg">🔒</div>
              <span class="text-[10px] font-mono-ln font-bold uppercase tracking-wider text-[var(--accent)]">Exclusivo Melhor Plano</span>
              <h4 class="text-xs sm:text-sm font-extrabold text-white leading-tight">${a.view}</h4>
              <p class="text-[11px] text-zinc-300 leading-snug">Disponível oficialmente apenas para assinantes <strong>Califórnia Gold VIP (4x)</strong>.</p>
              <button onclick="openCheckoutModal('Califórnia Gold VIP (4x/mês)', 109.90, 'plan_gold')" class="btn-ln-primary px-3.5 py-2 rounded-xl text-[11px] font-bold shadow-md">
                👑 Desbloquear no Gold VIP
              </button>
            </div>
          </div>
          <p class="p-3.5 text-xs opacity-50 leading-relaxed select-none">🔒 Ângulo técnico e medidas de caimento bloqueados no modo amostra.</p>
        </div>
      `;
    }

    return `
      <div class="subtle-ln rounded-2xl overflow-hidden flex flex-col justify-between group">
        <div class="relative aspect-square bg-zinc-950 overflow-hidden">
          <img src="${a.img}" alt="${a.view}" class="w-full h-full object-cover object-center group-hover:scale-105 transition duration-500" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
          <div class="absolute inset-0 pointer-events-none">
            ${getAngleBiometricSVG(a.type, currentShape)}
          </div>
          <span class="absolute top-2.5 right-2.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-black/80 text-white">
            ${isVip ? `👑 ${a.badge}` : `AMOSTRA GRÁTIS • ${a.badge}`}
          </span>
          <span class="absolute bottom-2.5 left-3 text-xs font-extrabold text-white">${a.view}</span>
        </div>
        <p class="p-3.5 text-xs opacity-85 leading-relaxed">${a.text}</p>
      </div>
    `;
  }).join('');

  drawBiometricMesh(currentShape);
}

// Malha Biométrica 1:1 (viewBox 0..100 ocupando w-full h-full da foto) calibrada exatamente no contorno real do modelo
function getAngleBiometricSVG(type, shape = 'Quadrado') {
  if (type === 'front') {
    // Coordenadas calibradas 1:1 com a testa (y=22..24), têmporas (x=29..69), maçãs (x=30..68, y=53), maxilar (x=33..65, y=68) e queixo (x=49, y=81)
    const jawLeft = shape === 'Quadrado' ? '33,68' : shape === 'Redondo' ? '35,67' : shape === 'Diamante' ? '36,68' : '34,68';
    const jawRight = shape === 'Quadrado' ? '65,68' : shape === 'Redondo' ? '63,67' : shape === 'Diamante' ? '62,68' : '64,68';
    const cheekLeft = shape === 'Diamante' ? '28,52' : '30,52';
    const cheekRight = shape === 'Diamante' ? '70,52' : '68,52';

    const pts = [
      [49, 22], [66, 24], [69, 38], cheekRight.split(',').map(Number),
      jawRight.split(',').map(Number), [57, 78], [49, 81], [41, 78],
      jawLeft.split(',').map(Number), cheekLeft.split(',').map(Number), [29, 38], [32, 24]
    ];
    const polyStr = pts.map(p => p.join(',')).join(' ');
    const circles = pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.15" fill="#ffffff" stroke="#d96b43" stroke-width="0.7"/>`).join('');

    return `<svg viewBox="0 0 100 100" class="w-full h-full opacity-90">
      <!-- Eixo de Simetria Vertical Frontal -->
      <line x1="49" y1="15" x2="49" y2="85" stroke="#10b981" stroke-width="0.65" stroke-dasharray="2,2" opacity="0.85"/>
      <!-- Linhas de Proporção: Têmporas, Zigomático (Maçãs) e Mandíbula -->
      <line x1="29" y1="38" x2="69" y2="38" stroke="#10b981" stroke-width="0.5" stroke-dasharray="1.5,1.5" opacity="0.65"/>
      <line x1="${cheekLeft.split(',')[0]}" y1="52" x2="${cheekRight.split(',')[0]}" y2="52" stroke="#d96b43" stroke-width="0.55" stroke-dasharray="2,1.5" opacity="0.75"/>
      <line x1="${jawLeft.split(',')[0]}" y1="68" x2="${jawRight.split(',')[0]}" y2="68" stroke="#d96b43" stroke-width="0.65" stroke-dasharray="2,1.5" opacity="0.85"/>
      <!-- Triangulação Interna Visagista (Nariz/Olhos -> Maxilar) -->
      <polyline points="29,38 49,53 69,38" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="0.45"/>
      <polyline points="${jawLeft} 49,63 ${jawRight}" fill="none" stroke="rgba(217,107,67,0.45)" stroke-width="0.5"/>
      <!-- Contorno Anatômico Real do Rosto do Modelo -->
      <polygon points="${polyStr}" fill="rgba(217,107,67,0.06)" stroke="#d96b43" stroke-width="0.95" stroke-dasharray="2.5,1.5"/>
      ${circles}
    </svg>`;
  }

  if (type === 'side') {
    // Perfil 90°: Linha do pezinho/têmpora (42,27 -> 41,36), Zona do Degradê lateral (41,36 -> 78,42 -> 74,56 -> 44,48) e Ângulo Mandibular (24,69 -> 51,70 -> 58,52)
    return `<svg viewBox="0 0 100 100" class="w-full h-full opacity-90">
      <!-- Zona do Fade / Degradê Lateral acima da orelha -->
      <path d="M42,35 Q60,31 78,40 L75,55 Q60,45 43,48 Z" fill="rgba(217,107,67,0.16)" stroke="#d96b43" stroke-width="0.95" stroke-dasharray="2.5,1.5"/>
      <!-- Linha de Aresta Mandibular Lateral (Queixo -> Maxilar -> Orelha) -->
      <polyline points="27,28 24,42 20,51 24,69 51,70 58,52" fill="none" stroke="#10b981" stroke-width="0.9" stroke-dasharray="2,1.5"/>
      <circle cx="42" cy="35" r="1.2" fill="#fff" stroke="#d96b43" stroke-width="0.7"/>
      <circle cx="78" cy="40" r="1.2" fill="#fff" stroke="#d96b43" stroke-width="0.7"/>
      <circle cx="24" cy="69" r="1.2" fill="#fff" stroke="#10b981" stroke-width="0.7"/>
      <circle cx="51" cy="70" r="1.3" fill="#fff" stroke="#10b981" stroke-width="0.7"/>
      <circle cx="58" cy="52" r="1.2" fill="#fff" stroke="#10b981" stroke-width="0.7"/>
    </svg>`;
  }

  // Costas 180°: Coroa, Osso Occipital e Taper na Nuca
  return `<svg viewBox="0 0 100 100" class="w-full h-full opacity-90">
    <line x1="50" y1="18" x2="50" y2="78" stroke="#10b981" stroke-width="0.65" stroke-dasharray="2,2"/>
    <path d="M29,34 Q50,29 71,34 L67,64 Q50,67 33,64 Z" fill="rgba(16,185,129,0.10)" stroke="#10b981" stroke-width="0.9" stroke-dasharray="2.5,1.5"/>
    <line x1="28" y1="48" x2="72" y2="48" stroke="#d96b43" stroke-width="0.95" stroke-dasharray="2,1.5"/>
    <circle cx="29" cy="34" r="1.2" fill="#fff" stroke="#10b981" stroke-width="0.7"/>
    <circle cx="71" cy="34" r="1.2" fill="#fff" stroke="#10b981" stroke-width="0.7"/>
    <circle cx="33" cy="64" r="1.2" fill="#fff" stroke="#d96b43" stroke-width="0.7"/>
    <circle cx="67" cy="64" r="1.2" fill="#fff" stroke="#d96b43" stroke-width="0.7"/>
  </svg>`;
}

function selectFaceShape(s) {
  currentShape = s;
  renderVisagism();
}

function cycleShape() {
  const keys = Object.keys(VISAGISM_DB);
  currentShape = keys[(keys.indexOf(currentShape) + 1) % keys.length];
  renderVisagism();
  toast(`Formato de rosto selecionado: ${currentShape}`);
}

let isWebcamActive = false;
let customUserPhotoUrl = null;
let visFrontImg = null;

function runBiometricScanSequence(sourceLabel = 'Scanner 3D') {
  const overlay = document.getElementById('vis-scan-overlay');
  const stepEl = document.getElementById('vis-scan-step');
  const pctEl = document.getElementById('vis-scan-pct');
  const barEl = document.getElementById('vis-scan-bar');
  const statusPill = document.getElementById('cam-status-pill');

  if (overlay) overlay.classList.remove('hidden');
  if (statusPill) statusPill.textContent = `🔴 Escaneando (${sourceLabel})...`;

  const steps = [
    { pct: 22, text: '1/4 • Medindo Linha da Testa...' },
    { pct: 54, text: '2/4 • Mapeando Arco Zigomático...' },
    { pct: 84, text: '3/4 • Calculando Ângulo do Maxilar...' },
    { pct: 100, text: '✔ Biometria Concluída! Amostra Liberada' }
  ];

  steps.forEach((st, idx) => {
    setTimeout(() => {
      if (stepEl) stepEl.textContent = st.text;
      if (pctEl) pctEl.textContent = `${st.pct}%`;
      if (barEl) barEl.style.width = `${st.pct}%`;

      if (idx === steps.length - 1) {
        const keys = Object.keys(VISAGISM_DB);
        currentShape = keys[(keys.indexOf(currentShape) + 1) % keys.length];
        renderVisagism();
        if (statusPill) {
          statusPill.textContent = isWebcamActive
            ? '🟢 Câmera Ao Vivo • Rosto Mapeado'
            : customUserPhotoUrl
            ? '🟢 Selfie Mapeada c/ Sucesso'
            : `🟢 Rosto ${currentShape} Detectado`;
        }
        toast(`✔ Scan concluído! Formato ${currentShape} → Recomendação: ${VISAGISM_DB[currentShape].cut}`);
        setTimeout(() => { if (overlay) overlay.classList.add('hidden'); }, 1800);
      }
    }, (idx + 1) * 480);
  });
}

async function openCameraVisagism() {
  const video = document.getElementById('vis-webcam');
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 600, height: 600 } });
      video.srcObject = stream;
      video.classList.remove('hidden');
      isWebcamActive = true;
      drawBiometricMesh(currentShape);
      runBiometricScanSequence('Câmera Ao Vivo');
      return;
    } catch {}
  }
  // Se estiver via IP local HTTP no celular (onde o Chrome exige HTTPS para vídeo ao vivo) ou PC sem webcam,
  // roda o escaneamento biométrico completo na hora!
  runBiometricScanSequence('Biometria IA');
}

function handleVisagismPhoto(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    customUserPhotoUrl = e.target.result;
    const video = document.getElementById('vis-webcam');
    if (video) video.classList.add('hidden');
    isWebcamActive = false;

    visFrontImg = new Image();
    visFrontImg.onload = () => {
      // Atualiza também o 1º card da Amostra Grátis (Frente 0°) com a foto tirada pelo cliente!
      Object.values(VISAGISM_DB).forEach(entry => {
        if (entry.angles && entry.angles[0]) entry.angles[0].img = customUserPhotoUrl;
      });
      drawBiometricMesh(currentShape);
      runBiometricScanSequence('Sua Selfie');
    };
    visFrontImg.src = customUserPhotoUrl;
  };
  reader.readAsDataURL(file);
}

function drawBiometricMesh(shape) {
  const canvas = document.getElementById('vis-canvas');
  if (!canvas) return;
  if (!visFrontImg) {
    visFrontImg = new Image();
    visFrontImg.src = '/assets/vis-front.png';
    visFrontImg.onload = () => drawBiometricMesh(currentShape);
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Se a webcam ao vivo NÃO estiver ativa, desenha o retrato base/selfie no fundo do scanner
  if (!isWebcamActive && visFrontImg && visFrontImg.complete && visFrontImg.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = customUserPhotoUrl ? 0.85 : 0.45;
    drawImageCover(ctx, visFrontImg, 0, 0, 400, 400);
    ctx.restore();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  [90, 140, 180].forEach(r => { ctx.beginPath(); ctx.arc(200, 200, r, 0, Math.PI * 2); ctx.stroke(); });

  // Coordenadas em escala 400x400 fiéis às arestas do modelo (Testa, Têmporas, Zigomático, Maxilar, Queixo)
  const pts = shape === 'Quadrado'
    ? [[196, 88], [264, 96], [276, 152], [272, 208], [260, 272], [228, 312], [196, 324], [164, 312], [132, 272], [120, 208], [116, 152], [128, 96]]
    : shape === 'Redondo'
    ? [[196, 90], [260, 100], [276, 156], [274, 212], [252, 268], [224, 308], [196, 318], [168, 308], [140, 268], [118, 212], [116, 156], [132, 100]]
    : shape === 'Diamante'
    ? [[196, 88], [256, 98], [272, 152], [280, 208], [248, 272], [220, 312], [196, 326], [172, 312], [144, 272], [112, 208], [120, 152], [136, 98]]
    : [[196, 88], [260, 96], [274, 152], [270, 208], [256, 270], [226, 310], [196, 322], [166, 310], [136, 270], [122, 208], [118, 152], [132, 96]];

  // Eixo central e linhas horizontais de simetria
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(196, 60); ctx.lineTo(196, 345);
  ctx.moveTo(116, 152); ctx.lineTo(276, 152);
  ctx.moveTo(120, 208); ctx.lineTo(272, 208);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = '#d96b43';
  ctx.fillStyle = 'rgba(217, 107, 67, 0.10)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  pts.forEach(([x, y]) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d96b43';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

async function saveVisagismChoice() {
  if (!isCurrentUserGoldVip()) {
    toast('🔒 O salvamento e os 3 ângulos são exclusivos do plano Califórnia Gold VIP!');
    openCheckoutModal('Califórnia Gold VIP (4x/mês)', 109.90, 'plan_gold');
    return;
  }
  const data = VISAGISM_DB[currentShape];
  state = await api('/api/visagism/save', {
    memberId: currentMemberId,
    shape: currentShape,
    cut: data.cut,
    angles: data.angle,
    notes: data.desc
  });
  renderQueueAndMember();
  toast(`👑 Corte "${data.cut}" salvo oficialmente na sua ficha Gold VIP!`);
}

// ================= PLANOS & CHECKOUT =================
function setCalcCuts(n) {
  document.getElementById('calc-2').className = n === 2 ? 'px-3 py-1.5 rounded-xl text-xs font-bold btn-ln-primary' : 'px-3 py-1.5 rounded-xl text-xs font-bold subtle-ln';
  document.getElementById('calc-4').className = n === 4 ? 'px-3 py-1.5 rounded-xl text-xs font-bold btn-ln-primary' : 'px-3 py-1.5 rounded-xl text-xs font-bold subtle-ln';
  document.getElementById('calc-summary').textContent = n === 2
    ? '2 cortes/mês = Economize R$ 121/ano no Club'
    : '4 cortes/mês = Economize R$ 601/ano no Gold VIP';
}

function renderPlans() {
  const plans = [
    {
      name: 'Corte Avulso', price: 'R$ 40,00', amount: 40.00, action: 'plan_single', sub: 'Por visita (Ordem de chegada)',
      items: [
        'Atendimento por ordem de chegada',
        'Acesso à fila ao vivo no celular',
        '🔒 Visagismo IA: Apenas Amostra (1 ângulo)',
        'Sem fidelidade mensal'
      ],
      featured: false, btn: 'Pagar Corte Avulso (R$ 40)'
    },
    {
      name: 'Califórnia Club (2x/mês)', price: 'R$ 69,90/mês', amount: 69.90, action: 'plan_club', sub: 'Sai a R$ 34,95 por corte (Anual)',
      items: [
        '2 Cortes todo mês garantidos',
        'Relocação de dia c/ antecedência',
        'Acordo flexível se atrasar (+R$ 5)',
        '🔒 Visagismo IA: Apenas Amostra (1 ângulo)'
      ],
      featured: false, btn: 'Assinar Califórnia Club'
    },
    {
      name: 'Califórnia Gold VIP (4x/mês)', price: 'R$ 109,90/mês', amount: 109.90, action: 'plan_gold', sub: 'Sai a R$ 27,47 por corte (31% OFF)',
      items: [
        '4 Cortes no mês (Toda semana alinhado)',
        '👑 Visagismo IA 3D OFICIAL LIBERADO (3 Ângulos)',
        '💾 Salvar corte ideal direto na ficha do barbeiro',
        'Relocação livre + Economia de R$ 601,20/ano'
      ],
      featured: true, btn: '👑 Assinar Gold VIP (Liberar Tudo)'
    }
  ];

  document.getElementById('plans-cards-grid').innerHTML = plans.map(p => `
    <div class="card-ln rounded-3xl p-6 flex flex-col justify-between ${p.featured ? 'border-2 border-[#d96b43]' : ''}">
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-extrabold text-lg">${p.name}</h3>
          ${p.featured ? `<span class="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full subtle-ln text-[var(--accent)] shrink-0">👑 Melhor Plano</span>` : ''}
        </div>
        <div>
          <div class="font-mono-ln font-extrabold text-3xl">${p.price}</div>
          <p class="text-xs text-[var(--accent)] font-bold mt-1">${p.sub}</p>
        </div>
        <ul class="space-y-2.5 pt-4 border-t border-[var(--border)] text-xs sm:text-sm opacity-90">
          ${p.items.map(i => `<li class="flex items-center gap-2"><span class="text-[var(--accent)] font-bold">✓</span><span>${i}</span></li>`).join('')}
        </ul>
      </div>
      <button onclick="openCheckoutModal('${p.name}', ${p.amount}, '${p.action}')" class="mt-6 w-full py-3.5 rounded-2xl text-xs sm:text-sm font-bold ${
        p.featured ? 'btn-ln-primary' : 'btn-ln-ghost'
      }">${p.btn}</button>
    </div>
  `).join('');
}

function renderReviews() {
  document.getElementById('reviews-grid').innerHTML = REVIEWS.map(r => `
    <div class="card-ln rounded-3xl p-5 space-y-3 flex flex-col justify-between">
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[var(--accent)] font-bold text-sm">${r.stars}</span>
          <span class="text-[11px] opacity-60">${r.date}</span>
        </div>
        <p class="text-xs sm:text-sm leading-relaxed opacity-90">"${r.text}"</p>
      </div>
      <div class="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
        <strong>${r.name}</strong>
        <span class="subtle-ln px-2.5 py-0.5 rounded-full text-[10px] font-bold text-[var(--accent)]">${r.cut}</span>
      </div>
    </div>
  `).join('');
}

window.addEventListener('DOMContentLoaded', init);
