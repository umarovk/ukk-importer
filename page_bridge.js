// Berjalan di MAIN world — punya akses ke jQuery dan select2 milik halaman
document.addEventListener('_ukk_select2', (e) => {
  const { selector, value } = e.detail;
  try {
    $(selector).val(value).trigger('change');
  } catch (err) {
    console.warn('[UKK Bridge] select2 error:', err);
  }
});
