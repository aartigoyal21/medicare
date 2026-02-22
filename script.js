// ═══════════════════════════════════════════════
//  MediCare+ — script.js
//  Booking auto-issues a per-dept queue token
// ═══════════════════════════════════════════════

const API = 'http://localhost:3000';

function escapeHtml(s) {
  return (s||'').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function showMessage(text, isError = false) {
  const msg = document.getElementById('message');
  if (!msg) return;
  msg.innerText = text;
  msg.style.display    = 'block';
  msg.style.background = isError ? 'rgba(255,107,107,0.12)' : 'rgba(0,229,255,0.12)';
  msg.style.borderColor= isError ? 'rgba(255,107,107,0.4)'  : 'rgba(0,229,255,0.4)';
  msg.style.color      = isError ? '#ff8f8f'                : '#00e5ff';
  setTimeout(() => { msg.style.display = 'none'; }, 6000);
}

function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.innerText = msg;
}

// ── BOOK APPOINTMENT ──────────────────────────────────────────
async function bookAppointment(event) {
  if (event) event.preventDefault();

  const name       = document.getElementById('name').value.trim();
  const email      = document.getElementById('email').value.trim();
  const phone      = document.getElementById('phone').value.trim();
  const department = document.getElementById('department').value;
  const date       = document.getElementById('date').value;
  const time       = document.getElementById('time').value;
  const doctor     = document.getElementById('doctor').value;
  const reason     = document.getElementById('reason').value.trim();

  ['name','email','phone','department','date','time','doctor','reason'].forEach(id => {
    const el = document.getElementById(id + 'Error');
    if (el) el.innerText = '';
  });

  let valid = true;
  if (!name)       { setError('nameError',      'Name is required');         valid = false; }
  if (!email)      { setError('emailError',      'Email is required');        valid = false; }
  if (!phone)      { setError('phoneError',      'Phone is required');        valid = false; }
  if (!department) { setError('departmentError', 'Select a department');      valid = false; }
  if (!date)       { setError('dateError',       'Select a date');            valid = false; }
  if (!time)       { setError('timeError',       'Select a time');            valid = false; }
  if (!doctor)     { setError('doctorError',     'Select a doctor');          valid = false; }
  if (!reason)     { setError('reasonError',     'Describe your reason');     valid = false; }
  if (!valid) return;

  const submitBtn = document.querySelector('.btn-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Booking...'; }

  const appointment = {
    id:   Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, email, phone, department, doctor, date, time, reason
  };

  try {
    const res  = await fetch(`${API}/api/appointments`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(appointment)
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById('appointmentForm').reset();
      if (data.token_number) {
        showTokenPopup(name, data.token_number, data.department || department);
      } else {
        showMessage('✅ Appointment booked for ' + name + '!');
      }
      renderAppointments();
    } else {
      showMessage('❌ Failed to book. Please try again.', true);
    }
  } catch {
    showMessage('❌ Cannot connect to server. Make sure node server.js is running.', true);
  }

  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '✓ Confirm Appointment'; }
}

// ── TOKEN POPUP (shown after booking) ────────────────────────
function showTokenPopup(name, tokenNum, department) {
  document.getElementById('tokenPopup')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tokenPopup';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;z-index:9999;';

  // Strip emojis from dept for plain text parts
  const deptPlain = department.replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '').trim();

  overlay.innerHTML = `
    <style>
      @keyframes popIn { from{opacity:0;transform:scale(0.88) translateY(22px)} to{opacity:1;transform:scale(1) translateY(0)} }
      #tokenPopup .box {
        background:linear-gradient(135deg,#0b1f32,#08364f);
        border:1px solid rgba(0,229,255,0.38);
        border-radius:24px; padding:46px 42px;
        text-align:center; max-width:420px; width:92%;
        box-shadow:0 28px 80px rgba(0,0,0,0.65),0 0 60px rgba(0,180,216,0.1);
        animation:popIn 0.45s cubic-bezier(.34,1.4,.64,1);
        font-family:'Poppins',sans-serif; color:#fff;
      }
      #tokenPopup .emoji   { font-size:46px; margin-bottom:10px; }
      #tokenPopup .label   { font-size:11px; text-transform:uppercase; letter-spacing:3px; color:#90e0ef; margin-bottom:18px; }
      #tokenPopup .tnum    { font-family:'Space Mono',monospace; font-size:92px; font-weight:700; line-height:1; color:#fff; margin-bottom:6px; text-shadow:0 0 40px rgba(0,229,255,0.85),0 0 80px rgba(0,229,255,0.3); }
      #tokenPopup .tdept   { font-size:15px; color:#90e0ef; margin-bottom:4px; }
      #tokenPopup .tname   { font-size:15px; font-weight:600; margin-bottom:20px; color:rgba(255,255,255,0.85); }
      #tokenPopup .note    { font-size:13px; color:#b0d8e8; line-height:1.65; background:rgba(0,180,216,0.09); border:1px solid rgba(0,229,255,0.18); border-radius:12px; padding:14px 18px; margin-bottom:24px; }
      #tokenPopup .note strong { color:#90e0ef; }
      #tokenPopup .note a  { color:#90e0ef; }
      #tokenPopup .btns    { display:flex; gap:12px; }
      #tokenPopup .btn     { flex:1; padding:13px; border-radius:12px; font-family:'Poppins',sans-serif; font-size:14px; font-weight:600; cursor:pointer; border:none; transition:0.3s; }
      #tokenPopup .primary { background:linear-gradient(45deg,#00b4d8,#90e0ef); color:#003049; }
      #tokenPopup .primary:hover { box-shadow:0 0 24px rgba(0,229,255,0.5); transform:translateY(-2px); }
      #tokenPopup .sec     { background:rgba(255,255,255,0.07); color:#b0d8e8; border:1px solid rgba(255,255,255,0.14); }
    </style>
    <div class="box">
      <div class="emoji">🎉</div>
      <div class="label">Appointment Confirmed — Your Queue Token</div>
      <div class="tnum">${String(tokenNum).padStart(2,'0')}</div>
      <div class="tdept">${escapeHtml(department)}</div>
      <div class="tname">👤 ${escapeHtml(name)}</div>
      <div class="note">
        <strong>Save this token number!</strong><br>
        Visit the <a href="queue.html">Live Queue</a> page and select
        <strong>${escapeHtml(deptPlain)}</strong> tab to see when your token is called.
      </div>
      <div class="btns">
        <button class="btn sec" onclick="document.getElementById('tokenPopup').remove()">Close</button>
        <button class="btn primary" onclick="window.location.href='queue.html'">Track My Queue →</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── RENDER BOOKED APPOINTMENTS ────────────────────────────────
async function renderAppointments() {
  const container = document.getElementById('appointmentsList');
  if (!container) return;

  container.innerHTML = '<p style="text-align:center;color:#b0d8e8;padding:30px;">Loading...</p>';

  let list = [];
  try {
    const res = await fetch(`${API}/api/appointments`);
    list = await res.json();
    list = list.filter(a => a.status !== 'cancelled');
    list.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  } catch {
    container.innerHTML = '<p class="no-appointments">⚠️ Could not load — server may be offline.</p>';
    return;
  }

  if (!list.length) {
    container.innerHTML = '<p class="no-appointments">No appointments booked yet</p>';
    return;
  }

  container.innerHTML = '';
  list.forEach((app, idx) => {
    const card = document.createElement('div');
    card.className = 'appointment-card ' + (idx % 2 === 0 ? 'from-left' : 'from-right');

    const sc = app.status === 'confirmed' ? '#34d399' : app.status === 'cancelled' ? '#f87171' : '#fbbf24';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
        <div>
          <div style="font-size:17px;font-weight:700;color:#fff;">${escapeHtml(app.name)}</div>
          <div style="font-size:13px;color:#b0d8e8;margin-top:4px;">${escapeHtml(app.department)} · ${escapeHtml(app.doctor)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:700;color:#90e0ef;font-size:15px;">📅 ${app.date}</div>
          <div style="color:#b0d8e8;font-size:13px;">🕐 ${app.time}</div>
          <div style="margin-top:6px;display:inline-block;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600;background:rgba(255,255,255,0.08);color:${sc};border:1px solid ${sc}40;">${app.status||'pending'}</div>
        </div>
      </div>
      <div style="margin-top:12px;font-size:13px;color:#b0d8e8;"><strong style="color:#90e0ef;">Reason:</strong> ${escapeHtml(app.reason||'—')}</div>
      <div style="margin-top:5px;font-size:12px;color:#7fa8be;">📞 ${escapeHtml(app.phone)} &nbsp;|&nbsp; ✉️ ${escapeHtml(app.email)}</div>
      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
        <button onclick="cancelAppointment('${app.id}')"
          style="padding:7px 16px;border-radius:8px;border:1px solid rgba(255,107,107,0.4);background:rgba(255,107,107,0.15);color:#ff8f8f;cursor:pointer;font-family:Poppins,sans-serif;font-size:13px;font-weight:600;transition:0.2s;"
          onmouseover="this.style.background='rgba(255,107,107,0.3)'" onmouseout="this.style.background='rgba(255,107,107,0.15)'">
          ✕ Cancel
        </button>
        <a href="queue.html"
          style="padding:7px 16px;border-radius:8px;border:1px solid rgba(0,229,255,0.3);background:rgba(0,180,216,0.1);color:#90e0ef;text-decoration:none;font-family:Poppins,sans-serif;font-size:13px;font-weight:600;transition:0.2s;"
          onmouseover="this.style.background='rgba(0,180,216,0.22)'" onmouseout="this.style.background='rgba(0,180,216,0.1)'">
          🔢 Track Queue
        </a>
      </div>`;

    container.appendChild(card);
    setTimeout(() => card.classList.add('slide-in'), 80 + idx * 80);
  });
}

// ── CANCEL ────────────────────────────────────────────────────
async function cancelAppointment(id) {
  if (!confirm('Cancel this appointment?')) return;
  try {
    const res  = await fetch(`${API}/api/appointments/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { showMessage('✅ Appointment cancelled.'); renderAppointments(); }
  } catch { showMessage('❌ Could not cancel — server offline.', true); }
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderAppointments();

  const form = document.querySelector('.form-section');
  const info = document.querySelector('.info-section');
  if (form) { form.classList.add('from-left');  setTimeout(() => form.classList.add('slide-in'), 200); }
  if (info) { info.classList.add('from-right'); setTimeout(() => info.classList.add('slide-in'), 350); }

  const dateInput = document.getElementById('date');
  if (dateInput) dateInput.setAttribute('min', new Date().toISOString().split('T')[0]);
});