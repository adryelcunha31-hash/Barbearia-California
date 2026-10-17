let state = { shop: {}, members: [], queue: [], transactions: [] };
let currentFilter = 'all';
let selectedMemberId = null;
let adminToken = '';

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
    notify('Bem-vindo ao Painel Administrativo, Rogério!');
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
  const members = state.members || [];
  const queue = state.queue || [];
  const txs = state.transactions || [];
  const extraRev = Number(state.shop?.extraRevenue || 0);

  const totalMRR = members.reduce((s, m) => s + Number(m.price || 0), 0);
  const overdueList = members.filter(m => m.status === 'overdue');
  const overdueSum = overdueList.reduce((s, m) => s + Number(m.price || 0), 0);
  const paidSum = Math.max(0, totalMRR - overdueSum);

  const kpis = [
    { label: 'Receita Recorrente (MRR)', val: `R$ ${totalMRR.toFixed(2)}`, sub: `${members.length} assinantes ativos no clube`, cls: '' },
    { label: 'Já Recebido no Mês', val: `R$ ${paidSum.toFixed(2)}`, sub: 'Pagamentos confirmados', cls: 'text-emerald-500' },
    { label: 'Em Atraso (Recuperar)', val: `R$ ${overdueSum.toFixed(2)}`, sub: `${overdueList.length} clientes em atraso`, cls: 'text-rose-500' },
    { label: 'Extras (Avulsos R$ 40 + Taxas R$ 5)', val: `R$ ${extraRev.toFixed(2)}`, sub: 'Cortes avulsos + taxas de adiamento', cls: 'text-[#c85a32]' }
  ];

  document.getElementById('kpi-grid').innerHTML = kpis.map(k => `
    <div class="surface-card rounded-3xl p-5 space-y-1">
      <span class="text-xs opacity-70 font-semibold">${k.label}</span>
      <div class="font-mono-num font-extrabold text-2xl sm:text-3xl ${k.cls}">${k.val}</div>
      <p class="text-[11px] opacity-65">${k.sub}</p>
    </div>
  `).join('');

  const list = members.filter(m => currentFilter === 'all' ? true : m.status === currentFilter);
  document.getElementById('crm-list').innerHTML = list.length === 0
    ? `<div class="p-6 rounded-2xl surface-subtle text-center text-xs opacity-70">Nenhum cliente cadastrado neste filtro ainda. Os novos clientes que se cadastrarem ou assinarem no site aparecerão aqui automaticamente.</div>`
    : list.map(m => `
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
          <p class="text-xs opacity-75">${m.plan} • <strong>R$ ${Number(m.price).toFixed(2)}/mês</strong> • Cortes: <strong>${m.cutsUsed}/${m.cutsLimit}</strong> • WhatsApp: ${m.phone || '-'}</p>
          <p class="text-[11px] text-[#c85a32] font-semibold truncate">🧠 Visagismo IA: Rosto ${m.visagism?.shape || 'Oval'} → ${m.visagism?.cut || 'Taper Fade'}</p>
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
          <button onclick="deleteMemberAdmin('${m.id}')" class="btn-outline font-bold px-2.5 py-2 rounded-xl text-xs text-rose-500" title="Excluir cliente">
            🗑️
          </button>
        </div>
      </div>
    `).join('');

  document.getElementById('transactions-list').innerHTML = txs.length === 0
    ? `<div class="p-6 rounded-2xl surface-subtle text-center text-xs opacity-70">Nenhuma transação registrada ainda. Pagamentos do Asaas (PIX Automático e Cartão) e cortes avulsos aparecerão aqui em tempo real.</div>`
    : txs.map(t => `
      <div class="p-3.5 rounded-2xl surface-subtle flex items-center justify-between gap-3 text-xs">
        <div class="min-w-0">
          <div class="font-bold truncate">${t.desc}</div>
          <div class="opacity-65 text-[11px]">${t.date} • ${t.method}</div>
        </div>
        <span class="font-mono-num font-bold text-sm text-emerald-500 shrink-0">+ R$ ${Number(t.amount).toFixed(2)}</span>
      </div>
    `).join('');

  const target = members.find(x => x.id === selectedMemberId) || overdueList[0] || members[0];
  if (target) {
    selectedMemberId = target.id;
    populateAiMessage(target);
  } else {
    document.getElementById('ai-target-name').textContent = 'Nenhum cliente em atraso';
    document.getElementById('ai-msg-textarea').value = '';
  }

  document.getElementById('admin-queue-badge').textContent = `${queue.length} na fila`;
  document.getElementById('admin-chair-list').innerHTML = queue.length === 0
    ? `<div class="p-6 rounded-2xl surface-subtle text-center text-xs opacity-70">💈 Cadeira livre! Nenhum cliente na fila no momento.</div>`
    : queue.map((q, i) => `
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
  if (!m) return notify('Nenhum cliente selecionado.');
  window.open(`https://wa.me/${m.phone}?text=${encodeURIComponent(document.getElementById('ai-msg-textarea').value)}`, '_blank');
}

async function confirmFeeAgreement() {
  if (!selectedMemberId) return notify('Nenhum cliente em atraso selecionado.');
  state = await api('/api/crm/reschedule-payment', { memberId: selectedMemberId });
  renderAdmin();
  notify('Acordo registrado no Livro Caixa! +R$ 5,00 somados.');
}

async function markPaid(memberId) {
  state = await api('/api/crm/pay-now', { memberId, method: 'Baixa Manual PIX' });
  renderAdmin();
  notify('Pagamento PIX registrado no Livro Caixa!');
}

async function deleteMemberAdmin(memberId) {
  if (!confirm('Deseja remover este cliente da carteira?')) return;
  state = await api('/api/admin/delete-member', { memberId });
  renderAdmin();
  notify('Cliente removido com sucesso.');
}

async function resetDatabaseAdmin() {
  if (!confirm('Tem certeza que deseja zerar todos os clientes, fila e transações do banco de dados?')) return;
  state = await api('/api/admin/reset', {});
  selectedMemberId = null;
  renderAdmin();
  notify('Banco de dados zerado com sucesso!');
}

async function finishCut(queueId) {
  state = await api('/api/queue/finish', { queueId });
  renderAdmin();
  notify('Corte finalizado e registrado no caixa!');
}

window.addEventListener('DOMContentLoaded', initAdminTheme);
