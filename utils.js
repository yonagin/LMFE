//uitils.js

export function isMobileDevice() {
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = /android|iphone|ipad|ipod|blackberry|windows phone/i;
  return mobileKeywords.test(userAgent) || window.innerWidth <= 768; 
}

export function autoResize(textarea) {
  const MAX_LINES = 8;
  const LINE_HEIGHT = 28;
  textarea.style.height = 'auto';
  const contentHeight = textarea.scrollHeight + 8;
  const maxHeight = LINE_HEIGHT * MAX_LINES + 28;

  // 应用限制高度
  textarea.style.height = Math.min(contentHeight, maxHeight) + 'px';
  textarea.scrollTop = textarea.scrollHeight;
}

export function processContent(content,contentDiv) {
  const codeRegex = /```[\s\S]*?```|`[^`]*`/g;
  let lastIndex = 0;
  let result = '';
  let match;

  while ((match = codeRegex.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    result += `<span class="text">${escapeHTML(before)}</span>`;
    result += `<pre class="code">${escapeHTML(match[0])}</pre>`;
    lastIndex = match.index + match[0].length;
  }

  addCopyButton('.code');

  result += `<span class="text">${escapeHTML(content.slice(lastIndex))}</span>`;

  // 处理行内公式（圆括号）
  result = result.replace(/\\\((.*?)\\\)/g, '<span class="math">\\($1\\)</span>');

  // 处理行内公式（美元符号）
  result = result.replace(/\$(.*?)\$/g, '<span class="math">$1</span>');

  // 处理块级公式（方括号）
  result = result.replace(/\\\[((?:\\[^]|[^\\])*?)\\\]/gs, '<span class="math display">\\[$1\\]</span>');

  // 处理块级公式（双美元符号）
  result = result.replace(/\$\$(.*?)\$\$/g, '<span class="math display">$1</span>');

  contentDiv.innerHTML = result;
  const mathElements = contentDiv.querySelectorAll('.math');
  mathElements.forEach(el => MathJax.typesetPromise([el]));
  addCopyButton('.math.display');

}

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function addCopyButton(selector) {
  document.querySelectorAll(selector).forEach(container => {
    if (container.querySelector('.copy-btn')) return;  // 避免重复添加

    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.innerHTML = '<i class="far fa-copy"></i>' ;
    btn.title = "复制内容";
    container.appendChild(btn);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // 克隆容器节点并移除按钮
      const cleanClone = container.cloneNode(true);
      cleanClone.querySelector('.copy-btn')?.remove();
      const content = cleanClone.textContent.trim();
      copyToClipboard(content).then(() => {
        btn.textContent = '✓';
        setTimeout(() => btn.innerHTML = '<i class="far fa-copy"></i>', 1500);
      });
    });
  });
}

async function copyToClipboard(text) {
  try {
    await AndroidBridge.copyToClipboard(text);
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      console.error('用户未授予剪贴板权限');
    } else {
      console.error('未知错误:', err);
    }
  }
}


