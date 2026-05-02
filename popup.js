// State: array of { nisn, nama, nilai, penguji, nosertif }
let students = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function showStatus(msg, type = 'info') {
  const el = document.getElementById('status');
  el.innerHTML = msg;
  el.className = `s-${type}`;
  el.style.display = 'block';
}

function hideStatus() {
  document.getElementById('status').style.display = 'none';
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Kirim pesan ke content.js (untuk READ data saja)
function sendMsg(tabId, msg) {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, msg, res => {
      resolve(chrome.runtime.lastError ? null : res);
    });
  });
}

// Jalankan fungsi langsung di page context (MAIN world) — bisa akses jQuery/select2
async function execInPage(tabId, func, args = []) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func,
      args,
      world: 'MAIN'
    });
    return results?.[0]?.result ?? null;
  } catch (e) {
    console.error('[UKK] executeScript error:', e);
    return null;
  }
}

function setButtonsEnabled(enabled) {
  document.getElementById('btnIsiForm').disabled   = !enabled;
  document.getElementById('btnReset').disabled     = !enabled;
  document.getElementById('btnCopyNames').disabled = !enabled;
}

// ─── Fungsi yang diinjeksi ke halaman (MAIN world) ────────────────────────────
// PENTING: fungsi ini tidak boleh pakai variabel di luar (no closure).

function fillValuesInPage(data) {
  function extractNisn(cell) {
    return Array.from(cell.childNodes)
      .filter(n => n.nodeType === 3)
      .map(n => n.textContent.trim())
      .join('')
      .split('/')[0].trim();
  }

  const rowMap = {};
  document.querySelectorAll('#tbl_data tbody tr').forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 5) return;
    const nisn = extractNisn(cells[2]);
    const pdid = row.querySelector('input[name^="pdid"]');
    if (!pdid || !nisn) return;
    rowMap[nisn] = { idx: pdid.name.replace('pdid', ''), row };
  });

  let filled = 0, notFound = 0;
  const notFoundList = [];

  data.forEach(item => {
    if (!item.nisn) return;
    const found = rowMap[item.nisn.trim()];
    if (!found) {
      notFound++;
      notFoundList.push('NISN ' + item.nisn + (item.nama ? ' (' + item.nama + ')' : ''));
      return;
    }

    const { idx, row } = found;
    let changed = false;

    // Isi nilai
    if (item.nilai) {
      const inp = document.querySelector('input[name="nilai' + idx + '"]');
      if (inp) {
        inp.value = item.nilai;
        inp.dispatchEvent(new Event('keyup', { bubbles: true }));
        changed = true;
      }
    }

    // Isi penguji internal via jQuery/select2
    if (item.penguji && item.penguji.trim()) {
      const sel = row.querySelector('select[name="ptkku' + idx + '"]');
      if (sel) {
        const pengujiLower = item.penguji.toLowerCase().trim();
        let optVal = null;
        sel.querySelectorAll('option').forEach(opt => {
          if (opt.value && opt.textContent.trim().toLowerCase() === pengujiLower) {
            optVal = opt.value;
          }
        });
        if (optVal) {
          $('select[name="ptkku' + idx + '"]').val(optVal).trigger('change');
          changed = true;
        }
      }
    }

    // Isi no sertifikat
    if (item.nosertif && item.nosertif.trim()) {
      const sertifInp = document.querySelector('input[name="no_sertif' + idx + '"]');
      if (sertifInp) {
        sertifInp.value = item.nosertif;
        sertifInp.dispatchEvent(new Event('keyup', { bubbles: true }));
        sertifInp.dispatchEvent(new Event('change', { bubbles: true }));
        changed = true;
      }
    }

    if (changed) filled++;
  });

  return { filled, notFound, notFoundList };
}

function resetFormInPage() {
  let count = 0;
  document.querySelectorAll('#tbl_data tbody tr').forEach(row => {
    const pdid = row.querySelector('input[name^="pdid"]');
    if (!pdid) return;
    const idx = pdid.name.replace('pdid', '');
    const inp = document.querySelector('input[name="nilai' + idx + '"]');
    if (inp) inp.value = '';
    $('select[name="ptkku' + idx + '"]').val('').trigger('change');
    const sertifInp = document.querySelector('input[name="no_sertif' + idx + '"]');
    if (sertifInp) sertifInp.value = '';
    count++;
  });
  return { count };
}

// ─── Render tabel siswa ───────────────────────────────────────────────────────

function renderTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  students.forEach((s, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-no">${i + 1}</td>
      <td class="col-nisn">${s.nisn}</td>
      <td class="col-nama">${escHtml(s.nama)}</td>
      <td class="col-nilai">
        <input class="cell-input nilai-input ${s.nilai ? 'has-value' : ''}"
               type="text" data-idx="${i}" value="${escHtml(s.nilai)}"
               placeholder="—" autocomplete="off">
      </td>
      <td class="col-penguji">
        <input class="cell-input penguji-input ${s.penguji ? 'has-value' : ''}"
               type="text" data-idx="${i}" value="${escHtml(s.penguji)}"
               placeholder="—" autocomplete="off">
      </td>
      <td class="col-nosertif">
        <input class="cell-input nosertif-input ${s.nosertif ? 'has-value' : ''}"
               type="text" data-idx="${i}" value="${escHtml(s.nosertif)}"
               placeholder="—" autocomplete="off">
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('countBadge').textContent = `${students.length} siswa`;
  attachInputHandlers();
  setButtonsEnabled(true);
}

function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

// ─── Copy ke clipboard ────────────────────────────────────────────────────────

function copyText(text, tagEl) {
  const done = tagEl ? () => {
    tagEl.classList.add('copied');
    tagEl.textContent = '✓ ' + text;
    setTimeout(() => {
      tagEl.classList.remove('copied');
      tagEl.textContent = text;
    }, 1000);
  } : () => {};

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); done(); } catch (_) {}
  document.body.removeChild(ta);
}

// ─── Input handlers: sync + paste distribution ────────────────────────────────

function attachInputHandlers() {
  document.querySelectorAll('.nilai-input').forEach(input => {
    input.addEventListener('input', () => syncFromInput(input, 'nilai'));
    input.addEventListener('paste', e => handlePaste(e, '.nilai-input', 'nilai'));
  });
  document.querySelectorAll('.penguji-input').forEach(input => {
    input.addEventListener('input', () => syncFromInput(input, 'penguji'));
    input.addEventListener('paste', e => handlePaste(e, '.penguji-input', 'penguji'));
  });
  document.querySelectorAll('.nosertif-input').forEach(input => {
    input.addEventListener('input', () => syncFromInput(input, 'nosertif'));
    input.addEventListener('paste', e => handlePaste(e, '.nosertif-input', 'nosertif'));
  });
}

function syncFromInput(input, field) {
  students[parseInt(input.dataset.idx)][field] = input.value;
  input.classList.toggle('has-value', !!input.value.trim());
}

function handlePaste(e, selector, field) {
  const text = (e.clipboardData || window.clipboardData).getData('text');
  const lines = text
    .split(/\r?\n/)
    .map(v => v.trim())
    .filter((v, i, arr) => !(i === arr.length - 1 && v === ''));

  if (lines.length <= 1) return;

  e.preventDefault();
  const startIdx = parseInt(e.target.dataset.idx);
  const inputs   = document.querySelectorAll(selector);

  lines.forEach((val, i) => {
    const inp = inputs[startIdx + i];
    if (!inp) return;
    inp.value = val;
    students[startIdx + i][field] = val;
    inp.classList.toggle('has-value', !!val);
  });

  const lastIdx = Math.min(startIdx + lines.length - 1, inputs.length - 1);
  inputs[lastIdx]?.focus();
}

// ─── Copy Nama Siswa ──────────────────────────────────────────────────────────

document.getElementById('btnCopyNames').addEventListener('click', () => {
  if (students.length === 0) return;
  const btn  = document.getElementById('btnCopyNames');
  const orig = btn.textContent;
  copyText(students.map(s => s.nama).join('\n'), null);
  btn.textContent      = `✓ ${students.length} nama ter-copy!`;
  btn.style.background = '#bf360c';
  setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1500);
});

// ─── Generate Siswa ───────────────────────────────────────────────────────────

document.getElementById('btnGenerate').addEventListener('click', async () => {
  const tab = await getActiveTab();
  const res = await sendMsg(tab.id, { action: 'getStudents' });

  if (!res) {
    showStatus('❌ Buka halaman <b>input_nilai_ukk</b> terlebih dahulu.', 'error');
    return;
  }

  students = res.students.map(s => ({ nisn: s.nisn, nama: s.nama, nilai: '', penguji: '', nosertif: '' }));
  renderTable();
  hideStatus();
});

// ─── Daftar Penguji ───────────────────────────────────────────────────────────

document.getElementById('btnGenPenguji').addEventListener('click', async () => {
  const panel = document.getElementById('pengujiPanel');
  if (panel.style.display === 'block') { panel.style.display = 'none'; return; }

  const tab = await getActiveTab();
  const res = await sendMsg(tab.id, { action: 'getStudents' });
  if (!res) { showStatus('❌ Buka halaman <b>input_nilai_ukk</b> terlebih dahulu.', 'error'); return; }

  const container = document.getElementById('pengujiTags');
  container.innerHTML = '';
  res.examiners.forEach(name => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = name;
    tag.title = 'Klik untuk copy nama ini';
    tag.addEventListener('click', () => copyText(name, tag));
    container.appendChild(tag);
  });
  panel.style.display = 'block';
});

// ─── Isi Form ─────────────────────────────────────────────────────────────────

document.getElementById('btnIsiForm').addEventListener('click', async () => {
  // Sync dari DOM ke state
  document.querySelectorAll('.nilai-input').forEach(inp => {
    students[inp.dataset.idx].nilai = inp.value.trim();
  });
  document.querySelectorAll('.penguji-input').forEach(inp => {
    students[inp.dataset.idx].penguji = inp.value.trim();
  });
  document.querySelectorAll('.nosertif-input').forEach(inp => {
    students[inp.dataset.idx].nosertif = inp.value.trim();
  });

  const toFill = students.filter(s => s.nilai || s.penguji || s.nosertif);
  if (toFill.length === 0) {
    showStatus('❌ Belum ada nilai, penguji, atau no sertifikat yang diisi.', 'error');
    return;
  }

  const tab = await getActiveTab();
  const btn = document.getElementById('btnIsiForm');
  btn.disabled = true;
  btn.textContent = '⏳ Mengisi...';

  // Jalankan langsung di page context (MAIN world) — jQuery tersedia di sana
  const res = await execInPage(tab.id, fillValuesInPage, [toFill]);

  btn.disabled = false;
  btn.textContent = '✔ Isi Form';

  if (!res) {
    showStatus('❌ Gagal mengisi form. Pastikan halaman <b>input_nilai_ukk</b> terbuka.', 'error');
    return;
  }

  const { filled, notFound, notFoundList } = res;
  let msg = `✅ <b>${filled} siswa</b> berhasil diisi.`;
  if (notFound > 0) msg += `<br>⚠️ <b>${notFound}</b> tidak ditemukan: ` + notFoundList.join(', ');
  showStatus(msg, notFound === 0 ? 'success' : 'info');
});

// ─── Reset ────────────────────────────────────────────────────────────────────

document.getElementById('btnReset').addEventListener('click', async () => {
  if (!confirm('Reset tabel di plugin dan form di halaman?')) return;

  students.forEach(s => { s.nilai = ''; s.penguji = ''; s.nosertif = ''; });
  renderTable();

  const tab = await getActiveTab();
  const res = await execInPage(tab.id, resetFormInPage, []);
  showStatus(
    res ? `✅ Reset selesai (${res.count} siswa).` : '❌ Gagal reset form.',
    res ? 'success' : 'error'
  );
});
