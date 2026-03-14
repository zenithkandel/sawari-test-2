// ============================================================
// Sawari Admin - Community Suggestions Manager
// Author: Zenith Kandel — https://zenithkandel.com.np
// License: MIT
// ============================================================

(function () {
  'use strict';

  const API_URL = '../backend/handlers/suggestions.php';

  const modal = document.getElementById('suggestions-modal');
  const listEl = document.getElementById('suggestions-list');
  const filterSelect = document.getElementById('suggestions-filter');
  const closeBtn = document.getElementById('suggestions-close');
  const openBtn = document.getElementById('btn-suggestions');
  const badge = document.getElementById('suggestions-badge');

  let suggestions = [];
  let currentFilter = 'pending';

  const CATEGORY_LABELS = {
    route_correction: 'Route Correction',
    missing_stop: 'Missing Stop',
    fare_issue: 'Fare Issue',
    new_route: 'New Route',
    general: 'General'
  };

  // --- Modal open/close ---

  function openModal() {
    modal.style.display = 'flex';
    loadSuggestions();
  }

  function closeModal() {
    modal.style.display = 'none';
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      closeModal();
    }
  });

  filterSelect.addEventListener('change', function () {
    currentFilter = this.value;
    renderList();
  });

  // --- Data loading ---

  async function loadSuggestions() {
    listEl.innerHTML = '<div class="suggestions-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading suggestions...</div>';

    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Failed to load');
      suggestions = await res.json();
      renderList();
      updateBadge();
    } catch (err) {
      listEl.innerHTML = '<div class="suggestions-empty">Failed to load suggestions.</div>';
      console.error('Suggestions load error:', err);
    }
  }

  function updateBadge() {
    const pendingCount = suggestions.filter(s => s.status === 'pending').length;
    if (pendingCount > 0) {
      badge.textContent = pendingCount > 99 ? '99+' : pendingCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // --- Rendering ---

  function renderList() {
    const filtered = currentFilter === 'all'
      ? suggestions
      : suggestions.filter(s => s.status === currentFilter);

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="suggestions-empty">No ${currentFilter === 'all' ? '' : currentFilter + ' '}suggestions found.</div>`;
      return;
    }

    // Sort: newest first
    const sorted = [...filtered].sort((a, b) => {
      const da = new Date(a.created_at || 0);
      const db = new Date(b.created_at || 0);
      return db - da;
    });

    listEl.innerHTML = sorted.map(s => renderCard(s)).join('');

    // Bind action buttons
    listEl.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = parseInt(this.dataset.id);
        const action = this.dataset.action;
        handleAction(id, action);
      });
    });
  }

  function renderCard(s) {
    const date = s.created_at ? new Date(s.created_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    }) : '';

    const categoryLabel = CATEGORY_LABELS[s.category] || s.category;

    let taskHtml = '';
    if (s.task) {
      taskHtml = `
        <div class="suggestion-task">
          <div class="suggestion-task-label"><i class="fa-solid fa-bolt"></i> Extracted Task</div>
          <div class="suggestion-task-summary">${escapeHtml(s.task.summary || '')}</div>
          <div class="suggestion-task-action">${escapeHtml(s.task.action || '')}${s.task.entity_name ? ' → ' + escapeHtml(s.task.entity_name) : ''}</div>
        </div>
      `;
    }

    let actionsHtml = '';
    if (s.status === 'pending') {
      actionsHtml = `
        <button class="btn btn-approve" data-id="${s.id}" data-action="approved"><i class="fa-solid fa-check"></i> Approve</button>
        <button class="btn btn-dismiss" data-id="${s.id}" data-action="dismissed"><i class="fa-solid fa-ban"></i> Dismiss</button>
        <button class="btn btn-delete" data-id="${s.id}" data-action="delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
      `;
    } else if (s.status === 'approved') {
      actionsHtml = `
        <button class="btn btn-complete" data-id="${s.id}" data-action="completed"><i class="fa-solid fa-check-double"></i> Mark Completed</button>
        <button class="btn btn-dismiss" data-id="${s.id}" data-action="dismissed"><i class="fa-solid fa-ban"></i> Dismiss</button>
      `;
    } else if (s.status === 'completed' || s.status === 'dismissed') {
      actionsHtml = `
        <button class="btn btn-delete" data-id="${s.id}" data-action="delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
      `;
    }

    return `
      <div class="suggestion-card" data-suggestion-id="${s.id}">
        <div class="suggestion-card-top">
          <div class="suggestion-meta">
            <span class="suggestion-category ${s.category}">${categoryLabel}</span>
            <span>${escapeHtml(s.name || 'Anonymous')}</span>
            <span>${date}</span>
          </div>
          <span class="suggestion-status ${s.status}">${s.status}</span>
        </div>
        <div class="suggestion-message">${escapeHtml(s.message)}</div>
        ${taskHtml}
        <div class="suggestion-actions">${actionsHtml}</div>
      </div>
    `;
  }

  // --- Task execution ---

  async function executeTask(task) {
    if (!task || !task.action || !task.details) return false;

    const d = task.details;

    try {
      switch (task.action) {
        case 'add_stop_to_route': {
          const route = Store.findEntity('routes', d.route_id);
          if (!route) throw new Error(`Route #${d.route_id} not found`);
          const stopIds = [...(route.stopIds || [])];
          if (stopIds.includes(d.stop_id)) {
            showToast(`Stop "${d.stop_name}" already on this route`, 'info');
            return true; // Already there, consider it done
          }
          stopIds.push(d.stop_id);
          await Commands.updateRoute(d.route_id, { stopIds });
          return true;
        }

        case 'remove_stop_from_route': {
          const route = Store.findEntity('routes', d.route_id);
          if (!route) throw new Error(`Route #${d.route_id} not found`);
          const stopIds = (route.stopIds || []).filter(sid => sid !== d.stop_id);
          await Commands.updateRoute(d.route_id, { stopIds });
          return true;
        }

        case 'rename_stop': {
          await Commands.updateStop(d.stop_id, { name: d.new_name });
          return true;
        }

        case 'rename_route': {
          await Commands.updateRoute(d.route_id, { name: d.new_name });
          return true;
        }

        case 'update_stop': {
          await Commands.updateStop(d.stop_id, { [d.field]: d.value });
          return true;
        }

        case 'update_route': {
          await Commands.updateRoute(d.route_id, { [d.field]: d.value });
          return true;
        }

        default:
          showToast(`Unknown task action: ${task.action}`, 'error');
          return false;
      }
    } catch (err) {
      console.error('Task execution failed:', err);
      showToast('Task failed: ' + err.message, 'error');
      return false;
    }
  }

  // --- Actions ---

  async function handleAction(id, action) {
    if (action === 'delete') {
      if (!confirm('Delete this suggestion permanently?')) return;
      try {
        const res = await fetch(API_URL + '?id=' + id, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        suggestions = suggestions.filter(s => s.id !== id);
        renderList();
        updateBadge();
        showToast('Suggestion deleted', 'success');
      } catch (err) {
        showToast('Failed to delete suggestion', 'error');
      }
      return;
    }

    // When approving a suggestion with an extracted task, execute the task
    if (action === 'approved') {
      const suggestion = suggestions.find(s => s.id === id);
      if (suggestion && suggestion.task) {
        const confirmed = confirm(
          `Apply this task?\n\n"${suggestion.task.summary}"\n\nThis will modify the transit data.`
        );
        if (!confirmed) return;

        const success = await executeTask(suggestion.task);
        if (!success) {
          showToast('Task execution failed — suggestion not approved', 'error');
          return;
        }
        // Task executed successfully, mark as completed directly
        action = 'completed';
      }
    }

    // Status update (approved, dismissed, completed)
    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: action })
      });
      if (!res.ok) throw new Error('Update failed');

      const s = suggestions.find(s => s.id === id);
      if (s) s.status = action;
      renderList();
      updateBadge();

      const labels = { approved: 'approved', dismissed: 'dismissed', completed: 'marked as completed' };
      showToast('Suggestion ' + (labels[action] || action), 'success');
    } catch (err) {
      showToast('Failed to update suggestion', 'error');
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function showToast(msg, type) {
    if (typeof Notifications !== 'undefined' && Notifications.toast) {
      Notifications.toast(msg, type === 'error' ? 5000 : 2000);
    }
  }

  // --- Initial badge load ---
  // Load suggestion count on page load for the badge
  fetch(API_URL)
    .then(res => res.json())
    .then(data => {
      suggestions = data;
      updateBadge();
    })
    .catch(() => { /* silent fail on initial badge load */ });

})();
