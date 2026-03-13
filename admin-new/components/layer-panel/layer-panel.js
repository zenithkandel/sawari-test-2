// ============================================================
// Sawari Admin - Layer Panel Component
// ============================================================
const LayerPanel = (() => {
    function init() {
        // Layer toggle checkboxes
        document.querySelectorAll('[data-layer]').forEach(cb => {
            cb.addEventListener('change', () => {
                Store.setLayer(cb.dataset.layer, cb.checked);
            });
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                Store.setFilter(btn.dataset.filter);
            });
        });
    }

    return { init };
})();
