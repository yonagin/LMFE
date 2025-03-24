// app.js
import { getModels, sendChatRequest } from './api.js';
import { autoResize, isMobileDevice, processContent, addCopyButton } from './utils.js';

const apiEnd = document.getElementById('api-end');
const apiKey = document.getElementById('api-key');
const syspromptInput = document.getElementById('system-prompt');
const newConversationButton = document.getElementById('new-conversation');
const conversationItems = document.getElementById('conversation-items');
const modelSelect = document.getElementById('model-select');
const temperatureValue = document.getElementById('temperature-value');
const temperatureInput = document.getElementById('temperature-input');
const maxTokensValue = document.getElementById('maxtokens-value');
const maxTokensInput = document.getElementById('maxtokens-input');
const messagesDiv = document.getElementById('messages');
const input = document.getElementById('input');
const sendButton = document.getElementById('send');
const textarea = document.getElementById('input');
const inputArea = document.getElementById('input-area');
const charCounter = document.getElementById('char-counter');
const loadingSpinner = document.createElement('div');
const welcome = document.getElementById('welcome-message');

let BASE_URL = localStorage.getItem('api_end') || 'http://localhost:1234';
let KEY = localStorage.getItem('api_key') || null;
let currentConversationId = null;
let pendingId = null;
let conversations = JSON.parse(localStorage.getItem('conversations')) || {};
let currentModel = '';
let currentsysprompt = '';
let currentTemperature = 0.7;
let currentMaxTokens = 4096;
let isSend = true;
let abort = { controller: null };

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  const toggleConversationsBtn = document.getElementById('toggle-conversations');
  const toggleSettingsBtn = document.getElementById('toggle-settings');
  const conversationsList = document.getElementById('conversations-list');
  const savedIp = localStorage.getItem('api_end');
  const savedKey = localStorage.getItem('api_key');
  const settings = document.getElementById('settings');
  const keyboardHeightPercentage = 0.425;
  charCounter.textContent = `0`;
  const originalBottom = window.getComputedStyle(inputArea).bottom;

  if (isMobileDevice()) {
    textarea.addEventListener('focus', () => {
      inputArea.style.bottom = `${keyboardHeightPercentage * window.innerHeight}px`;
      setTimeout(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        });
        inputArea.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 300);
    });

    textarea.addEventListener('blur', () => {
      inputArea.style.bottom = originalBottom;
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });

    window.addEventListener('resize', () => {
      const currentHeight = window.innerHeight;
      if (currentHeight > initialHeight) {
        initialHeight = currentHeight;
      }
    });

    textarea.addEventListener('input', () => {
      charCounter.textContent = `${textarea.value.length}`;
      autoResize(textarea);
      if (textarea.scrollHeight > textarea.clientHeight) {
        textarea.scrollTop = textarea.scrollHeight;
      }
    });
  }

  apiEnd.addEventListener('change', () => {
    const newIp = apiEnd.value.trim();
    if (newIp) {
      localStorage.setItem('api_end', newIp);
      BASE_URL = newIp;
      loadModels(BASE_URL, KEY);
    }
  });

  apiKey.addEventListener('change', () => {
    const newKey = apiKey.value.trim();
    if (newKey) {
      localStorage.setItem('api_key', newKey);
      KEY = newKey;
      loadModels(BASE_URL, KEY);
    }
  });

  if (savedIp) apiEnd.value = savedIp;
  if (savedKey) apiKey.value = savedKey;

  modelSelect.addEventListener('change', (event) => {
    currentModel = event.target.value;
  });

  toggleConversationsBtn.addEventListener('click', () => {
    conversationsList.classList.toggle('hidden');
    settings.classList.add('hidden');
  });

  toggleSettingsBtn.addEventListener('click', () => {
    settings.classList.toggle('hidden');
    conversationsList.classList.add('hidden');
  });

  syspromptInput.addEventListener('input', () => {
    if (!currentConversationId) {
      newConversationButton.click();
    } else {
      const conv = conversations[currentConversationId];
      conv.messages[0] = { role: 'system', content: syspromptInput.value };
    }
  });

  temperatureInput.addEventListener('input', () => {
    currentTemperature = parseFloat(temperatureInput.value);
    temperatureValue.textContent = currentTemperature;
    const rangeWidth = temperatureInput.offsetWidth;
    const thumbPosition = 0.9 * (temperatureInput.value / temperatureInput.max) * rangeWidth;
    temperatureValue.style.left = `${thumbPosition}px`;
    conversation[currentConversationId].temperature = currentTemperature;
  });

  maxTokensInput.addEventListener('input', () => {
    currentMaxTokens = parseFloat(maxTokensInput.value);
    maxTokensValue.textContent = currentMaxTokens;
    const rangeWidth = maxTokensInput.offsetWidth;
    const thumbPosition = 0.9 * (maxTokensInput.value / maxTokensInput.max) * rangeWidth;
    maxTokensValue.style.left = `${thumbPosition}px`;
    conversation[currentConversationId].maxTokens = currentMaxTokens;
  });

  loadModels(BASE_URL, KEY);
  loadConversations();
  temperatureValue.textContent = temperatureInput.value;
  maxTokensValue.textContent = maxTokensInput.value;
});

// 加载模型列表
async function loadModels(BASE_URL, KEY) {
  const models = await getModels(BASE_URL, KEY);
  modelSelect.innerHTML = '';
  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    modelSelect.appendChild(option);
  });
  currentModel = models[0] || '';
}

// 加载对话列表
function loadConversations() {
  conversationItems.innerHTML = '';
  Object.entries(conversations).forEach(([id, conv]) => {
    const div = document.createElement('div');
    div.className = 'conversation-item';
    if (id === currentConversationId) {
      div.classList.add('selected');
    }
    const userInputs = conv.messages.filter(message => message.role === 'user')
      .map(message => message.content);
    const lastInput = userInputs.length > 0
      ? userInputs[userInputs.length - 1]
      : "新对话";
    div.innerHTML = `
      <span>${lastInput.substring(0, Math.min(lastInput.length, 15))}</span>
      <span class="delete-conversation" data-id="${id}">删除</span>
    `;
    div.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-conversation')) {
        deleteConversation(id);
      } else {
        selectConversation(id);
      }
    });
    conversationItems.appendChild(div);
  });
}

newConversationButton.addEventListener('click', () => {
  const id = Date.now().toString();
  conversations[id] = {
    name: `对话 ${Object.keys(conversations).length + 1}`,
    model: currentModel,
    temperature: currentTemperature,
    maxTokens: currentMaxTokens,
    messages: []
  };
  conversations[id].messages.push({ role: 'system', content: syspromptInput.value });
  selectConversation(id);
});

function selectConversation(id) {
  currentConversationId = id;
  const conv = conversations[id];
  currentModel = conv.model;
  const sysprompts = conv.messages.filter(message => message.role === 'system')
    .map(message => message.content);
  currentsysprompt = sysprompts[sysprompts.length - 1];
  currentTemperature = conv.temperature;
  currentMaxTokens = conv.maxTokens;
  modelSelect.value = currentModel;
  temperatureInput.value = currentTemperature;
  temperatureValue.textContent = currentTemperature;
  maxTokensInput.value = currentMaxTokens;
  maxTokensValue.textContent = currentMaxTokens;
  syspromptInput.value = currentsysprompt;
  stopStreaming(loadingSpinner);
  loadConversations();
  loadMessages();
}

function deleteConversation(id) {
  document.getElementById('Confirm').style.display = 'block';
  document.getElementById('overlay').style.display = 'block';
  pendingId = id;
  const yes = document.getElementById('yes');
  const no = document.getElementById('no');
  yes.onclick = () => {
    Confirm(true);
  }
  no.onclick = () => {
    Confirm(false);
  }
}

function Confirm(confirm) {
  document.getElementById('Confirm').style.display = 'none';
  document.getElementById('overlay').style.display = 'none';

  if (confirm && pendingId !== null) {
    delete conversations[pendingId];
    localStorage.setItem('conversations', JSON.stringify(conversations));
    if (currentConversationId === pendingId) {
      currentConversationId = null;
      messagesDiv.innerHTML = '';
    }
    loadConversations();
  }
  pendingId = null;
}

function loadMessages() {
  welcome.style.display = messagesDiv.children.length > 1 ? 'none' : 'block';
  messagesDiv.innerHTML = '';
  if (!currentConversationId) return;
  const messages = conversations[currentConversationId].messages;
  messages.forEach(msg => {
    if (msg.role !== 'system') {
      displayMessage(msg);
    }
  });
  addCopyButton('.main-content');
}

function displayMessage(msg) {
  const { role, content } = msg;
  const div = document.createElement('div');
  div.className = `${role}`;

  if (role === 'assistant') {
    const parts = content.split('</think>');
    const thinktext = parts[0];
    const maintext = parts[1] || parts[0];

    if (/^(\[think\]|<think>)/.test(thinktext) && thinktext.slice(7).trim()) {
      const thinkContainer = document.createElement('div');
      thinkContainer.className = `think-container ${msg.thinkCollapsed ? 'collapsed' : 'expanded'}`;
      thinkContainer.innerHTML = `
        <div class="think-header">
          <span class="think-title">🧠 思考中</span>
          <span class="toggle">▼</span>
        </div>
        <div class="think-content">${thinktext.slice(7).trim()}</div>
      `;
      thinkContainer.addEventListener('click', () => {
        thinkContainer.classList.toggle('collapsed');
        thinkContainer.classList.toggle('expanded');
        conversations[currentConversationId].messages.find(m => m === msg).thinkCollapsed = thinkContainer.classList.contains('collapsed');
        localStorage.setItem('conversations', JSON.stringify(conversations));
      });
      div.appendChild(thinkContainer);
    }

    if (!maintext.startsWith('<think>') && maintext.trim()) {
      const mainContent = document.createElement('div');
      mainContent.className = 'main-content';
      processContent(maintext.trim(), mainContent);
      div.appendChild(mainContent);
    }
  } else {
    div.innerHTML = content;
  }

  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// 发送消息
sendButton.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (isSend) {
    sendMessage();
    textarea.blur();
  } else {
    stopStreaming(loadingSpinner);
  }
});

sendButton.addEventListener('click', (e) => {
  if (isSend) {
    sendMessage();
    textarea.blur();
  } else {
    stopStreaming(loadingSpinner);
  }
});

input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
    textarea.blur();
  }
});

function sendMessage() {
  let thinkContainer = null;
  let thinkContentDiv = null;
  let mainContentDiv = null;
  let parts = null;
  let normalContent = '';
  let chunks = '';
  let index = 0;

  welcome.style.display = messagesDiv.children.length > 1 ? 'none' : 'block';

  if (!currentConversationId) {
    newConversationButton.click();
  }
  const content = input.value.trim();
  if (!content) return;
  const conv = conversations[currentConversationId];
  conv.model = currentModel;
  conv.temperature = currentTemperature;
  conv.maxTokens = currentMaxTokens;
  const msg = { role: 'user', content };
  conv.messages.push(msg);
  localStorage.setItem('conversations', JSON.stringify(conversations));
  displayMessage(msg);
  input.value = '';
  charCounter.textContent = `0`;
  autoResize(textarea);

  sendButton.classList.add('stop');

  const assistantMessage = document.createElement('div');
  assistantMessage.className = 'assistant';
  assistantMessage.style.direction = 'ltr';
  messagesDiv.appendChild(assistantMessage);

  loadingSpinner.className = 'loading-spinner';
  assistantMessage.appendChild(loadingSpinner);

  sendChatRequest(
    BASE_URL,
    KEY,
    conv.messages.map(msg => ({
      ...msg,
      content: msg.content.replace(/[\s\S]*?<\/think>/g, '')
    })),
    conv.model,
    conv.temperature,
    conv.maxTokens,
    true,
    abort,
    (chunk) => {
      if (chunk === null) {
        processContent(normalContent, mainContentDiv);
        addCopyButton('.main-content');
        resetSendButton();
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        chunks = '';
        return;
      }

      if (!index) {
        conv.messages.push({});
        index = conv.messages.length - 1;
        loadingSpinner.remove();
      }

      chunks += chunk;
      parts = chunks.slice(7).split('</think>');
      if (chunks.startsWith('<th')) {
        if (!thinkContainer && parts[0].trim()) {
          thinkContainer = document.createElement('div');
          thinkContainer.className = 'think-container collapsed';
          thinkContainer.innerHTML = `
            <div class="think-header">
              <span class="think-title">🧠 思考中</span>
              <span class="toggle">▼</span>
            </div>
            <div class="think-content"></div>
          `.trim().replace(/\n\s+/g, '');

          thinkContentDiv = thinkContainer.querySelector('.think-content');
          thinkContainer.addEventListener('click', () => {
            thinkContainer.classList.toggle('collapsed');
            thinkContainer.classList.toggle('expanded');
          });
          assistantMessage.appendChild(thinkContainer);
        }
        if (thinkContentDiv) {
          thinkContentDiv.textContent = parts[0].trim();
        }

        if (chunks.includes('</think>')) {
          chunks = chunks.replace(/<think>/g, '[think]');
        }
      } else {
        if (chunks.includes('[think]')) {
          normalContent = parts[1].trim();
        } else {
          normalContent = chunks.trim();
        }
        if (!mainContentDiv) {
          mainContentDiv = document.createElement('div');
          mainContentDiv.className = 'main-content';
          assistantMessage.appendChild(mainContentDiv);
        }
        mainContentDiv.textContent = normalContent;
      }

      conv.messages[index] = {
        role: 'assistant',
        content: chunks,
        thinkCollapsed: true
      };
      localStorage.setItem('conversations', JSON.stringify(conversations));
    }
  );
  isSend = false;
  loadConversations();
}

function stopStreaming(loadingSpinner) {
  if (abort.controller) {
    abort.controller.abort();
  }
  loadingSpinner.remove();
  resetSendButton();
}

function resetSendButton() {
  sendButton.classList.remove('stop');
  isSend = true;
  abort.controller = null;
}
