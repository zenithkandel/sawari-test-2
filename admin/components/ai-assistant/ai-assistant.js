// ============================================================
// Sawari Admin - AI Assistant Component
// Supports: Natural language commands + natural language search
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
            }
            // Action buttons from AI response
            const actionBtn = e.target.closest('.ai-action-btn');
            if (actionBtn) executeAction(actionBtn);
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

You can respond in two ways:

1. ANSWER QUESTIONS: If the user asks a question about the data (queries, statistics, "which routes", "how many", "show me"), answer directly in plain text. Be concise.

2. EXECUTE COMMANDS: If the user wants to create, update, or delete an entity, return a JSON action block. Return ONLY the JSON with no other text. Format:
{"action":"create","entity":"stop","data":{"name":"...","lat":27.7,"lng":85.3}}
{"action":"create","entity":"vehicle","data":{"name":"...","lat":27.7,"lng":85.3,"routeId":null,"speed":28}}
{"action":"create","entity":"obstruction","data":{"name":"...","lat":27.7,"lng":85.3,"radiusMeters":40,"severity":"medium"}}
{"action":"update","entity":"stop","id":5,"data":{"name":"New Name"}}
{"action":"update","entity":"vehicle","id":3,"data":{"routeId":2,"moving":true}}
{"action":"delete","entity":"stop","id":5}
{"action":"select","entity":"stops","id":5}

RULES:
- For creating stops: always require a name. If no coordinates given, use a central Kathmandu default (27.7172, 85.3240). The "entity" value for API is singular: stop, route, vehicle, obstruction.
- For creating vehicles: require name, default speed 28, default lat/lng to Kathmandu center.
- For select actions: use plural entity type (stops, routes, vehicles, obstructions).
- When the user says "show me" or "find" a specific entity, use the select action.
- For updates: only include fields that need to change in "data".
- For deletes: confirm the entity name in your response before the JSON.
- Do NOT create routes via JSON (routes require a multi-step builder). Instead, instruct the user to use the Route Builder.
- If unsure about coordinates for a well-known Kathmandu location, make your best estimate.
- Keep responses concise.`;
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
                    max_tokens: 800,
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

            // Check if reply is a JSON action
            const actionMatch = reply.match(/^\s*\{[\s\S]*\}\s*$/);
            if (actionMatch) {
                try {
                    const action = JSON.parse(actionMatch[0]);
                    renderAction(action);
                } catch {
                    // Not valid JSON, render as text
                    addMessage('assistant', formatReply(reply));
                }
            } else {
                // Check if reply contains embedded JSON (text + JSON)
                const embeddedJson = reply.match(/\{[^{}]*"action"\s*:\s*"[^"]+?"[^{}]*\}/);
                if (embeddedJson) {
                    const textPart = reply.replace(embeddedJson[0], '').trim();
                    if (textPart) addMessage('assistant', formatReply(textPart));
                    try {
                        const action = JSON.parse(embeddedJson[0]);
                        renderAction(action);
                    } catch {
                        // Fallback: just show the text
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

    function renderAction(action) {
        const { action: act, entity, id, data } = action;
        let html = '';

        if (act === 'create') {
            html = `<div class="ai-action-card">
                <div class="ai-action-header"><i class="fa-solid fa-plus"></i> Create ${esc(entity)}</div>
                <div class="ai-action-details">${Object.entries(data || {}).map(([k, v]) =>
                    `<span><strong>${esc(k)}:</strong> ${esc(String(v))}</span>`
                ).join('')}</div>
                <div class="ai-action-buttons">
                    <button class="ai-action-btn confirm" data-action="create" data-entity="${esc(entity)}" data-payload='${esc(JSON.stringify(data))}'>
                        <i class="fa-solid fa-check"></i> Create
                    </button>
                    <button class="ai-action-btn cancel" onclick="this.closest('.ai-action-card').style.opacity='0.4'">
                        <i class="fa-solid fa-xmark"></i> Skip
                    </button>
                </div>
            </div>`;
        } else if (act === 'update') {
            const current = Store.findEntity(entity + 's', id);
            const name = current ? current.name : `#${id}`;
            html = `<div class="ai-action-card">
                <div class="ai-action-header"><i class="fa-solid fa-pen"></i> Update ${esc(entity)} "${esc(name)}"</div>
                <div class="ai-action-details">${Object.entries(data || {}).map(([k, v]) =>
                    `<span><strong>${esc(k)}:</strong> ${esc(String(v))}</span>`
                ).join('')}</div>
                <div class="ai-action-buttons">
                    <button class="ai-action-btn confirm" data-action="update" data-entity="${esc(entity)}" data-id="${id}" data-payload='${esc(JSON.stringify(data))}'>
                        <i class="fa-solid fa-check"></i> Update
                    </button>
                    <button class="ai-action-btn cancel" onclick="this.closest('.ai-action-card').style.opacity='0.4'">
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
                    <button class="ai-action-btn cancel" onclick="this.closest('.ai-action-card').style.opacity='0.4'">
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
        const payload = btn.dataset.payload ? JSON.parse(btn.dataset.payload) : null;
        const card = btn.closest('.ai-action-card');

        btn.disabled = true;
        btn.innerHTML = '<div class="loading-spinner small"></div>';

        try {
            if (action === 'create') {
                const cmdMap = { stop: 'createStop', vehicle: 'createVehicle', obstruction: 'createObstruction' };
                const fn = cmdMap[entity];
                if (!fn) throw new Error(`Cannot create ${entity} via AI. Use the UI.`);
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
