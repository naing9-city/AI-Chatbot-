(() => {
  'use strict';

  // === DOM References ===
  const widget      = document.getElementById('chat-widget');
  const launcherIcon = document.getElementById('launcher-icon');
  const chatInner   = document.getElementById('chat-inner');
  const btnClose    = document.getElementById('btn-close');
  const btnRefresh  = document.getElementById('btn-refresh');
  const btnSend     = document.getElementById('btn-send');
  const btnEmoji    = document.getElementById('btn-emoji');
  const msgInput    = document.getElementById('msg-input');
  const msgContainer = document.getElementById('messages-container');

  // Modal References
  const authModal    = document.getElementById('auth-modal');
  const authForm     = document.getElementById('auth-form');
  const staffIdInput = document.getElementById('staff-id-input');
  const authErrorMsg = document.getElementById('auth-error-msg');
  const authErrorText = document.getElementById('auth-error-text');
  const btnModalClose = document.getElementById('btn-modal-close');
  const btnModalCancel = document.getElementById('btn-modal-cancel');

  let isOpen = false;
  let session_id = crypto.randomUUID();
  let currentMode = 'public';

  // Test Staff Accounts
  const VALID_STAFF_IDS = {
    'TPM1001': 'Naing Naing',
    'TPM2222': 'Yusuf'
  };
  let authenticatedStaff = null; // null or { id: 'TPM1001', name: 'Naing Naing' }

  // === Modal Helper Functions ===
  function openAuthModal() {
    if (!authModal) return;
    authModal.classList.remove('hidden');
    staffIdInput.value = '';
    authErrorMsg.classList.add('hidden');
    setTimeout(() => staffIdInput.focus(), 100);
  }

  function closeAuthModal() {
    if (!authModal) return;
    authModal.classList.add('hidden');
    authErrorMsg.classList.add('hidden');
  }

  if (authModal) {
    btnModalClose?.addEventListener('click', closeAuthModal);
    btnModalCancel?.addEventListener('click', closeAuthModal);

    authForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const enteredId = staffIdInput.value.trim().toUpperCase();

      if (!enteredId) {
        authErrorText.textContent = "Please enter a valid Staff ID.";
        authErrorMsg.classList.remove('hidden');
        staffIdInput.focus();
        return;
      }

      if (VALID_STAFF_IDS[enteredId]) {
        authenticatedStaff = {
          id: enteredId,
          name: VALID_STAFF_IDS[enteredId]
        };
        closeAuthModal();
        switchMode('employee');
      } else {
        authErrorText.textContent = `Invalid Staff ID "${enteredId}". Access denied. Please enter a valid Staff ID.`;
        authErrorMsg.classList.remove('hidden');
        staffIdInput.focus();
      }
    });
  }

  // === Mode Switching Logic ===
  function switchMode(mode) {
    if (mode === 'public' || mode === 'employee') {
      currentMode = mode;
      switchModeUI();
      resetChat();
    }
  }

  function switchModeUI() {
    const btnModePublic = document.getElementById('btn-mode-public');
    const btnModeEmployee = document.getElementById('btn-mode-employee');
    if (!btnModePublic || !btnModeEmployee) return;

    if (currentMode === 'public') {
      btnModePublic.classList.add('bg-white', 'text-primary', 'shadow-sm');
      btnModePublic.classList.remove('text-gray-500', 'hover:text-gray-800');
      btnModeEmployee.classList.remove('bg-white', 'text-primary', 'shadow-sm');
      btnModeEmployee.classList.add('text-gray-500', 'hover:text-gray-800');
    } else {
      btnModeEmployee.classList.add('bg-white', 'text-primary', 'shadow-sm');
      btnModeEmployee.classList.remove('text-gray-500', 'hover:text-gray-800');
      btnModePublic.classList.remove('bg-white', 'text-primary', 'shadow-sm');
      btnModePublic.classList.add('text-gray-500', 'hover:text-gray-800');
    }
  }

  const btnModePublic = document.getElementById('btn-mode-public');
  const btnModeEmployee = document.getElementById('btn-mode-employee');

  if (btnModePublic) {
    btnModePublic.addEventListener('click', (e) => {
      e.stopPropagation();
      authenticatedStaff = null; // Require re-authentication upon returning to Employee Mode
      if (currentMode !== 'public') switchMode('public');
    });
  }

  if (btnModeEmployee) {
    btnModeEmployee.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentMode !== 'employee') {
        if (authenticatedStaff) {
          switchMode('employee');
        } else {
          openAuthModal();
        }
      }
    });
  }

  // === Morphing: Open Widget ===
  function openWidget() {
    if (isOpen) return;
    isOpen = true;
    widget.classList.remove('collapsed');
    widget.classList.add('expanded');
    setTimeout(() => {
      msgInput.focus();
      scrollToBottom();
    }, 450);
  }

  // === Morphing: Close Widget ===
  function closeWidget() {
    if (!isOpen) return;
    isOpen = false;
    widget.classList.remove('expanded');
    widget.classList.add('collapsed');
  }

  // === Event: Click launcher to open ===
  widget.addEventListener('click', (e) => {
    if (!isOpen) {
      e.stopPropagation();
      openWidget();
    }
  });

  // === Event: Close button ===
  btnClose.addEventListener('click', (e) => {
    e.stopPropagation();
    closeWidget();
  });

  // === Event: Refresh button ===
  btnRefresh.addEventListener('click', (e) => {
    e.stopPropagation();
    resetChat();
  });

  // === Scroll to bottom with smooth behavior ===
  function scrollToBottom() {
    requestAnimationFrame(() => {
      msgContainer.scrollTo({
        top: msgContainer.scrollHeight,
        behavior: 'smooth'
      });
    });
  }

  // === Helper: Escape HTML ===
  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;'
      }[tag] || tag)
    );
  }

  // === Helper: Format bot response for readable rendering & HTML tables ===
  function formatResponse(text) {
    if (!text) return '';

    // 1. Normalize line endings
    let str = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Clean up any double-encoded entity artifacts like &39; or &#39;
    str = str.replace(/&(?:amp;)?#?39;/g, "'").replace(/&(?:amp;)?quot;/g, '"');

    // 2. Extract markdown tables into protected placeholders
    const tables = [];
    const tableRegex = /((?:^[ \t]*\|.*\|[ \t]*\n?)+)/gm;
    str = str.replace(tableRegex, (match) => {
      const lines = match.trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return match;

      let headerLine = lines[0];
      let bodyLines = lines.slice(1);

      if (bodyLines.length > 0 && /^[ \t]*\|?[\s:\-]+\|[\s:\-|+]+/m.test(bodyLines[0])) {
        bodyLines = bodyLines.slice(1);
      }

      const parseCells = (line) => line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const headers = parseCells(headerLine);
      const rows = bodyLines.map(parseCells);

      let tableHtml = '<div class="overflow-x-auto my-3 rounded-xl border border-gray-200 shadow-sm">';
      tableHtml += '<table class="w-full text-xs text-left border-collapse bg-white">';
      tableHtml += '<thead class="bg-primary text-white font-semibold uppercase text-[10px] tracking-wider"><tr>';
      headers.forEach(h => {
        tableHtml += `<th class="px-3.5 py-2.5 border-b border-primary/20">${escapeHTML(h)}</th>`;
      });
      tableHtml += '</tr></thead><tbody class="divide-y divide-gray-100 text-gray-700 font-normal">';

      rows.forEach((r, idx) => {
        const bg = idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white';
        tableHtml += `<tr class="${bg} hover:bg-blue-50/40 transition-colors">`;
        r.forEach(c => {
          tableHtml += `<td class="px-3.5 py-2">${escapeHTML(c)}</td>`;
        });
        tableHtml += '</tr>';
      });

      tableHtml += '</tbody></table></div>';
      const placeholder = `___TABLE_PLACEHOLDER_${tables.length}___`;
      tables.push(tableHtml);
      return placeholder;
    });

    // 3. Escape HTML on text
    let safe = escapeHTML(str);

    // 4. Strip markdown symbols (*, #, `, _, ~) from text
    safe = safe.replace(/[*#`_~]+/g, '');

    // 5. Wrap numbered list items (1. 2. 3.) on newlines
    safe = safe.replace(/^(\d+\.\s)/gm, '<br>$1');

    // 6. Convert double newlines to paragraph breaks
    safe = safe.replace(/\n{2,}/g, '<br><br>');

    // 7. Convert remaining newlines
    safe = safe.replace(/\n/g, '<br>');

    // 8. Clean up extra breaks
    safe = safe.replace(/^(<br>)+/, '');

    // 9. Links
    safe = safe.replace(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g, '<a href="mailto:$1" class="text-accent hover:underline font-semibold">$1</a>');
    safe = safe.replace(/\b(\d{2,3}-\d{7,8})\b/g, '<a href="tel:$1" class="text-accent hover:underline font-semibold">$1</a>');

    // 10. Restore tables
    tables.forEach((tblHtml, idx) => {
      const ph = `___TABLE_PLACEHOLDER_${idx}___`;
      safe = safe.replace(ph, tblHtml);
    });

    return safe;
  }

  // === Helper: Get Current Time ===
  function getCurrentTime() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes}${ampm}`;
  }

  // === Create a message element ===
  function createMessage(text, type, source = null) {
    // type: 'user' | 'bot' | 'typing'
    const wrapper = document.createElement('div');
    wrapper.classList.add('msg-spring');
    const timeStr = getCurrentTime();

    if (type === 'user') {
      wrapper.classList.add('flex', 'justify-end');
      wrapper.innerHTML = `
        <div class="max-w-[75%] min-w-0">
          <div class="bg-primary text-white text-sm leading-relaxed px-4 py-3 rounded-2xl rounded-br-sm shadow-sm break-words">
            ${escapeHTML(text)}
          </div>
          <span class="text-[10px] text-gray-400 mt-1 block text-right pr-1 select-none">${timeStr}</span>
        </div>
      `;
    } else if (type === 'bot') {
      wrapper.classList.add('flex', 'items-start', 'gap-2.5');

      let sourceCardHtml = '';
      if (source && source.title) {
        sourceCardHtml = `
          <div class="mb-2.5 pb-2 border-b border-gray-300/70 text-xs">
            <div class="flex items-center gap-1.5 font-semibold text-gray-700 select-none">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>${escapeHTML(source.title)}</span>
            </div>
            <div class="text-[11px] text-gray-500 mt-1 pl-5 select-none">
              Doc No: ${escapeHTML(source.doc_no || 'IT-SEC-01')} • Revision ${escapeHTML(source.revision || '01')} • Effective ${escapeHTML(source.effective || '1 Jan 2024')}
            </div>
          </div>
        `;
      }

      let sourceCardFooterHtml = '';
      if (source && source.written_by) {
        sourceCardFooterHtml = `
          <div class="mt-3 pt-2.5 border-t border-gray-300/70 text-[10px] select-none">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <span class="block text-[9px] uppercase font-bold tracking-wider text-gray-400">Written By</span>
                <span class="font-semibold text-gray-700 block leading-tight">${escapeHTML(source.written_by)}</span>
                <span class="text-[9.5px] text-gray-500 block leading-tight mt-0.5">${escapeHTML(source.written_title || '')}</span>
              </div>
              <div>
                <span class="block text-[9px] uppercase font-bold tracking-wider text-gray-400">Reviewed By</span>
                <span class="font-semibold text-gray-700 block leading-tight">${escapeHTML(source.reviewed_by)}</span>
                <span class="text-[9.5px] text-gray-500 block leading-tight mt-0.5">${escapeHTML(source.reviewed_title || '')}</span>
              </div>
              <div>
                <span class="block text-[9px] uppercase font-bold tracking-wider text-gray-400">Approved By</span>
                <span class="font-semibold text-gray-700 block leading-tight">${escapeHTML(source.approved_by)}</span>
                <span class="text-[9.5px] text-gray-500 block leading-tight mt-0.5">${escapeHTML(source.approved_title || '')}</span>
              </div>
            </div>
          </div>
        `;
      }

      wrapper.innerHTML = `
        <!-- Chat head (company logo) -->
        <div class="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border border-gray-200 bg-white shadow-sm">
          <img src="assets/tpb.jpeg" alt="Bot avatar" class="w-full h-full object-cover" />
        </div>
        <div class="max-w-[75%] min-w-0">
          <!-- Small title name -->
          <span class="text-[11px] font-semibold text-gray-500 mb-1 block select-none">Bot from TPB</span>
          <div class="bot-message bg-gray-100 text-gray-800 text-sm px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
            ${sourceCardHtml}
            ${formatResponse(text)}
            ${sourceCardFooterHtml}
          </div>
          <!-- Time -->
          <span class="text-[10px] text-gray-400 mt-1 block pl-1 select-none">${timeStr}</span>
        </div>
      `;

    } else if (type === 'typing') {
      wrapper.classList.add('flex', 'items-start', 'gap-2.5');
      wrapper.id = 'typing-indicator';
      wrapper.innerHTML = `
        <!-- Chat head (company logo) -->
        <div class="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border border-gray-200 bg-white shadow-sm">
          <img src="assets/tpb.jpeg" alt="Bot avatar" class="w-full h-full object-cover" />
        </div>
        <div class="max-w-[75%] min-w-0">
          <!-- Typing... text with smooth animation -->
          <span class="text-[11px] font-semibold text-gray-500 mb-1 block animate-pulse select-none">Typing...</span>
          <div class="bg-gray-100 text-gray-800 text-sm leading-relaxed px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm inline-flex items-center gap-1">
            <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
          </div>
        </div>
      `;
    }

    return wrapper;
  }

  // === Add message to container ===
  function addMessage(text, type, source = null) {
    const el = createMessage(text, type, source);
    msgContainer.appendChild(el);
    // Trigger reflow for animation
    void el.offsetHeight;
    scrollToBottom();
    return el;
  }

  // === Simulated bot responses ===
  const botResponses = {
    '🏢 What is TPB?': "Tradewinds Plantation Berhad (TPB) is one of Malaysia's leading oil palm and rubber plantation companies, established on 4 October 2005. It manages 74 estates and 10 palm oil mills across Malaysia, with a total landbank of approximately 156,138 hectares.",
    '📅 How many leave days can I take?': "Annual leave entitlement is based on your employment terms and length of service. Leave applications must be submitted at least 5 working days in advance and require approval from your Immediate Superior and Head of Division/Department. You may accumulate unused leave up to a maximum of one year's entitlement, subject to management approval.",
    '🎯 What is the company vision?': "To be the global leader in integrated agribusiness.",
  };

  // === Helper: Send message to backend ===
  async function sendMessageToBackend(text) {
    const typingIndicator = addMessage('', 'typing');

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: text,
            session_id: session_id,
            mode: currentMode
          })
        }
      );

      const data = await response.json();

      if (typingIndicator) {
        typingIndicator.remove();
      }

      addMessage(data.answer, 'bot', data.source || null);

    } catch (error) {
      console.error(error);

      if (typingIndicator) {
        typingIndicator.remove();
      }

      addMessage(
        "Sorry, I am unable to connect to the AI server at the moment.",
        'bot'
      );
    }
  }

  // === Handle quick reply clicks ===
  async function handleQuickReply(btn) {
    const text = btn.textContent.trim();
    addMessage(text, 'user');

    // Disable quick reply buttons briefly
    const allQr = msgContainer.querySelectorAll('.qr-btn');
    allQr.forEach(b => { b.disabled = true; b.style.opacity = '0.5'; b.style.pointerEvents = 'none'; });

    await sendMessageToBackend(text);

    // Re-enable quick reply buttons
    allQr.forEach(b => { b.disabled = false; b.style.opacity = '1'; b.style.pointerEvents = 'auto'; });
  }

  // Expose to inline onclick handlers
  window.handleQuickReply = handleQuickReply;

  // === Handle user text send (FastAPI + Ollama integration) ===
  async function sendUserMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    msgInput.value = '';
    addMessage(text, 'user');
    await sendMessageToBackend(text);
  }

  btnSend.addEventListener('click', (e) => {
    e.stopPropagation();
    sendUserMessage();
  });

  msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendUserMessage();
    }
  });

  // Prevent clicks inside chat from collapsing
  chatInner.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // === Reset Chat ===
  function resetChat() {
    // Generate new session ID on reset
    session_id = crypto.randomUUID();

    // Clear all messages
    msgContainer.innerHTML = '';

    // Re-add initial messages with spring animation and soft lines
    const dateBadge = document.createElement('div');
    dateBadge.className = 'flex items-center justify-center gap-4 my-2 msg-spring';
    dateBadge.style.animationDelay = '0.05s';
    dateBadge.innerHTML = `
      <div class="h-[1px] bg-gray-200 flex-1"></div>
      <span class="text-xs text-gray-400 font-medium select-none whitespace-nowrap">October 15, 2024</span>
      <div class="h-[1px] bg-gray-200 flex-1"></div>
    `;
    msgContainer.appendChild(dateBadge);

    const botMsg = document.createElement('div');
    botMsg.className = 'flex items-start gap-2.5 msg-spring';
    botMsg.style.animationDelay = '0.15s';
    
    let greeting = "";
    let qrButtonsHtml = "";
    
    if (currentMode === 'public') {
      greeting = "Hello! 👋 Welcome to Tradewinds Plantation Berhad. How can I assist you today? Feel free to choose from the options below or type your question.";
      qrButtonsHtml = `
        <button class="qr-btn btn-tactile bg-primary text-white text-sm font-medium px-4 py-2 rounded-full" onclick="handleQuickReply(this)">🏢 What is TPB?</button>
        <button class="qr-btn btn-tactile bg-white text-gray-700 text-sm font-medium px-4 py-2 rounded-full border border-gray-300" onclick="handleQuickReply(this)">🎯 What is the company vision?</button>
        <button class="qr-btn btn-tactile bg-white text-gray-700 text-sm font-medium px-4 py-2 rounded-full border border-gray-300" onclick="handleQuickReply(this)">📞 How can I contact Tradewinds?</button>
      `;
    } else {
      const staffName = authenticatedStaff ? authenticatedStaff.name : 'Employee';
      greeting = `Hello ${staffName}! 👋 Welcome to Tradewinds Plantation Berhad Employee Portal. 💼 I am your Employee Support Assistant. How can I assist you today? Feel free to ask about IT security polices, internal policies or leave applications.`;
      qrButtonsHtml = `
        <button class="qr-btn btn-tactile bg-primary text-white text-sm font-medium px-4 py-2 rounded-full" onclick="handleQuickReply(this)">💻 What is the IT security compliance policy?</button>
        <button class="qr-btn btn-tactile bg-gray-100 text-gray-700 text-sm font-medium px-4 py-2 rounded-full border border-gray-300" onclick="handleQuickReply(this)">💼 What is the employment policy?</button>
        <button class="qr-btn btn-tactile bg-white text-gray-700 text-sm font-medium px-4 py-2 rounded-full border border-gray-300" onclick="handleQuickReply(this)">🏦 Tell me about the leave application process.</button>
      `;
    }

    const timeStr = getCurrentTime();
    botMsg.innerHTML = `
      <!-- Chat head (company logo) -->
      <div class="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border border-gray-200 bg-white shadow-sm">
        <img src="assets/tpb.jpeg" alt="Bot avatar" class="w-full h-full object-cover" />
      </div>
      <div class="max-w-[75%] min-w-0">
        <!-- Small title name -->
        <span class="text-[11px] font-semibold text-gray-500 mb-1 block select-none">Bot from TPB</span>
        <div class="bot-message bg-gray-100 text-gray-800 text-sm px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
          ${greeting}
        </div>
        <!-- Time -->
        <span class="text-[10px] text-gray-400 mt-1 block pl-1 select-none">${timeStr}</span>
      </div>
    `;
    msgContainer.appendChild(botMsg);

    const qrRow = document.createElement('div');
    qrRow.className = 'flex flex-wrap gap-2 pl-0 msg-spring';
    qrRow.innerHTML = qrButtonsHtml;
    msgContainer.appendChild(qrRow);

    scrollToBottom();
  }

  // === Emoji picker (simple inline toggle) ===
  const emojis = ['😊', '👍', '🙏', '❤️', '🎉', '👋', '✅', '🔥'];
  let emojiPickerOpen = false;
  let emojiPicker = null;

  btnEmoji.addEventListener('click', (e) => {
    e.stopPropagation();
    if (emojiPickerOpen) {
      closeEmojiPicker();
    } else {
      openEmojiPicker();
    }
  });

  function openEmojiPicker() {
    emojiPickerOpen = true;
    emojiPicker = document.createElement('div');
    emojiPicker.id = 'emoji-picker';
    emojiPicker.className = 'absolute bottom-14 left-3 bg-white border border-gray-200 rounded-2xl shadow-lg p-2 flex gap-1 flex-wrap msg-spring';
    emojiPicker.style.zIndex = '10';
    emojiPicker.style.width = '200px';

    emojis.forEach((em) => {
      const btn = document.createElement('button');
      btn.className = 'btn-tactile text-xl w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors duration-150';
      btn.textContent = em;
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        msgInput.value += em;
        msgInput.focus();
        closeEmojiPicker();
      });
      emojiPicker.appendChild(btn);
    });

    // Append relative to the input bar area
    chatInner.style.position = 'relative';
    chatInner.appendChild(emojiPicker);
  }

  function closeEmojiPicker() {
    emojiPickerOpen = false;
    const picker = document.getElementById('emoji-picker');
    if (picker) picker.remove();
  }

  // Close emoji picker on outside click
  document.addEventListener('click', () => {
    if (emojiPickerOpen) closeEmojiPicker();
  });

})();
