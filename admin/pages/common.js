const API = '../../backend/handlers/api.php';

async function getAllData() {
  const [stops, routes, vehicles] = await Promise.all([
    fetch(`${API}?type=stops`).then((r) => r.json()),
    fetch(`${API}?type=routes`).then((r) => r.json()),
    fetch(`${API}?type=vehicles`).then((r) => r.json())
  ]);
  return { stops, routes, vehicles };
}

function routeName(routeId, routes) {
  return routes.find((r) => r.id === routeId)?.name || 'Unassigned';
}

function openPortalPage(src) {
  window.parent.postMessage({ type: 'portal:navigate', src }, '*');
}
