/* ==========================================================================
   GIỮ RỪNG CÓ TIẾNG – script.js (JavaScript thuần)
   Dữ liệu (mục tiêu, số tiền, mức ủng hộ, tài khoản nhận) được đọc từ app.py
   qua thẻ <script id="campaign-config">. KHÔNG hard-code số tiền ở đây.

   Luồng ủng hộ (chỉ chạy trên giao diện, không kết nối ngân hàng):
     1. Chọn mức  ->  2. Thông tin chuyển khoản (mã QR, nội dung CK, đếm ngược)
     ->  3. Xác nhận giao dịch (đối soát từng bước)  ->  4. Biên nhận + cập nhật tiến độ
   Không lưu thông tin người dùng: tải lại trang sẽ quay về số liệu ban đầu.
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- 1. DỮ LIỆU / TRẠNG THÁI ---------- */
  const CONFIG = JSON.parse(document.getElementById('campaign-config').textContent);
  const PAY = CONFIG.payment;
  const state = {
    targetAmount: CONFIG.targetAmount,
    currentAmount: CONFIG.currentAmount,
    selectedTier: null,
    displayedAmount: CONFIG.currentAmount, // số đang hiển thị (phục vụ hiệu ứng đếm)
    pay: null,         // { memo, expiresAt } của giao dịch hiện tại
    timerId: null,     // interval đếm ngược
    procTimers: [],    // các timeout của bước "xác nhận"
    receipt: null,
  };

  // Thời điểm (ms) mỗi bước đối soát hoàn thành ở màn hình "Đang xác nhận"
  const VERIFY_TIMES = [1300, 2700, 4000];

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const pad2 = (n) => String(n).padStart(2, '0');

  /* ---------- 2. TIỆN ÍCH ĐỊNH DẠNG ---------- */
  /** 2850000 -> "2.850.000 VNĐ" */
  function formatVND(value) {
    return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' VNĐ';
  }

  /* ---------- 3. TIẾN ĐỘ GỌI VỐN ---------- */
  let countRaf = null;

  /**
   * Cập nhật toàn bộ giao diện tiến độ:
   * 1) tính phần trăm  2) cập nhật số tiền  3) cập nhật thanh progress
   * 4) cập nhật text phần trăm  5) xử lý trạng thái đạt 100%
   */
  function updateProgress(animate = true) {
    const { currentAmount, targetAmount } = state;
    // progress = currentAmount / targetAmount * 100  (không vượt quá 100%)
    const percent = Math.min(100, Math.round((currentAmount / targetAmount) * 100));
    const remaining = Math.max(0, targetAmount - currentAmount);
    const done = currentAmount >= targetAmount;

    $$('[data-progress-bar]').forEach((bar) => { bar.style.width = percent + '%'; });
    $$('[data-progress-track]').forEach((el) => el.setAttribute('aria-valuenow', percent));
    $$('[data-percent]').forEach((el) => { el.textContent = percent + '%'; });
    $$('[data-remaining]').forEach((el) => { el.textContent = formatVND(remaining); });
    $$('[data-status]').forEach((el) => {
      el.textContent = done ? 'Đã hoàn thành mục tiêu (mô phỏng)' : 'Dự án đang gọi vốn';
    });
    document.body.classList.toggle('goal-complete', done);

    // Số tiền: đếm tăng dần cho mượt
    const els = $$('[data-current-amount]');
    const from = state.displayedAmount;
    const to = currentAmount;
    if (countRaf) cancelAnimationFrame(countRaf);
    if (!animate || prefersReducedMotion || from === to) {
      els.forEach((el) => { el.textContent = formatVND(to); });
      state.displayedAmount = to;
      return;
    }
    const duration = 900;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (to - from) * eased;
      els.forEach((el) => { el.textContent = formatVND(v); });
      if (p < 1) countRaf = requestAnimationFrame(tick);
      else state.displayedAmount = to;
    };
    countRaf = requestAnimationFrame(tick);
  }

  /* ---------- 4. TOAST ---------- */
  const toastEl = $('#toast');
  let toastTimer = null;
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 4200);
  }

  /* ---------- 5. GIẢ LẬP CHUYỂN KHOẢN ---------- */

  /** Tạo nội dung chuyển khoản + hạn hiệu lực, vd: "GRCT 70K 4821" */
  function newPayment(tier) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    return {
      memo: `${PAY.memoPrefix} ${tier.amount / 1000}K ${code}`,
      expiresAt: Date.now() + PAY.expireSeconds * 1000,
    };
  }

  /** Mã giao dịch kiểu ngân hàng: FT + yyMMdd + 8 số ngẫu nhiên */
  function newTransactionId() {
    const d = new Date();
    const date = String(d.getFullYear()).slice(2) + pad2(d.getMonth() + 1) + pad2(d.getDate());
    return 'FT' + date + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  }

  /* --- Mã QR trang trí (hoạt hình, không quét được), sinh từ nội dung CK --- */
  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function renderQR(seed) {
    const N = 25, C = 8, INK = '#3b2a1e';
    const rnd = mulberry32(hashSeed(seed));
    const inFinder = (x, y) => (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
    const inLogo = (x, y) => x >= 9 && x <= 15 && y >= 9 && y <= 15;
    let dots = '';
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (inFinder(x, y) || inLogo(x, y)) continue;
        if (rnd() > 0.5) dots += `<rect x="${x * C}" y="${y * C}" width="${C - 1.2}" height="${C - 1.2}" rx="2"/>`;
      }
    }
    const finder = (ox, oy) =>
      `<rect x="${ox * C}" y="${oy * C}" width="${7 * C}" height="${7 * C}" rx="9" fill="${INK}"/>` +
      `<rect x="${(ox + 1) * C}" y="${(oy + 1) * C}" width="${5 * C}" height="${5 * C}" rx="6" fill="#fff"/>` +
      `<rect x="${(ox + 2) * C}" y="${(oy + 2) * C}" width="${3 * C}" height="${3 * C}" rx="4" fill="${INK}"/>`;
    const mid = (N * C) / 2;
    $('#qr-box').innerHTML =
      `<svg viewBox="0 0 ${N * C} ${N * C}" role="img" aria-label="Mã QR chuyển khoản">` +
      `<rect width="${N * C}" height="${N * C}" fill="#fff"/><g fill="${INK}">${dots}</g>` +
      finder(0, 0) + finder(N - 7, 0) + finder(0, N - 7) +
      `<circle cx="${mid}" cy="${mid}" r="${3.4 * C}" fill="#f6b73c" stroke="${INK}" stroke-width="3"/>` +
      `<path d="M${mid - 14} ${mid + 6} a14 14 0 0 1 28 0 Z" fill="#b98a5e" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `</svg>`;
  }

  /* --- Đếm ngược hiệu lực mã giao dịch --- */
  const timerEl = $('#pay-timer');
  const timerChip = $('#pay-timer-chip');
  const payActions = $('#pay-actions');
  const payExpired = $('#pay-expired');

  function stopTimer() { clearInterval(state.timerId); state.timerId = null; }
  function showExpired(expired) {
    payExpired.hidden = !expired;
    payActions.hidden = expired;
    timerChip.hidden = expired;
  }
  function tickTimer() {
    const left = Math.max(0, Math.round((state.pay.expiresAt - Date.now()) / 1000));
    timerEl.textContent = pad2(Math.floor(left / 60)) + ':' + pad2(left % 60);
    timerChip.classList.toggle('warn', left <= 60);
    if (left === 0) { stopTimer(); showExpired(true); }
  }
  function startTimer() {
    stopTimer();
    showExpired(false);
    tickTimer();
    if (state.pay && state.pay.expiresAt > Date.now()) state.timerId = setInterval(tickTimer, 1000);
  }

  /** Đổ dữ liệu giao dịch vào màn hình chuyển khoản (bước 2) */
  function renderPayment() {
    const tier = CONFIG.tiers[state.selectedTier];
    state.pay = newPayment(tier);
    const amountEl = $('#pay-amount');
    amountEl.textContent = formatVND(tier.amount);
    amountEl.dataset.raw = String(tier.amount);
    const memoEl = $('#pay-memo');
    memoEl.textContent = state.pay.memo;
    renderQR(state.pay.memo);
    startTimer();
  }

  /* --- Nút "Sao chép" --- */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea'); // dự phòng cho trình duyệt cũ
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (_) { /* bỏ qua */ }
      ta.remove();
    }
  }
  $$('.copy-btn').forEach((btn) => btn.addEventListener('click', async () => {
    const src = $(btn.dataset.copyFrom);
    await copyText(src.dataset.raw || src.textContent.trim());
    const old = btn.textContent;
    btn.textContent = 'Đã chép';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = old; btn.classList.remove('copied'); }, 1500);
  }));

  /* --- Bước 3: đối soát giao dịch (giả lập từng bước) --- */
  function clearProcessing() {
    state.procTimers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    state.procTimers = [];
  }
  function startVerification() {
    if (!state.pay || Date.now() >= state.pay.expiresAt) { showExpired(true); return; }
    stopTimer();
    clearProcessing();
    goToStep(3);
    const items = $$('#verify-list li');
    items.forEach((li) => { li.className = ''; });
    items[0].classList.add('active');
    VERIFY_TIMES.forEach((ms, i) => {
      state.procTimers.push(setTimeout(() => {
        items[i].classList.remove('active');
        items[i].classList.add('done');
        if (items[i + 1]) items[i + 1].classList.add('active');
        if (i === items.length - 1) state.procTimers.push(setTimeout(finishDonation, 450));
      }, ms));
    });
  }

  /* --- Quà: nút "Tải về" chạy hiệu ứng tải giả rồi hiện dấu tích xanh --- */
  const checkSVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const DOWNLOAD_MS = 1800; // thời gian chạy thanh tải giả

  function fakeDownload(li, btn, label) {
    btn.disabled = true;
    btn.classList.add('loading');
    const t0 = performance.now();
    const id = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / DOWNLOAD_MS);
      const pct = Math.round(p * 100);
      btn.style.setProperty('--p', pct + '%');
      btn.textContent = 'Đang tải ' + pct + '%';
      if (p >= 1) {
        clearInterval(id);
        li.classList.add('done');
        btn.replaceWith(Object.assign(document.createElement('span'), {
          className: 'gift-done',
          innerHTML: checkSVG + '<span>Đã tải về</span>',
        }));
        showToast('✓ Đã tải về thành công: ' + label);
      }
    }, 60);
    state.procTimers.push(id); // bị huỷ khi đóng/mở lại modal
  }

  function renderGifts(tier) {
    const list = $('#gift-list');
    list.innerHTML = '';
    (tier.downloads || []).forEach((g) => {
      const li = document.createElement('li');
      li.className = 'gift-item gift-' + g.kind;
      const name = document.createElement('span');
      name.className = 'gift-name';
      name.textContent = g.label;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-primary gift-btn';
      btn.textContent = 'Tải về';
      btn.setAttribute('aria-label', 'Tải về ' + g.label);
      btn.addEventListener('click', () => fakeDownload(li, btn, g.label));
      li.append(name, btn);
      list.appendChild(li);
    });
    $('#gift-box').hidden = !list.children.length;
  }

  /* --- Bước 4: ghi nhận, cập nhật tiến độ, hiện biên nhận --- */
  function finishDonation() {
    const tier = CONFIG.tiers[state.selectedTier];
    if (!tier) return;
    state.currentAmount += tier.amount;
    updateProgress(true);

    const now = new Date();
    $('#rc-id').textContent = newTransactionId();
    $('#rc-time').textContent =
      `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())} - ` +
      `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`;
    $('#rc-amount').textContent = formatVND(tier.amount);
    $('#rc-memo').textContent = state.pay.memo;
    $('#rc-rewards').textContent = tier.rewards.join(' + ');
    renderGifts(tier);

    goToStep(4);
    showToast('✓ Cảm ơn bạn đã đồng hành cùng ' + CONFIG.campaignName + '!');
  }

  /* ---------- 6. MODAL ỦNG HỘ ---------- */
  const modal = $('#donate-modal');
  const btnNext = $('#btn-next');
  const btnBack = $('#btn-back');
  const btnConfirm = $('#btn-confirm');
  const radios = $$('input[name="tier"]', modal);
  let lastFocused = null;

  function goToStep(n) {
    $$('.modal-step', modal).forEach((s) => { s.hidden = Number(s.dataset.step) !== n; });
    $$('[data-stepper]', modal).forEach((li) => {
      const k = Number(li.dataset.stepper);
      li.classList.toggle('active', k === n);
      li.classList.toggle('done', k < n);
    });
    // Đưa focus vào tiêu đề bước mới (hỗ trợ bàn phím / screen reader)
    const heading = $('.modal-step:not([hidden]) h2', modal);
    if (heading) heading.focus();
  }

  function selectTier(id) {
    state.selectedTier = id && CONFIG.tiers[id] ? id : null;
    radios.forEach((r) => { r.checked = r.value === state.selectedTier; });
    btnNext.disabled = !state.selectedTier;
  }

  function openModal(tierId) {
    lastFocused = document.activeElement;
    stopTimer(); clearProcessing();
    selectTier(tierId || null);
    modal.hidden = false;
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => modal.classList.add('open'));
    closeMenu();
    // Bấm từ một mức cụ thể -> bỏ qua bước chọn, vào thẳng thông tin chuyển khoản
    if (state.selectedTier) { renderPayment(); goToStep(2); } else { goToStep(1); }
  }

  function closeModal() {
    // Đóng giữa chừng: huỷ đếm ngược và quá trình xác nhận (không ghi nhận ủng hộ)
    stopTimer(); clearProcessing();
    modal.classList.remove('open');
    document.body.classList.remove('modal-open');
    setTimeout(() => { modal.hidden = true; }, prefersReducedMotion ? 0 : 180);
    if (lastFocused && lastFocused.focus) lastFocused.focus({ preventScroll: true }); // giữ nguyên vị trí đang đọc
  }

  // Mở modal từ mọi nút có data-open-donate (có thể kèm data-tier)
  $$('[data-open-donate]').forEach((btn) =>
    btn.addEventListener('click', () => openModal(btn.dataset.tier)));
  $$('[data-close-donate]').forEach((btn) => btn.addEventListener('click', closeModal));
  radios.forEach((r) => r.addEventListener('change', () => selectTier(r.value)));
  btnNext.addEventListener('click', () => { if (state.selectedTier) { renderPayment(); goToStep(2); } });
  btnBack.addEventListener('click', () => { stopTimer(); goToStep(1); });
  btnConfirm.addEventListener('click', startVerification);
  $('#btn-renew').addEventListener('click', () => { renderPayment(); $('#btn-confirm').focus(); });
  $('#btn-view-progress').addEventListener('click', () => {
    closeModal();
    const goal = $('#goal');
    if (goal) goal.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  });

  // Click nền mờ để đóng
  modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeModal(); });

  // Bàn phím: Esc đóng, Tab bị giữ trong modal (focus trap)
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab') return;
    const focusables = $$('button, input, a[href], [tabindex]:not([tabindex="-1"])', modal)
      .filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement.tabIndex === -1)) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });

  /* ---------- 7. NAVIGATION (menu mobile + scroll-spy) ---------- */
  const header = $('.site-header');
  const menuToggle = $('#menu-toggle');

  function closeMenu() {
    header.classList.remove('menu-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Mở menu');
  }
  menuToggle.addEventListener('click', () => {
    const open = header.classList.toggle('menu-open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
  });
  $$('#main-nav a').forEach((a) => a.addEventListener('click', closeMenu));

  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Đánh dấu mục menu đang xem: khu nào đang cắt "vạch đo" (38% chiều cao màn hình) thì sáng.
  // Mỗi khu khai báo data-nav (mục menu của nó) và data-label (tên hiển thị trên mobile).
  const navLinks = $$('#main-nav a[href^="#"]');
  const spySections = $$('main > section[data-nav]');
  const nowReading = $('#now-reading');
  const roamEls = $$('.roam');   // tê tê đứng ở đáy một số section (chỉ hiện trên desktop, xem CSS 18e)
  let spyTicking = false;

  /**
   * Tê tê chạy chéo ngang qua nội dung của section chứa nó khi cuộn, rồi NẰM Ở GÓC DƯỚI trái/phải cho tới section có tê tê kế tiếp.
   * p (0..1) = mức cuộn qua section: 0 khi mép trên section vừa chạm đáy màn hình, 1 khi mép dưới section chạm đáy màn hình.
   *   p≈0: nằm ở góc dưới (bên xuất phát) · 0<p<1: chạy chéo sang góc dưới bên đối diện · p=1: nằm ở góc đó và ở lại.
   * Mọi vị trí là hàm của p trong toạ độ màn hình (ảnh dùng position: fixed), nên cuộn ngược lại cũng đúng.
   * Khi section có tê tê kế tiếp bắt đầu, con trước mờ đi ngay tại chỗ và con sau hiện ra (đổi dáng) rồi chạy tiếp.
   */
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const footerEl = $('.site-footer');
  function updateRoam() {
    if (window.innerWidth < 1025) return;               // mobile/tablet: CSS đã ẩn
    const vh = window.innerHeight, W = window.innerWidth;
    const m = (W - Math.min(1160, W - 40)) / 2;         // bề rộng lề trống hai bên nội dung
    const ps = roamEls.map((el) => {
      const r = el.parentElement.getBoundingClientRect();
      return clamp01((vh - r.top) / r.height);
    });
    const footFade = footerEl ? clamp01((footerEl.getBoundingClientRect().top - vh * 0.6) / (vh * 0.3)) : 1;
    roamEls.forEach((el, i) => {
      const p = ps[i];
      const s = clamp01((p - 0.1) / 0.8);               // nghỉ một chút ở hai đầu, chạy ở giữa
      const w = el.offsetWidth, h = el.offsetHeight;
      // Nằm trong lề trống; lề hẹp thì thò một phần ra ngoài mép màn hình để ít đè nội dung
      const side = Math.max(-0.6 * w, Math.min(W * 0.04, m - w - 8));
      const xLeft = side, xRight = W - w - side;
      const rl = el.dataset.dir === 'rl';
      const x = rl ? xRight + (xLeft - xRight) * s : xLeft + (xRight - xLeft) * s;
      const moving = s > 0 && s < 1 && !prefersReducedMotion;
      const roller = el.hasAttribute('data-roll');
      const arc = Math.sin(Math.PI * s) * vh * 0.07;    // vọt lên theo đường chéo rồi hạ xuống góc đối diện
      const hop = moving && !roller ? Math.abs(Math.sin(s * Math.PI * 10)) * 12 : 0;
      const rot = prefersReducedMotion ? 0 : roller ? (rl ? -1 : 1) * s * 540 : Math.sin(s * Math.PI * 10) * 3;
      const feet = vh - 8 - arc;                       // chân tê tê sát đáy màn hình
      const next = i + 1 < ps.length ? ps[i + 1] : 0;
      const o = (p <= 0 ? 0 : Math.min(1, p / 0.12)) * (1 - clamp01(next / 0.15)) * footFade;
      el.style.setProperty('--x', x.toFixed(1) + 'px');
      el.style.setProperty('--y', (feet - h - hop).toFixed(1) + 'px');
      el.style.setProperty('--r', rot.toFixed(1) + 'deg');
      el.style.setProperty('--o', o.toFixed(2));
    });
  }

  function updateSpy() {
    spyTicking = false;
    const line = window.innerHeight * 0.38;
    let current = null;
    spySections.forEach((sec) => { if (sec.getBoundingClientRect().top <= line) current = sec; });
    // Chạm đáy trang -> khu cuối cùng
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      current = spySections[spySections.length - 1];
    }
    const target = current ? current.dataset.nav : null;
    navLinks.forEach((a) => {
      const on = a.getAttribute('href') === target;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    // Mobile: tên khu đang xem hiện cạnh logo
    nowReading.textContent = current ? current.dataset.label : '';
    header.classList.toggle('reading', !!current);

    updateRoam();

    // Thanh đáy mobile: hiện sau khi cuộn qua hero (hero đã có tiến độ + nút riêng)
    const hero = $('.hero');
    const pastHero = hero ? hero.getBoundingClientRect().bottom < 60 : true;
    dock.classList.toggle('show', pastHero);
  }
  const dock = $('#dock');
  const requestSpy = () => { if (!spyTicking) { spyTicking = true; requestAnimationFrame(updateSpy); } };
  window.addEventListener('scroll', requestSpy, { passive: true });
  window.addEventListener('resize', requestSpy);
  updateSpy();

  /* ---------- 7b. THẺ LẬT "HIỂU LẦM / SỰ THẬT" ---------- */
  $$('.flip').forEach((card, i) => {
    const front = $('.face-front', card);
    const back = $('.face-back', card);
    card.addEventListener('click', () => {
      const on = card.classList.toggle('flipped');
      card.setAttribute('aria-pressed', String(on));
      card.setAttribute('aria-label', 'Thẻ ' + (i + 1) + (on ? ': đang xem sự thật, bấm để lật lại' : ': lật để xem sự thật'));
      // Chỉ mặt đang hiển thị mới được screen reader đọc
      front.setAttribute('aria-hidden', String(on));
      back.setAttribute('aria-hidden', String(!on));
    });
  });

  /* ---------- 8. HIỆU ỨNG HIỆN DẦN KHI CUỘN (nhẹ) ---------- */
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    document.documentElement.classList.add('js-reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- 9. KHỞI TẠO ---------- */
  updateProgress(false);
  // Hiệu ứng "đầy dần" của thanh progress lúc tải trang
  if (!prefersReducedMotion) {
    $$('[data-progress-bar]').forEach((bar) => {
      const target = bar.style.width;
      bar.style.width = '0%';
      requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = target; }));
    });
  }
})();


/* Nút phát tam giác trên khung TV: ẩn khi video chạy, hiện lại khi tạm dừng/kết thúc */
(function () {
  var btn = document.querySelector('.tv-play');
  var vid = document.querySelector('.tv-screen video');
  if (!btn || !vid) return;
  btn.addEventListener('click', function () { vid.play(); });
  vid.addEventListener('play', function () { btn.hidden = true; });
  vid.addEventListener('pause', function () { btn.hidden = false; });
  vid.addEventListener('ended', function () { btn.hidden = false; });
})();