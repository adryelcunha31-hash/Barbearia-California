let state = { shop: {}, members: [], queue: [], transactions: [] };
let currentFilter = 'all';
let selectedMemberId = 'm2';

function initAdminTheme() {
  const saved = localStorage.getItem('cal_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleAdminTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'light' ? 'dark' : 'light';
  localStorage.setItem('cal_theme', next);
  document.documentElement.setAttribute('data-theme', next);
}

function notify(msg) {
  const el = document.getElementById('toast');
  el.textContent = `✦ ${msg}`;
  el.classList.remove('hidden');
  clearTimeout(window._admT);
  window._admT = setTimeout(() => el.classList.add('hidden'), 3500);
}

let adminToken = '';

async function api(url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro');
  return data;
}

async function unlockAdmin() {
  try {
    const pin = document.getElementById('admin-pin-input').value;
    const auth = await api('/api/admin/login', { pin });
    adminToken = auth.token || '';
    document.getElementById('admin-lock-screen').classList.add('hidden');
    state = await api('/api/state');
    renderAdmin();
  } catch (e) {
    notify(e.message);
  }
}

function filterCrm(f) {
  currentFilter = f;
  ['all', 'overdue', 'active'].forEach(k => {
    const btn = document.getElementById(`btn-${k}`);
    btn.className = k === f ? 'px-3 py-1.5 rounded-lg btn-accent font-bold' : 'px-3 py-1.5 rounded-lg opacity-75';
  });
  renderAdmin();
}

function renderAdmin() {
  const totalMRR = state.members.reduce((s, m) => s + m.price, 0);
  const overdueList = state.members.filter(m => m.status === 'overdue');
  const overdueSum = overdueList.reduce((s, m) => s + m.price, 0);
  const paidSum = totalMRR - overdueSum;

  const kpis = [
    { label: 'Receita Recorrente (MRR)', val: `R$ ${totalMRR.toFixed(2)}`, sub: `${state.members.length} assinantes no clube anual`, cls: '' },
    { label: 'Já Recebido no Mês', val: `R$ ${paidSum.toFixed(2)}`, sub: 'Pagamentos confirmados', cls: 'text-emerald-500' },
    { label: 'Em Atraso (Recuperar)', val: `R$ ${overdueSum.toFixed(2)}`, sub: `${overdueList.length} clientes com 3+ dias de atraso`, cls: 'text-rose-500' },
    { label: 'Extras (Avulsos R$ 40 + Taxas R$ 5)', val: `R$ ${state.shop.extraRevenue.toFixed(2)}`, sub: 'Cortes avulsos + taxas de adiamento', cls: 'text-[#c85a32]' }
  ];

  document.getElementById('kpi-grid').innerHTML = kpis.map(k => `
    <div class="surface-card rounded-3xl p-5 space-y-1">
      <span class="text-xs opacity-70 font-semibold">${k.label}</span>
      <div class="font-mono-num font-extrabold text-2xl sm:text-3xl ${k.cls}">${k.val}</div>
      <p class="text-[11px] opacity-65">${k.sub}</p>
    </div>
  `).join('');

  const list = state.members.filter(m => currentFilter === 'all' ? true : m.status === currentFilter);
  document.getElementById('crm-list').innerHTML = list.map(m => `
    <div class="p-4 rounded-2xl surface-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="space-y-1 min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <strong class="text-sm">${m.name}</strong>
          <span class="text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
            m.status === 'overdue' ? 'bg-rose-500/20 text-rose-500' : 'accent-badge'
          }">
            ${m.status === 'overdue' ? `⚠️ ${m.daysOverdue} dias atrasado` : m.status === 'rescheduled' ? `📅 Adiado p/ ${m.dueDate} (+R$ ${m.feeAdded})` : '✅ Em Dia'}
          </span>
        </div>
        <p class="text-xs opacity-75">${m.plan} • <strong>R$ ${m.price.toFixed(2)}/mês</strong> • Cortes: <strong>${m.cutsUsed}/${m.cutsLimit}</strong></p>
        <p class="text-[11px] text-[#c85a32] font-semibold truncate">🧠 Visagismo IA: Rosto ${m.visagism.shape} → ${m.visagism.cut}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        ${m.status === 'overdue' ? `
          <button onclick="selectForAi('${m.id}')" class="btn-accent font-bold px-3 py-2 rounded-xl text-xs">
            🤖 Cobrar c/ IA
          </button>
        ` : ''}
        <button onclick="markPaid('${m.id}')" class="btn-outline font-bold px-3 py-2 rounded-xl text-xs">
          Baixa PIX
        </button>
      </div>
    </div>
  `).join('');

  // Renderiza Livro Caixa Financeiro
  const txs = state.transactions || [];
  document.getElementById('transactions-list').innerHTML = txs.map(t => `
    <div class="p-3.5 rounded-2xl surface-subtle flex items-center justify-between gap-3 text-xs">
      <div class="min-w-0">
        <div class="font-bold truncate">${t.desc}</div>
        <div class="opacity-65 text-[11px]">${t.date} • ${t.method}</div>
      </div>
      <span class="font-mono-num font-bold text-sm text-emerald-500 shrink-0">+ R$ ${Number(t.amount).toFixed(2)}</span>
    </div>
  `).join('');

  const target = state.members.find(x => x.id === selectedMemberId) || overdueList[0] || state.members[0];
  if (target) populateAiMessage(target);

  document.getElementById('admin-queue-badge').textContent = `${state.queue.length} na fila`;
  document.getElementById('admin-chair-list').innerHTML = state.queue.map((q, i) => `
    <div class="p-3.5 rounded-2xl surface-subtle flex items-center justify-between gap-2">
      <div class="min-w-0">
        <div class="font-bold text-xs sm:text-sm truncate">${i === 0 ? '✂ Na Cadeira: ' : `${i + 1}º: `}${q.name}</div>
        <div class="text-xs opacity-70 truncate">${q.service} • ${q.tag}</div>
      </div>
      <button onclick="finishCut('${q.id}')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-2 rounded-xl text-xs shrink-0">
        ✔ Concluir
      </button>
    </div>
  `).join('');
}

function selectForAi(memberId) {
  selectedMemberId = memberId;
  const m = state.members.find(x => x.id === memberId);
  if (m) {
    populateAiMessage(m);
    notify(`Mensagem gerada para ${m.name}`);
  }
}

function populateAiMessage(m) {
  document.getElementById('ai-target-name').textContent = `${m.name} (${m.daysOverdue || 3} dias em atraso)`;
  const fee = state.shop.rescheduleFee || 5;
  document.getElementById('ai-msg-textarea').value =
    `Olá ${m.name.split(' ')[0]}, bom dia! Tudo certo? 💈\n\nVi que você está há ${m.daysOverdue || 3} dias com o pagamento atrasado aqui na Barbearia Califórnia, queria tentar resolver da melhor forma!\n\nPodemos reajustar a parte do pagamento em atraso para outro dia com uma taxinha simbólica de R$ ${fee.toFixed(2)}? Assim você não perde seu desconto e sua fila já fica liberada!`;
}

function dispatchWhatsApp() {
  const m = state.members.find(x => x.id === selectedMemberId) || state.members[0];
  window.open(`https://wa.me/${m.phone}?text=${encodeURIComponent(document.getElementById('ai-msg-textarea').value)}`, '_blank');
}

async function confirmFeeAgreement() {
  state = await api('/api/crm/reschedule-payment', { memberId: selectedMemberId, newDueDate: '25/10/2026' });
  renderAdmin();
  notify('Acordo registrado no Livro Caixa! +R$ 5,00 somados.');
}

async function markPaid(memberId) {
  state = await api('/api/crm/pay-now', { memberId, method: 'Baixa Manual PIX' });
  renderAdmin();
  notify('Pagamento PIX registrado no Livro Caixa!');
}

async function finishCut(queueId) {
  state = await api('/api/queue/finish', { queueId });
  renderAdmin();
  notify('Corte finalizado e registrado no caixa!');
}

window.addEventListener('DOMContentLoaded', initAdminTheme);
