/* Planner-first wedding app. Local-first: everything in localStorage, no account.
   Partner sync and a real LLM behind Ask both need a backend — the UI says so
   rather than faking either. */

(function () {
  const META = window.WD_META;
  const VENUES = window.WD_VENUES;

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const screens = { gate: $('gate'), names: $('ask-names'), date: $('ask-date'), home: $('home') };

  const store = {
    get(k, fb) { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
  };

  let profile = store.get('wd-profile', null);
  let plan = store.get('wd-plan', null);

  const ESSENTIAL_CATS = [
    'Venue', 'Catering', 'Photo & Video', 'Hair & Makeup', 'Attire', 'Rings',
    'Ceremony & Fees', 'Paperwork',
  ];
  const OPTIONAL_CATS = [
    'Coordinator', 'Invitations', 'Host & Music', 'Lights & Sounds', 'Bridal Car',
    'Cake & Desserts', 'Coffee Cart', 'Souvenirs', 'Prenup Shoot', 'Photobooth',
    'Mobile Bar', 'Honeymoon',
  ];
  // per-head categories: the guest count drives their estimate
  const PER_HEAD = { Catering: 1200, Souvenirs: 120, 'Cake & Desserts': 150, 'Mobile Bar': 250 };

  function ensurePlan() {
    if (!plan) plan = { v: 3, cats: [...ESSENTIAL_CATS], items: [] };
    if (plan.v !== 3) {
      const rename = (c) => (c === 'Church & Fees' ? 'Ceremony & Fees' : c);
      plan.items.forEach((i) => {
        i.cat = rename(i.cat);
        i.payments = i.payments || [];
        i.thread = i.thread || [];
      });
      const inUse = [...new Set(plan.items.map((i) => i.cat))];
      plan.cats = [...ESSENTIAL_CATS];
      for (const c of inUse) if (!plan.cats.includes(c)) plan.cats.push(c);
      plan.v = 3;
    }
    store.set('wd-plan', plan);
  }

  const savePlan = () => store.set('wd-plan', plan);
  const saveProfile = () => store.set('wd-profile', profile);

  const uid = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const peso = (n) => '₱' + Math.round(n).toLocaleString('en-PH');
  const isCouple = () => profile?.mode === 'couple';

  function pesoNode(n, cls) {
    const w = el('span', cls);
    w.append(el('span', 'peso', '₱'), Math.round(n).toLocaleString('en-PH'));
    return w;
  }

  function show(name) {
    Object.values(screens).forEach((s) => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
  }

  const todayISO = () => new Date().toISOString().slice(0, 10);

  function daysBetween(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const t = new Date(y, m - 1, d);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((t - now) / 86400000);
  }

  const fmtDate = (iso) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const fmtShort = (iso) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });

  /* ---------- small dialogs ---------- */

  let pendingRemove = null;

  function confirmRemove(item, onCancel) {
    pendingRemove = { item, onCancel };
    $('confirm-text').textContent = `Alisin ang “${item.name || 'item na ito'}”?`;
    $('confirm-sub').textContent = item.thread?.length
      ? 'Mawawala rin ang usapan dito.' : 'Pwede itong ibalik anumang oras gamit ang “+ add”.';
    $('confirm-dialog').showModal();
  }

  $('confirm-yes').addEventListener('click', () => {
    if (pendingRemove) {
      plan.items = plan.items.filter((i) => i.id !== pendingRemove.item.id);
      savePlan();
      if (panelState.kind === 'item' && panelState.id === pendingRemove.item.id) closePanel();
    }
    pendingRemove = null;
    $('confirm-dialog').close();
    renderPlan();
  });
  $('confirm-no').addEventListener('click', () => $('confirm-dialog').close());
  $('confirm-dialog').addEventListener('close', () => {
    if (pendingRemove) { pendingRemove.onCancel?.(); pendingRemove = null; }
  });

  // promptFor: a styled replacement for window.prompt
  function promptFor({ title, sub, value = '', type = 'text', placeholder = '' }) {
    return new Promise((resolve) => {
      const dlg = $('prompt-dialog');
      $('prompt-text').textContent = title;
      $('prompt-sub').textContent = sub ?? '';
      const input = $('prompt-input');
      input.type = type === 'number' ? 'text' : type;
      if (type === 'number') input.inputMode = 'numeric';
      input.value = value;
      input.placeholder = placeholder;
      const onClose = () => {
        dlg.removeEventListener('close', onClose);
        if (dlg.returnValue !== 'ok') return resolve(null);
        const v = input.value.trim();
        if (type === 'number') {
          const n = Number(v.replace(/[₱,\s]/g, ''));
          return resolve(v === '' || Number.isNaN(n) ? null : n);
        }
        resolve(v === '' ? null : v);
      };
      dlg.addEventListener('close', onClose);
      dlg.showModal();
      input.focus();
      input.select();
    });
  }

  /* ================= gate + onboarding ================= */

  $('gate-foot').textContent =
    `${META.swept.toLocaleString()} venues natukoy sa buong Pilipinas · ` +
    `${META.researched} na-research · ${META.priced} may presyong nakikita`;

  for (const v of VENUES.filter((x) => x.photo && x.rate != null).slice(0, 3)) {
    const img = el('img');
    img.src = 'photos/' + v.photo;
    img.alt = v.name;
    img.loading = 'lazy';
    $('gate-shots').appendChild(img);
  }

  $('btn-couple').addEventListener('click', () => {
    profile = { mode: 'couple', names: null, date: null, guests: null, target: null };
    show('names');
    $('names-input').focus();
  });

  $('btn-looking').addEventListener('click', () => {
    profile = { mode: 'looking' };
    saveProfile();
    boot('venues');
  });

  $('names-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('names-input').value.trim();
    if (v) profile.names = v;
    show('date');
    $('date-input').focus();
  });
  $('skip-names').addEventListener('click', () => show('date'));

  $('date-form').addEventListener('submit', (e) => {
    e.preventDefault();
    profile.date = $('date-input').value || null;
    saveProfile();
    boot('plan');
  });
  $('skip-date').addEventListener('click', () => {
    profile.date = null;
    saveProfile();
    boot('plan');
  });

  /* ================= views ================= */

  let view = 'plan';

  function setView(name) {
    view = name;
    screens.home.dataset.view = name;
    for (const v of ['plan', 'venues', 'ask']) $('view-' + v).classList.toggle('hidden', v !== name);
    document.querySelectorAll('.tab').forEach((t) =>
      t.setAttribute('aria-current', String(t.dataset.view === name)));
    renderRail();
    if (name === 'plan') renderPlan();
    if (name === 'venues') renderVenues();
    if (name === 'ask') renderAsk();
  }

  document.querySelectorAll('.tab').forEach((t) =>
    t.addEventListener('click', () => setView(t.dataset.view)));

  /* ================= money math ================= */

  function guestEstimate(cat) {
    const g = profile?.guests;
    if (!g || !PER_HEAD[cat]) return null;
    return g * PER_HEAD[cat];
  }

  function totals() {
    ensurePlan();
    const items = plan.items;
    const estimated = items.reduce((s, i) => s + (i.price ?? 0), 0);
    const committed = items.filter((i) => i.status === 'booked' || i.status === 'paid');
    const booked = committed.reduce((s, i) => s + (i.price ?? 0), 0);
    const payments = items.flatMap((i) => (i.payments || []).map((p) => ({ ...p, item: i })));
    const paid = payments.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0);
    const scheduled = payments.reduce((s, p) => s + p.amount, 0);
    const unpaid = payments.filter((p) => !p.paid);
    const soon = unpaid.filter((p) => p.due && daysBetween(p.due) <= 30);
    return {
      estimated, booked, paid, scheduled,
      unpaidTotal: unpaid.reduce((s, p) => s + p.amount, 0),
      dueSoon: soon.reduce((s, p) => s + p.amount, 0),
      payments, unpaid,
    };
  }

  /* ================= rail (identity + money) ================= */

  let countedOnce = false;

  function countUp(node, target) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || target <= 1 || countedOnce) {
      node.textContent = String(target);
      countedOnce = true;
      return;
    }
    countedOnce = true;
    const t0 = performance.now(), dur = 700;
    (function tick(t) {
      const p = Math.min((t - t0) / dur, 1);
      node.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  function renderRail() {
    const box = $('rail-identity');
    box.innerHTML = '';
    if (!isCouple()) return;

    const invite = el('div', 'invite');
    if (profile.names) invite.appendChild(el('p', 'invite-names', profile.names));

    if (profile.date) {
      invite.appendChild(el('p', 'invite-date', fmtDate(profile.date)));
      const days = daysBetween(profile.date);
      if (days > 0) {
        const row = el('div', 'invite-count');
        const num = el('span', 'invite-days');
        row.append(num, el('span', 'invite-label', 'days to go'));
        invite.appendChild(row);
        countUp(num, days);
      } else {
        invite.appendChild(el('p', 'invite-note',
          days === 0 ? 'Ngayon na! Best day ever.' : 'Congratulations — kasal na kayo!'));
      }
    } else {
      const note = el('p', 'invite-note');
      note.append('Venue muna, date later — okay ’yan. ');
      const a = el('a', null, 'May date na kami →');
      a.href = '#';
      a.addEventListener('click', (e) => { e.preventDefault(); show('date'); $('date-input').focus(); });
      note.appendChild(a);
      invite.appendChild(note);
    }
    box.appendChild(invite);

    const t = totals();
    const money = el('div', 'money');

    const top = el('div', 'money-top');
    top.appendChild(pesoNode(t.estimated, 'money-big'));
    const targetBtn = el('button', 'money-target',
      profile.target ? `of ${peso(profile.target)} budget` : '+ set a budget');
    targetBtn.addEventListener('click', async () => {
      const v = await promptFor({
        title: 'Magkano ang budget ninyo?',
        sub: 'Para may masusukatan — pwedeng baguhin anumang oras.',
        type: 'number',
        value: profile.target ? String(profile.target) : '',
        placeholder: '600000',
      });
      profile.target = v;
      saveProfile();
      renderRail();
    });
    top.appendChild(targetBtn);
    money.appendChild(top);

    if (profile.target) {
      const meter = el('div', 'meter');
      const fill = el('div', 'meter-fill' + (t.estimated > profile.target ? ' over' : ''));
      fill.style.width = Math.min(100, (t.estimated / profile.target) * 100) + '%';
      meter.appendChild(fill);
      money.appendChild(meter);
    }

    const rows = el('div', 'money-rows');
    const cells = [
      ['Booked', t.booked, ''],
      ['Paid', t.paid, 'paid'],
      ...(t.dueSoon ? [['Due ≤30d', t.dueSoon, 'due']] : []),
    ];
    for (const [label, val, cls] of cells) {
      const c = el('div', 'money-cell');
      c.append(el('span', 'money-label', label), pesoNode(val, 'money-num ' + cls));
      rows.appendChild(c);
    }
    money.appendChild(rows);

    const meta = el('div', 'money-meta');
    const guestBtn = el('button', null, profile.guests ? `${profile.guests} guests` : '+ guest count');
    guestBtn.addEventListener('click', async () => {
      const v = await promptFor({
        title: 'Ilan ang bisita?',
        sub: 'Ginagamit ito sa per-head na estimates (catering, souvenirs) at sa capacity ng venue.',
        type: 'number',
        value: profile.guests ? String(profile.guests) : '',
        placeholder: '120',
      });
      profile.guests = v;
      saveProfile();
      renderRail();
      renderPlan();
      if (view === 'venues') renderVenues();
    });
    meta.appendChild(guestBtn);
    money.appendChild(meta);

    box.appendChild(money);
  }

  /* ================= plan ================= */

  function nextUp() {
    const t = totals();
    const out = [];

    for (const p of t.unpaid.filter((x) => x.due).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 3)) {
      const d = daysBetween(p.due);
      out.push({
        when: d < 0 ? 'overdue' : d === 0 ? 'today' : `in ${d}d`,
        urgent: d <= 14,
        what: `${p.label} — ${p.item.name || p.item.cat}`,
        amount: p.amount,
        go: () => openItem(p.item.id),
      });
    }

    const missing = ESSENTIAL_CATS.filter((c) =>
      !plan.items.some((i) => i.cat === c && (i.status === 'booked' || i.status === 'paid')));
    if (missing.length) {
      const days = profile?.date ? daysBetween(profile.date) : null;
      out.push({
        when: days != null && days < 120 ? 'soon' : 'to do',
        urgent: days != null && days < 120,
        what: `${missing.length} essentials hindi pa booked: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`,
        go: () => { setView('plan'); },
      });
    }

    if (!profile?.guests) {
      out.push({ when: 'setup', urgent: false, what: 'Ilagay ang guest count — para tumpak ang catering estimate', go: null });
    }
    return out;
  }

  function renderPlanHead() {
    const head = $('plan-head');
    head.innerHTML = '';
    if (!isCouple()) return;

    const box = el('section', 'nextup');
    box.appendChild(el('p', 'section-title', 'Next up'));
    const list = el('div', 'nextup-list');
    const rows = nextUp();

    if (!rows.length) {
      box.appendChild(el('p', 'nextup-empty', 'Walang nakabinbin. Ang sarap ng pakiramdam, ’di ba?'));
    } else {
      for (const r of rows) {
        const b = el('button', 'nextup-item');
        b.append(
          el('span', 'nextup-when' + (r.urgent ? '' : ' calm'), r.when),
          el('span', 'nextup-what', r.what),
        );
        if (r.amount) b.appendChild(el('span', 'nextup-amt', peso(r.amount)));
        if (r.go) b.addEventListener('click', r.go);
        else b.disabled = true;
        list.appendChild(b);
      }
      box.appendChild(list);
    }
    head.appendChild(box);
  }

  /* swipe-left to remove */
  function attachSwipe(slide, item) {
    let startX = 0, startY = 0, dx = 0, dragging = false, active = false;

    slide.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      startX = e.clientX; startY = e.clientY; dx = 0; dragging = false; active = true;
      slide.style.transition = 'none';
    });

    slide.addEventListener('pointermove', (e) => {
      if (!active) return;
      const mx = e.clientX - startX, my = e.clientY - startY;
      if (!dragging) {
        if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) && mx < 0) {
          dragging = true;
          try { slide.setPointerCapture(e.pointerId); } catch { /* ok */ }
        } else if (Math.abs(my) > 10) { active = false; return; }
      }
      if (dragging) {
        dx = Math.max(Math.min(mx, 0), -128);
        slide.style.transform = `translateX(${dx}px)`;
      }
    });

    const end = () => {
      if (!active) return;
      active = false;
      if (!dragging) return;
      slide.style.transition = 'transform 0.18s ease';
      if (dx < -72) {
        slide.style.transform = 'translateX(-96px)';
        confirmRemove(item, () => { slide.style.transform = 'translateX(0)'; });
      } else slide.style.transform = 'translateX(0)';
      slide.dataset.dragged = '1';
      setTimeout(() => { delete slide.dataset.dragged; }, 80);
      dragging = false; dx = 0;
    };
    slide.addEventListener('pointerup', end);
    slide.addEventListener('pointercancel', end);
    slide.addEventListener('click', (e) => {
      if (slide.dataset.dragged) { e.stopPropagation(); e.preventDefault(); }
    }, true);
  }

  const STATUS = ['idea', 'canvassing', 'booked', 'paid'];

  function itemNode(item) {
    const wrap = el('div', 'plan-item');
    wrap.appendChild(el('div', 'plan-item-under', 'Alisin'));

    const slide = el('div', 'plan-item-slide');
    slide.setAttribute('role', 'button');
    slide.tabIndex = 0;
    attachSwipe(slide, item);
    slide.addEventListener('click', () => openItem(item.id));
    slide.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openItem(item.id); }
    });

    slide.appendChild(el('p', 'plan-item-name' + (item.name ? '' : ' empty'),
      item.name || 'Pangalanan ito'));
    slide.appendChild(el('p', 'plan-item-price' + (item.price != null ? '' : ' empty'),
      item.price != null ? peso(item.price) : '₱ —'));

    const sub = el('div', 'plan-item-sub');
    sub.appendChild(el('span', 'status status-' + item.status, item.status));
    if (item.thread?.length) sub.appendChild(el('span', 'thread-count', `usapan (${item.thread.length})`));
    const unpaid = (item.payments || []).filter((p) => !p.paid);
    if (unpaid.length) {
      const next = unpaid.filter((p) => p.due).sort((a, b) => a.due.localeCompare(b.due))[0];
      sub.appendChild(el('span', 'thread-count',
        next ? `${peso(next.amount)} due ${fmtShort(next.due)}` : `${unpaid.length} payment${unpaid.length > 1 ? 's' : ''} pending`));
    }
    slide.appendChild(sub);

    wrap.appendChild(slide);
    return wrap;
  }

  function renderPlan() {
    ensurePlan();
    renderPlanHead();
    const box = $('plan-list');
    box.innerHTML = '';

    if (!isCouple()) {
      const p = el('p', 'nextup-empty');
      p.append('Ang planner ay para sa mga nagpaplano na. ');
      const a = el('a', null, 'Start your plan →');
      a.href = '#';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        profile = { mode: 'couple', names: null, date: null, guests: null, target: null };
        show('names'); $('names-input').focus();
      });
      p.appendChild(a);
      box.appendChild(p);
      return;
    }

    for (const cat of plan.cats) {
      const items = plan.items.filter((i) => i.cat === cat);
      const sec = el('section', 'plan-cat');

      const head = el('div', 'plan-cat-head');
      const name = el('p', 'plan-cat-name');
      name.append(cat);
      if (!items.length) {
        const est = guestEstimate(cat);
        if (est) name.appendChild(el('span', 'req', `  ~${peso(est)} for ${profile.guests}`));
      }
      head.appendChild(name);

      const sum = items.reduce((s, i) => s + (i.price ?? 0), 0);
      if (sum) head.appendChild(el('p', 'plan-cat-sum', peso(sum)));
      else if (!ESSENTIAL_CATS.includes(cat) && !items.length) {
        const rm = el('button', 'cat-remove', 'alisin');
        rm.addEventListener('click', () => {
          plan.cats = plan.cats.filter((c) => c !== cat);
          savePlan(); renderPlan();
        });
        head.appendChild(rm);
      }
      sec.appendChild(head);

      for (const item of items) sec.appendChild(itemNode(item));

      const add = el('button', 'add-item', items.length ? '+ add another' : '+ add');
      add.addEventListener('click', () => {
        const item = {
          id: uid(), cat, name: null,
          price: guestEstimate(cat), status: 'idea', thread: [], payments: [],
        };
        plan.items.push(item);
        savePlan();
        renderPlan();
        openItem(item.id);
      });
      sec.appendChild(add);
      box.appendChild(sec);
    }

    const opt = el('div', 'optionals');
    opt.appendChild(el('p', 'optionals-label', 'Optional — idagdag kung kailangan ninyo'));
    const chips = el('div', 'opt-chips');
    for (const cat of OPTIONAL_CATS.filter((c) => !plan.cats.includes(c))) {
      const b = el('button', 'opt-chip', '+ ' + cat);
      b.addEventListener('click', () => { plan.cats.push(cat); savePlan(); renderPlan(); });
      chips.appendChild(b);
    }
    const custom = el('button', 'opt-chip', '+ iba pa…');
    custom.addEventListener('click', async () => {
      const name = await promptFor({
        title: 'Anong idadagdag?',
        sub: 'Kahit ano — food truck, drone, fireworks.',
        placeholder: 'Food truck',
      });
      if (name && !plan.cats.includes(name.slice(0, 40))) {
        plan.cats.push(name.slice(0, 40));
        savePlan(); renderPlan();
      }
    });
    chips.appendChild(custom);
    opt.appendChild(chips);
    box.appendChild(opt);
  }

  /* ================= detail panel ================= */

  let panelState = { kind: null, id: null };

  function openPanel() {
    $('panel').classList.remove('hidden');
    screens.home.classList.add('panel-open');
    const p = $('panel');
    p.scrollTop = 0;
    p.focus({ preventScroll: true }); // move focus into the region without a ring on the button
  }

  function closePanel() {
    panelState = { kind: null, id: null };
    $('panel').classList.add('hidden');
    screens.home.classList.remove('panel-open');
  }

  $('panel-close').addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelState.kind && !document.querySelector('dialog[open]')) closePanel();
  });

  function openVenue(name) {
    panelState = { kind: 'venue', id: name };
    renderPanel();
    openPanel();
  }

  function openItem(id) {
    panelState = { kind: 'item', id };
    renderPanel();
    openPanel();
  }

  function renderPanel() {
    const body = $('panel-body');
    body.innerHTML = '';
    if (panelState.kind === 'venue') renderVenuePanel(body, VENUES.find((v) => v.name === panelState.id));
    else if (panelState.kind === 'item') renderItemPanel(body, plan.items.find((i) => i.id === panelState.id));
  }

  function renderVenuePanel(body, v) {
    if (!v) return closePanel();

    if (v.photo) {
      const fig = el('figure', 'panel-hero');
      const img = el('img');
      img.src = 'photos/' + v.photo;
      img.alt = v.name;
      fig.appendChild(img);
      if (v.credit) fig.appendChild(el('figcaption', 'venue-credit', `Photo: ${v.credit} · Google`));
      body.appendChild(fig);
    }

    body.appendChild(el('p', 'panel-eyebrow',
      [v.region, v.type, v.capacity ? `up to ${v.capacity} pax` : null].filter(Boolean).join(' · ')));
    body.appendChild(el('h2', 'panel-title', v.name));
    body.appendChild(el('p', 'panel-sub',
      [v.area, v.rating ? `${v.rating}★ ${v.reviews.toLocaleString()} reviews` : null].filter(Boolean).join(' · ')));

    const price = el('section', 'price-block');
    if (v.rate != null) {
      price.appendChild(el('p', 'price-block-label', 'Starting rate'));
      price.appendChild(pesoNode(v.rate, 'price-hero'));
      const stamp = el('p', 'stamp ' + (v.fresh ? 'stamp-fresh' : 'stamp-aged'));
      stamp.textContent = v.fresh ? `✓ verified ${v.rateYear}` : (v.rateYear ? `from ${v.rateYear} · baka iba na` : 'year unknown');
      stamp.style.paddingTop = '0.5rem';
      price.appendChild(stamp);
      if (v.notes) price.appendChild(el('p', 'price-source', v.notes));
    } else {
      price.appendChild(el('p', 'price-block-label', 'Presyo'));
      const red = el('div');
      red.style.padding = '0.5rem 0';
      red.appendChild(el('span', 'redacted'));
      price.appendChild(red);
      price.appendChild(el('p', 'price-source',
        'Hindi pa nila inilalabas ang presyo. Kung nakakuha kayo ng quote, i-share ninyo — makakatulong sa susunod na couple.'));
    }
    body.appendChild(price);

    if (profile?.guests && v.capacity) {
      const fits = v.capacity >= profile.guests;
      const fit = el('p', 'venue-fit' + (fits ? '' : ' no'));
      fit.textContent = fits
        ? `✓ Kasya ang ${profile.guests} guests ninyo`
        : `Kulang para sa ${profile.guests} guests (max ${v.capacity})`;
      fit.style.paddingTop = '0.75rem';
      body.appendChild(fit);
    }

    const verify = el('section', 'panel-section');
    verify.appendChild(el('p', 'section-title', 'Tama pa ba ang presyo?'));
    const acts = el('div', 'verify-actions');
    const yes = el('button', 'btn btn-ghost btn-sm', 'Oo, tama pa');
    const no = el('button', 'btn btn-ghost btn-sm', 'Nagbago na');
    const thanks = () => {
      acts.replaceChildren(el('p', 'price-source', 'Salamat — naitala namin. (Sa ngayon, dito lang sa device na ito.)'));
    };
    yes.addEventListener('click', thanks);
    no.addEventListener('click', thanks);
    acts.append(yes, no);
    verify.appendChild(acts);
    body.appendChild(verify);

    const links = el('section', 'panel-section');
    const row = el('p', 'panel-links');
    if (v.maps) {
      const a = el('a', null, 'Maps ↗');
      a.href = v.maps; a.target = '_blank'; a.rel = 'noopener';
      row.appendChild(a);
    }
    if (v.website) {
      const a = el('a', null, 'Website ↗');
      a.href = v.website; a.target = '_blank'; a.rel = 'noopener';
      row.appendChild(a);
    }
    if (row.children.length) links.appendChild(row);
    links.appendChild(el('p', 'claim-line', 'Hindi pa na-claim ng may-ari ang listing na ito.'));
    body.appendChild(links);

    const similar = VENUES.filter((x) =>
      x.name !== v.name && x.region === v.region && x.rate != null).slice(0, 3);
    if (similar.length) {
      const sec = el('section', 'panel-section');
      sec.appendChild(el('p', 'section-title', `Iba pa sa ${v.region}`));
      const hits = el('div', 'ask-hits');
      for (const s of similar) hits.appendChild(hitRow(s));
      sec.appendChild(hits);
      body.appendChild(sec);
    }

    if (isCouple()) {
      const actions = el('div', 'panel-actions');
      const left = el('div', 'panel-actions-price');
      if (v.rate != null) {
        left.appendChild(el('span', 'price-from', 'from'));
        left.appendChild(pesoNode(v.rate, 'money-num'));
      }
      const already = plan?.items.some((i) => i.name === v.name);
      const add = el('button', 'btn btn-primary btn-sm', already ? 'Nasa plan na ✓' : 'Add to plan');
      add.disabled = already;
      add.addEventListener('click', () => {
        ensurePlan();
        plan.items.push({
          id: uid(), cat: 'Venue', name: v.name, price: v.rate ?? null,
          status: 'canvassing', thread: [], payments: [],
        });
        savePlan();
        add.textContent = 'Nasa plan na ✓';
        add.disabled = true;
        renderPlan();
        renderRail();
      });
      actions.append(left, add);
      body.appendChild(actions);
    }
  }

  function renderItemPanel(body, item) {
    if (!item) return closePanel();

    body.appendChild(el('p', 'panel-eyebrow', item.cat));
    body.appendChild(el('h2', 'panel-title', item.name || 'Walang pangalan pa'));

    const fields = el('section', 'panel-section');

    const nameRow = el('div', 'editor-row');
    nameRow.appendChild(el('span', 'editor-label', 'Pangalan'));
    const nameBtn = el('button', 'editor-value', item.name || 'idagdag');
    nameBtn.addEventListener('click', async () => {
      const v = await promptFor({
        title: 'Anong tawag dito?', sub: 'Pangalan ng supplier o venue.',
        value: item.name ?? '', placeholder: 'Hillcreek Gardens',
      });
      if (v !== null) { item.name = v; savePlan(); renderPanel(); renderPlan(); }
    });
    nameRow.appendChild(nameBtn);
    fields.appendChild(nameRow);

    const priceRow = el('div', 'editor-row');
    priceRow.appendChild(el('span', 'editor-label', 'Presyo'));
    const priceBtn = el('button', 'editor-value num', item.price != null ? peso(item.price) : 'idagdag');
    priceBtn.addEventListener('click', async () => {
      const v = await promptFor({
        title: 'Magkano?', sub: 'Buong halaga — hahatiin natin sa payments mamaya.',
        type: 'number', value: item.price != null ? String(item.price) : '', placeholder: '150000',
      });
      item.price = v; savePlan(); renderPanel(); renderPlan(); renderRail();
    });
    priceRow.appendChild(priceBtn);
    fields.appendChild(priceRow);
    body.appendChild(fields);

    const statusSec = el('section', 'panel-section');
    statusSec.appendChild(el('p', 'section-title', 'Status'));
    const row = el('div', 'status-row');
    for (const s of STATUS) {
      const b = el('button', 'status-opt', s);
      b.setAttribute('aria-pressed', String(item.status === s));
      b.addEventListener('click', () => {
        item.status = s;
        // booking usually means a deposit — offer the standard PH split once
        if ((s === 'booked' || s === 'paid') && item.price && !(item.payments || []).length) {
          const down = Math.round(item.price * 0.2);
          item.payments = [
            { id: uid(), label: 'Down payment', amount: down, due: todayISO(), paid: s === 'paid' },
            { id: uid(), label: 'Balance', amount: item.price - down, due: profile?.date ?? null, paid: s === 'paid' },
          ];
        }
        savePlan(); renderPanel(); renderPlan(); renderRail();
      });
      row.appendChild(b);
    }
    statusSec.appendChild(row);
    body.appendChild(statusSec);

    const paySec = el('section', 'panel-section');
    paySec.appendChild(el('p', 'section-title', 'Bayad'));
    item.payments = item.payments || [];

    if (!item.payments.length) {
      paySec.appendChild(el('p', 'price-source', 'Wala pang nakatakdang bayad.'));
    }

    for (const p of item.payments) {
      const r = el('div', 'pay-row');
      const check = el('button', 'pay-check', p.paid ? '✓' : '');
      check.setAttribute('aria-pressed', String(!!p.paid));
      check.setAttribute('aria-label', p.paid ? 'Bayad na' : 'Hindi pa bayad');
      check.addEventListener('click', () => {
        p.paid = !p.paid;
        if (item.payments.every((x) => x.paid)) item.status = 'paid';
        savePlan(); renderPanel(); renderPlan(); renderRail();
      });
      const label = el('span', 'pay-label' + (p.paid ? ' done' : ''), p.label);
      const amt = el('span', 'pay-amt', peso(p.amount));
      r.append(check, label, amt);
      if (p.due) {
        const d = daysBetween(p.due);
        const due = el('span', 'pay-due' + (!p.paid && d <= 14 ? ' late' : ''),
          p.paid ? `bayad · ${fmtShort(p.due)}` : d < 0 ? `overdue · ${fmtShort(p.due)}` : `due ${fmtShort(p.due)} · in ${d}d`);
        r.appendChild(due);
      }
      paySec.appendChild(r);
    }

    const addPay = el('button', 'add-item', '+ add a payment');
    addPay.addEventListener('click', async () => {
      const amount = await promptFor({
        title: 'Magkano ang bayad?', sub: 'Halimbawa: down payment, second installment, balance.',
        type: 'number', placeholder: '30000',
      });
      if (amount == null) return;
      const label = await promptFor({ title: 'Anong tawag dito?', value: 'Payment', placeholder: 'Down payment' });
      const due = await promptFor({ title: 'Kailan ang due?', sub: 'YYYY-MM-DD — pwedeng laktawan.', type: 'date' });
      item.payments.push({ id: uid(), label: label || 'Payment', amount, due: due || null, paid: false });
      savePlan(); renderPanel(); renderPlan(); renderRail();
    });
    paySec.appendChild(addPay);

    if (item.price != null && item.payments.length) {
      const sched = item.payments.reduce((s, p) => s + p.amount, 0);
      if (sched !== item.price) {
        paySec.appendChild(el('p', 'price-source',
          sched < item.price
            ? `${peso(item.price - sched)} pa ang hindi naka-schedule.`
            : `${peso(sched - item.price)} ang sobra sa presyo.`));
      }
    }
    body.appendChild(paySec);

    const talk = el('section', 'panel-section');
    talk.appendChild(el('p', 'section-title', 'Usapan'));
    const thread = el('div', 'thread');
    item.thread = item.thread || [];
    for (const m of item.thread) {
      const msg = el('p', 'thread-msg');
      msg.appendChild(el('span', 'thread-who', `${m.who} · ${fmtShort(new Date(m.ts).toISOString().slice(0, 10))}`));
      msg.append(m.text);
      thread.appendChild(msg);
    }
    const form = el('form', 'thread-form');
    const input = el('input', 'field field-sm');
    input.placeholder = 'Sabihin mo…';
    input.maxLength = 300;
    const send = el('button', 'btn btn-primary btn-sm', 'Send');
    send.type = 'submit';
    form.append(input, send);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      item.thread.push({ who: 'You', text, ts: Date.now() });
      savePlan(); renderPanel(); renderPlan();
    });
    thread.appendChild(form);

    const invite = el('p', 'thread-invite');
    const a = el('a', null, 'Invite your partner');
    a.href = '#';
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      const data = { title: 'Our wedding plan', text: 'Plan our wedding with me dito:', url: location.href };
      if (navigator.share) { try { await navigator.share(data); } catch { /* cancelled */ } }
      else { try { await navigator.clipboard.writeText(location.href); a.textContent = 'Link copied!'; } catch { /* no-op */ } }
    });
    invite.append(a, ' — sa ngayon, dito muna sa device na ito ang plano; real-time sync ang kasunod.');
    thread.appendChild(invite);
    talk.appendChild(thread);
    body.appendChild(talk);

    const actions = el('div', 'panel-actions');
    const rm = el('button', 'btn btn-ghost btn-sm', 'Alisin ito');
    rm.addEventListener('click', () => confirmRemove(item, () => {}));
    actions.appendChild(el('span'));
    actions.appendChild(rm);
    body.appendChild(actions);
  }

  /* ================= venues ================= */

  let region = 'All';
  let pricedOnly = false;
  let fitsOnly = false;
  const REGIONS = ['All', ...new Set(VENUES.map((v) => v.region))];

  function filtered() {
    let rows = VENUES;
    if (region !== 'All') rows = rows.filter((v) => v.region === region);
    if (pricedOnly) rows = rows.filter((v) => v.rate != null);
    if (fitsOnly && profile?.guests) rows = rows.filter((v) => v.capacity && v.capacity >= profile.guests);
    return rows;
  }

  function renderFilters() {
    const box = $('venue-filters');
    box.innerHTML = '';
    const wrap = el('div', 'filters');

    const regionChips = el('div', 'chips');
    for (const r of REGIONS) {
      const b = el('button', 'chip', r);
      b.setAttribute('aria-pressed', String(r === region));
      b.addEventListener('click', () => { region = r; renderVenues(); });
      regionChips.appendChild(b);
    }
    wrap.appendChild(regionChips);

    const toggles = el('div', 'chips');
    const p = el('button', 'chip chip-accent', 'May presyo');
    p.setAttribute('aria-pressed', String(pricedOnly));
    p.addEventListener('click', () => { pricedOnly = !pricedOnly; renderVenues(); });
    toggles.appendChild(p);

    if (profile?.guests) {
      const f = el('button', 'chip chip-accent', `Kasya ang ${profile.guests}`);
      f.setAttribute('aria-pressed', String(fitsOnly));
      f.addEventListener('click', () => { fitsOnly = !fitsOnly; renderVenues(); });
      toggles.appendChild(f);
    }
    wrap.appendChild(toggles);
    box.appendChild(wrap);
  }

  function venueCard(v) {
    // a div, not a button: the card holds figure/p (flow content), which is
    // invalid inside <button>
    const card = el('div', 'venue' + (v.photo ? ' venue-shot' : ''));
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.addEventListener('click', () => openVenue(v.name));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openVenue(v.name); }
    });

    if (v.photo) {
      const fig = el('figure', 'venue-figure');
      const img = el('img');
      img.src = 'photos/' + v.photo;
      img.alt = v.name;
      img.loading = 'lazy';
      img.decoding = 'async';
      fig.appendChild(img);
      if (v.credit) fig.appendChild(el('figcaption', 'venue-credit', `Photo: ${v.credit} · Google`));
      card.appendChild(fig);
    }

    const line = el('div', 'venue-line');

    const main = el('div', 'venue-main');
    main.appendChild(el('p', 'venue-eyebrow',
      [v.region, v.type, v.capacity ? `${v.capacity} pax` : null].filter(Boolean).join(' · ')));
    main.appendChild(el('p', 'venue-name', v.name));
    main.appendChild(el('p', 'venue-area',
      v.area + (v.rating ? ` · ${v.rating}★ ${v.reviews.toLocaleString()}` : '')));
    line.appendChild(main);

    const price = el('div', 'venue-price');
    if (v.rate != null) {
      price.appendChild(el('span', 'price-from', 'from'));
      price.appendChild(pesoNode(v.rate, 'price-num'));
      price.appendChild(el('span', 'stamp ' + (v.fresh ? 'stamp-fresh' : 'stamp-aged'),
        v.fresh ? `✓ verified ${v.rateYear}` : (v.rateYear ? `from ${v.rateYear}` : 'year unknown')));
    } else {
      price.appendChild(el('span', 'redacted'));
      price.appendChild(el('span', 'redacted-label', 'hindi pa public'));
    }
    line.appendChild(price);

    card.appendChild(line);
    return card;
  }

  function renderVenues() {
    renderFilters();
    const list = $('list');
    list.innerHTML = '';
    const rows = filtered();
    const priced = rows.filter((v) => v.rate != null).length;
    $('list-meta').textContent = rows.length ? `${rows.length} venues · ${priced} may presyo` : '';

    if (!rows.length) {
      const empty = el('p', 'nextup-empty');
      empty.textContent = fitsOnly
        ? `Walang venue dito na kasya ang ${profile.guests} guests. Subukang alisin ang filter o mag-ibang region.`
        : pricedOnly
          ? 'Wala pang public na presyo dito. Alisin ang "May presyo" para makita lahat.'
          : 'Wala pang venues dito — soon!';
      list.appendChild(empty);
      return;
    }
    for (const v of rows) list.appendChild(venueCard(v));
  }

  /* ================= ask ================= */

  const priced = VENUES.filter((v) => v.rate != null);
  const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);

  function hitRow(v) {
    const b = el('button', 'ask-hit');
    b.addEventListener('click', () => openVenue(v.name));
    if (v.photo) {
      const img = el('img');
      img.src = 'photos/' + v.photo;
      img.alt = '';
      img.loading = 'lazy';
      b.appendChild(img);
    } else b.appendChild(el('span'));
    const mid = el('span');
    mid.append(el('span', 'ask-hit-name', v.name), el('span', 'ask-hit-area', v.area));
    mid.style.display = 'flex';
    mid.style.flexDirection = 'column';
    b.appendChild(mid);
    b.appendChild(el('span', 'ask-hit-price', v.rate != null ? peso(v.rate) : '—'));
    return b;
  }

  // an answer is {lede, stats:[[label,value]], hits:[venue], notes:[str], follow:[str]}
  function answer(q) {
    const t = q.toLowerCase();
    const regionHit = REGIONS.slice(1).find((r) => t.includes(r.toLowerCase()))
      || (/tagaytay/.test(t) ? 'Tagaytay' : null);
    const pool = regionHit ? priced.filter((v) => v.region === regionHit) : priced;
    const where = regionHit ? `sa ${regionHit}` : 'sa buong dataset';

    const typeDefs = [
      ['garden', /garden|hardin|farm|hacienda/],
      ['hotel', /hotel|ballroom/],
      ['beach', /beach|dagat|resort|island/],
      ['events place', /events? place|pavilion|hall/],
    ];
    const typeHit = typeDefs.find(([, re]) => re.test(t));
    const byType = (rows) => typeHit ? rows.filter((v) => typeHit[1].test((v.type + ' ' + v.name).toLowerCase())) : rows;

    /* --- questions about THEIR plan --- */
    if (isCouple() && /(plano|plan ko|plan namin|nagastos|gastos|budget namin|kulang|natitira|left)/.test(t)) {
      const tot = totals();
      const missing = ESSENTIAL_CATS.filter((c) =>
        !plan.items.some((i) => i.cat === c && (i.status === 'booked' || i.status === 'paid')));
      const stats = [['Estimated', peso(tot.estimated)], ['Booked', peso(tot.booked)], ['Paid', peso(tot.paid)]];
      if (profile.target) stats.push(['Budget', peso(profile.target)]);
      const notes = [];
      if (profile.target) {
        const diff = profile.target - tot.estimated;
        notes.push(diff >= 0
          ? `May ${peso(diff)} pa kayong space sa budget.`
          : `Lampas kayo ng ${peso(-diff)} sa budget ninyo.`);
      }
      if (missing.length) notes.push(`Hindi pa booked: ${missing.join(', ')}.`);
      if (tot.dueSoon) notes.push(`May ${peso(tot.dueSoon)} na due sa loob ng 30 araw.`);
      return {
        lede: `${plan.items.length} ${plan.items.length === 1 ? 'item' : 'items'} ang nasa plano ninyo.`,
        stats, notes,
        follow: ['Ano ang kulang?', 'Magkano ang average sa Tagaytay?'],
      };
    }

    if (isCouple() && profile?.target && /(kaya ba|afford|sapat|enough)/.test(t)) {
      const tot = totals();
      const room = profile.target - tot.estimated;
      const fits = pool.filter((v) => v.rate <= Math.max(room, 0)).sort((a, b) => b.rate - a.rate).slice(0, 5);
      return {
        lede: room >= 0
          ? `May ${peso(room)} pa kayo bago maabot ang budget.`
          : `Lampas na kayo ng ${peso(-room)} sa budget.`,
        hits: room > 0 ? fits : [],
        notes: room > 0 && fits.length ? ['Ito ang pinakamalapit sa natitirang budget:'] : [],
        follow: ['Ano ang kulang?', 'Cheapest garden venue'],
      };
    }

    /* --- capacity --- */
    const paxMatch = t.match(/(\d{2,4})\s*(pax|guests?|bisita|tao)/);
    if (paxMatch || /kasya|capacity|fit/.test(t)) {
      const n = paxMatch ? Number(paxMatch[1]) : profile?.guests;
      if (!n) return { lede: 'Ilan ang bisita ninyo? Ilagay muna ang guest count sa Plan tab.', follow: ['Magkano ang average sa Tagaytay?'] };
      const fits = byType(pool).filter((v) => v.capacity && v.capacity >= n).sort((a, b) => a.rate - b.rate);
      return {
        lede: `${fits.length} venues ${where} ang kasya sa ${n} guests at may public na presyo.`,
        hits: fits.slice(0, 6),
        stats: fits.length ? [['Pinakamura', peso(fits[0].rate)], ['Median', peso(median(fits.map((v) => v.rate)))]] : [],
        notes: fits.length ? [] : ['Marami ang hindi naglalathala ng capacity — subukan ang Venues tab para sa buong listahan.'],
        follow: ['Cheapest garden venue', 'Ilan ang may presyo?'],
      };
    }

    /* --- counts / transparency --- */
    if (/(ilan|how many|count)/.test(t) && /(presyo|price|tago|hidden|public)/.test(t)) {
      return {
        lede: `${priced.length} sa ${VENUES.length} venues ang may public na presyo.`,
        stats: [
          ['Na-sweep', META.swept.toLocaleString()],
          ['Na-research', String(VENUES.length)],
          ['May presyo', String(priced.length)],
          ['Nagtatago', String(VENUES.length - priced.length)],
        ],
        notes: ['Ang natitira, "PM sent po" pa rin — kaya nga ginawa ito.'],
        follow: ['Magkano ang average sa Tagaytay?', 'Cheapest venue'],
      };
    }

    /* --- budget cap --- */
    const cap = (() => {
      const m = t.match(/(?:under|below|less than|mas mura sa|kayang|hanggang|≤|<)\s*₱?\s*([\d,.]+)\s*(k|m)?/);
      if (!m) return null;
      let n = Number(m[1].replace(/,/g, ''));
      if (m[2] === 'k') n *= 1000;
      if (m[2] === 'm') n *= 1000000;
      return n > 0 ? n : null;
    })();

    if (cap) {
      const hits = byType(pool).filter((v) => v.rate <= cap).sort((a, b) => a.rate - b.rate);
      if (!hits.length) {
        const cheapest = [...byType(pool)].sort((a, b) => a.rate - b.rate)[0];
        return {
          lede: `Walang venue ${where} na ${peso(cap)} pababa.`,
          hits: cheapest ? [cheapest] : [],
          notes: cheapest ? ['Ito ang pinakamalapit:'] : [],
          follow: ['Magkano ang average sa Tagaytay?'],
        };
      }
      return {
        lede: `${hits.length} venues ${where} ang ${peso(cap)} pababa.`,
        hits: hits.slice(0, 6),
        stats: [['Pinakamura', peso(hits[0].rate)], ['Median', peso(median(hits.map((v) => v.rate)))]],
        notes: hits.length > 6 ? [`…at ${hits.length - 6} pa sa Venues tab.`] : [],
        follow: ['Cheapest garden venue', 'Ano ang kulang?'],
      };
    }

    /* --- cheapest / priciest --- */
    if (/(pinakamura|cheapest|mura)/.test(t)) {
      const rows = [...byType(pool)].sort((a, b) => a.rate - b.rate).slice(0, 6);
      if (!rows.length) return { lede: `Wala pa akong presyo ${where}${typeHit ? ` para sa ${typeHit[0]}` : ''}.`, follow: ['Ilan ang may presyo?'] };
      return {
        lede: `Pinakamura ${where}${typeHit ? ` (${typeHit[0]})` : ''}:`,
        hits: rows,
        notes: ['Iba-iba ang saklaw — may venue-only, may all-in. Tingnan ang detalye ng bawat isa.'],
        follow: ['Magkano ang average sa Tagaytay?', 'Venues under ₱150k'],
      };
    }

    if (/(pinakamahal|priciest|most expensive|mahal)/.test(t)) {
      const rows = [...byType(pool)].sort((a, b) => b.rate - a.rate).slice(0, 5);
      if (!rows.length) return { lede: `Wala pa akong presyo ${where}.`, follow: [] };
      return { lede: `Pinakamataas ${where}:`, hits: rows, follow: ['Cheapest venue'] };
    }

    /* --- averages / ranges --- */
    if (/(average|avg|magkano|median|how much|range|presyo|gaano)/.test(t)) {
      const rows = byType(pool);
      const rates = rows.map((v) => v.rate);
      if (!rates.length) return { lede: `Wala pa akong public na presyo ${where}${typeHit ? ` para sa ${typeHit[0]}` : ''}.`, follow: ['Ilan ang may presyo?'] };
      const perHead = profile?.guests
        ? [['Per guest (median)', peso(median(rates) / profile.guests)]] : [];
      return {
        lede: `${rates.length} venues ${where}${typeHit ? ` (${typeHit[0]})` : ''} ang may public na presyo.`,
        stats: [
          ['Pinakamura', peso(Math.min(...rates))],
          ['Median', peso(median(rates))],
          ['Pinakamahal', peso(Math.max(...rates))],
          ...perHead,
        ],
        hits: [...rows].sort((a, b) => a.rate - b.rate).slice(0, 3),
        notes: ['Hindi pantay ang saklaw: may venue-only, may all-in package, may per-head. Basahin ang notes bawat venue.'],
        follow: ['Cheapest garden venue', `Venues under ${peso(median(rates))}`],
      };
    }

    /* --- type only --- */
    if (typeHit) {
      const rows = byType(pool).sort((a, b) => a.rate - b.rate);
      if (!rows.length) return { lede: `Wala pa akong ${typeHit[0]} na may presyo ${where}.`, follow: ['Ilan ang may presyo?'] };
      return {
        lede: `${rows.length} ${typeHit[0]} venues ${where} na may presyo.`,
        hits: rows.slice(0, 6),
        stats: [['Median', peso(median(rows.map((v) => v.rate)))]],
        follow: ['Magkano ang average sa Tagaytay?'],
      };
    }

    /* --- region only --- */
    if (regionHit) {
      const rates = pool.map((v) => v.rate);
      return {
        lede: `${pool.length} venues sa ${regionHit} ang may public na presyo.`,
        stats: rates.length ? [['Pinakamura', peso(Math.min(...rates))], ['Median', peso(median(rates))]] : [],
        hits: [...pool].sort((a, b) => a.rate - b.rate).slice(0, 5),
        follow: ['Cheapest garden venue', 'Venues under ₱150k'],
      };
    }

    return {
      lede: 'Hindi ko pa masagot ’yan nang tama.',
      notes: ['Magaling ako sa presyo, region, venue type, capacity, at sa plano ninyo. Subukan ito:'],
      follow: ['Magkano ang average sa Tagaytay?', 'Venues under ₱150k', 'Kasya ba ang 150 pax?', 'Ano ang kulang?'],
    };
  }

  function askNode(q) {
    const a = answer(q);
    const wrap = el('div', 'ask-a');
    if (a.lede) wrap.appendChild(el('p', 'lede', a.lede));

    if (a.stats?.length) {
      const stats = el('div', 'ask-stats');
      for (const [label, value] of a.stats) {
        const c = el('div', 'ask-stat');
        c.append(el('span', 'ask-stat-label', label), el('span', 'ask-stat-num', value));
        stats.appendChild(c);
      }
      wrap.appendChild(stats);
    }

    for (const n of a.notes ?? []) wrap.appendChild(el('p', null, n));

    if (a.hits?.length) {
      const hits = el('div', 'ask-hits');
      for (const v of a.hits) hits.appendChild(hitRow(v));
      wrap.appendChild(hits);
    }

    wrap.appendChild(el('p', 'ask-caveat',
      `Sagot mula sa ${VENUES.length} venues na na-research namin — computed, hindi hula.`));

    if (a.follow?.length) {
      const chips = el('div', 'ask-chips');
      for (const f of a.follow) {
        const b = el('button', 'ask-chip', f);
        b.addEventListener('click', () => ask(f));
        chips.appendChild(b);
      }
      wrap.appendChild(chips);
    }
    return wrap;
  }

  const SUGGESTIONS = [
    'Magkano ang average sa Tagaytay?',
    'Venues under ₱150k',
    'Cheapest garden venue',
    'Kasya ba ang 150 pax?',
    'Ilan ang may presyo?',
  ];

  let askStarted = false;

  function renderAsk() {
    if (askStarted) return;
    const thread = $('ask-thread');
    thread.innerHTML = '';
    const intro = el('div', 'ask-intro');
    intro.appendChild(el('p', 'ask-intro-title', 'Tanong lang'));
    intro.appendChild(el('p', 'ask-intro-note',
      `Sinasagot mula sa ${VENUES.length} venues na na-research namin — presyo, region, capacity, at ang plano ninyo. Walang hula.`));
    thread.appendChild(intro);

    const chips = $('ask-chips');
    chips.innerHTML = '';
    for (const s of SUGGESTIONS) {
      const b = el('button', 'ask-chip', s);
      b.addEventListener('click', () => ask(s));
      chips.appendChild(b);
    }
  }

  function ask(q) {
    askStarted = true;
    const thread = $('ask-thread');
    thread.appendChild(el('p', 'ask-q', q));
    const node = askNode(q);
    thread.appendChild(node);
    node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  $('ask-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('ask-input').value.trim();
    if (!q) return;
    $('ask-input').value = '';
    ask(q);
  });

  /* ================= boot ================= */

  function boot(startView) {
    ensurePlan();
    $('setup-link').classList.toggle('hidden', isCouple());
    // names live in the identity block; the masthead stays the brand line
    $('masthead-title').textContent = 'Philippine weddings · beta';
    $('colophon-meta').textContent =
      `${META.swept.toLocaleString()} venues natukoy · ${META.researched} na-research · ` +
      `${META.priced} may presyo · ${META.hidden} nagtatago pa`;
    renderAsk();
    show('home');
    setView(startView ?? (isCouple() ? 'plan' : 'venues'));
  }

  $('setup-link').addEventListener('click', (e) => {
    e.preventDefault();
    profile = { mode: 'couple', names: null, date: null, guests: null, target: null };
    show('names');
    $('names-input').focus();
  });

  $('reset-link').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('wd-profile');
    localStorage.removeItem('wd-plan');
    location.reload();
  });

  $('feedback-link').addEventListener('click', (e) => e.preventDefault());

  if (profile) boot();
  else show('gate');
})();
