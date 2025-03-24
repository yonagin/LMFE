// api.js

// 获取模型列表
export async function getModels(BASE_URL, KEY) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...(KEY && { 'Authorization': `Bearer ${KEY}` })
    };

    const response = await fetch(`${BASE_URL}/v1/models`, { headers });
    const data = await response.json();
    return data.data.map(model => model?.id) || [];
  } catch (e) {
    console.error('获取模型列表失败:', e);
    return [];
  }
}

function parseStreamData(chunk) {
  // 流式数据通常以 "data: " 开头，后面是 JSON 字符串或 "[DONE]" 表示结束
  const lines = chunk.split('\n');
  const results = [];
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const jsonStr = line.slice(6).trim(); // 去除首尾空白
      if (jsonStr === '[DONE]') {
        // 跳过 "[DONE]"，表示流结束
        continue;
      }
      try {
        const data = JSON.parse(jsonStr);
        const content = data.choices?.[0]?.delta?.content;
        if (content) {
          results.push(content);
        }
      } catch (e) {
        console.error('解析 JSON 失败:', e, '无效的 JSON 字符串:', jsonStr);
      }
    }
  }
  return results;
}

// 发送聊天请求，支持流式输出
export function sendChatRequest(BASE_URL, KEY, messages, model, temperature, maxTokens, stream, abort, onChunk) {
  abort.controller = new AbortController();
  const url = `${BASE_URL}/v1/chat/completions`;
  const headers = {
    'Content-Type': 'application/json',
    ...(KEY && { 'Authorization': `Bearer ${KEY}` })
  };

  const body = JSON.stringify({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream
  });

  fetch(url, {
    method: 'POST',
    headers,
    body,
	signal: abort.controller.signal
  }).then(response => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    function read() {
      reader.read().then(({ done, value }) => {
        if (done) {
          onChunk(null); // 表示流结束
          return;
        }
        const chunk = decoder.decode(value);
        const contents = parseStreamData(chunk);
        for (const content of contents) {
          onChunk(content);
        }
        read();
      });
    }

    read();
  }).catch(e => {
    console.error('发送聊天请求失败:', e);
  });
}
