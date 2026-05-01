chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  try {
    if (msg.action === 'getStudents') {
      sendResponse(getStudents());
    } else if (msg.action === 'fillValues') {
      sendResponse(fillValues(msg.data));
    } else if (msg.action === 'resetForm') {
      sendResponse(resetForm());
    }
  } catch (e) {
    sendResponse({ error: e.message });
  }
  return true;
});

// Ekstrak NISN dari cell (text node sebelum hidden input)
function extractNisn(cell) {
  const textNode = Array.from(cell.childNodes)
    .filter(n => n.nodeType === Node.TEXT_NODE)
    .map(n => n.textContent.trim())
    .join('');
  return textNode.split('/')[0].trim();
}

// Ambil daftar siswa dan penguji dari tabel
function getStudents() {
  const rows = document.querySelectorAll('#tbl_data tbody tr');
  const students = [];
  const examinerSet = new Set();

  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 5) return;

    const nama = cells[1].textContent.trim();
    const nisn = extractNisn(cells[2]);
    if (!nama) return;

    students.push({ nisn, nama });

    // Ambil daftar penguji dari option select
    row.querySelectorAll('select.pilihan option').forEach(opt => {
      if (opt.value && opt.textContent.trim()) {
        examinerSet.add(opt.textContent.trim());
      }
    });
  });

  return {
    students,
    examiners: Array.from(examinerSet).sort()
  };
}

// Buat map: nisn -> { nisn, nama, idx, row }
function buildRowMap() {
  const rows = document.querySelectorAll('#tbl_data tbody tr');
  const map = {};

  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 5) return;

    const nama = cells[1].textContent.trim();
    const nisn = extractNisn(cells[2]);
    if (!nisn) return;

    // Cari idx dari hidden input pdid
    const pdid = row.querySelector('input[name^="pdid"]');
    if (!pdid) return;

    const idx = pdid.name.replace('pdid', '');
    map[nisn] = { nisn, nama, idx, row };
  });

  return map;
}

// Isi nilai dari data CSV
function fillValues(data) {
  const rowMap = buildRowMap();
  let filled = 0;
  let notFound = 0;
  const notFoundList = [];

  data.forEach(item => {
    if (!item.nisn) return;

    const key = item.nisn.trim();
    const found = rowMap[key];

    if (!found) {
      notFound++;
      notFoundList.push(`NISN ${item.nisn} (${item.nama || '-'})`);
      return;
    }

    const { idx, row } = found;
    let changed = false;

    // Isi nilai
    if (item.nilai !== '' && item.nilai !== undefined) {
      const nilaiInput = document.querySelector(`input[name="nilai${idx}"]`);
      if (nilaiInput) {
        nilaiInput.value = item.nilai;
        nilaiInput.dispatchEvent(new Event('keyup', { bubbles: true }));
        nilaiInput.dispatchEvent(new Event('change', { bubbles: true }));
        changed = true;
      }
    }

    // Isi penguji internal
    if (item.penguji && item.penguji.trim()) {
      const selectEl = row.querySelector(`select[name="ptkku${idx}"]`);
      if (selectEl) {
        let optValue = null;
        const pengujiLower = item.penguji.toLowerCase().trim();

        selectEl.querySelectorAll('option').forEach(opt => {
          if (opt.value && opt.textContent.trim().toLowerCase() === pengujiLower) {
            optValue = opt.value;
          }
        });

        if (optValue) {
          // Gunakan jQuery milik halaman via injected script
          injectSelect2(`select[name="ptkku${idx}"]`, optValue);
          changed = true;
        }
      }
    }

    if (changed) filled++;
    else if (item.nilai === '' && (!item.penguji || !item.penguji.trim())) {
      // baris CSV ada tapi nilai & penguji kosong, skip tanpa error
    }
  });

  return { filled, notFound, notFoundList };
}

// Reset semua nilai dan penguji
function resetForm() {
  const rows = document.querySelectorAll('#tbl_data tbody tr');
  let count = 0;

  rows.forEach(row => {
    const pdid = row.querySelector('input[name^="pdid"]');
    if (!pdid) return;

    const idx = pdid.name.replace('pdid', '');

    const nilaiInput = document.querySelector(`input[name="nilai${idx}"]`);
    if (nilaiInput) nilaiInput.value = '';

    injectSelect2(`select[name="ptkku${idx}"]`, '');
    count++;
  });

  return { count };
}

// Kirim CustomEvent ke page_bridge.js (MAIN world) yang punya akses jQuery/select2
function injectSelect2(selector, value) {
  document.dispatchEvent(new CustomEvent('_ukk_select2', {
    detail: { selector, value }
  }));
}
