// ============================================================
// Sawari - Landing Page Script
// Groq-powered chatbot for transit Q&A
// Author: Zenith Kandel — https://zenithkandel.com.np
// License: MIT
// ============================================================

(function () {
  'use strict';

  const chatLog = document.getElementById('chat-log');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');

  const SYSTEM_PROMPT = `You are Sawari, a friendly and knowledgeable assistant for Kathmandu Valley's public transit system in Nepal.

You know about:
- Bus routes operated by Sajha Yatayat, Nepal Yatayat, Mahanagar Yatayat, and dozens of micro/tempo operators
- Major stops and landmarks: Ratnapark, Lagankhel, Kalanki, Chabahil, Koteshwor, New Baneshwor, Balkhu, Jamal, Budhanilkantha, Thankot, etc.
- Fare structure: Regular minimum Rs 20 for first 5 km, then Rs 1.80/km (bus) or Rs 2.35/km (micro). Students/elderly get Rs 15 minimum (about 25% discount). All fares round to nearest Rs 5.
- General Kathmandu geography and transit tips
- The Ringroad loop, major arterial roads, and how the transit network connects the three cities (Kathmandu, Lalitpur/Patan, Bhaktapur)

Be helpful, concise, and warm. If you're not sure about a specific route, say so honestly — suggest the user check the Sawari navigator for exact routing. Keep answers under 150 words unless the question warrants more detail.

Important: You are on the Sawari landing page. If users want to actually plan a journey with a map, suggest they click "Open Navigator" or go to the main page at index.php.`;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function addMessage(role, text) {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.innerHTML = role === 'assistant'
      ? '<i class="fa-solid fa-bus"></i>'
      : '<i class="fa-solid fa-user"></i>';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');

    msg.appendChild(avatar);
    msg.appendChild(bubble);
    chatLog.appendChild(msg);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function addTypingIndicator() {
    const msg = document.createElement('div');
    msg.className = 'chat-msg assistant';
    msg.id = 'typing-indicator';

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.innerHTML = '<i class="fa-solid fa-bus"></i>';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-typing';
    bubble.innerHTML = '<span></span><span></span><span></span>';

    msg.appendChild(avatar);
    msg.appendChild(bubble);
    chatLog.appendChild(msg);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function removeTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }

  async function sendMessage(userText) {
    addMessage('user', userText);
    messages.push({ role: 'user', content: userText });

    chatInput.value = '';
    chatInput.disabled = true;
    chatSend.disabled = true;
    addTypingIndicator();

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: messages.slice(-12), // keep context manageable
          max_tokens: 500,
          temperature: 0.6
        })
      });

      removeTypingIndicator();

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';

      messages.push({ role: 'assistant', content: reply });
      addMessage('assistant', reply);
    } catch (err) {
      removeTypingIndicator();
      console.error('Chat error:', err);
      addMessage('assistant', 'Sorry, something went wrong. Please try again in a moment.');
    } finally {
      chatInput.disabled = false;
      chatSend.disabled = false;
      chatInput.focus();
    }
  }

  chatForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    sendMessage(text);
  });

  // Focus input on load
  chatInput.focus();
})();
