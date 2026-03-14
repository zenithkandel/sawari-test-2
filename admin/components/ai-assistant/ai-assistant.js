// ============================================================
// Sawari Admin - AI Assistant Component
// Supports: Natural language commands + natural language search
// Author: Zenith Kandel — https://zenithkandel.com.np
// License: MIT
// ============================================================
const AiAssistant = (() => {
    const modal = document.getElementById('ai-modal');
    const chatLog = document.getElementById('ai-chat-log');
    const chatInput = document.getElementById('ai-chat-input');
    const sendBtn = document.getElementById('ai-chat-send');
    let busy = false;

    function init() {
        document.getElementById('btn-ai-assistant').addEventListener('click', open);
        document.getElementById('ai-modal-close').addEventListener('click', close);
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

        sendBtn.addEventListener('click', send);
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            if (e.key === 'Escape') close();
        });

        // Example buttons
        chatLog.addEventListener('click', (e) => {
            const btn = e.target.closest('.ai-example-btn');
            if (btn) {
                chatInput.value = btn.textContent;
                send();
                return;
            }
            // Action buttons from AI response (only confirm buttons, not cancel)
            const actionBtn = e.target.closest('.ai-action-btn.confirm');
            if (actionBtn && !actionBtn.disabled) executeAction(actionBtn);
        });

        // Keyboard shortcut: Ctrl+I
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                e.preventDefault();
                if (modal.style.display === 'flex') close(); else open();
            }
        });
    }

    function open() {
        modal.style.display = 'flex';
        setTimeout(() => chatInput.focus(), 50);
    }

    function close() {
        modal.style.display = 'none';
    }

    function esc(str) {
        return String(str ?? '').replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
        );
    }

    function tryParseJson(str) {
        try { return JSON.parse(str); } catch { return null; }
    }

    function tryExtractJson(text) {
        // Try array first (multiple actions)
        const arrStart = text.indexOf('[');
        if (arrStart !== -1) {
            let depth = 0;
            for (let i = arrStart; i < text.length; i++) {
                if (text[i] === '[') depth++;
                else if (text[i] === ']') depth--;
                if (depth === 0) {
                    const candidate = text.substring(arrStart, i + 1);
                    const result = tryParseJson(candidate);
                    if (Array.isArray(result) && result.length > 0 && result[0].action) return result;
                }
            }
        }
        // Fall back to single object
        const start = text.indexOf('{');
        if (start === -1) return null;
        let depth = 0;
        for (let i = start; i < text.length; i++) {
            if (text[i] === '{') depth++;
            else if (text[i] === '}') depth--;
            if (depth === 0) {
                const candidate = text.substring(start, i + 1);
                const result = tryParseJson(candidate);
                if (result && result.action) return result;
            }
        }
        return null;
    }

    // Store payloads by ID to avoid HTML-encoding issues in data attributes
    const payloadStore = {};
    let payloadCounter = 0;

    function addMessage(role, html) {
        // Remove welcome message on first interaction
        const welcome = chatLog.querySelector('.ai-welcome');
        if (welcome) welcome.remove();

        const div = document.createElement('div');
        div.className = `ai-msg ai-msg-${role}`;
        div.innerHTML = html;
        chatLog.appendChild(div);
        chatLog.scrollTop = chatLog.scrollHeight;
        return div;
    }

    function buildSystemContext() {
        const stops = Store.get('stops');
        const routes = Store.get('routes');
        const vehicles = Store.get('vehicles');
        const obstructions = Store.get('obstructions');

        // Build a concise summary of current data for the AI
        const stopList = stops.map(s => `  id:${s.id} "${s.name}" (${s.lat.toFixed(4)},${s.lng.toFixed(4)})`).join('\n');
        const routeList = routes.map(r => {
            const stopNames = r.stopIds.map(sid => {
                const s = stops.find(st => st.id === sid);
                return s ? s.name : `#${sid}`;
            }).join(' -> ');
            const vCount = vehicles.filter(v => v.routeId === r.id).length;
            return `  id:${r.id} "${r.name}" stops:[${stopNames}] vehicles:${vCount} rating:${r.ratingAverage || 0}`;
        }).join('\n');
        const vehicleList = vehicles.map(v => {
            const rName = v.routeId ? (routes.find(r => r.id === v.routeId)?.name || `route#${v.routeId}`) : 'unassigned';
            return `  id:${v.id} "${v.name}" route:"${rName}" moving:${v.moving} speed:${v.speed} rating:${v.ratingAverage || 0}`;
        }).join('\n');
        const obsList = obstructions.map(o =>
            `  id:${o.id} "${o.name}" severity:${o.severity} active:${o.active} radius:${o.radiusMeters}m`
        ).join('\n');

        return `You are an AI assistant for the Sawari transit admin dashboard in Kathmandu, Nepal.

CURRENT DATA:
Stops (${stops.length}):
${stopList || '  (none)'}

Routes (${routes.length}):
${routeList || '  (none)'}

Vehicles (${vehicles.length}):
${vehicleList || '  (none)'}

Obstructions (${obstructions.length}):
${obsList || '  (none)'}

ENTITY RELATIONSHIPS (CRITICAL):
- stops are standalone entities. They must exist BEFORE they can be used in a route.
- routes reference stops via "stopIds" (an array of stop IDs). ALL stop IDs in a route MUST already exist in the stops list.
- vehicles reference routes via "routeId". The route MUST already exist before assigning a vehicle to it.
- obstructions are standalone entities with no dependencies.

Dependency chain: stops → routes → vehicles
- To add a NEW stop to an EXISTING route: the stop must already exist. If it doesn't, you must create the stop FIRST, then tell the user to confirm the creation before the route can be updated (since the new stop's ID is assigned by the server).
- To create a vehicle on a route: the route must already exist.
- You CANNOT reference an entity that doesn't exist yet in the CURRENT DATA above.

You can respond in two ways:

1. ANSWER QUESTIONS: If the user asks a question about the data (queries, statistics, "which routes", "how many", "show me"), answer directly in plain text. Be concise.

2. EXECUTE COMMANDS: If the user wants to create, update, or delete entities, return JSON action(s).

For a SINGLE action, return just the JSON object:
{"action":"create","entity":"stop","data":{"name":"...","lat":27.7,"lng":85.3}}

For MULTIPLE actions that can all execute independently (all referenced IDs already exist), return a JSON array:
[{"action":"create","entity":"stop","data":{"name":"Stop A","lat":27.71,"lng":85.32}},{"action":"create","entity":"stop","data":{"name":"Stop B","lat":27.72,"lng":85.33}}]

Action formats:
{"action":"create","entity":"stop","data":{"name":"...","lat":27.7,"lng":85.3}}
{"action":"create","entity":"vehicle","data":{"name":"...","lat":27.7,"lng":85.3,"routeId":null,"speed":28}}
{"action":"create","entity":"obstruction","data":{"name":"...","lat":27.7,"lng":85.3,"radiusMeters":40,"severity":"medium"}}
{"action":"update","entity":"stop","id":5,"data":{"name":"New Name"}}
{"action":"update","entity":"route","id":2,"data":{"stopIds":[1,3,5,7]}}
{"action":"update","entity":"vehicle","id":3,"data":{"routeId":2,"moving":true}}
{"action":"delete","entity":"stop","id":5}
{"action":"select","entity":"stops","id":5}

RULES:
- For creating stops: name, lat, and lng are REQUIRED. If no coordinates given, default to Kathmandu center (27.7172, 85.3240). The "entity" value for API is singular: stop, route, vehicle, obstruction.
- For creating vehicles: name, lat, and lng are REQUIRED. Default speed 28, default lat/lng to Kathmandu center (27.7172, 85.3240). Always include lat and lng in the data.
- For select actions: use plural entity type (stops, routes, vehicles, obstructions).
- When the user says "show me" or "find" a specific entity, use the select action.
- For updates: only include fields that need to change in "data".
- For deletes: confirm the entity name in your response before the JSON.
- Do NOT create routes via JSON (routes require a multi-step builder). Instead, instruct the user to use the Route Builder.
- If unsure about coordinates for a well-known Kathmandu location, make your best estimate.
- Keep responses concise.
- IMPORTANT: When a user asks to do something that requires a dependency that doesn't exist yet (e.g., "add stop X to route Y" but stop X doesn't exist), you MUST break it into steps. First create the dependency (the stop), explain that the user needs to confirm it first, and then you'll update the route with the new stop's ID in a follow-up message.
- When updating a route's stopIds, always include ALL existing stopIds plus the new ones. Never replace the entire list unless the user explicitly asks to.
- When a user says "add stop X to route Y", check if stop X already exists in the CURRENT DATA. If it does, use its existing ID. If not, create it first.`;
    }

    async function send() {
        const text = chatInput.value.trim();
        if (!text || busy) return;

        if (!GROQ_API_KEY || GROQ_API_KEY === 'YOUR_GROQ_API_KEY_HERE') {
            Notifications.toast('Groq API key not configured in .env', 'error');
            return;
        }

        addMessage('user', esc(text));
        chatInput.value = '';

        const thinking = addMessage('assistant', '<div class="ai-thinking"><div class="loading-spinner small"></div> Thinking...</div>');
        busy = true;
        sendBtn.disabled = true;

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    max_tokens: 1200,
                    temperature: 0.1,
                    messages: [
                        { role: 'system', content: buildSystemContext() },
                        { role: 'user', content: text }
                    ]
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message || 'API error');

            const reply = data.choices?.[0]?.message?.content?.trim() || '';
            thinking.remove();

            // Strip markdown code fences if present
            const cleaned = reply.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

            // Try to parse as JSON action(s) — single object or array
            let parsed = tryParseJson(cleaned);
            if (parsed && renderActions(parsed)) {
                // Successfully rendered action(s)
            } else {
                // Check if reply contains embedded JSON within text
                const jsonMatch = reply.match(/[\[{][^}\]]*"action"\s*:/);
                if (jsonMatch) {
                    parsed = tryExtractJson(reply);
                    if (parsed) {
                        // Extract text around the JSON
                        const jsonStart = reply.indexOf(Array.isArray(parsed) ? '[' : '{');
                        const jsonEnd = Array.isArray(parsed)
                            ? reply.lastIndexOf(']') + 1
                            : reply.lastIndexOf('}') + 1;
                        const textBefore = reply.substring(0, jsonStart).replace(/```(?:json)?|```/gi, '').trim();
                        const textAfter = reply.substring(jsonEnd).replace(/```(?:json)?|```/gi, '').trim();
                        const textPart = [textBefore, textAfter].filter(Boolean).join('\n');
                        if (textPart) addMessage('assistant', formatReply(textPart));
                        renderActions(parsed);
                    } else {
                        addMessage('assistant', formatReply(reply));
                    }
                } else {
                    addMessage('assistant', formatReply(reply));
                }
            }
        } catch (err) {
            thinking.remove();
            addMessage('assistant', `<span class="ai-error-text"><i class="fa-solid fa-circle-xmark"></i> ${esc(err.message)}</span>`);
        } finally {
            busy = false;
            sendBtn.disabled = false;
            chatInput.focus();
        }
    }

    function formatReply(text) {
        // Simple markdown-like formatting
        return esc(text)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }

    function renderActions(parsed) {
        // Handle both single action objects and arrays of actions
        if (Array.isArray(parsed)) {
            if (parsed.length === 0 || !parsed[0].action) return false;
            parsed.forEach(a => renderAction(a));
            return true;
        }
        if (parsed && parsed.action) {
            renderAction(parsed);
            return true;
        }
        return false;
    }

    function renderAction(action) {
        const { action: act, entity, id, data } = action;
        let html = '';

        if (act === 'create') {
            const pid = ++payloadCounter;
            payloadStore[pid] = data;
            html = `<div class="ai-action-card">
                <div class="ai-action-header"><i class="fa-solid fa-plus"></i> Create ${esc(entity)}</div>
                <div class="ai-action-details">${Object.entries(data || {}).map(([k, v]) =>
                    `<span><strong>${esc(k)}:</strong> ${esc(String(v))}</span>`
                ).join('')}</div>
                <div class="ai-action-buttons">
                    <button class="ai-action-btn confirm" data-action="create" data-entity="${esc(entity)}" data-pid="${pid}">
                        <i class="fa-solid fa-check"></i> Create
                    </button>
                    <button class="ai-action-btn cancel" onclick="this.closest('.ai-action-card').style.opacity='0.4';this.closest('.ai-action-card').style.pointerEvents='none'">
                        <i class="fa-solid fa-xmark"></i> Skip
                    </button>
                </div>
            </div>`;
        } else if (act === 'update') {
            const pid = ++payloadCounter;
            payloadStore[pid] = data;
            const current = Store.findEntity(entity + 's', id);
            const name = current ? current.name : `#${id}`;
            html = `<div class="ai-action-card">
                <div class="ai-action-header"><i class="fa-solid fa-pen"></i> Update ${esc(entity)} "${esc(name)}"</div>
                <div class="ai-action-details">${Object.entries(data || {}).map(([k, v]) =>
                    `<span><strong>${esc(k)}:</strong> ${esc(String(v))}</span>`
                ).join('')}</div>
                <div class="ai-action-buttons">
                    <button class="ai-action-btn confirm" data-action="update" data-entity="${esc(entity)}" data-id="${id}" data-pid="${pid}">
                        <i class="fa-solid fa-check"></i> Update
                    </button>
                    <button class="ai-action-btn cancel" onclick="this.closest('.ai-action-card').style.opacity='0.4';this.closest('.ai-action-card').style.pointerEvents='none'">
                        <i class="fa-solid fa-xmark"></i> Skip
                    </button>
                </div>
            </div>`;
        } else if (act === 'delete') {
            const current = Store.findEntity(entity + 's', id);
            const name = current ? current.name : `#${id}`;
            html = `<div class="ai-action-card delete">
                <div class="ai-action-header"><i class="fa-solid fa-trash"></i> Delete ${esc(entity)} "${esc(name)}"</div>
                <div class="ai-action-buttons">
                    <button class="ai-action-btn confirm danger" data-action="delete" data-entity="${esc(entity)}" data-id="${id}">
                        <i class="fa-solid fa-check"></i> Delete
                    </button>
                    <button class="ai-action-btn cancel" onclick="this.closest('.ai-action-card').style.opacity='0.4';this.closest('.ai-action-card').style.pointerEvents='none'">
                        <i class="fa-solid fa-xmark"></i> Skip
                    </button>
                </div>
            </div>`;
        } else if (act === 'select') {
            // Immediately select and pan
            const pluralEntity = entity.endsWith('s') ? entity : entity + 's';
            Store.select(pluralEntity, id);
            LayerManager.panToEntity(pluralEntity, id);
            const current = Store.findEntity(pluralEntity, id);
            html = `<div class="ai-action-card selected">
                <div class="ai-action-header"><i class="fa-solid fa-crosshairs"></i> Selected: ${esc(current?.name || `#${id}`)}</div>
            </div>`;
        }

        if (html) addMessage('assistant', html);
    }

    async function executeAction(btn) {
        const action = btn.dataset.action;
        const entity = btn.dataset.entity;
        const id = btn.dataset.id ? parseInt(btn.dataset.id) : null;
        const pid = btn.dataset.pid;
        const payload = pid ? payloadStore[pid] : null;
        const card = btn.closest('.ai-action-card');

        btn.disabled = true;
        btn.innerHTML = '<div class="loading-spinner small"></div>';

        try {
            if (action === 'create') {
                const cmdMap = { stop: 'createStop', vehicle: 'createVehicle', obstruction: 'createObstruction' };
                const fn = cmdMap[entity];
                if (!fn) throw new Error(`Cannot create ${entity} via AI. Use the UI.`);
                // Ensure required defaults for vehicle/stop/obstruction
                if (entity === 'vehicle' || entity === 'stop' || entity === 'obstruction') {
                    if (payload.lat == null) payload.lat = 27.7172;
                    if (payload.lng == null) payload.lng = 85.3240;
                }
                await Commands[fn](payload);
                card.classList.add('done');
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Created';
                Notifications.toast(`${entity} "${payload.name}" created`, 'success');
            } else if (action === 'update') {
                const cmdMap = { stop: 'updateStop', route: 'updateRoute', vehicle: 'updateVehicle', obstruction: 'updateObstruction' };
                const fn = cmdMap[entity];
                if (!fn) throw new Error(`Cannot update ${entity}`);
                await Commands[fn](id, payload);
                card.classList.add('done');
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Updated';
                Notifications.toast(`${entity} #${id} updated`, 'success');
            } else if (action === 'delete') {
                const cmdMap = { stop: 'deleteStop', route: 'deleteRoute', vehicle: 'deleteVehicle', obstruction: 'deleteObstruction' };
                const fn = cmdMap[entity];
                if (!fn) throw new Error(`Cannot delete ${entity}`);
                await Commands[fn](id);
                card.classList.add('done');
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Deleted';
                Notifications.toast(`${entity} #${id} deleted`, 'success');
            }
        } catch (err) {
            btn.innerHTML = `<i class="fa-solid fa-xmark"></i> ${esc(err.message || 'Error')}`;
            btn.classList.add('errored');
        }
    }

    return { init, open, close };
})();
