const { createClient } = supabase;
const client = createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

const state = {
  session: null,
  month: new Date(),
  meetings: [],
  members: [],
  memberHistory: {},
  themes: [],
  settings: null,
  editingMeetingId: null,
  activeMeeting: null,
  currentAssignments: []
};

const $ = (id) => document.getElementById(id);

const fmtDate = (iso) => new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric"
}).format(new Date(`${iso}T12:00:00`));

const monthLabel = (date) => new Intl.DateTimeFormat("pt-BR", {
  month: "long", year: "numeric"
}).format(date);

const meetingLabels = {
  discursos: "Reunião com discursos",
  testemunhos: "Reunião de testemunhos",
  conferencia_estaca: "Conferência de Estaca",
  conferencia_geral: "Conferência Geral"
};

const meetingBadgeLabels = {
  discursos: "Discursos",
  testemunhos: "Testemunhos",
  conferencia_estaca: "Conferência de Estaca",
  conferencia_geral: "Conferência Geral"
};

const statusLabels = {
  nao_enviado: "Não enviado",
  aguardando_resposta: "Aguardando resposta",
  aceitou: "Aceitou"
};

const pageTitles = {
  "agenda-page": "Agenda sacramental",
  "members-page": "Membros",
  "themes-page": "Temas",
  "settings-page": "Configurações"
};

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DEFAULT_INVITE_TEMPLATE = `Oi, {primeiro_nome}! Tudo bem? \u{1F60A}

Queria te fazer um convite! O Bispado gostaria de contar com você para discursar na nossa reunião sacramental.

As informações seriam:

\u{1F4C5} *Data:* {data}
\u{1F399}\u{FE0F} *Ordem:* {ordem}
\u{23F1}\u{FE0F} *Tempo:* {duracao} minutos
\u{1F4A1} *Sugestão de tema:* {tema}

{link_tema}

O tema é apenas uma sugestão para ajudar em sua preparação. Fique à vontade para abordar da maneira que sentir ser mais adequada, sempre procurando centralizar a mensagem em Jesus Cristo.

Você aceita o convite?`;

const DEFAULT_SECRETARY_TEMPLATE = `Oi! Tudo bem? \u{1F60A}

Segue a programação dos discursos da reunião sacramental de *{data}*:

\u{1F399}\u{FE0F} *1º orador:* {orador_1} — {tempo_1} min
\u{1F399}\u{FE0F} *2º orador:* {orador_2} — {tempo_2} min
\u{1F399}\u{FE0F} *3º orador:* {orador_3} — {tempo_3} min

Obrigado! \u{1F64F}`;

const DEFAULT_REMINDER_TEMPLATE = `Oi, {primeiro_nome}! Tudo bem? \u{1F60A}

Só passando para lembrar do seu discurso na reunião sacramental deste próximo domingo, dia *{data}*.

\u{1F399}\u{FE0F} *Ordem:* {ordem}
\u{1F4A1} *Tema:* {tema}

Se acontecer algum imprevisto ou se precisar de alguma ajuda do bispado na preparação, pode me avisar por aqui.

Obrigado! \u{1F64F}`;


const INVITE_TEMPLATE_STORAGE_PREFIX = "V17::";


function hasBrokenTemplateEncoding(value) {
  const text = String(value || "");
  return text.includes("\\n") || text.includes("\uFFFD") || text.includes("�");
}

function isLegacySecretaryTemplate(value) {
  const text = String(value || "");
  return (
    text.includes("Seguem os discursantes da reunião sacramental") ||
    text.includes("Olá! Seguem os discursantes") ||
    text.includes("1º orador — {orador_1}")
  );
}

function normalizeStoredTemplate(value) {
  let text = String(value || "");

  text = text
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");

  return text.trim();
}

function showLogin() {
  $("login-view").classList.remove("hidden");
  $("main-view").classList.add("hidden");
}

function showMain() {
  $("login-view").classList.add("hidden");
  $("main-view").classList.remove("hidden");
}

async function bootstrap() {
  state.month = new Date();
  buildDateSelectors();
  updateDateSelectors(state.month.getFullYear(), state.month.getMonth() + 1);

  const { data: { session } } = await client.auth.getSession();
  state.session = session;

  if (!session) return showLogin();

  showMain();
  await Promise.all([loadMonth(), loadSettings()]);
}

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("login-error").classList.add("hidden");

  const email = $("login-email").value.trim();
  const password = $("login-password").value;

  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    $("login-error").textContent = "Não foi possível entrar. Verifique e-mail e senha.";
    $("login-error").classList.remove("hidden");
    return;
  }

  state.session = data.session;
  state.month = new Date();
  updateDateSelectors(state.month.getFullYear(), state.month.getMonth() + 1);
  showMain();
  await Promise.all([loadMonth(), loadSettings()]);
});

$("logout-btn").addEventListener("click", async () => {
  await client.auth.signOut();
  state.session = null;
  showLogin();
});

client.auth.onAuthStateChange((_event, session) => {
  state.session = session;
  if (!session) showLogin();
});

function goToCurrentMonth() {
  state.month = new Date();
  updateDateSelectors(state.month.getFullYear(), state.month.getMonth() + 1);
  loadMonth();
}

$("today-btn").addEventListener("click", goToCurrentMonth);
$("today-btn-header").addEventListener("click", goToCurrentMonth);

function setMonth(delta) {
  state.month = new Date(
    state.month.getFullYear(),
    state.month.getMonth() + delta,
    1
  );
  updateDateSelectors(state.month.getFullYear(), state.month.getMonth() + 1);
  loadMonth();
}

$("prev-month").addEventListener("click", () => setMonth(-1));
$("next-month").addEventListener("click", () => setMonth(1));



function getMonthLabels() {
  const isMobile = window.matchMedia("(max-width: 560px)").matches;
  return isMobile
    ? ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"]
    : monthNames;
}

function refreshMonthOptions() {
  const monthSelect = $("month-select");
  if (!monthSelect) return;

  const selected = Number(
    monthSelect.value || (state.month ? state.month.getMonth() + 1 : new Date().getMonth() + 1)
  );
  const labels = getMonthLabels();

  monthSelect.innerHTML = labels.map((name, index) =>
    `<option value="${index + 1}">${name}</option>`
  ).join("");

  monthSelect.value = String(selected);
  monthSelect.setAttribute("aria-label", labels[selected - 1] || "Mês");
}

function buildDateSelectors() {
  const monthSelect = $("month-select");
  const yearSelect = $("year-select");

  refreshMonthOptions();

  const currentYear = new Date().getFullYear();
  const startYear = Math.min(2026, currentYear - 2);
  const endYear = currentYear + 6;

  yearSelect.innerHTML = Array.from(
    { length: endYear - startYear + 1 },
    (_, i) => startYear + i
  ).map((year) => `<option value="${year}">${year}</option>`).join("");

  monthSelect.addEventListener("change", () => {
    const selectedMonth = Number(monthSelect.value);
    const selectedYear = Number(yearSelect.value);
    state.month = new Date(selectedYear, selectedMonth - 1, 1);
    loadMonth();
  });

  yearSelect.addEventListener("change", () => {
    const selectedMonth = Number(monthSelect.value);
    const selectedYear = Number(yearSelect.value);
    state.month = new Date(selectedYear, selectedMonth - 1, 1);
    loadMonth();
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      refreshMonthOptions();
      updateDateSelectors(state.month.getFullYear(), state.month.getMonth() + 1);
    }, 120);
  });
}

function ensureYearOption(year) {
  const yearSelect = $("year-select");
  if (![...yearSelect.options].some((option) => Number(option.value) === year)) {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    yearSelect.appendChild(option);
  }
}

function updateDateSelectors(year, month) {
  ensureYearOption(year);
  $("month-select").value = String(month);
  $("year-select").value = String(year);
}

async function ensureMonthExists(year, month) {
  const { error } = await client.rpc("gerar_reunioes_mes", {
    p_ano: year,
    p_mes: month
  });
  if (error) throw error;
}

async function loadMonth() {
  const year = state.month.getFullYear();
  const month = state.month.getMonth() + 1;

  updateDateSelectors(year, month);

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0);
  const end = `${year}-${String(month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

  try {
    $("month-status").classList.add("hidden");
    await ensureMonthExists(year, month);

    const { data: meetings, error } = await client
      .from("reunioes")
      .select("id,data,tipo_reuniao,observacao")
      .gte("data", start)
      .lte("data", end)
      .order("data");

    if (error) throw error;

    state.meetings = meetings || [];

    const ids = state.meetings.map((m) => m.id);
    let assignments = [];

    if (ids.length) {
      const { data: rows, error: speechesError } = await client
        .from("discursos")
        .select(`
          id,
          reuniao_id,
          membro_id,
          ordem,
          tema_id,
          duracao_minutos,
          status_convite,
          convite_enviado_em,
          membros ( nome_completo, whatsapp ),
          temas ( titulo, url, categoria, autor )
        `)
        .in("reuniao_id", ids)
        .order("ordem");

      if (speechesError) throw speechesError;
      assignments = rows || [];
    }

    state.meetings = state.meetings.map((meeting) => ({
      ...meeting,
      assignments: assignments
        .filter((a) => a.reuniao_id === meeting.id)
        .sort((a, b) => a.ordem - b.ordem)
    }));

    renderMeetings();
  } catch (error) {
    console.error(error);
    $("month-status").textContent = "Não foi possível carregar este mês.";
    $("month-status").classList.remove("hidden");
  }
}

function renderMeetings() {
  const container = $("sundays-list");

  if (!state.meetings.length) {
    container.innerHTML = `<div class="empty-state">Nenhum domingo encontrado neste mês.</div>`;
    return;
  }

  container.innerHTML = state.meetings.map((meeting) => {
    const d = new Date(`${meeting.data}T12:00:00`);
    const day = String(d.getDate()).padStart(2, "0");
    const mon = new Intl.DateTimeFormat("pt-BR", { month: "short" })
      .format(d).replace(".", "").toUpperCase();

    let body;

    if (meeting.tipo_reuniao === "discursos" && meeting.assignments?.length) {
      body = `
        <div class="assignment-summary">
          ${meeting.assignments.map((a) => `
            <div class="assignment-row">
              <span class="assignment-order">${a.ordem}º</span>
              <span class="assignment-name">${escapeHtml(a.membros?.nome_completo || "Membro")}</span>
              <span class="assignment-status assignment-status-${a.status_convite || "nao_enviado"}">
                <span class="assignment-status-dot ${a.status_convite || "nao_enviado"}"></span>
                ${statusLabels[a.status_convite] || "Não enviado"}
              </span>
            </div>
          `).join("")}
        </div>
      `;
    } else {
      const detail = meeting.tipo_reuniao === "discursos"
        ? "Defina o primeiro, segundo e terceiro orador desta reunião."
        : "Este domingo não possui discursantes.";
      body = `<p class="card-note">${detail}</p>`;
    }

    // Usa a data LOCAL do navegador e compara YYYY-MM-DD diretamente.
    // Isso evita diferenças de fuso horário ao identificar domingos passados/próximos.
    const now = new Date();
    const todayIso = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");

    const nextMeetingIso = state.meetings
      .map((m) => m.data)
      .filter((date) => date >= todayIso)
      .sort()[0] || null;

    const isPast = meeting.data < todayIso;
    const isNext = meeting.data === nextMeetingIso;

    const temporalClass = isPast ? "is-past" : (isNext ? "is-next" : "");

    return `
      <article class="sunday-card ${temporalClass}">
        <div class="sunday-card-top">
          <div class="sunday-card-date">
            <div class="date-box">
              <strong>${day}</strong>
              <span>${mon}</span>
            </div>
            <div>
              <div class="meeting-title">${meetingLabels[meeting.tipo_reuniao] || meeting.tipo_reuniao}</div>
              <div class="meeting-date">${fmtDate(meeting.data)}</div>
            </div>
          </div>

          <div class="card-badges">
            ${isPast ? `<span class="temporal-badge temporal-badge-past"><i class="fa-solid fa-check"></i> Realizado</span>` : ""}
            ${isNext ? `<span class="temporal-badge temporal-badge-next"><i class="fa-solid fa-arrow-right"></i> Próximo domingo</span>` : ""}
            <span class="badge badge-${meeting.tipo_reuniao}">
              ${meetingBadgeLabels[meeting.tipo_reuniao] || meeting.tipo_reuniao}
            </span>
          </div>
        </div>

        <div class="sunday-card-body">
          ${body}
          ${meeting.observacao ? `<p class="card-note" style="margin-top:8px"><strong>Obs.:</strong> ${escapeHtml(meeting.observacao)}</p>` : ""}
        </div>

        <div class="card-actions">
          <button class="btn btn-secondary" onclick="openMeeting(${meeting.id})">
            <i class="fa-regular fa-pen-to-square"></i>
            <span>Editar reunião</span>
          </button>
          ${meeting.tipo_reuniao === "discursos"
            ? `<button class="btn btn-primary" onclick="openSpeakers(${meeting.id})">
                 <i class="fa-solid fa-microphone-lines"></i>
                 <span>${meeting.assignments?.length ? "Editar discursantes" : "Definir discursantes"}</span>
               </button>`
            : ""}
        </div>
      </article>
    `;
  }).join("");
}

window.openMeeting = function(id) {
  const meeting = state.meetings.find((m) => m.id === id);
  if (!meeting) return;

  state.editingMeetingId = id;
  $("meeting-dialog-title").textContent = fmtDate(meeting.data);
  $("meeting-type").value = meeting.tipo_reuniao;
  $("meeting-note").value = meeting.observacao || "";
  $("meeting-dialog").showModal();
};

$("meeting-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!state.editingMeetingId) return;

  const payload = {
    tipo_reuniao: $("meeting-type").value,
    observacao: $("meeting-note").value.trim() || null
  };

  const { error } = await client
    .from("reunioes")
    .update(payload)
    .eq("id", state.editingMeetingId);

  if (error) {
    alert(
      error.message.includes("Remova os discursantes")
        ? "Remova os discursantes antes de alterar o tipo desta reunião."
        : `Erro ao salvar: ${error.message}`
    );
    return;
  }

  $("meeting-dialog").close();
  await loadMonth();
});

function setupNavigation(selector) {
  document.querySelectorAll(selector).forEach((btn) => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".side-nav-item,.bottom-nav-item")
        .forEach((b) => b.classList.remove("active"));

      document.querySelectorAll(`[data-page="${btn.dataset.page}"]`)
        .forEach((b) => b.classList.add("active"));

      document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
      $(btn.dataset.page).classList.add("active");
      $("page-title").textContent = pageTitles[btn.dataset.page] || "Gestão Sacramental";

      if (btn.dataset.page === "members-page" && !state.members.length) await loadMembers();
      if (btn.dataset.page === "themes-page" && !state.themes.length) await loadThemes();
    });
  });
}

setupNavigation(".side-nav-item");
setupNavigation(".bottom-nav-item");

document.querySelectorAll('[data-page="settings-page"]').forEach((btn) => {
  btn.addEventListener("click", async () => {
    await loadSettings();
  });
});


async function loadMembers(includeHistory = false) {
  if (!state.members.length) {
    const { data, error } = await client
      .from("membros")
      .select("id,nome_completo,whatsapp")
      .eq("ativo", true)
      .order("nome_completo");

    if (error) throw error;
    state.members = data || [];
  }

  if (includeHistory && Object.keys(state.memberHistory).length === 0) {
    const { data, error } = await client
      .from("v_historico_membros")
      .select("membro_id,ultimo_discurso,total_discursos");

    if (error) throw error;

    state.memberHistory = Object.fromEntries(
      (data || []).map((row) => [String(row.membro_id), row])
    );
  }
}

function renderMembers() {
  const q = $("member-search").value.trim().toLocaleLowerCase("pt-BR");

  const rows = state.members.filter((m) =>
    m.nome_completo.toLocaleLowerCase("pt-BR").includes(q)
  );

  $("members-list").innerHTML = rows.map((m) => `
    <div class="list-row">
      <div class="list-row-main">
        <div class="list-row-title">${escapeHtml(m.nome_completo)}</div>
        <div class="list-row-sub">
          ${m.whatsapp ? escapeHtml(m.whatsapp) : "WhatsApp não cadastrado"}
        </div>
      </div>
      <div class="member-actions">
        ${m.whatsapp ? `
          <button class="btn-icon-success" type="button"
                  onclick="openMemberWhatsapp(${m.id})"
                  title="Abrir WhatsApp">
            <i class="fa-brands fa-whatsapp"></i>
          </button>
        ` : ""}
        <button class="btn btn-secondary" onclick="editMember(${m.id})">
          <i class="fa-regular fa-pen-to-square"></i>
          <span>Editar</span>
        </button>
      </div>
    </div>
  `).join("") || `<div class="empty-state">Nenhum membro encontrado.</div>`;
}

window.openMemberWhatsapp = function(id) {
  const member = state.members.find((m) => m.id === id);
  if (!member?.whatsapp) {
    showToast("WhatsApp não cadastrado para este membro.", "info");
    return;
  }

  const url = new URL("https://api.whatsapp.com/send");
  url.searchParams.set("phone", digitsOnly(member.whatsapp));
  window.open(url.toString(), "_blank", "noopener");
};

async function ensureMembersPage() {
  try {
    await loadMembers(false);
    renderMembers();
  } catch (error) {
    alert(`Erro ao carregar membros: ${error.message}`);
  }
}

$("member-search").addEventListener("input", renderMembers);

$("new-member-btn").addEventListener("click", () => {
  $("member-id").value = "";
  $("member-dialog-title").textContent = "Novo membro";
  $("member-name").value = "";
  $("member-whatsapp").value = "";
  $("member-dialog").showModal();
});

window.editMember = function(id) {
  const m = state.members.find((x) => x.id === id);
  if (!m) return;

  $("member-id").value = m.id;
  $("member-dialog-title").textContent = "Editar membro";
  $("member-name").value = m.nome_completo;
  $("member-whatsapp").value = m.whatsapp || "";
  $("member-dialog").showModal();
};

$("member-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = $("member-id").value;
  const payload = {
    nome_completo: $("member-name").value.trim(),
    whatsapp: normalizeWhatsapp($("member-whatsapp").value)
  };

  if (!payload.nome_completo) return;

  const query = id
    ? client.from("membros").update(payload).eq("id", id)
    : client.from("membros").insert(payload);

  const { error } = await query;

  if (error) return alert(`Erro ao salvar membro: ${error.message}`);

  $("member-dialog").close();
  state.members = [];
  state.memberHistory = {};
  await ensureMembersPage();
});

async function loadThemes() {
  if (state.themes.length) return;

  const { data, error } = await client
    .from("temas")
    .select("id,titulo,categoria,autor,url,edicao_origem")
    .eq("ativo", true)
    .order("categoria")
    .order("titulo");

  if (error) throw error;
  state.themes = data || [];
}

function libraryGroupName(theme) {
  if (theme.categoria === "conferencia_geral") {
    return theme.edicao_origem || "Conferência Geral";
  }
  if (theme.categoria === "principios_evangelho") return "Princípios do Evangelho";
  if (theme.categoria === "topicos_evangelho") return "Tópicos do Evangelho";
  if (theme.categoria === "forca_dos_jovens") return "Força dos Jovens";
  if (theme.categoria === "opcoes_especiais") return "Opções especiais";
  if (theme.categoria === "personalizado") return "Meus temas";
  return themeCategoryLabel(theme.categoria);
}

function libraryGroupIcon(group) {
  if (group.startsWith("Conferência Geral")) return "fa-solid fa-microphone-lines";
  if (group === "Princípios do Evangelho") return "fa-solid fa-book-open";
  if (group === "Tópicos do Evangelho") return "fa-regular fa-lightbulb";
  if (group === "Força dos Jovens") return "fa-solid fa-person-rays";
  if (group === "Opções especiais") return "fa-solid fa-wand-magic-sparkles";
  if (group === "Meus temas") return "fa-solid fa-pen";
  return "fa-regular fa-folder";
}

function renderThemes() {
  const q = normalizeSearch($("theme-search").value);

  const filtered = state.themes.filter((theme) => {
    const haystack = normalizeSearch(
      `${theme.titulo} ${theme.autor || ""} ${theme.edicao_origem || ""} ${libraryGroupName(theme)}`
    );
    return !q || haystack.includes(q);
  });

  const grouped = {};
  filtered.forEach((theme) => {
    const group = libraryGroupName(theme);
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(theme);
  });

  const preferredOrder = [
    "Opções especiais",
    "Conferência Geral de Abril de 2026",
    "Conferência Geral de Outubro de 2025",
    "Princípios do Evangelho",
    "Tópicos do Evangelho",
    "Força dos Jovens",
    "Meus temas"
  ];

  const entries = Object.entries(grouped).sort(([a], [b]) => {
    const ia = preferredOrder.indexOf(a);
    const ib = preferredOrder.indexOf(b);
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    }
    return a.localeCompare(b, "pt-BR");
  });

  const container = $("themes-library");

  if (!entries.length) {
    container.innerHTML = `<div class="library-empty">Nenhum tema encontrado.</div>`;
    return;
  }

  container.innerHTML = entries.map(([group, themes]) => `
    <section class="library-group ${q ? "open" : ""}">
      <button class="library-group-header" type="button">
        <span class="library-group-icon">
          <i class="${libraryGroupIcon(group)}"></i>
        </span>
        <span class="library-group-title">
          <strong>${escapeHtml(group)}</strong>
          <span>${themes.length === 1 ? "1 tema" : `${themes.length} temas`}</span>
        </span>
        <span class="library-group-count">${themes.length}</span>
        <i class="fa-solid fa-chevron-down library-group-chevron"></i>
      </button>

      <div class="library-group-body">
        ${themes.map((theme) => `
          <div class="library-theme-row">
            <div class="library-theme-main">
              <div class="library-theme-title">${escapeHtml(theme.titulo)}</div>
              <div class="library-theme-meta">
                ${theme.autor ? escapeHtml(theme.autor) : themeCategoryLabel(theme.categoria)}
              </div>
            </div>
            <div class="library-theme-actions">
              ${theme.url ? `
                <a class="btn btn-secondary" href="${escapeAttr(theme.url)}"
                   target="_blank" rel="noopener" title="Abrir referência">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i>
                  <span>Abrir</span>
                </a>
              ` : ""}
              ${theme.categoria === "personalizado" ? `
                <button class="btn btn-secondary" type="button"
                        onclick="editTheme(${theme.id})" title="Editar tema">
                  <i class="fa-regular fa-pen-to-square"></i>
                  <span>Editar</span>
                </button>
              ` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `).join("");

  container.querySelectorAll(".library-group-header").forEach((header) => {
    header.addEventListener("click", () => {
      header.closest(".library-group").classList.toggle("open");
    });
  });
}

async function ensureThemesPage() {
  try {
    await loadThemes();
    renderThemes();
  } catch (error) {
    alert(`Erro ao carregar temas: ${error.message}`);
  }
}

$("theme-search").addEventListener("input", renderThemes);


$("close-theme-dialog").addEventListener("click", () => {
  $("theme-dialog").close();
});

$("cancel-theme-btn").addEventListener("click", () => {
  $("theme-dialog").close();
});

$("new-theme-btn").addEventListener("click", () => {
  $("theme-id-edit").value = "";
  $("theme-dialog-title").textContent = "Novo tema";
  $("theme-title").value = "";
  $("theme-category").value = "personalizado";
  $("theme-author").value = "";
  $("theme-url").value = "";
  $("delete-theme-btn").classList.add("hidden");
  $("theme-dialog").showModal();
});

window.editTheme = function(id) {
  const theme = state.themes.find((t) => t.id === id);
  if (!theme) return;

  $("theme-id-edit").value = theme.id;
  $("theme-dialog-title").textContent = "Editar tema";
  $("theme-title").value = theme.titulo || "";
  $("theme-category").value = theme.categoria || "personalizado";
  $("theme-author").value = theme.autor || "";
  $("theme-url").value = theme.url || "";
  $("delete-theme-btn").classList.remove("hidden");
  $("theme-dialog").showModal();
};

$("theme-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = Number($("theme-id-edit").value || 0);
  const payload = {
    titulo: $("theme-title").value.trim(),
    categoria: $("theme-category").value || "personalizado",
    autor: $("theme-author").value.trim() || null,
    url: $("theme-url").value.trim() || null
  };

  const query = id
    ? client.from("temas").update(payload).eq("id", id)
    : client.from("temas").insert(payload);

  const { error } = await query;

  if (error) return alert(`Erro ao salvar tema: ${error.message}`);

  $("theme-dialog").close();
  state.themes = [];
  await ensureThemesPage();
  showToast(id ? "Tema atualizado." : "Tema criado.");
});

$("delete-theme-btn").addEventListener("click", async () => {
  const id = Number($("theme-id-edit").value || 0);
  if (!id) return;

  if (!confirm("Excluir este tema personalizado?")) return;

  const { error } = await client.from("temas").delete().eq("id", id);
  if (error) return alert(`Erro ao excluir tema: ${error.message}`);

  $("theme-dialog").close();
  state.themes = [];
  await ensureThemesPage();
  showToast("Tema excluído.");
});

async function loadSettings() {
  const { data, error } = await client
    .from("configuracoes")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) {
    console.error(error);
    return;
  }

  const rawInvite = String(data.template_convite || "");
  const storedSecretary = normalizeStoredTemplate(data.template_secretario);
  const storedReminder = normalizeStoredTemplate(data.template_lembrete);

  // Importante:
  // templates de convite anteriores à V17 não são confiáveis porque algumas
  // versões antigas gravaram emojis corrompidos. Só aceitamos um template
  // salvo pelo fluxo novo, identificado pelo prefixo V17::.
  const inviteTemplate = rawInvite.startsWith(INVITE_TEMPLATE_STORAGE_PREFIX)
    ? normalizeStoredTemplate(rawInvite.slice(INVITE_TEMPLATE_STORAGE_PREFIX.length))
    : DEFAULT_INVITE_TEMPLATE;

  const secretaryTemplate = (
    !storedSecretary ||
    hasBrokenTemplateEncoding(storedSecretary) ||
    isLegacySecretaryTemplate(storedSecretary)
  ) ? DEFAULT_SECRETARY_TEMPLATE : storedSecretary;

  const reminderTemplate = (
    !storedReminder ||
    hasBrokenTemplateEncoding(storedReminder)
  ) ? DEFAULT_REMINDER_TEMPLATE : storedReminder;

  state.settings = {
    ...data,
    template_convite: inviteTemplate,
    template_secretario: secretaryTemplate,
    template_lembrete: reminderTemplate
  };

  $("secretary-name").value = data.secretario_nome || "";
  $("secretary-whatsapp").value = data.secretario_whatsapp || "";
  $("invite-template").value = inviteTemplate;
  $("secretary-template").value = secretaryTemplate;
  $("reminder-template").value = reminderTemplate;
}

$("save-settings-btn").addEventListener("click", async () => {
  const payload = {
    secretario_nome: $("secretary-name").value.trim() || null,
    secretario_whatsapp: normalizeWhatsapp($("secretary-whatsapp").value),
    template_convite: INVITE_TEMPLATE_STORAGE_PREFIX + (normalizeStoredTemplate($("invite-template").value) || DEFAULT_INVITE_TEMPLATE),
    template_secretario: normalizeStoredTemplate($("secretary-template").value) || DEFAULT_SECRETARY_TEMPLATE,
    template_lembrete: normalizeStoredTemplate($("reminder-template").value) || DEFAULT_REMINDER_TEMPLATE
  };

  const { error } = await client
    .from("configuracoes")
    .update(payload)
    .eq("id", 1);

  if (error) {
    alert(`Erro ao salvar: ${error.message}`);
    return;
  }

  await loadSettings();
  showToast("Configurações atualizadas.");

  // Volta automaticamente para a Agenda após salvar.
  document.querySelectorAll(".side-nav-item,.bottom-nav-item")
    .forEach((b) => b.classList.remove("active"));
  document.querySelectorAll('[data-page="agenda-page"]')
    .forEach((b) => b.classList.add("active"));

  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  $("agenda-page").classList.add("active");
  $("page-title").textContent = "Agenda sacramental";

  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("reset-invite-template").addEventListener("click", () => {
  $("invite-template").value = DEFAULT_INVITE_TEMPLATE;
  showToast("Modelo padrão restaurado.");
});

$("reset-secretary-template").addEventListener("click", () => {
  $("secretary-template").value = DEFAULT_SECRETARY_TEMPLATE;
  showToast("Modelo padrão restaurado.");
});


$("reset-reminder-template").addEventListener("click", () => {
  $("reminder-template").value = DEFAULT_REMINDER_TEMPLATE;
  showToast("Modelo padrão de lembrete restaurado.");
});

/* -------------------------------
   DEFINIÇÃO DE DISCURSANTES
-------------------------------- */

window.openSpeakers = async function(meetingId) {
  const meeting = state.meetings.find((m) => m.id === meetingId);
  if (!meeting || meeting.tipo_reuniao !== "discursos") return;

  state.activeMeeting = meeting;
  $("speakers-dialog-title").textContent = fmtDate(meeting.data);
  $("speakers-dialog-subtitle").textContent = "Defina os oradores, temas, duração e acompanhe o status dos convites.";
  $("speakers-feedback").textContent = "Carregando...";

  try {
    await Promise.all([loadMembers(true), loadThemes(), loadSettings()]);
    await loadCurrentAssignments(meetingId);
    populateSpeakerForm();
    updateSecretaryButtonState();
    $("speakers-feedback").textContent = "";
    $("speakers-dialog").showModal();
  } catch (error) {
    console.error(error);
    alert(`Não foi possível carregar a programação: ${error.message}`);
  }
};

async function loadCurrentAssignments(meetingId) {
  const { data, error } = await client
    .from("discursos")
    .select("id,reuniao_id,membro_id,ordem,tema_id,duracao_minutos,status_convite,convite_enviado_em")
    .eq("reuniao_id", meetingId)
    .order("ordem");

  if (error) throw error;
  state.currentAssignments = data || [];
}

function populateSpeakerForm() {
  for (let order = 1; order <= 3; order++) {
    clearSpeakerSlot(order, false);

    const assignment = state.currentAssignments.find((a) => a.ordem === order);
    if (!assignment) continue;

    const member = state.members.find((m) => m.id === assignment.membro_id);
    const theme = state.themes.find((t) => t.id === assignment.tema_id);

    if (member) selectMember(order, member);
    if (theme) selectTheme(order, theme);

    $(`duration-${order}`).value = assignment.duracao_minutos || defaultDuration(order);
    $(`status-${order}`).value = assignment.status_convite || "nao_enviado";
  }
}

function defaultDuration(order) {
  return 10;
}

function clearSpeakerSlot(order, resetDuration = true) {
  $(`member-search-${order}`).value = "";
  $(`member-id-${order}`).value = "";
  $(`theme-selected-label-${order}`).textContent = "Selecionar tema...";
  $(`theme-id-${order}`).value = "";
  $(`status-${order}`).value = "nao_enviado";

  if (resetDuration) $(`duration-${order}`).value = defaultDuration(order);

  $(`member-history-${order}`).classList.remove("never");
  $(`member-history-${order}`).innerHTML =
    `<i class="fa-regular fa-clock"></i><span>Selecione um membro para consultar o histórico.</span>`;
  $(`theme-meta-${order}`).innerHTML = "";
  hideAutocomplete(order, "member");
  hideAutocomplete(order, "theme");
}

document.querySelectorAll(".clear-speaker-btn").forEach((button) => {
  button.addEventListener("click", () => clearSpeakerSlot(Number(button.dataset.clearOrder)));
});

document.querySelectorAll(".member-autocomplete").forEach((input) => {
  const order = Number(input.dataset.order);

  input.addEventListener("focus", () => renderMemberResults(order));
  input.addEventListener("input", () => {
    $(`member-id-${order}`).value = "";
    renderMemberResults(order);
  });
});

document.querySelectorAll(".theme-picker-trigger").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const order = Number(button.dataset.order);
    document.querySelectorAll(".theme-picker-panel").forEach((panel) => {
      if (panel.id !== `theme-results-${order}`) panel.classList.add("hidden");
    });
    renderThemeGroupedPicker(order);
    $(`theme-results-${order}`).classList.toggle("hidden");
  });
});

function renderMemberResults(order) {
  const input = $(`member-search-${order}`);
  const results = $(`member-results-${order}`);
  const q = normalizeSearch(input.value);

  const rows = state.members
    .filter((m) => !q || normalizeSearch(m.nome_completo).includes(q))
    .slice(0, 10);

  if (!rows.length) {
    results.innerHTML = `<div class="autocomplete-empty">Nenhum membro encontrado.</div>`;
  } else {
    results.innerHTML = rows.map((member) => {
      const history = state.memberHistory[String(member.id)];
      const historyLabel = history?.ultimo_discurso
        ? `Último discurso: ${fmtDate(history.ultimo_discurso)}`
        : "Nunca discursou";
      const phoneLabel = member.whatsapp ? " • WhatsApp cadastrado" : " • Sem WhatsApp";

      return `
        <button class="autocomplete-item" type="button" data-member-id="${member.id}" data-order="${order}">
          <span class="autocomplete-item-main">
            <span class="autocomplete-item-title">${escapeHtml(member.nome_completo)}</span>
            <span class="autocomplete-item-sub">${historyLabel}${phoneLabel}</span>
          </span>
          ${member.whatsapp ? `<i class="fa-brands fa-whatsapp" style="color:#1f9d62"></i>` : ""}
        </button>
      `;
    }).join("");

    results.querySelectorAll("[data-member-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const member = state.members.find((m) => m.id === Number(button.dataset.memberId));
        if (member) selectMember(order, member);
      });
    });
  }

  results.classList.remove("hidden");
}

function selectMember(order, member) {
  $(`member-search-${order}`).value = member.nome_completo;
  $(`member-id-${order}`).value = member.id;
  hideAutocomplete(order, "member");
  renderMemberHistory(order, member);
}

function renderMemberHistory(order, member) {
  const container = $(`member-history-${order}`);
  const history = state.memberHistory[String(member.id)];

  if (!history?.ultimo_discurso) {
    container.classList.add("never");
    container.innerHTML = `<i class="fa-solid fa-circle-check"></i><span>Nunca discursou.</span>`;
    return;
  }

  container.classList.remove("never");

  const total = Number(history.total_discursos || 0);
  container.innerHTML = `
    <i class="fa-regular fa-clock"></i>
    <span>Último discurso: <strong>${fmtDate(history.ultimo_discurso)}</strong>${total ? ` • ${total} no histórico` : ""}</span>
  `;
}

function themeGroupName(theme) {
  if (theme.categoria === "opcoes_especiais") return "Opções especiais";
  if (theme.categoria === "conferencia_geral") {
    return theme.edicao_origem || "Conferência Geral";
  }
  if (theme.categoria === "principios_evangelho") return "Princípios do Evangelho";
  if (theme.categoria === "topicos_evangelho") return "Tópicos do Evangelho";
  if (theme.categoria === "forca_dos_jovens") return "Força dos Jovens";
  if (theme.categoria === "personalizado") return "Meus temas";
  return themeCategoryLabel(theme.categoria);
}

function renderThemeGroupedPicker(order, query = "") {
  const results = $(`theme-results-${order}`);
  const q = normalizeSearch(query);

  const filtered = state.themes.filter((theme) => {
    const haystack = normalizeSearch(
      `${theme.titulo} ${theme.autor || ""} ${theme.edicao_origem || ""} ${themeGroupName(theme)}`
    );
    return !q || haystack.includes(q);
  });

  const grouped = {};
  filtered.forEach((theme) => {
    const group = themeGroupName(theme);
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(theme);
  });

  const preferredOrder = [
    "Opções especiais",
    "Conferência Geral de Abril de 2026",
    "Conferência Geral de Outubro de 2025",
    "Princípios do Evangelho",
    "Tópicos do Evangelho",
    "Força dos Jovens",
    "Meus temas"
  ];

  const groups = Object.entries(grouped).sort(([a], [b]) => {
    const ia = preferredOrder.indexOf(a);
    const ib = preferredOrder.indexOf(b);
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    }
    return a.localeCompare(b, "pt-BR");
  });

  results.innerHTML = `
    <div class="theme-picker-search">
      <div class="theme-picker-search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input id="theme-group-search-${order}" type="search" placeholder="Buscar em todos os temas..." value="${escapeAttr(query)}">
      </div>
    </div>
    ${groups.length ? groups.map(([group, themes], index) => `
      <div class="theme-group ${q ? "open" : ""}">
        <button class="theme-group-header" type="button">
          <span>${escapeHtml(group)}</span>
          <span class="count">${themes.length}</span>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="theme-group-items">
          ${themes.map((theme) => `
            <button class="theme-option" type="button" data-theme-id="${theme.id}">
              <span>
                <span class="theme-option-title">${escapeHtml(theme.titulo)}</span>
                <span class="theme-option-meta">${theme.autor ? escapeHtml(theme.autor) : themeCategoryLabel(theme.categoria)}</span>
              </span>
              ${theme.url ? `<i class="fa-solid fa-link" style="color:#98a2b3;margin-top:3px"></i>` : ""}
            </button>
          `).join("")}
        </div>
      </div>
    `).join("") : `<div class="autocomplete-empty">Nenhum tema encontrado.</div>`}
  `;

  const search = $(`theme-group-search-${order}`);

  search.addEventListener("input", () => {
    const value = search.value;
    renderThemeGroupedPicker(order, value);

    // O campo é recriado ao filtrar os resultados. Recupera o foco imediatamente
    // para permitir digitação contínua sem precisar clicar novamente.
    const refreshedSearch = $(`theme-group-search-${order}`);
    if (refreshedSearch) {
      refreshedSearch.focus();
      const caret = refreshedSearch.value.length;
      refreshedSearch.setSelectionRange(caret, caret);
    }
  });

  search.addEventListener("click", (e) => e.stopPropagation());
  search.addEventListener("keydown", (e) => e.stopPropagation());

  results.querySelectorAll(".theme-group-header").forEach((header) => {
    header.addEventListener("click", (e) => {
      e.stopPropagation();
      header.closest(".theme-group").classList.toggle("open");
    });
  });

  results.querySelectorAll("[data-theme-id]").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const theme = state.themes.find((t) => t.id === Number(button.dataset.themeId));
      if (theme) selectTheme(order, theme);
    });
  });
}

function selectTheme(order, theme) {
  $(`theme-selected-label-${order}`).textContent = theme.titulo;
  $(`theme-id-${order}`).value = theme.id;
  $(`theme-results-${order}`).classList.add("hidden");

  $(`theme-meta-${order}`).innerHTML = `
    <span>${themeGroupName(theme)}${theme.autor ? ` • ${escapeHtml(theme.autor)}` : ""}</span>
    ${theme.url ? `<a href="${escapeAttr(theme.url)}" target="_blank" rel="noopener">Abrir referência <i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ""}
  `;
}

function hideAutocomplete(order, type) {
  const el = $(`${type}-results-${order}`);
  if (el) el.classList.add("hidden");
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".autocomplete")) {
    document.querySelectorAll(".autocomplete-results").forEach((el) => el.classList.add("hidden"));
  }
  if (!event.target.closest(".theme-picker")) {
    document.querySelectorAll(".theme-picker-panel").forEach((el) => el.classList.add("hidden"));
  }
});

function collectAssignments() {
  const rows = [];

  for (let order = 1; order <= 3; order++) {
    const memberId = Number($(`member-id-${order}`).value || 0);
    if (!memberId) continue;

    const duration = Number($(`duration-${order}`).value);
    const themeId = Number($(`theme-id-${order}`).value || 0);

    if (!duration || duration < 1 || duration > 60) {
      throw new Error(`Informe uma duração válida para o ${order}º orador.`);
    }

    rows.push({
      reuniao_id: state.activeMeeting.id,
      membro_id: memberId,
      ordem: order,
      tema_id: themeId || null,
      duracao_minutos: duration,
      status_convite: $(`status-${order}`).value
    });
  }

  const memberIds = rows.map((r) => r.membro_id);
  if (new Set(memberIds).size !== memberIds.length) {
    throw new Error("O mesmo membro não pode ocupar duas posições na mesma reunião.");
  }

  return rows;
}

async function saveAssignments(showFeedback = true) {
  if (!state.activeMeeting) return [];

  const rows = collectAssignments();

  const { error: deleteError } = await client
    .from("discursos")
    .delete()
    .eq("reuniao_id", state.activeMeeting.id);

  if (deleteError) throw deleteError;

  if (rows.length) {
    const { error: insertError } = await client
      .from("discursos")
      .insert(rows);

    if (insertError) throw insertError;
  }

  await loadCurrentAssignments(state.activeMeeting.id);

  if (showFeedback) {
    $("speakers-feedback").textContent = "Programação salva.";
    setTimeout(() => {
      if ($("speakers-feedback").textContent === "Programação salva.") {
        $("speakers-feedback").textContent = "";
      }
    }, 2500);
  }

  await loadMonth();
  return rows;
}

$("save-speakers-btn").addEventListener("click", async () => {
  try {
    $("speakers-feedback").textContent = "Salvando...";
    await saveAssignments(false);

    // Depois de salvar, fecha a programação e retorna à agenda principal.
    $("speakers-dialog").close();
    document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));
    $("agenda-page").classList.add("active");
    document.querySelectorAll(".side-nav-item,.bottom-nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.page === "agenda-page");
    });
    $("page-title").textContent = "Agenda sacramental";
  } catch (error) {
    console.error(error);
    $("speakers-feedback").textContent = "";
    alert(error.message || "Não foi possível salvar a programação.");
  }
});

$("close-speakers-dialog").addEventListener("click", () => $("speakers-dialog").close());
$("cancel-speakers-btn").addEventListener("click", () => $("speakers-dialog").close());

document.querySelectorAll("[data-whatsapp-order]").forEach((button) => {
  button.addEventListener("click", async () => {
    const order = Number(button.dataset.whatsappOrder);
    await sendSpeakerWhatsapp(order);
  });
});

document.querySelectorAll("[data-copy-order]").forEach((button) => {
  button.addEventListener("click", async () => {
    const order = Number(button.dataset.copyOrder);

    try {
      const memberId = Number($(`member-id-${order}`).value || 0);
      if (!memberId) {
        throw new Error(`Selecione o ${order}º orador antes de copiar o convite.`);
      }

      const member = state.members.find((m) => m.id === memberId);
      const themeId = Number($(`theme-id-${order}`).value || 0);
      const theme = state.themes.find((t) => t.id === themeId);
      const duration = Number($(`duration-${order}`).value);

      const message = buildInviteMessage({ member, theme, duration, order });
      await copyToClipboard(message);

      // Feedback fica dentro do próprio botão, portanto permanece visível
      // mesmo enquanto o <dialog> está no top layer do navegador.
      const originalHtml = button.innerHTML;
      button.innerHTML = '<i class="fa-solid fa-check"></i><span>Copiado!</span>';
      button.classList.add("copy-success");
      button.disabled = true;

      setTimeout(() => {
        button.innerHTML = originalHtml;
        button.classList.remove("copy-success");
        button.disabled = false;
      }, 1600);
    } catch (error) {
      alert(error.message || "Não foi possível copiar o convite.");
    }
  });
});


function buildWhatsAppMessageUrl(phone, message) {
  // Usa o endpoint oficial de compartilhamento e URLSearchParams.
  // Não usamos encodeURIComponent manualmente porque o URLSearchParams
  // serializa a mensagem em UTF-8 corretamente, inclusive emojis.
  const url = new URL("https://api.whatsapp.com/send");
  url.searchParams.set("phone", digitsOnly(phone));
  url.searchParams.set("text", String(message || ""));
  return url.toString();
}


document.querySelectorAll("[data-reminder-order]").forEach((button) => {
  button.addEventListener("click", () => {
    const order = Number(button.dataset.reminderOrder);

    try {
      const memberId = Number($(`member-id-${order}`).value || 0);
      if (!memberId) {
        throw new Error(`Selecione o ${order}º orador antes de enviar o lembrete.`);
      }

      const member = state.members.find((m) => m.id === memberId);
      if (!member) throw new Error("Membro não encontrado.");
      if (!member.whatsapp) {
        throw new Error(`${member.nome_completo} não possui WhatsApp cadastrado.`);
      }

      const themeId = Number($(`theme-id-${order}`).value || 0);
      const theme = state.themes.find((t) => t.id === themeId);

      const message = buildReminderMessage({ member, theme, order });
      const url = buildWhatsAppMessageUrl(member.whatsapp, message);

      window.open(url, "_blank", "noopener");
    } catch (error) {
      alert(error.message || "Não foi possível abrir o lembrete no WhatsApp.");
    }
  });
});

async function sendSpeakerWhatsapp(order) {
  let popup = null;

  try {
    const memberId = Number($(`member-id-${order}`).value || 0);
    if (!memberId) throw new Error(`Selecione o ${order}º orador antes de enviar o convite.`);

    const member = state.members.find((m) => m.id === memberId);
    if (!member) throw new Error("Membro não encontrado.");
    if (!member.whatsapp) throw new Error(`${member.nome_completo} não possui WhatsApp cadastrado.`);

    const themeId = Number($(`theme-id-${order}`).value || 0);
    const theme = state.themes.find((t) => t.id === themeId);
    const duration = Number($(`duration-${order}`).value);

    popup = window.open("about:blank", "_blank");

    await saveAssignments(false);

    const message = buildInviteMessage({
      member,
      theme,
      duration,
      order
    });

    const now = new Date().toISOString();

    const { error } = await client
      .from("discursos")
      .update({
        status_convite: "aguardando_resposta",
        convite_enviado_em: now
      })
      .eq("reuniao_id", state.activeMeeting.id)
      .eq("ordem", order);

    if (error) throw error;

    $(`status-${order}`).value = "aguardando_resposta";

    const url = buildWhatsAppMessageUrl(member.whatsapp, message);

    if (popup) popup.location.replace(url);
    else window.location.href = url;

    await loadCurrentAssignments(state.activeMeeting.id);
    await loadMonth();
  } catch (error) {
    if (popup) popup.close();
    alert(error.message || "Não foi possível abrir o WhatsApp.");
  }
}

function buildInviteMessage({ member, theme, duration, order }) {
  const template = state.settings?.template_convite || DEFAULT_INVITE_TEMPLATE;

  return replaceTemplate(template, {
    primeiro_nome: getFirstName(member.nome_completo),
    data: fmtDate(state.activeMeeting.data),
    ordem: orderLabel(order),
    duracao: duration,
    tema: theme?.titulo || "A definir",
    link_tema: theme?.url || ""
  }).replace(/\n{3,}/g, "\n\n").trim();
}

function buildReminderMessage({ member, theme, order }) {
  const stored = normalizeStoredTemplate(state.settings?.template_lembrete || "");
  const template = (!stored || hasBrokenTemplateEncoding(stored))
    ? DEFAULT_REMINDER_TEMPLATE
    : stored;

  return replaceTemplate(template, {
    primeiro_nome: getFirstName(member.nome_completo),
    data: fmtDate(state.activeMeeting.data),
    ordem: orderLabel(order),
    tema: theme?.titulo || "A definir"
  }).replace(/\n{3,}/g, "\n\n").trim();
}

function buildSecretaryMessage() {
  const assignments = collectAssignments();
  const byOrder = Object.fromEntries(assignments.map((row) => [row.ordem, row]));

  const storedTemplate = normalizeStoredTemplate(state.settings?.template_secretario || "");
  const template = (
    !storedTemplate ||
    hasBrokenTemplateEncoding(storedTemplate) ||
    isLegacySecretaryTemplate(storedTemplate)
  ) ? DEFAULT_SECRETARY_TEMPLATE : storedTemplate;

  const getMemberName = (order) => {
    const row = byOrder[order];
    if (!row) return "A definir";
    return state.members.find((m) => m.id === row.membro_id)?.nome_completo || "A definir";
  };

  const getTime = (order) => byOrder[order]?.duracao_minutos || "—";

  return replaceTemplate(template, {
    data: fmtDate(state.activeMeeting.data),
    orador_1: getMemberName(1),
    orador_2: getMemberName(2),
    orador_3: getMemberName(3),
    tempo_1: getTime(1),
    tempo_2: getTime(2),
    tempo_3: getTime(3)
  });
}

$("copy-secretary-btn").addEventListener("click", async () => {
  try {
    const message = buildSecretaryMessage();
    await copyToClipboard(message);
    showToast("Mensagem copiada para a área de transferência.");
  } catch (error) {
    alert("Não foi possível copiar a mensagem.");
  }
});

$("whatsapp-secretary-btn").addEventListener("click", () => {
  try {
    const phone = state.settings?.secretario_whatsapp;
    if (!phone) throw new Error("Cadastre o WhatsApp do secretário em Configurações.");

    const message = buildSecretaryMessage();
    const url = buildWhatsAppMessageUrl(phone, message);
    window.open(url, "_blank", "noopener");
  } catch (error) {
    alert(error.message);
  }
});

function updateSecretaryButtonState() {
  const hasPhone = Boolean(state.settings?.secretario_whatsapp);
  $("whatsapp-secretary-btn").title = hasPhone
    ? "Abrir conversa com o secretário"
    : "Cadastre o WhatsApp do secretário em Configurações";
}

function replaceTemplate(template, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value ?? "")),
    template
  );
}

function getFirstName(fullName) {
  return String(fullName || "").trim().split(/\s+/)[0] || "";
}

function orderLabel(order) {
  return ({
    1: "Primeiro orador",
    2: "Segundo orador",
    3: "Terceiro orador"
  })[order] || `${order}º orador`;
}

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!ok) throw new Error("Falha ao copiar.");
}

let toastTimer;
function showToast(message, type = "success") {
  const toast = $("app-toast");
  const icon = $("app-toast-icon");
  const text = $("app-toast-text");

  if (!toast || !text || !icon) return;

  text.textContent = message;
  icon.className = type === "info"
    ? "fa-solid fa-circle-info"
    : "fa-solid fa-check";

  toast.style.display = "flex";
  requestAnimationFrame(() => toast.classList.add("show"));

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.style.display = "";
    }, 220);
  }, 2400);
}

function normalizeWhatsapp(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) return null;
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;

  return String(value).trim() || null;
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function themeCategoryLabel(value) {
  return ({
    conferencia_geral: "Conferência Geral",
    topicos_evangelho: "Tópicos do Evangelho",
    principios_evangelho: "Princípios do Evangelho",
    forca_dos_jovens: "Força dos Jovens",
    opcoes_especiais: "Opções especiais",
    personalizado: "Personalizado"
  })[value] || value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

/* Corrige navegação para carregar páginas sob demanda */
document.querySelectorAll(".side-nav-item,.bottom-nav-item").forEach((btn) => {
  btn.addEventListener("click", async () => {
    if (btn.dataset.page === "members-page") await ensureMembersPage();
    if (btn.dataset.page === "themes-page") await ensureThemesPage();
  });
});

bootstrap();


document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && $("theme-dialog")?.open) {
    $("theme-dialog").close();
  }
});
