const frame = document.getElementById('content-frame');
const pageTitle = document.getElementById('page-title');
const frameLoader = document.getElementById('frame-loader');
const navButtons = Array.from(document.querySelectorAll('.nav-item'));
const navSearch = document.getElementById('nav-search');
const KEY_LAST_PAGE = 'sawari_admin_last_page';

function showLoader() {
    frameLoader.classList.add('show');
}

function hideLoader() {
    frameLoader.classList.remove('show');
}

function updateTitle(title) {
    pageTitle.textContent = title;
    document.title = `${title} | Sawari Admin Portal`;
}

function setActiveNav(targetBtn) {
    navButtons.forEach((btn) => btn.classList.remove('active'));
    targetBtn.classList.add('active');
}

function navigateTo(src, title) {
    showLoader();
    frame.src = src;
    updateTitle(title);
    localStorage.setItem(KEY_LAST_PAGE, JSON.stringify({ src, title }));
}

navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        setActiveNav(btn);
        navigateTo(btn.dataset.src, btn.dataset.title);
        closeSidebar();
    });
});

frame.addEventListener('load', hideLoader);

document.getElementById('btn-refresh-frame').addEventListener('click', () => {
    showLoader();
    frame.contentWindow?.location.reload();
});

document.getElementById('btn-open-new-tab').addEventListener('click', () => {
    window.open(frame.src, '_blank', 'noopener');
});

document.getElementById('btn-fullscreen').addEventListener('click', (e) => {
    document.body.classList.toggle('frame-focus');
    const focused = document.body.classList.contains('frame-focus');
    e.currentTarget.innerHTML = focused
        ? '<i class="fa-solid fa-compress"></i> Exit Focus'
        : '<i class="fa-solid fa-expand"></i> Focus';
});

function updateClock() {
    const now = new Date();
    const el = document.getElementById('clock');
    el.textContent = now.toLocaleString([], {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        day: 'numeric'
    });
}

updateClock();
setInterval(updateClock, 30000);

function openSidebar() {
    document.body.classList.add('sidebar-open');
}

function closeSidebar() {
    document.body.classList.remove('sidebar-open');
}

document.getElementById('btn-open-sidebar').addEventListener('click', openSidebar);
document.getElementById('btn-close-sidebar').addEventListener('click', closeSidebar);
document.getElementById('sidebar-backdrop').addEventListener('click', closeSidebar);

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeSidebar();
        document.body.classList.remove('frame-focus');
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        navSearch.focus();
        navSearch.select();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        showLoader();
        frame.contentWindow?.location.reload();
    }
});

navSearch.addEventListener('input', () => {
    const q = navSearch.value.trim().toLowerCase();
    navButtons.forEach((btn) => {
        const text = `${btn.textContent} ${btn.dataset.keywords}`.toLowerCase();
        btn.classList.toggle('hidden', !!q && !text.includes(q));
    });
});

window.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;
    if (event.data.type !== 'portal:navigate') return;

    const { src } = event.data;
    const target = navButtons.find((btn) => btn.dataset.src === src);
    if (!target) return;

    setActiveNav(target);
    navigateTo(target.dataset.src, target.dataset.title);
});

(function restoreLastPage() {
    const fallback = navButtons[0];
    let restored = null;
    try {
        restored = JSON.parse(localStorage.getItem(KEY_LAST_PAGE) || 'null');
    } catch {
        restored = null;
    }

    if (restored && restored.src) {
        const matched = navButtons.find((btn) => btn.dataset.src === restored.src);
        if (matched) {
            setActiveNav(matched);
            navigateTo(matched.dataset.src, matched.dataset.title);
            return;
        }
    }

    setActiveNav(fallback);
    navigateTo(fallback.dataset.src, fallback.dataset.title);
})();
