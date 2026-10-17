let state = { shop: {}, members: [], queue: [], transactions: [] };
let currentMemberId = localStorage.getItem('cal_member_id') || 'avulso';
let currentShape = 'Quadrado';
let pendingCheckoutAction = null;

// ================= LENIS SMOOTH SCROLL + HERO TIMELAPSE CANVAS =================
const tlImages = [];
const TL_SOURCES = [
  '/assets/timelapse-1.png',
  '/assets/timelapse-2.png',
  '/assets/timelapse-3.png',
  '/assets/timelapse-4.png'
];
let targetProgress = 0;
let smoothProgress = 0;
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

function drawImageCover(ctx, img, x, y, w, h, offsetX = 0, offsetY = 0) {
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const canvasRatio = w / h;
  let drawW, drawH, drawX, drawY;

  if (canvasRatio > imgRatio) {
    drawW = w;
    drawH = w / imgRatio;
    drawX = x;
    drawY = y + (h - drawH) * 0.35;
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

// ================= BANCO DE VISAGISMO (3 PERSPECTIVAS DE REFERÊNCIA DO CORTE) =================
const VISAGISM_DB = {
  Quadrado: {
    cut: 'Mid Fade + Crop Texturizado',
    angle: '118° Maxilar',
    harmony: '98.8% Compatibilidade',
    desc: 'Rostos quadrados possuem maxilar forte e testa alinhada. O Mid Fade limpa as laterais na medida certa, enquanto o topo texturizado na tesoura suaviza as linhas superiores.',
    tags: ['Degradê Médio (Zero Alta)', 'Crop Texturizado', 'Pomada Matte'],
    angles: [
      { view: '1. Frente (Frontal 0°)', badge: 'Simetria Frontal', text: 'Topo desconectado equilibrando a linha da testa com o maxilar quadrado.', img: '/assets/vis-front.png', type: 'front' },
      { view: '2. Lado (Perfil 90°)', badge: 'Mid Fade Lateral', text: 'Transição suave na lateral valorizando a aresta mandibular.', img: '/assets/vis-side.png', type: 'side' },
      { view: '3. Costas (Nuca 180°)', badge: 'Taper Nuca', text: 'Acabamento esfumado na nuca acompanhando a curvatura da coroa.', img: '/assets/vis-back.png', type: 'back' }
    ]
  },
  Redondo: {
    cut: 'High Fade + Quiff Estruturado',
    angle: '132° Curvatura',
    harmony: '98.4% Compatibilidade',
    desc: 'Para rostos de curvatura suave, o visagismo cria verticalidade: subimos o degradê na lateral (High Fade) para afinar o contorno e estruturamos o topete frontal.',
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
    desc: 'Com maçãs do rosto projetadas e queixo mais fino, preservamos densidade nas têmporas com um Low Fade em arco e franja curta texturizada.',
    tags: ['Low Fade em Arco', 'Têmporas Cheias', 'French Crop'],
    angles: [
      { view: '1. Frente (Frontal 0°)', badge: 'Equilíbrio Testa', text: 'Franja curta texturizada preenchendo a testa em harmonia com as maçãs.', img: '/assets/vis-front.png', type: 'front' },
      { view: '2. Lado (Perfil 90°)', badge: 'Low Fade em Arco', text: 'Degradê baixo contornando a orelha sem esvaziar as têmporas.', img: '/assets/vis-side.png', type: 'side' },
      { view: '3. Costas (Nuca 180°)', badge: 'Coroa Encorpada', text: 'Caimento encorpado no osso occipital com base da nuca disfarçada.', img: '/assets/vis-back.png', type: 'back' }
    ]
  },
  Oval: {
    cut: 'Taper Fade California + Barba Alinhada',
    angle: 'Proporção 1.38',
    harmony: '99.5% Compatibilidade',
    desc: 'Proporções naturalmente equilibradas entre testa e mandíbula. O clássico Taper Fade California limpa costeletas e nuca preservando a harmonia natural.',
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
let currentPixPaymentId = null;
let selectedCalendarDays = [];
let activeInspectDay = '';

function updateState(res) {
  if (!res) return;
  if (Array.isArray(res.members)) {
    state = res;
  } else if (res.state && Array.isArray(res.state.members)) {
    state = res.state;
  }
}

function getActiveMember() {
  const list = Array.isArray(state?.members) ? state.members : [];
  const m = list.find(x => x.id === currentMemberId);
  if (m && (m.status === 'active' || m.status === 'rescheduled' || m.status === 'overdue')) {
    return m;
  }
  return null;
}

function handleAccountButtonClick() {
  const m = getActiveMember();
  const isPaidActive = Boolean(m && (m.status === 'active' || m.status === 'rescheduled'));
  if (isPaidActive) {
    renderVipArea();
    const vipSection = document.getElementById('vip-area-section');
    if (vipSection) {
      vipSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast(`👑 Painel do Assinante de ${m.name.split(' ')[0]} aberto!`);
      return;
    }
  }
  toast('🔒 Área exclusiva para assinantes! Faça login na sua conta ativa para acessar.');
  openLoginModal('login');
}

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

function openLoginModal(initialTab = 'login', preselectedPlan = null) {
  switchAuthTab(initialTab);
  if (preselectedPlan) {
    const regPlan = document.getElementById('reg-plan');
    if (regPlan) regPlan.value = preselectedPlan;
  }

  const wrapper = document.getElementById('demo-accounts-wrapper');
  const list = document.getElementById('demo-accounts-list');
  const m = getActiveMember();
  if (m && wrapper && list) {
    wrapper.classList.remove('hidden');
    list.innerHTML = `
      <div class="p-2.5 rounded-xl subtle-ln flex items-center justify-between text-xs">
        <span class="font-bold">Conectado: ${m.name}</span>
        <button onclick="logoutClient()" class="text-rose-400 font-bold hover:underline">Sair da Conta</button>
      </div>
    `;
  } else if (wrapper) {
    wrapper.classList.add('hidden');
  }
  document.getElementById('client-login-modal').classList.remove('hidden');
}

function closeLoginModal() {
  document.getElementById('client-login-modal').classList.add('hidden');
}

function logoutClient() {
  currentMemberId = 'avulso';
  clientAuthToken = '';
  selectedCalendarDays = [];
  localStorage.removeItem('cal_member_id');
  localStorage.removeItem('cal_client_token');
  closeLoginModal();
  renderAll();
  toast('Você saiu da sua conta.');
}

async function submitClientLogin() {
  try {
    const phone = document.getElementById('login-phone').value;
    const pin = document.getElementById('login-pin').value;
    const res = await api('/api/client/login', { phone, pin });
    updateState(res);

    // Bloqueia entrada se a conta ainda não pagou nenhum plano!
    if (res.requiresPayment) {
      closeLoginModal();
      const isGold = String(res.plan || '').includes('Gold');
      openCheckoutModal(
        res.plan || 'Califórnia Gold VIP (4x/mês)',
        res.price || (isGold ? 109.90 : 69.90),
        isGold ? 'plan_gold' : 'plan_club',
        res.memberId
      );
      toast('🔒 Conclua o pagamento do seu plano (PIX ou Cartão) para liberar o acesso à sua conta!');
      return;
    }

    currentMemberId = res.memberId;
    localStorage.setItem('cal_member_id', res.memberId);
    if (res.token) {
      clientAuthToken = res.token;
      localStorage.setItem('cal_client_token', res.token);
    }
    const m = (state.members || []).find(x => x.id === currentMemberId);
    selectedCalendarDays = Array.isArray(m?.scheduledDays) ? [...m.scheduledDays] : [];
    closeLoginModal();
    renderAll();
    toast(`👑 Bem-vindo, ${res.name}! Redirecionando para sua Área VIP...`);
    setTimeout(() => {
      document.getElementById('vip-area-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 180);
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
    const visData = VISAGISM_DB[currentShape] || VISAGISM_DB.Oval;

    const res = await api('/api/client/register', {
      name,
      cpf,
      phone,
      pin,
      planKey,
      shape: currentShape,
      cut: visData.cut,
      angles: lastTelemetryLabel || visData.angle
    });
    updateState(res);

    // NÃO loga o cliente antes de pagar! Só loga se já for assinante ativo.
    if (res.status === 'active' || res.status === 'rescheduled') {
      currentMemberId = res.memberId;
      localStorage.setItem('cal_member_id', res.memberId);
      closeLoginModal();
      renderAll();
      toast('👑 Sua assinatura já está ativa! Bem-vindo de volta.');
      return;
    }

    currentMemberId = 'avulso';
    localStorage.removeItem('cal_member_id');
    closeLoginModal();
    renderAll();

    const isGold = planKey === 'gold';
    openCheckoutModal(
      isGold ? 'Califórnia Gold VIP (4x/mês)' : 'Califórnia Club (2x/mês)',
      isGold ? 109.90 : 69.90,
      isGold ? 'plan_gold' : 'plan_club',
      res.memberId
    );
    toast('🔒 CPF validado! Agora confirme o pagamento (PIX ou Cartão) para ativar e liberar sua conta.');
  } catch (e) {
    toast(e.message);
  }
}

// ================= CHECKOUT FINANCEIRO ASAAS (QR CODE REAL & VALIDAÇÃO LUHN) =================
function isValidCardLuhnClient(numStr) {
  const digits = String(numStr || '').replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function copyPixPayload() {
  const input = document.getElementById('pix-payload-input');
  if (!input || !input.value || input.value.includes('Gerando')) {
    return toast('Aguarde o QR Code PIX ser gerado...');
  }
  navigator.clipboard?.writeText(input.value);
  toast('✔ Código PIX Copia e Cola copiado!');
}

async function loadRealPixQrCode(title, amount, memberId) {
  const qrImg = document.getElementById('pix-qr-img');
  const qrLoading = document.getElementById('pix-qr-loading');
  const payloadInput = document.getElementById('pix-payload-input');
  const statusHint = document.getElementById('pix-status-hint');

  currentPixPaymentId = null;
  if (qrImg) {
    qrImg.classList.add('hidden');
    qrImg.removeAttribute('src');
  }
  if (qrLoading) {
    qrLoading.classList.remove('hidden');
    qrLoading.textContent = 'Gerando QR Code PIX oficial Asaas...';
  }
  if (payloadInput) payloadInput.value = 'Gerando código PIX Copia e Cola...';
  if (statusHint) statusHint.textContent = 'Conectando ao Banco Central via Asaas...';

  try {
    const res = await api('/api/asaas/pix-qrcode', {
      memberId,
      amount,
      title
    });
    currentPixPaymentId = res.paymentId;
    if (qrImg && res.encodedImage) {
      qrImg.src = `data:image/png;base64,${res.encodedImage}`;
      qrImg.classList.remove('hidden');
    }
    if (qrLoading) qrLoading.classList.add('hidden');
    if (payloadInput) payloadInput.value = res.payload || '';
    if (statusHint) statusHint.textContent = '🟢 QR Code PIX pronto! Escaneie no app do seu banco e clique abaixo.';
  } catch (e) {
    if (qrLoading) qrLoading.textContent = e.message || 'Informe seu CPF para gerar o PIX.';
    if (payloadInput) payloadInput.value = '';
    if (statusHint) statusHint.textContent = '⚠️ Cadastre seu CPF para emitir o QR Code PIX.';
  }
}

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
    ? 'Já Paguei o PIX (Verificar no Banco)'
    : 'Validar e Cobrar no Cartão de Crédito';
}

function openCheckoutModal(title, amount, actionType, memberId = null) {
  const list = Array.isArray(state?.members) ? state.members : [];
  const m = list.find(x => x.id === (memberId || currentMemberId));
  // Exige cadastro com CPF validado para gerar cobrança PIX ou Cartão no Asaas
  if (!m) {
    toast('Preencha seus dados (CPF + WhatsApp) para emitir o PIX ou pagar no Cartão!');
    openLoginModal('register', actionType === 'plan_club' ? 'club' : 'gold');
    return;
  }

  document.getElementById('chk-title').textContent = title;
  document.getElementById('chk-desc').textContent = 'Asaas Pagamentos • Validação Bancária Oficial';
  document.getElementById('chk-amount').textContent = `R$ ${Number(amount).toFixed(2)}`;
  pendingCheckoutAction = { title, amount: Number(amount), actionType, memberId: m.id };
  const nameField = document.getElementById('cc-name');
  if (nameField && m.name && !nameField.value) nameField.value = m.name.toUpperCase();

  switchPaymentMethod('PIX_AUTOMATICO');
  document.getElementById('checkout-modal').classList.remove('hidden');
  loadRealPixQrCode(title, Number(amount), m.id);
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.add('hidden');
}

async function confirmCheckoutPayment() {
  if (!pendingCheckoutAction) return closeCheckoutModal();
  const { title, amount, actionType, memberId } = pendingCheckoutAction;
  const btn = document.getElementById('btn-confirm-checkout');
  const origText = btn ? btn.textContent : '';

  try {
    if (selectedPaymentMethod === 'PIX_AUTOMATICO') {
      if (!currentPixPaymentId) {
        return toast('Aguarde o QR Code PIX terminar de carregar.');
      }
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Consultando Banco Central / Asaas...';
      }
      const res = await api('/api/asaas/check-payment', {
        paymentId: currentPixPaymentId,
        memberId,
        plan: title,
        amount
      });
      updateState(res);
      currentMemberId = memberId;
      localStorage.setItem('cal_member_id', memberId);
      const m = (state.members || []).find(x => x.id === currentMemberId);
      selectedCalendarDays = Array.isArray(m?.scheduledDays) ? [...m.scheduledDays] : [];
      closeCheckoutModal();
      renderAll();
      toast('👑 Pagamento PIX confirmado pelo banco! Sua conta e Área VIP estão liberadas!');
      setTimeout(() => {
        document.getElementById('vip-area-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
      return;
    }

    // Validação rigorosa de Cartão de Crédito antes de enviar ao Asaas
    const number = document.getElementById('cc-number')?.value || '';
    const holderName = document.getElementById('cc-name')?.value || '';
    const expiry = document.getElementById('cc-expiry')?.value || '';
    const cvv = document.getElementById('cc-cvv')?.value || '';
    const cpf = document.getElementById('cc-cpf')?.value || '';

    if (!isValidCardLuhnClient(number)) {
      return toast('❌ Número de cartão inválido! Verifique os 16 dígitos.');
    }
    if (holderName.trim().split(/\s+/).length < 2) {
      return toast('❌ Digite o nome e sobrenome impresso no cartão.');
    }
    if (!/^\d{2}\/\d{2,4}$/.test(expiry.trim())) {
      return toast('❌ Validade inválida! Use o formato MM/AA (ex: 08/29).');
    }
    if (!/^\d{3,4}$/.test(cvv.trim())) {
      return toast('❌ CVV inválido! Digite os 3 ou 4 dígitos de segurança.');
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Autorizando Cartão na Operadora...';
    }

    const targetPlan = (actionType === 'plan_gold' || title.includes('Gold'))
      ? 'Califórnia Gold (4 Cortes/mês)'
      : title.includes('Club')
      ? 'Califórnia Club (2 Cortes/mês)'
      : 'Corte Avulso';

    const res = await api('/api/asaas/subscribe', {
      memberId,
      plan: targetPlan,
      amount,
      billingType: 'CREDIT_CARD',
      methodLabel: 'Cartão de Crédito Asaas',
      creditCard: { number, holderName, expiry, cvv, cpf }
    });
    updateState(res);
    currentMemberId = memberId;
    localStorage.setItem('cal_member_id', memberId);
    const m = (state.members || []).find(x => x.id === currentMemberId);
    selectedCalendarDays = Array.isArray(m?.scheduledDays) ? [...m.scheduledDays] : [];

    closeCheckoutModal();
    renderAll();
    toast('👑 Cartão autorizado com sucesso! Sua conta VIP foi ativada!');
    setTimeout(() => {
      document.getElementById('vip-area-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  } catch (e) {
    toast(e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = origText || (selectedPaymentMethod === 'PIX_AUTOMATICO'
        ? 'Já Paguei o PIX (Verificar no Banco)'
        : 'Validar e Cobrar no Cartão de Crédito');
    }
  }
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
  initMediaPipeFaceLandmarker();
  const res = await api('/api/state');
  updateState(res);
  const m = getActiveMember();
  if (!m) {
    currentMemberId = 'avulso';
    localStorage.removeItem('cal_member_id');
  } else {
    selectedCalendarDays = Array.isArray(m.scheduledDays) ? [...m.scheduledDays] : [];
  }
  renderAll();
}

function renderAll() {
  renderQueueAndMember();
  renderVisagism();
  renderVipArea();
  renderPlans();
  renderReviews();
}

function renderQueueAndMember() {
  const m = getActiveMember();
  const banner = document.getElementById('overdue-banner');
  const navName = document.getElementById('nav-user-name');
  const guestBox = document.getElementById('queue-guest-box');

  if (!m) {
    navName.textContent = 'Minha Conta';
    if (guestBox) guestBox.classList.remove('hidden');
    document.getElementById('card-member-name').textContent = 'Visitante (Sem Plano)';
    document.getElementById('card-member-avatar').textContent = 'VA';
    document.getElementById('card-member-plan').textContent = 'Corte Avulso (R$ 40,00)';
    document.getElementById('card-member-cuts').textContent = 'Assine p/ pagar R$ 27,47/corte';
    document.getElementById('card-member-bar').style.width = '15%';
    document.getElementById('card-member-cut').textContent = `${VISAGISM_DB[currentShape].cut} (${currentShape})`;
    document.getElementById('card-member-due').textContent = 'Pagamento por visita';
    document.getElementById('card-member-status').className = 'px-3 py-1 rounded-full font-bold text-[11px] subtle-ln';
    document.getElementById('card-member-status').textContent = 'Visitante';
    banner.classList.add('hidden');
  } else {
    navName.textContent = `👑 ${m.name.split(' ')[0]}`;
    if (guestBox) guestBox.classList.add('hidden');
    const left = Math.max(0, m.cutsLimit - m.cutsUsed);
    document.getElementById('card-member-name').textContent = m.name;
    document.getElementById('card-member-avatar').textContent = m.avatar;
    document.getElementById('card-member-plan').textContent = m.plan;
    document.getElementById('card-member-cuts').textContent = `${left} de ${m.cutsLimit} disponíveis`;
    document.getElementById('card-member-bar').style.width = `${(left / m.cutsLimit) * 100}%`;
    document.getElementById('card-member-cut').textContent = `${m.visagism.cut} (${m.visagism.shape})`;
    document.getElementById('card-member-due').textContent = `Vencimento: ${m.dueDate}`;

    const st = document.getElementById('card-member-status');
    if (m.status === 'pending_payment') {
      st.className = 'px-3 py-1 rounded-full font-bold text-[11px] bg-amber-500/20 text-amber-400';
      st.textContent = 'Aguardando Pagamento';
      banner.classList.remove('hidden');
      banner.innerHTML = `
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div class="space-y-1">
            <span class="text-xs font-mono-ln font-bold uppercase tracking-wider text-[var(--accent)]">⏳ Ativação Pendente • Asaas</span>
            <h3 class="text-base sm:text-lg font-extrabold">Olá, ${m.name.split(' ')[0]}! Conclua o pagamento do seu ${m.plan} para liberar seus ${m.cutsLimit} dias do mês e descontos no Bar.</h3>
          </div>
          <div class="flex flex-wrap gap-2.5 shrink-0">
            <button onclick="openCheckoutModal('${m.plan}', ${m.price}, '${m.plan.includes('Gold') ? 'plan_gold' : 'plan_club'}', '${m.id}')" class="btn-ln-primary px-4 py-3 rounded-2xl text-xs font-bold">
              💠 Gerar QR Code PIX / Pagar Agora (R$ ${m.price.toFixed(2)})
            </button>
          </div>
        </div>`;
    } else if (m.status === 'overdue') {
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

  const queueList = Array.isArray(state?.queue) ? state.queue : [];
  const todayVips = Array.isArray(state?.todayVipList) ? state.todayVipList : [];
  const cutMin = state?.cutDurationMin || 40;

  // Monta linha do tempo unificada: Fila por Ordem de Chegada + Horários Reservados Hoje (Gold VIP & Club)
  const unifiedEntries = [
    ...queueList.map((q, idx) => ({
      kind: 'queue',
      id: q.id,
      name: q.name,
      tag: q.tag,
      service: q.service,
      status: q.status,
      joinedAt: q.joinedAt,
      assignedTime: q.assignedTime || '08:20',
      estMin: typeof q.estMin === 'number' ? q.estMin : idx * cutMin,
      skippedVip: q.skippedVip || null,
      orderIdx: idx + 1
    })),
    ...todayVips.map(v => ({
      kind: 'vip_reserved',
      id: 'vip_' + v.time,
      name: v.name,
      tag: v.plan,
      service: `${v.service} • Horário Exclusivo Agendado`,
      assignedTime: v.time,
      estMin: null
    }))
  ].sort((a, b) => String(a.assignedTime).localeCompare(String(b.assignedTime)));

  document.getElementById('hero-queue-count').textContent = `${queueList.length} na fila`;
  const lastQueueItem = queueList[queueList.length - 1];
  const nextWaitMin = queueList.length === 0 ? 0 : (lastQueueItem.estMin || 0) + cutMin;
  document.getElementById('queue-est-label').textContent =
    nextWaitMin === 0 ? 'Sem espera (Livre)' : `~${nextWaitMin} min (${cutMin}m/corte)`;

  document.getElementById('live-queue-container').innerHTML = unifiedEntries.length === 0
    ? `<div class="p-5 rounded-2xl subtle-ln text-center text-xs sm:text-sm opacity-80">💈 <strong>Cadeira livre agora!</strong> Nenhum cliente na fila ou agendado neste horário (${cutMin} min por corte).</div>`
    : unifiedEntries.map(item => {
      if (item.kind === 'vip_reserved') {
        return `
          <div class="p-3.5 sm:p-4 rounded-2xl flex items-center justify-between gap-3 card-ln border border-[#d96b43]/60">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-xl btn-ln-primary font-mono-ln font-bold text-xs flex items-center justify-center shrink-0">
                👑
              </div>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-extrabold text-sm truncate">${item.name}</span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold shrink-0">${item.tag} • Prioridade</span>
                </div>
                <p class="text-xs opacity-85 truncate">📅 Reservado no Painel VIP para <strong>Hoje às ${item.assignedTime}</strong> (${cutMin} min reservados)</p>
              </div>
            </div>
            <span class="font-mono-ln text-xs font-extrabold text-[var(--accent)] shrink-0">
              ⏰ ${item.assignedTime}
            </span>
          </div>
        `;
      }

      return `
        <div class="p-3.5 sm:p-4 rounded-2xl flex items-center justify-between gap-3 subtle-ln">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-xl font-mono-ln font-bold text-xs flex items-center justify-center shrink-0 ${
              item.status === 'in_chair' ? 'btn-ln-primary' : 'card-ln'
            }">
              ${item.status === 'in_chair' ? '✂' : `${item.orderIdx}º`}
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-bold text-sm truncate">${item.name}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full card-ln font-semibold shrink-0">${item.tag}</span>
                <span class="text-[10px] font-mono-ln px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold shrink-0">⏰ Slot ${item.assignedTime}</span>
              </div>
              <p class="text-xs opacity-75 truncate">${item.service} • Chegada às ${item.joinedAt}</p>
              ${item.skippedVip ? `<p class="text-[11px] text-amber-400 font-semibold mt-0.5">⚡ Horário ajustado p/ ${item.assignedTime} (desviou de reserva VIP: ${item.skippedVip})</p>` : ''}
            </div>
          </div>
          <span class="font-mono-ln text-xs font-bold shrink-0 ${item.status === 'in_chair' ? 'text-[var(--accent)]' : ''}">
            ${item.status === 'in_chair' ? `Na Cadeira (${item.assignedTime})` : `~${item.estMin} min`}
          </span>
        </div>
      `;
    }).join('');
}

async function handleJoinQueue() {
  try {
    const m = getActiveMember();
    const guestInput = document.getElementById('queue-guest-name');
    const guestName = guestInput ? guestInput.value.trim() : '';

    if (!m && guestName.length < 2) {
      if (guestInput) guestInput.focus();
      return toast('Digite seu nome no campo acima para entrar na fila!');
    }

    const res = await api('/api/queue/join', {
      memberId: m ? m.id : null,
      name: m ? m.name : guestName,
      service: m ? `${m.visagism.cut} (Assinatura)` : `Corte ${VISAGISM_DB[currentShape].cut} (R$ 40)`
    });
    updateState(res);
    if (guestInput) guestInput.value = '';
    renderAll();
    const myEntry = (state.queue || [])[state.queue.length - 1];
    toast(myEntry?.skippedVip
      ? `⚡ Você entrou na fila! Horário alocado às ${myEntry.assignedTime} (respeitando reserva VIP de ${myEntry.skippedVip}).`
      : `✂ Você entrou na fila! Atendimento previsto às ${myEntry?.assignedTime || 'agora'} (40 min/corte).`);
  } catch (e) {
    toast(e.message);
  }
}

async function handleRelocateDay() {
  try {
    const qList = state?.queue || [];
    const qItem = qList.find(q => q.memberId === currentMemberId) || qList[qList.length - 1];
    const res = await api('/api/queue/relocate', { queueId: qItem?.id, newDay: 'Sábado (Manhã)' });
    updateState(res);
    renderAll();
    toast('📅 Vaga de hoje liberada e relocada com antecedência! Fila de 40 min recalculada.');
  } catch (e) {
    toast(e.message);
  }
}

// ================= RECONHECIMENTO FACIAL REAL (MEDIAPIPE 478 LANDMARKS + PIXEL CONTOUR ENGINE) =================
let mpFaceLandmarker = null;
let isWebcamActive = false;
let customUserPhotoUrl = null;
let visFrontImg = null;
let detectedFaceData = null; // Guarda os vértices reais detectados e a telemetria antropométrica do rosto
let lastTelemetryLabel = '';

async function initMediaPipeFaceLandmarker() {
  try {
    const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
    const filesetResolver = await vision.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );
    mpFaceLandmarker = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU'
      },
      outputFaceBlendshapes: false,
      runningMode: 'IMAGE',
      numFaces: 1
    });
  } catch {}
}

function calcAngleDeg(A, B, C) {
  const v1x = A[0] - B[0], v1y = A[1] - B[1];
  const v2x = C[0] - B[0], v2y = C[1] - B[1];
  const dot = v1x * v2x + v1y * v2y;
  const mag = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (mag === 0) return 120;
  return Math.round((Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI);
}

// Calcula enquadramento inteligente para que selfies de celular nunca fiquem gigantes ou cortando o queixo/cabelo
function computePortraitFraming(imgW, imgH, faceBox) {
  // faceBox em coordenadas normalizadas [0..1]: { minX, minY, maxX, maxY }
  const fW = Math.max(0.18, faceBox.maxX - faceBox.minX);
  const fH = Math.max(0.22, faceBox.maxY - faceBox.minY);
  const fCx = (faceBox.minX + faceBox.maxX) / 2;
  const fCy = (faceBox.minY + faceBox.maxY) / 2;

  // Queremos que a altura da face (testa -> queixo) ocupe ~205px dos 400px do canvas (~51% da altura),
  // deixando espaço em cima para o cabelo e embaixo para o pescoço/queixo!
  const targetFacePxH = 205;
  const targetFacePxW = 168;
  const scaleH = targetFacePxH / (fH * imgH);
  const scaleW = targetFacePxW / (fW * imgW);
  const scale = Math.min(scaleH, scaleW);

  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const drawX = 200 - fCx * drawW;
  const drawY = 208 - fCy * drawH;

  return { drawX, drawY, drawW, drawH };
}

// Classificador Antropométrico Real baseado nas medidas extraídas do rosto
function classifyFromMeasurements(wForehead, wCheek, wJaw, wChin, hFace, jawAngle) {
  const safeCheek = Math.max(1, wCheek);
  // Correção de perspectiva de câmera frontal (lentes de celular aumentam o centro zigomático em ~7%)
  const foreheadRatio = Math.min(1.05, (wForehead / safeCheek) * 1.06);
  const jawRatio = Math.min(1.05, (wJaw / safeCheek) * 1.07);
  const chinToJaw = Math.min(1.0, wChin / Math.max(1, wJaw));
  const heightIndex = hFace / safeCheek;

  // Pontuação contínua para cada formato de rosto
  let scores = {
    Quadrado: 0,
    Redondo: 0,
    Diamante: 0,
    Oval: 0
  };

  // Quadrado: maxilar largo (>= 83% do zigomático), queixo firme e ângulo mandibular mais marcado
  scores.Quadrado += (jawRatio - 0.78) * 35;
  scores.Quadrado += (chinToJaw - 0.56) * 25;
  scores.Quadrado += (126 - jawAngle) * 0.35;
  scores.Quadrado += (foreheadRatio - 0.78) * 15;

  // Redondo: menor índice de altura vertical (< 1.28) e mandíbula mais curva/aberta (> 125°)
  scores.Redondo += (1.30 - heightIndex) * 42;
  scores.Redondo += (jawAngle - 122) * 0.45;
  scores.Redondo += (jawRatio - 0.76) * 18;

  // Diamante: zigomático bem mais largo que a testa (< 0.80) e queixo mais estreito/pontudo
  scores.Diamante += (0.83 - foreheadRatio) * 45;
  scores.Diamante += (0.81 - jawRatio) * 30;
  scores.Diamante += (0.58 - chinToJaw) * 28;

  // Oval: proporção equilibrada entre altura (1.28..1.46) e transição suave testa -> maçãs -> maxilar
  scores.Oval += (1 - Math.abs(heightIndex - 1.36) * 3.2) * 8;
  scores.Oval += (1 - Math.abs(jawRatio - 0.81) * 4.5) * 6;
  scores.Oval += (1 - Math.abs(foreheadRatio - 0.85) * 4.0) * 5;

  let bestShape = 'Oval';
  let bestScore = -999;
  for (const [k, val] of Object.entries(scores)) {
    if (val > bestScore) {
      bestScore = val;
      bestShape = k;
    }
  }

  const fPct = Math.round(foreheadRatio * 100);
  const jPct = Math.round(jawRatio * 100);
  const hIdx = heightIndex.toFixed(2);
  const harmonyPct = (97.8 + Math.min(1.9, Math.max(0.2, bestScore * 0.12))).toFixed(1);

  return {
    shape: bestShape,
    foreheadPct: fPct,
    jawPct: jPct,
    jawAngle,
    heightIndex: hIdx,
    harmony: `${harmonyPct}% Compatibilidade`,
    angleLabel: `${jawAngle}° Maxilar • ${hIdx}`,
    metricsText: `📐 Medidas Reais do Seu Rosto: Testa ${fPct}% • Zigomático 100% • Maxilar ${jPct}% • Ângulo ${jawAngle}° • Índice ${hIdx}`
  };
}

// Motor 1: Extrai os 16 vértices anatômicos + linhas internas dos 478 pontos do MediaPipe FaceLandmarker
function buildDataFromMediaPipe(landmarks, imgW, imgH) {
  const pt = (idx) => [landmarks[idx].x, landmarks[idx].y];

  // Topo da testa (estimando a linha do cabelo acima do ponto 10 usando a distância glabela->nariz)
  const p10 = pt(10);
  const p168 = pt(168);
  const p152 = pt(152);
  const browToChinY = Math.abs(p152[1] - p168[1]);
  const hairlineY = Math.max(0.04, p10[1] - browToChinY * 0.22);

  const rawContourIdx = [10, 338, 297, 332, 356, 454, 361, 397, 379, 152, 150, 172, 132, 234, 127, 103, 67, 109];
  const contourNorm = rawContourIdx.map((idx, i) => {
    const [x, y] = pt(idx);
    if (idx === 10) return [x, hairlineY];
    if (idx === 338 || idx === 109) return [x, y - browToChinY * 0.14];
    if (idx === 297 || idx === 67) return [x, y - browToChinY * 0.08];
    return [x, y];
  });

  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  contourNorm.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });

  const framing = computePortraitFraming(imgW, imgH, { minX, minY, maxX, maxY });
  const toCanvas = ([nx, ny]) => [
    Math.round(framing.drawX + nx * framing.drawW),
    Math.round(framing.drawY + ny * framing.drawH)
  ];

  const contourCanvas = contourNorm.map(toCanvas);

  // Pontos internos reais (Olhos, Sobrancelhas, Eixo Nasal, Boca)
  const features = {
    leftEye: [pt(33), pt(159), pt(133), pt(145)].map(toCanvas),
    rightEye: [pt(362), pt(386), pt(263), pt(374)].map(toCanvas),
    leftBrow: [pt(70), pt(105), pt(107)].map(toCanvas),
    rightBrow: [pt(336), pt(334), pt(300)].map(toCanvas),
    noseAxis: [toCanvas([p10[0], hairlineY]), toCanvas(pt(168)), toCanvas(pt(1)), toCanvas(pt(152))],
    mouthLine: [toCanvas(pt(61)), toCanvas(pt(13)), toCanvas(pt(291))],
    foreheadLine: [toCanvas(pt(103)), toCanvas(pt(332))],
    cheekLine: [toCanvas(pt(234)), toCanvas(pt(454))],
    jawLine: [toCanvas(pt(172)), toCanvas(pt(397))]
  };

  // Medidas em pixels reais da imagem original (respeitando proporção real)
  const pxDist = (a, b) => Math.hypot((a[0] - b[0]) * imgW, (a[1] - b[1]) * imgH);
  const wForehead = (pxDist(pt(103), pt(332)) + pxDist(pt(127), pt(356))) * 0.5;
  const wCheek = pxDist(pt(234), pt(454));
  const wJaw = (pxDist(pt(172), pt(397)) + pxDist(pt(132), pt(361))) * 0.5;
  const wChin = pxDist(pt(150), pt(379));
  const hFace = Math.hypot((p10[0] - p152[0]) * imgW, (hairlineY - p152[1]) * imgH);

  const angL = calcAngleDeg(
    [pt(234)[0] * imgW, pt(234)[1] * imgH],
    [pt(172)[0] * imgW, pt(172)[1] * imgH],
    [pt(152)[0] * imgW, pt(152)[1] * imgH]
  );
  const angR = calcAngleDeg(
    [pt(454)[0] * imgW, pt(454)[1] * imgH],
    [pt(397)[0] * imgW, pt(397)[1] * imgH],
    [pt(152)[0] * imgW, pt(152)[1] * imgH]
  );
  const jawAngle = Math.round((angL + angR) / 2);

  const telemetry = classifyFromMeasurements(wForehead, wCheek, wJaw, wChin, hFace, jawAngle);
  return { framing, contourCanvas, features, telemetry };
}

// Motor 2 (Fallback Local Instantâneo via Segmentação de Pele YCbCr + Gradiente nos Pixels da Foto)
function buildDataFromPixelAnalysis(img) {
  const W = 160, H = 160;
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const octx = off.getContext('2d');
  octx.drawImage(img, 0, 0, W, H);
  const data = octx.getImageData(0, 0, W, H).data;

  // Detecta pixels de pele humana (YCbCr + Luminância)
  const skinMask = new Uint8Array(W * H);
  let sumX = 0, sumY = 0, count = 0;

  for (let y = Math.floor(H * 0.08); y < Math.floor(H * 0.94); y++) {
    for (let x = Math.floor(W * 0.10); x < Math.floor(W * 0.90); x++) {
      const i = (y * W + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const Y = 0.299 * r + 0.587 * g + 0.114 * b;
      const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      if (Y > 40 && Y < 245 && Cb >= 74 && Cb <= 132 && Cr >= 128 && Cr <= 180 && r > g * 0.92 && r > b) {
        skinMask[y * W + x] = 1;
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }

  // Encontra limites verticais e horizontais reais da face na foto
  let cx = count > 200 ? sumX / count : W * 0.5;
  let cy = count > 200 ? sumY / count : H * 0.52;

  // Mede a largura real da face em 6 alturas anatômicas (Testa, Têmporas, Zigomático, Maxilar Alto, Maxilar Baixo, Queixo)
  function getSliceBounds(normY, defaultHalfW) {
    const row = Math.max(5, Math.min(H - 6, Math.round(normY * H)));
    let left = Math.round(cx), right = Math.round(cx);
    let missL = 0, missR = 0;
    for (let x = Math.round(cx); x >= 6; x--) {
      if (skinMask[row * W + x] || skinMask[(row - 1) * W + x] || skinMask[(row + 1) * W + x]) {
        left = x;
        missL = 0;
      } else if (++missL > 6) break;
    }
    for (let x = Math.round(cx); x < W - 6; x++) {
      if (skinMask[row * W + x] || skinMask[(row - 1) * W + x] || skinMask[(row + 1) * W + x]) {
        right = x;
        missR = 0;
      } else if (++missR > 6) break;
    }
    const minSpan = W * 0.14;
    if (right - left < minSpan) {
      return [Math.max(0.12, (cx - defaultHalfW * W) / W), Math.min(0.88, (cx + defaultHalfW * W) / W)];
    }
    return [left / W, right / W];
  }

  let topY = Math.max(0.12, (cy / H) - 0.34);
  let botY = Math.min(0.92, (cy / H) + 0.34);
  for (let y = Math.round(cy); y >= 6; y--) {
    let rowCount = 0;
    for (let x = Math.max(4, Math.round(cx - W * 0.22)); x <= Math.min(W - 4, Math.round(cx + W * 0.22)); x++) {
      if (skinMask[y * W + x]) rowCount++;
    }
    if (rowCount >= 5) topY = y / H;
    else if (y < cy - H * 0.15) break;
  }
  for (let y = Math.round(cy); y < H - 4; y++) {
    let rowCount = 0;
    for (let x = Math.max(4, Math.round(cx - W * 0.18)); x <= Math.min(W - 4, Math.round(cx + W * 0.18)); x++) {
      if (skinMask[y * W + x]) rowCount++;
    }
    if (rowCount >= 4) botY = y / H;
    else if (y > cy + H * 0.15) break;
  }

  const faceH = Math.max(0.32, botY - topY);
  const yForehead = topY + faceH * 0.14;
  const yTemple = topY + faceH * 0.30;
  const yCheek = topY + faceH * 0.50;
  const yJawUpper = topY + faceH * 0.68;
  const yJawCorner = topY + faceH * 0.78;
  const yChinSide = topY + faceH * 0.91;

  const [fL, fR] = getSliceBounds(yForehead, 0.22);
  const [tL, tR] = getSliceBounds(yTemple, 0.25);
  const [cL, cR] = getSliceBounds(yCheek, 0.26);
  const [juL, juR] = getSliceBounds(yJawUpper, 0.24);
  const [jcL, jcR] = getSliceBounds(yJawCorner, 0.21);
  const [chL, chR] = getSliceBounds(yChinSide, 0.13);

  const midX = (cL + cR) / 2;
  const contourNorm = [
    [midX, topY],
    [(midX + fR) * 0.5, topY + faceH * 0.04],
    [fR, yForehead],
    [tR, yTemple],
    [cR, yCheek],
    [juR, yJawUpper],
    [jcR, yJawCorner],
    [chR, yChinSide],
    [midX, botY],
    [chL, yChinSide],
    [jcL, yJawCorner],
    [juL, yJawUpper],
    [cL, yCheek],
    [tL, yTemple],
    [fL, yForehead],
    [(midX + fL) * 0.5, topY + faceH * 0.04]
  ];

  const minX = Math.min(fL, tL, cL);
  const maxX = Math.max(fR, tR, cR);
  const framing = computePortraitFraming(img.naturalWidth, img.naturalHeight, {
    minX, minY: topY, maxX, maxY: botY
  });

  const toCanvas = ([nx, ny]) => [
    Math.round(framing.drawX + nx * framing.drawW),
    Math.round(framing.drawY + ny * framing.drawH)
  ];

  const contourCanvas = contourNorm.map(toCanvas);
  const eyeY = topY + faceH * 0.36;
  const browY = topY + faceH * 0.28;
  const noseTipY = topY + faceH * 0.58;
  const mouthY = topY + faceH * 0.74;
  const spanW = maxX - minX;

  const features = {
    leftEye: [
      toCanvas([midX - spanW * 0.28, eyeY]),
      toCanvas([midX - spanW * 0.19, eyeY - faceH * 0.02]),
      toCanvas([midX - spanW * 0.11, eyeY]),
      toCanvas([midX - spanW * 0.19, eyeY + faceH * 0.02])
    ],
    rightEye: [
      toCanvas([midX + spanW * 0.11, eyeY]),
      toCanvas([midX + spanW * 0.19, eyeY - faceH * 0.02]),
      toCanvas([midX + spanW * 0.28, eyeY]),
      toCanvas([midX + spanW * 0.19, eyeY + faceH * 0.02])
    ],
    leftBrow: [
      toCanvas([midX - spanW * 0.31, browY + faceH * 0.02]),
      toCanvas([midX - spanW * 0.20, browY - faceH * 0.01]),
      toCanvas([midX - spanW * 0.09, browY + faceH * 0.01])
    ],
    rightBrow: [
      toCanvas([midX + spanW * 0.09, browY + faceH * 0.01]),
      toCanvas([midX + spanW * 0.20, browY - faceH * 0.01]),
      toCanvas([midX + spanW * 0.31, browY + faceH * 0.02])
    ],
    noseAxis: [
      toCanvas([midX, topY]),
      toCanvas([midX, eyeY]),
      toCanvas([midX, noseTipY]),
      toCanvas([midX, botY])
    ],
    mouthLine: [
      toCanvas([midX - spanW * 0.18, mouthY]),
      toCanvas([midX, mouthY + faceH * 0.01]),
      toCanvas([midX + spanW * 0.18, mouthY])
    ],
    foreheadLine: [toCanvas([fL, yForehead]), toCanvas([fR, yForehead])],
    cheekLine: [toCanvas([cL, yCheek]), toCanvas([cR, yCheek])],
    jawLine: [toCanvas([jcL, yJawCorner]), toCanvas([jcR, yJawCorner])]
  };

  const wForehead = (fR - fL) * img.naturalWidth;
  const wCheek = (cR - cL) * img.naturalWidth;
  const wJaw = ((juR - juL) + (jcR - jcL)) * 0.5 * img.naturalWidth;
  const wChin = (chR - chL) * img.naturalWidth;
  const hFace = faceH * img.naturalHeight;

  const jawAngle = calcAngleDeg(
    [cL * img.naturalWidth, yCheek * img.naturalHeight],
    [jcL * img.naturalWidth, yJawCorner * img.naturalHeight],
    [midX * img.naturalWidth, botY * img.naturalHeight]
  );

  const telemetry = classifyFromMeasurements(wForehead, wCheek, wJaw, wChin, hFace, jawAngle);
  return { framing, contourCanvas, features, telemetry };
}

async function analyzeImageFaceBiometrics(img) {
  if (!img || !img.complete || img.naturalWidth === 0) return null;

  // Tenta primeiro com os 478 pontos 3D do MediaPipe FaceLandmarker
  if (mpFaceLandmarker) {
    try {
      const res = mpFaceLandmarker.detect(img);
      if (res && res.faceLandmarks && res.faceLandmarks.length > 0) {
        return buildDataFromMediaPipe(res.faceLandmarks[0], img.naturalWidth, img.naturalHeight);
      }
    } catch {}
  }

  // Fallback imediato: análise real de pixels (segmentação de pele YCbCr + larguras anatômicas)
  return buildDataFromPixelAnalysis(img);
}

// ================= VISAGISMO IA 3D (AMOSTRA GRÁTIS VS EXCLUSIVO GOLD VIP) =================
function isCurrentUserGoldVip() {
  const m = state.members.find(x => x.id === currentMemberId);
  return Boolean(m && m.plan.includes('Gold') && (m.status === 'active' || m.status === 'rescheduled'));
}

function renderVisagism() {
  const isVip = isCurrentUserGoldVip();
  const shapes = Object.keys(VISAGISM_DB);
  document.getElementById('shape-buttons-grid').innerHTML = shapes.map(s => `
    <button onclick="selectFaceShape('${s}')" class="py-2.5 px-1 rounded-xl text-xs font-bold transition truncate ${
      currentShape === s ? 'btn-ln-primary' : 'subtle-ln hover:opacity-80'
    }">${s}</button>
  `).join('');

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
  const tel = detectedFaceData?.telemetry;

  document.getElementById('vis-angle-pill').textContent = tel ? tel.angleLabel : data.angle;
  document.getElementById('vis-harmony-badge').textContent = tel ? tel.harmony : data.harmony;
  document.getElementById('vis-recommended-cut').textContent = data.cut;
  document.getElementById('vis-recommended-desc').textContent = data.desc;

  const liveMetricsEl = document.getElementById('vis-live-metrics');
  if (liveMetricsEl) {
    liveMetricsEl.textContent = tel
      ? tel.metricsText
      : `📐 Biometria Padrão (${currentShape}): Clique em "📸 Tirar Selfie / Foto" ou "📷 Escanear Rosto" para medir suas proporções reais.`;
  }

  document.getElementById('vis-recommended-tags').innerHTML = data.tags.map(t =>
    `<span class="px-3 py-1 rounded-xl card-ln font-bold text-[var(--accent)]">${t}</span>`
  ).join('');

  document.getElementById('vis-3-angles-grid').innerHTML = data.angles.map((a, idx) => {
    const isLocked = !isVip && idx > 0;
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

// Malha Biométrica 1:1 nos cards de Referência do Corte (Modelo de Estúdio em 3 Ângulos)
function getAngleBiometricSVG(type, shape = 'Quadrado') {
  if (type === 'front') {
    // Coordenadas matemáticas exatas do modelo em vis-front.png sob object-cover
    const jawLeft = shape === 'Quadrado' ? '31.5,66.2' : shape === 'Redondo' ? '33.5,65.5' : shape === 'Diamante' ? '34.5,66.5' : '32.0,66.2';
    const jawRight = shape === 'Quadrado' ? '68.0,66.2' : shape === 'Redondo' ? '66.0,65.5' : shape === 'Diamante' ? '65.0,66.5' : '67.5,66.2';
    const cheekLeft = shape === 'Diamante' ? '28.5,53.8' : '29.8,53.8';
    const cheekRight = shape === 'Diamante' ? '71.0,53.8' : '70.0,53.8';

    const pts = [
      [49.5, 26.2], [66.5, 28.0], [70.2, 42.2], cheekRight.split(',').map(Number),
      jawRight.split(',').map(Number), [61.5, 75.8], [49.5, 80.5], [38.0, 75.8],
      jawLeft.split(',').map(Number), cheekLeft.split(',').map(Number), [29.2, 42.2], [32.5, 28.0]
    ];
    const polyStr = pts.map(p => p.join(',')).join(' ');
    const circles = pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.15" fill="#ffffff" stroke="#d96b43" stroke-width="0.7"/>`).join('');

    return `<svg viewBox="0 0 100 100" class="w-full h-full opacity-90">
      <line x1="49.5" y1="20" x2="49.5" y2="84" stroke="#10b981" stroke-width="0.65" stroke-dasharray="2,2" opacity="0.85"/>
      <line x1="29.2" y1="42.2" x2="70.2" y2="42.2" stroke="#10b981" stroke-width="0.5" stroke-dasharray="1.5,1.5" opacity="0.65"/>
      <line x1="${cheekLeft.split(',')[0]}" y1="53.8" x2="${cheekRight.split(',')[0]}" y2="53.8" stroke="#d96b43" stroke-width="0.55" stroke-dasharray="2,1.5" opacity="0.75"/>
      <line x1="${jawLeft.split(',')[0]}" y1="66.2" x2="${jawRight.split(',')[0]}" y2="66.2" stroke="#d96b43" stroke-width="0.65" stroke-dasharray="2,1.5" opacity="0.85"/>
      <polyline points="29.2,42.2 49.5,57.5 70.2,42.2" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="0.45"/>
      <polyline points="${jawLeft} 49.5,67.5 ${jawRight}" fill="none" stroke="rgba(217,107,67,0.45)" stroke-width="0.5"/>
      <polygon points="${polyStr}" fill="rgba(217,107,67,0.06)" stroke="#d96b43" stroke-width="0.95" stroke-dasharray="2.5,1.5"/>
      ${circles}
    </svg>`;
  }

  if (type === 'side') {
    return `<svg viewBox="0 0 100 100" class="w-full h-full opacity-90">
      <path d="M42,35 Q60,31 78,40 L75,55 Q60,45 43,48 Z" fill="rgba(217,107,67,0.16)" stroke="#d96b43" stroke-width="0.95" stroke-dasharray="2.5,1.5"/>
      <polyline points="27,28 24,42 20,51 24,69 51,70 58,52" fill="none" stroke="#10b981" stroke-width="0.9" stroke-dasharray="2,1.5"/>
      <circle cx="42" cy="35" r="1.2" fill="#fff" stroke="#d96b43" stroke-width="0.7"/>
      <circle cx="78" cy="40" r="1.2" fill="#fff" stroke="#d96b43" stroke-width="0.7"/>
      <circle cx="24" cy="69" r="1.2" fill="#fff" stroke="#10b981" stroke-width="0.7"/>
      <circle cx="51" cy="70" r="1.3" fill="#fff" stroke="#10b981" stroke-width="0.7"/>
      <circle cx="58" cy="52" r="1.2" fill="#fff" stroke="#10b981" stroke-width="0.7"/>
    </svg>`;
  }

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
  renderQueueAndMember();
}

function runBiometricScanSequence(sourceLabel = 'Scanner 3D', targetImage = null) {
  const overlay = document.getElementById('vis-scan-overlay');
  const stepEl = document.getElementById('vis-scan-step');
  const pctEl = document.getElementById('vis-scan-pct');
  const barEl = document.getElementById('vis-scan-bar');
  const statusPill = document.getElementById('cam-status-pill');

  if (overlay) overlay.classList.remove('hidden');
  if (statusPill) statusPill.textContent = `🔴 Escaneando (${sourceLabel})...`;

  const steps = [
    { pct: 25, text: '1/4 • Detectando Contorno Facial IA...' },
    { pct: 55, text: '2/4 • Alinhando Olhos, Nariz e Têmporas...' },
    { pct: 85, text: '3/4 • Medindo Testa × Zigomático × Maxilar...' },
    { pct: 100, text: '✔ Biometria Facial Concluída!' }
  ];

  // Executa a detecção real apenas quando há uma foto/selfie capturada pelo usuário
  const analysisPromise = targetImage ? analyzeImageFaceBiometrics(targetImage) : Promise.resolve(null);

  steps.forEach((st, idx) => {
    setTimeout(async () => {
      if (stepEl) stepEl.textContent = st.text;
      if (pctEl) pctEl.textContent = `${st.pct}%`;
      if (barEl) barEl.style.width = `${st.pct}%`;

      if (idx === steps.length - 1) {
        const result = await analysisPromise;
        if (result && result.telemetry) {
          detectedFaceData = result;
          currentShape = result.telemetry.shape;
          lastTelemetryLabel = result.telemetry.angleLabel;
        }
        renderVisagism();
        renderQueueAndMember();
        if (statusPill) {
          statusPill.textContent = `🟢 Rosto ${currentShape} Mapeado`;
        }
        toast(`✔ Rosto ${currentShape} detectado! Corte ideal: ${VISAGISM_DB[currentShape].cut}`);
        setTimeout(() => { if (overlay) overlay.classList.add('hidden'); }, 1800);
      }
    }, (idx + 1) * 420);
  });
}

async function openCameraVisagism() {
  const video = document.getElementById('vis-webcam');
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 640 } });
      video.srcObject = stream;
      video.classList.remove('hidden');
      isWebcamActive = true;
      setTimeout(() => {
        const snap = document.createElement('canvas');
        snap.width = video.videoWidth || 600;
        snap.height = video.videoHeight || 600;
        snap.getContext('2d').drawImage(video, 0, 0, snap.width, snap.height);
        const snapImg = new Image();
        snapImg.onload = () => {
          visFrontImg = snapImg;
          customUserPhotoUrl = snapImg.src;
          video.classList.add('hidden');
          isWebcamActive = false;
          stream.getTracks().forEach(t => t.stop());
          runBiometricScanSequence('Câmera Ao Vivo', snapImg);
        };
        snapImg.src = snap.toDataURL('image/jpeg', 0.92);
      }, 650);
      return;
    } catch {}
  }
  if (!customUserPhotoUrl) {
    document.getElementById('vis-photo-input')?.click();
    return;
  }
  runBiometricScanSequence('Sua Selfie', visFrontImg);
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

    const img = new Image();
    img.onload = async () => {
      visFrontImg = img;
      if (!mpFaceLandmarker) await initMediaPipeFaceLandmarker();
      detectedFaceData = await analyzeImageFaceBiometrics(img);
      drawBiometricMesh(currentShape);
      runBiometricScanSequence('Sua Selfie', img);
    };
    img.src = customUserPhotoUrl;
  };
  reader.readAsDataURL(file);
}

function drawBiometricMesh(shape) {
  const canvas = document.getElementById('vis-canvas');
  if (!canvas) return;
  if (!visFrontImg) {
    visFrontImg = new Image();
    visFrontImg.src = '/assets/vis-front.png';
    // Na imagem padrão do modelo de estúdio, desenha 100% full-bleed com as coordenadas calibradas do modelo!
    visFrontImg.onload = () => drawBiometricMesh(currentShape);
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 400, 400);

  // 1. Desenha a foto: Modelo padrão preenche 400x400 sem bordas internas; Selfie do cliente usa Enquadramento Inteligente
  if (!isWebcamActive && visFrontImg && visFrontImg.complete && visFrontImg.naturalWidth > 0) {
    ctx.save();
    if (customUserPhotoUrl && detectedFaceData && detectedFaceData.framing) {
      ctx.save();
      ctx.filter = 'blur(18px) brightness(0.32)';
      drawImageCover(ctx, visFrontImg, -20, -20, 440, 440);
      ctx.restore();

      const { drawX, drawY, drawW, drawH } = detectedFaceData.framing;
      ctx.globalAlpha = 0.94;
      ctx.drawImage(visFrontImg, drawX, drawY, drawW, drawH);

      const grad = ctx.createRadialGradient(200, 205, 115, 200, 200, 220);
      grad.addColorStop(0, 'rgba(9,10,12,0)');
      grad.addColorStop(1, 'rgba(9,10,12,0.65)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 400, 400);
    } else {
      ctx.globalAlpha = 0.72;
      drawImageCover(ctx, visFrontImg, 0, 0, 400, 400);
    }
    ctx.restore();
  }

  // Mira concêntrica sutil do scanner
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  [95, 145, 185].forEach(r => { ctx.beginPath(); ctx.arc(200, 205, r, 0, Math.PI * 2); ctx.stroke(); });

  // 2. Coordenadas: Se o usuário tirou selfie, usa os vértices reais detectados; se for o modelo padrão, usa o contorno exato calibrado em 400x400!
  const pts = (customUserPhotoUrl && detectedFaceData && detectedFaceData.contourCanvas)
    ? detectedFaceData.contourCanvas
    : shape === 'Quadrado'
    ? [[198, 105], [266, 112], [281, 169], [280, 215], [272, 265], [246, 303], [198, 322], [152, 303], [127, 265], [119, 215], [117, 169], [130, 113]]
    : shape === 'Redondo'
    ? [[198, 106], [262, 114], [280, 170], [282, 216], [266, 264], [242, 301], [198, 319], [156, 301], [132, 264], [117, 216], [118, 170], [134, 114]]
    : shape === 'Diamante'
    ? [[198, 105], [258, 114], [278, 169], [284, 215], [262, 266], [240, 304], [198, 324], [158, 304], [136, 266], [114, 215], [120, 169], [138, 114]]
    : [[198, 105], [264, 112], [280, 169], [279, 215], [268, 265], [244, 303], [198, 322], [154, 303], [130, 265], [120, 215], [118, 169], [132, 113]];

  // 3. Desenha as linhas internas de simetria e feições
  if (customUserPhotoUrl && detectedFaceData && detectedFaceData.features) {
    const f = detectedFaceData.features;
    const tel = detectedFaceData.telemetry;

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.72)';
    ctx.lineWidth = 1.3;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    f.noseAxis.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.stroke();

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.50)';
    ctx.beginPath();
    ctx.moveTo(f.foreheadLine[0][0], f.foreheadLine[0][1]);
    ctx.lineTo(f.foreheadLine[1][0], f.foreheadLine[1][1]);
    ctx.moveTo(f.cheekLine[0][0], f.cheekLine[0][1]);
    ctx.lineTo(f.cheekLine[1][0], f.cheekLine[1][1]);
    ctx.moveTo(f.jawLine[0][0], f.jawLine[0][1]);
    ctx.lineTo(f.jawLine[1][0], f.jawLine[1][1]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.85)';
    ctx.lineWidth = 1.2;
    [f.leftEye, f.rightEye].forEach(eye => {
      ctx.beginPath();
      eye.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.closePath();
      ctx.stroke();
    });

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    [f.leftBrow, f.rightBrow, f.mouthLine].forEach(line => {
      ctx.beginPath();
      line.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.stroke();
    });

    // Barra HUD de telemetria no rodapé do scanner (fora do nariz/boca!)
    if (tel) {
      ctx.fillStyle = 'rgba(9, 10, 12, 0.82)';
      ctx.fillRect(42, 360, 316, 24);
      ctx.strokeStyle = 'rgba(217, 107, 67, 0.45)';
      ctx.strokeRect(42, 360, 316, 24);
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#10b981';
      ctx.fillText(`TESTA ${tel.foreheadPct}%`, 54, 375);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`•  ZIG 100%  •`, 152, 375);
      ctx.fillStyle = '#d96b43';
      ctx.fillText(`MAXILAR ${tel.jawPct}%`, 262, 375);
    }
  } else {
    // Linhas de simetria calibradas para o modelo padrão (Olhos y=188, Zigomático y=215, Maxilar y=265)
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.60)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(198, 80); ctx.lineTo(198, 345);
    ctx.moveTo(117, 169); ctx.lineTo(281, 169);
    ctx.moveTo(119, 215); ctx.lineTo(280, 215);
    ctx.moveTo(127, 265); ctx.lineTo(272, 265);
    ctx.stroke();
    ctx.setLineDash([]);

    // Contorno ocular sutil alinhado aos olhos do modelo padrão
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.75)';
    ctx.lineWidth = 1.1;
    [[[142, 188], [160, 181], [178, 189], [160, 194]], [[218, 188], [238, 180], [258, 187], [238, 193]]].forEach(eye => {
      ctx.beginPath();
      eye.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.closePath();
      ctx.stroke();
    });
  }

  // 4. Desenha o polígono de contorno anatômico cravado na borda real do rosto
  ctx.strokeStyle = '#d96b43';
  ctx.fillStyle = 'rgba(217, 107, 67, 0.08)';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 5. Desenha os vértices de ancoragem anatômica
  pts.forEach(([x, y]) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d96b43';
    ctx.lineWidth = 1.4;
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
  const res = await api('/api/visagism/save', {
    memberId: currentMemberId,
    shape: currentShape,
    cut: data.cut,
    angles: lastTelemetryLabel || data.angle,
    notes: data.desc
  });
  updateState(res);
  renderQueueAndMember();
  toast(`👑 Corte "${data.cut}" salvo oficialmente na sua ficha Gold VIP!`);
}

// ================= PAINEL VIP DO ASSINANTE: ESCOLHA DOS 4 DIAS + HORÁRIOS DO MÊS + BAR & PRODUTOS COM DESCONTO =================
const BAR_STORE_PRODUCTS = [
  { id: 'heineken', name: 'Cerveja Heineken Long Neck (Trincando)', category: '🍺 Bebida Gelada', basePrice: 12.00, icon: '🍺' },
  { id: 'corona', name: 'Corona Extra Long Neck 330ml', category: '🍺 Bebida Gelada', basePrice: 13.00, icon: '🍻' },
  { id: 'monster', name: 'Energético Monster / Red Bull Gelado', category: '⚡ Bebida Gelada', basePrice: 14.00, icon: '⚡' },
  { id: 'coca', name: 'Coca-Cola Zero / Guaraná Lata', category: '🥤 Bebida Gelada', basePrice: 6.50, icon: '🥤' },
  { id: 'pomada', name: 'Pomada Modeladora Matte Califórnia (120g)', category: '💈 Produto Físico', basePrice: 45.00, icon: '💈' },
  { id: 'balm', name: 'Kit Óleo & Balm Hidratante p/ Barba', category: '🧔 Produto Físico', basePrice: 55.00, icon: '🧴' }
];

// Grade de horários diários de 40 em 40 min (Manhã 08:20-11:40 | Almoço 11:40-13:20 | Tarde/Noite 13:20-20:00)
const DAILY_TIME_SLOTS = [
  { time: '08:20', period: 'Manhã' },
  { time: '09:00', period: 'Manhã' },
  { time: '09:40', period: 'Manhã' },
  { time: '10:20', period: 'Manhã' },
  { time: '11:00', period: 'Manhã' },
  { time: '13:20', period: 'Tarde' },
  { time: '14:00', period: 'Tarde' },
  { time: '14:40', period: 'Tarde' },
  { time: '15:20', period: 'Tarde' },
  { time: '16:00', period: 'Tarde' },
  { time: '16:40', period: 'Tarde' },
  { time: '17:20', period: 'Noite' },
  { time: '18:00', period: 'Noite' },
  { time: '18:40', period: 'Noite' },
  { time: '19:20', period: 'Noite' }
];

function getAvailableMonthDays() {
  const days = [];
  const weekNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const now = new Date();
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  while (days.length < 18) {
    if (d.getDay() !== 0) { // Segunda a Sábado (Barbearia aberta)
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const wk = weekNames[d.getDay()];
      days.push({
        label: `${wk} ${dd}/${mm}`,
        week: wk,
        dateNum: `${dd}/${mm}`
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function selectInspectDay(dayLabel) {
  const m = getActiveMember();
  if (!m || (m.status !== 'active' && m.status !== 'rescheduled')) {
    toast('🔒 Área exclusiva para assinantes! Faça login na sua conta ativa para ver os horários.');
    openLoginModal('login');
    return;
  }
  activeInspectDay = dayLabel;
  renderVipArea();
}

function toggleDayTimeSlot(dayLabel, timeStr) {
  const m = getActiveMember();
  if (!m) {
    toast('🔒 Assine um plano ou entre na sua conta de assinante para reservar dias e horários!');
    openLoginModal('register', 'gold');
    return;
  }
  if (m.status !== 'active' && m.status !== 'rescheduled') {
    toast('⏳ Conclua o pagamento da sua assinatura para liberar a agenda de horários!');
    openCheckoutModal(m.plan, m.price, m.plan.includes('Gold') ? 'plan_gold' : 'plan_club', m.id);
    return;
  }

  const slotLabel = `${dayLabel} às ${timeStr}`;
  const maxDays = m.cutsLimit || (m.plan.includes('Gold') ? 4 : 2);

  // Verifica se já está selecionado pelo próprio cliente (clicar de novo desmarca)
  const existingIdx = selectedCalendarDays.indexOf(slotLabel);
  if (existingIdx >= 0) {
    selectedCalendarDays.splice(existingIdx, 1);
    renderVipArea();
    return;
  }

  // Verifica se outro cliente já ocupou este exato Dia + Horário
  const bookedByOther = (state?.bookedSlots || []).some(
    b => b.slot === slotLabel && b.memberId !== m.id
  );
  if (bookedByOther) {
    return toast(`🔒 O horário ${slotLabel} já está ocupado! Escolha outro horário livre neste dia.`);
  }

  if (selectedCalendarDays.length >= maxDays) {
    return toast(`Seu plano dá direito a ${maxDays} horários no mês! Toque em um horário já escolhido para trocar.`);
  }

  selectedCalendarDays.push(slotLabel);
  renderVipArea();
  toast(`⏰ Selecionado: ${slotLabel} (${selectedCalendarDays.length}/${maxDays}). Clique em "Confirmar Dias & Horários" para salvar!`);
}

function removeScheduledSlot(slotLabel) {
  const idx = selectedCalendarDays.indexOf(slotLabel);
  if (idx >= 0) {
    selectedCalendarDays.splice(idx, 1);
    renderVipArea();
  }
}

async function saveSubscriberMonthlyDays() {
  const m = getActiveMember();
  if (!m) {
    toast('🔒 Faça login com um plano ativo para salvar seus dias e horários do mês!');
    return openLoginModal('login');
  }
  if (m.status !== 'active' && m.status !== 'rescheduled') {
    toast('⏳ Ative sua assinatura no PIX ou Cartão antes de reservar seus horários no mês!');
    return openCheckoutModal(m.plan, m.price, m.plan.includes('Gold') ? 'plan_gold' : 'plan_club', m.id);
  }
  if (selectedCalendarDays.length === 0) {
    return toast('Escolha pelo menos 1 dia e horário na grade acima antes de confirmar!');
  }

  try {
    const res = await api('/api/member/schedule-days', {
      memberId: m.id,
      days: selectedCalendarDays
    });
    updateState(res);
    renderAll();
    toast(`📅 Confirmado! Seus ${selectedCalendarDays.length} horários (${selectedCalendarDays.join(' • ')}) foram salvos na agenda do Rogério!`);
  } catch (e) {
    toast(e.message);
  }
}

async function orderStoreItem(itemName, basePrice) {
  const m = getActiveMember();
  if (!m) {
    toast('🔒 Assine um plano ou faça login para reservar bebidas e produtos com desconto VIP!');
    return openLoginModal('login');
  }
  try {
    const res = await api('/api/store/order', {
      memberId: m.id,
      itemName,
      basePrice
    });
    updateState(res);
    renderAll();
    const finalPrice = Number(res.finalPrice ?? res.order?.finalPrice ?? basePrice);
    const discountPct = Number(res.discountPct ?? res.order?.discountPct ?? 0);
    const name = res.itemName || res.order?.item || itemName;
    toast(discountPct > 0
      ? `🍺 ${name} reservado por R$ ${finalPrice.toFixed(2)} (${discountPct}% OFF VIP)!`
      : `🍺 ${name} reservado na sua comanda por R$ ${finalPrice.toFixed(2)}!`);
  } catch (e) {
    toast(e.message);
  }
}

function renderVipArea() {
  const vipSection = document.getElementById('vip-area-section');
  const calGrid = document.getElementById('vip-calendar-grid');
  const timesGrid = document.getElementById('vip-times-grid');
  const activeDayTitle = document.getElementById('vip-active-day-title');
  const storeGrid = document.getElementById('vip-store-grid');

  const m = getActiveMember();
  const isPaidActive = Boolean(m && (m.status === 'active' || m.status === 'rescheduled'));

  if (vipSection) {
    vipSection.classList.toggle('hidden', !isPaidActive);
  }
  if (!isPaidActive) {
    if (calGrid) calGrid.innerHTML = '';
    if (timesGrid) timesGrid.innerHTML = '';
    return;
  }
  if (!calGrid || !storeGrid) return;

  const availDays = getAvailableMonthDays();
  if (!activeInspectDay || !availDays.some(d => d.label === activeInspectDay)) {
    activeInspectDay = availDays[0]?.label || 'Sáb 17/10';
  }

  const isGold = Boolean(isPaidActive && m.plan.includes('Gold'));
  const isClub = Boolean(isPaidActive && m.plan.includes('Club'));
  const maxDays = m ? (m.cutsLimit || (m.plan.includes('Gold') ? 4 : 2)) : 4;
  const discountPct = isGold ? 10 : isClub ? 5 : 0;

  const loungeBadge = document.getElementById('vip-lounge-badge');
  const counterEl = document.getElementById('vip-days-counter');
  const summaryEl = document.getElementById('vip-selected-summary');
  const discBadge = document.getElementById('vip-discount-pill');

  if (loungeBadge) {
    if (isGold) {
      loungeBadge.className = 'text-[10px] sm:text-[11px] font-bold px-3 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
      loungeBadge.textContent = `👑 ${m.name.split(' ')[0]} • Gold VIP Ativo (4 Horários/Mês + 10% OFF no Bar)`;
    } else if (isClub) {
      loungeBadge.className = 'text-[10px] sm:text-[11px] font-bold px-3 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
      loungeBadge.textContent = `✦ ${m.name.split(' ')[0]} • Club Ativo (2 Horários/Mês + 5% OFF no Bar)`;
    } else {
      loungeBadge.className = 'text-[10px] sm:text-[11px] font-bold px-3 py-0.5 rounded-full subtle-ln text-[var(--accent)]';
      loungeBadge.textContent = '🔒 Exclusivo Assinantes Club & Gold VIP';
    }
  }

  if (counterEl) {
    counterEl.textContent = `${selectedCalendarDays.length}/${maxDays} Horários`;
  }

  if (summaryEl) {
    if (selectedCalendarDays.length > 0) {
      summaryEl.innerHTML = `
        <div class="text-[11px] font-bold text-emerald-400 mb-1">✅ Seus horários escolhidos no mês:</div>
        <div class="flex flex-wrap gap-1.5">
          ${selectedCalendarDays.map(slot => `
            <span class="px-2.5 py-1 rounded-xl card-ln border border-[#d96b43]/50 text-[11px] font-bold flex items-center gap-1.5">
              <span>📅 ${slot}</span>
              <button onclick="removeScheduledSlot('${slot}')" class="text-rose-400 hover:text-rose-300 font-extrabold" title="Remover horário">✕</button>
            </span>
          `).join('')}
        </div>
      `;
    } else {
      summaryEl.textContent = isPaidActive
        ? `Selecione um dia acima e toque no horário desejado (até ${maxDays} cortes no mês).`
        : 'Assinantes Gold VIP escolhem seus 4 dias e horários livres no mês com prioridade na cadeira.';
    }
  }

  if (discBadge) {
    discBadge.textContent = isGold
      ? '👑 SEU DESCONTO GOLD: 10% OFF ATIVO'
      : isClub
      ? '✦ SEU DESCONTO CLUB: 5% OFF ATIVO'
      : '👑 Gold VIP: 10% OFF • Club: 5% OFF';
  }

  // 1. Renderiza os Dias do Mês (destacando o dia aberto para inspeção e quantos horários o cliente tem naquele dia)
  calGrid.innerHTML = availDays.map(d => {
    const isInspecting = d.label === activeInspectDay;
    const mySlotsOnDay = selectedCalendarDays
      .filter(s => s.startsWith(d.label))
      .map(s => s.split(' às ')[1] || '✓');
    const hasMyBooking = mySlotsOnDay.length > 0;

    return `
      <button onclick="selectInspectDay('${d.label}')" class="p-2 rounded-2xl text-center transition border ${
        hasMyBooking
          ? 'btn-ln-primary border-[#d96b43] shadow-lg'
          : isInspecting
          ? 'card-ln border-2 border-[#d96b43] scale-[1.02]'
          : 'subtle-ln border-transparent hover:border-[#d96b43]/50'
      }">
        <div class="text-[9px] font-mono-ln uppercase opacity-75">${d.week}</div>
        <div class="text-xs sm:text-sm font-extrabold mt-0.5">${d.dateNum}</div>
        <div class="text-[9px] font-bold mt-0.5 truncate ${hasMyBooking ? 'text-white' : isInspecting ? 'text-[var(--accent)]' : 'text-emerald-400'}">
          ${hasMyBooking ? `✓ ${mySlotsOnDay.join(', ')}` : isInspecting ? 'Ver Horas' : 'Livre'}
        </div>
      </button>
    `;
  }).join('');

  // 2. Renderiza os Horários de 40 em 40 min do Dia Selecionado (Sincronizado c/ Fila Ao Vivo e Assinantes)
  if (activeDayTitle) {
    activeDayTitle.textContent = `⏰ 2. Horários (40 min/corte) em ${activeInspectDay}:`;
  }
  if (timesGrid) {
    timesGrid.innerHTML = DAILY_TIME_SLOTS.map(slotObj => {
      const fullSlot = `${activeInspectDay} às ${slotObj.time}`;
      const isMine = selectedCalendarDays.includes(fullSlot);
      const takenEntry = (state?.bookedSlots || []).find(
        b => b.slot === fullSlot && b.memberId !== currentMemberId
      );

      if (takenEntry) {
        const isFromQueue = takenEntry.source === 'queue';
        return `
          <button disabled class="p-2 rounded-xl text-center subtle-ln opacity-45 cursor-not-allowed border border-transparent" title="${isFromQueue ? 'Horário já ocupado por cliente na Fila Ao Vivo' : 'Horário já reservado por outro Assinante'}">
            <div class="text-xs font-mono-ln font-bold line-through">${slotObj.time}</div>
            <div class="text-[9px] text-rose-400 font-bold">${isFromQueue ? '🔒 Na Fila' : '🔒 Reservado'}</div>
          </button>
        `;
      }

      return `
        <button onclick="toggleDayTimeSlot('${activeInspectDay}', '${slotObj.time}')" class="p-2 rounded-xl text-center transition border ${
          isMine
            ? 'btn-ln-primary border-[#d96b43] shadow-md scale-[1.02]'
            : 'subtle-ln border-transparent hover:border-emerald-500/50'
        }">
          <div class="text-xs font-mono-ln font-extrabold">${slotObj.time}</div>
          <div class="text-[9px] font-bold ${isMine ? 'text-white' : 'text-emerald-400'}">
            ${isMine ? '✓ Seu Horário' : `🟢 ${slotObj.period}`}
          </div>
        </button>
      `;
    }).join('');
  }

  // 3. Renderiza a Geladeira (Bebidas) & Produtos Físicos com Desconto de Assinante
  storeGrid.innerHTML = BAR_STORE_PRODUCTS.map(item => {
    const goldPrice = +(item.basePrice * 0.90).toFixed(2);
    const clubPrice = +(item.basePrice * 0.95).toFixed(2);
    const userFinalPrice = discountPct > 0 ? +(item.basePrice * (1 - discountPct / 100)).toFixed(2) : item.basePrice;

    return `
      <div class="subtle-ln rounded-2xl p-4 flex flex-col justify-between gap-3 border border-[var(--border)]">
        <div class="space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] font-mono-ln uppercase px-2 py-0.5 rounded-full card-ln text-[var(--accent)] font-bold">${item.category}</span>
            <span class="text-[10px] font-bold text-emerald-400">Gold -10% • Club -5%</span>
          </div>
          <h4 class="font-extrabold text-sm leading-snug">${item.icon} ${item.name}</h4>
        </div>
        <div class="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2">
          <div>
            <div class="text-[10px] line-through opacity-50">Normal: R$ ${item.basePrice.toFixed(2)}</div>
            <div class="font-mono-ln font-extrabold text-sm text-emerald-400">
              ${isGold ? `R$ ${goldPrice.toFixed(2)} (Seu Preço VIP)` : isClub ? `R$ ${clubPrice.toFixed(2)} (Seu Preço Club)` : `VIP Gold: R$ ${goldPrice.toFixed(2)}`}
            </div>
          </div>
          <button onclick="orderStoreItem('${item.name}', ${item.basePrice})" class="px-3 py-2 rounded-xl text-[11px] font-bold ${
            discountPct > 0 ? 'btn-ln-primary' : 'btn-ln-ghost'
          } shrink-0">
            🍺 Pedir (R$ ${userFinalPrice.toFixed(2)})
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ================= PLANOS & CHECKOUT =================
function setCalcCuts(n) {
  document.getElementById('calc-2').className = n === 2 ? 'px-3 py-1.5 rounded-xl text-xs font-bold btn-ln-primary' : 'px-3 py-1.5 rounded-xl text-xs font-bold subtle-ln';
  document.getElementById('calc-4').className = n === 4 ? 'px-3 py-1.5 rounded-xl text-xs font-bold btn-ln-primary' : 'px-3 py-1.5 rounded-xl text-xs font-bold subtle-ln';
  document.getElementById('calc-summary').textContent = n === 2
    ? '2 cortes/mês = Economize R$ 121/ano + 5% OFF no Bar'
    : '4 cortes/mês = Economize R$ 601/ano + 10% OFF no Bar';
}

function renderPlans() {
  const plans = [
    {
      name: 'Corte Avulso', price: 'R$ 40,00', amount: 40.00, action: 'plan_single', sub: 'Por visita (Ordem de chegada)',
      items: [
        'Atendimento por ordem de chegada',
        'Acesso à fila ao vivo no celular',
        '🔒 Visagismo IA: Apenas Amostra (1 ângulo)',
        'Sem desconto no Bar e Produtos Físicos'
      ],
      featured: false, btn: 'Pagar Corte Avulso (R$ 40)'
    },
    {
      name: 'Califórnia Club (2x/mês)', price: 'R$ 69,90/mês', amount: 69.90, action: 'plan_club', sub: 'Sai a R$ 34,95 por corte (Anual)',
      items: [
        '📅 Escolha seus 2 dias livres de corte no mês',
        '🍺 5% OFF em Bebidas (Heineken/Monster) e Pomadas',
        'Relocação de dia c/ antecedência + Acordo flexível',
        '🔒 Visagismo IA: Apenas Amostra (1 ângulo)'
      ],
      featured: false, btn: 'Assinar Califórnia Club'
    },
    {
      name: 'Califórnia Gold VIP (4x/mês)', price: 'R$ 109,90/mês', amount: 109.90, action: 'plan_gold', sub: 'Sai a R$ 27,47 por corte (31% OFF)',
      items: [
        '📅 Escolha seus 4 dias livres no mês (1 por semana)',
        '🍺 10% OFF em Todas as Bebidas do Bar e Produtos Físicos',
        '👑 Visagismo IA 3D OFICIAL LIBERADO (3 Ângulos + Ficha)',
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
