// 全局变量
var opMenuItem = []; // 使用 var 或 let/const 保持一致性，这里用 var 以匹配原有代码
var currentText = ""; // 显式声明

// 新增：用于存储从 chrome.storage 读取的设置
let SCRIPT_FEATURE_ENABLED = false; // 功能是否开启，默认为 false
let SCRIPT_SERVER_ADDRESS = 'http://127.0.0.1:5273/'; // 服务器地址的默认值

// 辅助函数：移除 URL 末尾的斜杠
function removeTrailingSlash(url) {
  if (typeof url === 'string' && url.endsWith('/')) {
    return url.slice(0, -1);
  }
  return url;
}

// 初始化扩展
function initializeExtension() {
  console.log("%c Chrome扩展: 内容脚本已加载 %c " + new Date().toLocaleTimeString() + " on page: " + window.location.href,
    "background: #4285f4; color: white; padding: 2px 4px; border-radius: 4px;",
    "color: #4285f4;");

  // 添加内容脚本加载标记
  window.__contentScriptLoaded = true;

  // 从 chrome.storage 加载设置
  chrome.storage.sync.get(['featureEnabled', 'serverAddress'], function (data) {
    SCRIPT_FEATURE_ENABLED = data.featureEnabled === undefined ? false : data.featureEnabled; // 默认不开启
    SCRIPT_SERVER_ADDRESS = removeTrailingSlash(data.serverAddress || 'http://127.0.0.1:5273');
    // 下面这行日志会显示 SCRIPT_FEATURE_ENABLED 初始化后的状态
    console.log(`内容脚本: 初始化设置 - 功能开启: ${SCRIPT_FEATURE_ENABLED}, 服务器地址: ${SCRIPT_SERVER_ADDRESS}`);
    if (SCRIPT_FEATURE_ENABLED) {
      console.log("内容脚本: 功能已启用。文本选择处理将激活。");
      getOpNames();
    } else {
      console.log("内容脚本: 功能已禁用。文本选择处理将不会激活。");
    }
  });
}

// 监听来自 chrome.storage 的设置更改
chrome.storage.onChanged.addListener(function (changes, namespace) {
  if (namespace === 'sync') {
    let settingsUpdated = false;
    if (changes.featureEnabled) {
      SCRIPT_FEATURE_ENABLED = changes.featureEnabled.newValue;
      console.log(`内容脚本: 'featureEnabled' 设置已更新为: ${SCRIPT_FEATURE_ENABLED}`);
      if(SCRIPT_FEATURE_ENABLED) {
        console.log("内容脚本: 功能已启用。文本选择处理将激活。");
        getOpNames(); // 重新获取操作名称列表
      }
      settingsUpdated = true;
    }
    if (changes.serverAddress) {
      SCRIPT_SERVER_ADDRESS = removeTrailingSlash(changes.serverAddress.newValue);
      console.log(`内容脚本: 'serverAddress' 设置已更新为: ${SCRIPT_SERVER_ADDRESS}`);
      settingsUpdated = true;
    }
    if (settingsUpdated) {
      if (SCRIPT_FEATURE_ENABLED) {
        console.log("内容脚本: 功能当前已启用。");
      } else {
        console.log("内容脚本: 功能当前已禁用。");
      }
    }
  }
});

// 确保 initializeExtension 在 DOM 加载后正确执行
if (document.readyState === 'loading') {
  // 文档仍在加载，等待 DOMContentLoaded 事件
  document.addEventListener('DOMContentLoaded', function () {
    console.log("内容脚本: DOMContentLoaded 事件触发，调用 initializeExtension。");
    // 在调用 initializeExtension 之前，确保 SCRIPT_SERVER_ADDRESS 的初始值也被处理
    SCRIPT_SERVER_ADDRESS = removeTrailingSlash(SCRIPT_SERVER_ADDRESS);
    initializeExtension();
  });
} else {
  // DOMContentLoaded 事件已触发，或者文档已完成加载 (interactive or complete)
  console.log(`内容脚本: DOM 已准备就绪 (readyState: ${document.readyState})，直接调用 initializeExtension。`);
  // 在调用 initializeExtension 之前，确保 SCRIPT_SERVER_ADDRESS 的初始值也被处理
  SCRIPT_SERVER_ADDRESS = removeTrailingSlash(SCRIPT_SERVER_ADDRESS);
  initializeExtension();
}
// initializeExtension(); // 移除此处的重复调用

// 添加鼠标选择文本监听功能
document.addEventListener('mouseup', function (event) {
  if (!SCRIPT_FEATURE_ENABLED) {
    // 如果功能未开启，则不执行任何操作
    // console.log("内容脚本: 功能已禁用，跳过文本选择处理。");
    return;
  }

  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectedText && selectedText.length > 1) {
    let x, y;
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const clientRects = range.getClientRects();

      if (clientRects.length > 0) {
        // 获取最后一个 DOMRect，它代表选中文本的最后一行/部分
        const lastRect = clientRects[clientRects.length - 1];
        x = lastRect.right; // 最后一个文本片段的右边界
        y = lastRect.bottom; // 最后一个文本片段的下边界
      } else {
        // Fallback: 如果 getClientRects() 为空 (理论上不应发生，因为 rangeCount > 0)
        // 则使用整个选区的边界框，这可能在某些边缘情况下不太精确
        const rect = range.getBoundingClientRect();
        x = rect.right;
        y = rect.bottom;
      }
    } else {
      // Fallback to mouse position if range is not available
      x = event.clientX;
      y = event.clientY;
    }
    console.log(`内容脚本: 检测到文本选择 (长度: ${selectedText.length})，功能已启用。显示操作框于 (${x}, ${y})。`);
    showCharCountBox(selectedText, x, y);
  }
});

// 显示操作按钮浮窗
function showCharCountBox(text, x, y) {

  currentText = text;

  // 移除可能已存在的浮窗
  const existingBox = document.getElementById('plugin-char-count-box');
  if (existingBox) {
    existingBox.style.left = `${x + 10}px`;
    existingBox.style.top = `${y + 10}px`;
    // 确保浮窗可见
    existingBox.style.opacity = '1';
  }
  else {
    if (opMenuItem.length === 0) {
      console.log("内容脚本: 没有操作菜单项可用，无法显示浮窗。");
      return;
    }

    // 创建浮窗元素
    const box = document.createElement('div');
    box.id = 'plugin-char-count-box';
    box.style.left = `${x + 10}px`;
    box.style.top = `${y + 10}px`;
    // 添加到页面
    document.body.appendChild(box);
    // 添加事件阻止冒泡
    box.addEventListener('mouseup', (e) => {
      e.stopPropagation();
    });

    box.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    // 添加操作按钮
    opMenuItem.forEach(operation => {
      const button = document.createElement('button');
      button.textContent = operation;
      button.className = 'plugin-op-button';

      // 点击事件处理
      button.addEventListener('click', (e) => {
        console.log("点击操作按钮:", operation);
        // 阻止事件冒泡
        e.stopPropagation();

        sendToServerCallLLM(currentText, operation);
        box.style.opacity = '0';
        setTimeout(() => {
          if (box.parentNode) {
            box.parentNode.removeChild(box);
          }
        }, 300);
      });

      box.appendChild(button);
    });
    // 确保新创建的浮窗可见
    setTimeout(() => box.style.opacity = '1', 0); // 延迟以确保CSS过渡生效

    // 添加鼠标离开事件，使浮窗消失
    box.addEventListener('mouseleave', () => {
      box.style.opacity = '0';
      setTimeout(() => {
        if (box.parentNode) {
          box.parentNode.removeChild(box);
        }
      }, 300);
    });

    // 如果用户点击页面其他地方，也使浮窗消失
    document.addEventListener('mousedown', function documentClickHandler(e) {
      if (!box.contains(e.target)) {
        box.style.opacity = '0';
        setTimeout(() => {
          if (box.parentNode) {
            box.parentNode.removeChild(box);
          }
        }, 300);
        document.removeEventListener('mousedown', documentClickHandler);
      }
    });
  }
}

// 发送选中文本和操作到后台脚本
function sendToServerCallLLM(text, operation) {
  // 注意：SCRIPT_SERVER_ADDRESS 在这里被记录，但实际的HTTP请求通常在 background.js 中进行。
  // 如果 background.js 需要此地址，它也应该从 chrome.storage.sync 中获取。
  console.log(`内容脚本: 发送文本到后台。操作: ${operation}, 使用服务器地址 (供参考): ${SCRIPT_SERVER_ADDRESS}`);
  chrome.runtime.sendMessage({
    type: "PROCESS_TEXT",
    payload: {
      text: text,
      opName: operation,
      serverAddress: SCRIPT_SERVER_ADDRESS
    }
  }, response => {
    if (chrome.runtime.lastError) {
      console.error("内容脚本: 发送文本到后台失败:", chrome.runtime.lastError.message);
      return;
    }

    if (response) {
      console.log("内容脚本: 后台响应:", response);
      // 处理后台响应
      if (response.status === "success") {
        showResultFloatingBox(response.aiResponse, false, false, operation);
      } else {
        showResultFloatingBox("", false, true, operation);
      }
    }
  });
}

// 发送选中文本和操作到后台脚本
function getOpNames() {

  // 请求服务器获取操作名称列表
  console.log("内容脚本: 请求服务器获取操作名称列表");
  chrome.runtime.sendMessage({
    type: "REQUEST_INITIAL_MENU_LIST",
    payload: {
      serverAddress: SCRIPT_SERVER_ADDRESS
    }
  }, response => {
    if (chrome.runtime.lastError) {
      console.error("内容脚本: 发送文本到后台失败:", chrome.runtime.lastError.message);
      return;
    }

    if (response) {
      if (response != null && response.length > 0) {
        console.log("内容脚本: 后台响应:", response);
        opMenuItem = response;
        console.log("内容脚本: 更新操作菜单项:", opMenuItem);
      }
      else {
        console.log("内容脚本: 后台响应为空或无效");
      }
    }
  });
}

// showFloatingBox 函数
function showResultFloatingBox(content, isLoading = false, isJson = false, operation = '') {
  console.log("显示浮动框:", content, isLoading, isJson, operation);

  let resultBox = document.getElementById('plugin-result-box');
  let titleTextElement;
  let contentAreaElement;

  if (resultBox) {
    // 结果框已存在，尝试复用
    console.log("复用已存在的结果框");

    // 如果存在待处理的移除操作 (例如，用户点击了关闭按钮，但尚未到移除时间)
    // 则取消该移除操作
    if (resultBox._removeTimeoutId) {
      clearTimeout(resultBox._removeTimeoutId);
      resultBox._removeTimeoutId = null;
      console.log("已取消待处理的移除操作。");
    }

    // 确保结果框可见
    resultBox.style.opacity = '1';
    resultBox.style.display = 'flex'; // 确保其 display 状态正确 (CSS 中为 flex)

    // 获取标题和内容区域的引用
    titleTextElement = resultBox.querySelector('.plugin-result-title span');
    contentAreaElement = resultBox.querySelector('.plugin-result-content');

    // 如果必要的子元素不存在，说明结果框结构可能已损坏，则移除并重新创建
    if (!titleTextElement || !contentAreaElement) {
      console.warn("结果框内部结构不完整，将重新创建。");
      if (resultBox.parentNode) { // 确保它仍在DOM中再移除
        resultBox.remove();
      }
      resultBox = null; // 置为null，以便后续逻辑创建新的
    }
  }

  if (!resultBox) {
    // 结果框不存在或需要重新创建
    console.log("创建新的结果框");
    resultBox = document.createElement('div');
    resultBox.id = 'plugin-result-box';
    // 新创建的框初始透明，用于后续的淡入动画
    resultBox.style.opacity = '0';

    // 创建标题区域
    const titleBar = document.createElement('div');
    titleBar.className = 'plugin-result-title';
    titleBar.style.cursor = 'move'; // 添加拖拽手势

    titleTextElement = document.createElement('span');
    // 标题文本将在后续公共逻辑中设置
    titleBar.appendChild(titleTextElement);

    // 创建关闭按钮
    const closeButton = document.createElement('button');
    closeButton.className = 'plugin-result-close';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => {
      resultBox.style.opacity = '0';
      // 如果之前有定时器，先清除
      if (resultBox._removeTimeoutId) {
        clearTimeout(resultBox._removeTimeoutId);
      }
      // 设置定时器，在动画结束后移除元素
      resultBox._removeTimeoutId = setTimeout(() => {
        if (resultBox && resultBox.parentNode) { // 再次检查，确保元素存在且在DOM中
          resultBox.remove();
        }
        resultBox._removeTimeoutId = null; // 清除存储的ID
      }, 300); // 300ms 与 CSS 过渡时间一致
    });
    titleBar.appendChild(closeButton);
    resultBox.appendChild(titleBar);

    // 实现拖拽功能
    let isDragging = false;
    let offsetX, offsetY;

    const dragMouseDown = (e) => {
      if (e.button !== 0) return; // 只响应鼠标左键
      isDragging = true;
      const rect = resultBox.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;

      // 确保从CSS的right定位切换到left/top定位
      resultBox.style.left = rect.left + 'px';
      resultBox.style.top = rect.top + 'px';
      resultBox.style.right = 'auto'; // 取消right定位的影响

      document.addEventListener('mousemove', dragMouseMove);
      document.addEventListener('mouseup', dragMouseUp);
      e.preventDefault(); // 阻止默认行为，如文本选择
    };

    const dragMouseMove = (e) => {
      if (!isDragging) return;
      let newX = e.clientX - offsetX;
      let newY = e.clientY - offsetY;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const boxWidth = resultBox.offsetWidth;
      const boxHeight = resultBox.offsetHeight;
      if (newX < 0) newX = 0;
      if (newY < 0) newY = 0;
      if (newX + boxWidth > viewportWidth) newX = viewportWidth - boxWidth;
      if (newY + boxHeight > viewportHeight) newY = viewportHeight - boxHeight;
      resultBox.style.left = newX + 'px';
      resultBox.style.top = newY + 'px';
    };

    const dragMouseUp = (e) => {
      if (isDragging && e.button === 0) { // 确保是对应的拖拽操作且为左键释放
        isDragging = false;
        document.removeEventListener('mousemove', dragMouseMove);
        document.removeEventListener('mouseup', dragMouseUp);
        e.stopPropagation(); // 阻止冒泡，以免影响其他mouseup监听器
      }
    };
    titleBar.addEventListener('mousedown', dragMouseDown);

    // 创建内容区域
    contentAreaElement = document.createElement('div');
    contentAreaElement.className = 'plugin-result-content';
    resultBox.appendChild(contentAreaElement);

    // 添加到页面
    document.body.appendChild(resultBox);

    // 为整个结果框添加 mousedown 事件阻止冒泡
    // 这可以防止点击结果框内部时，触发 document 级别的 mousedown 监听器 (例如关闭其他浮窗的监听器)
    resultBox.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    // 延迟后设置透明度为1，以触发CSS淡入动画
    setTimeout(() => {
      resultBox.style.opacity = '1';
    }, 10); // 短暂延迟确保浏览器渲染初始的 opacity:0
  }

  // --- 公共逻辑：更新标题和内容 (无论是新创建的还是复用的) ---

  // 更新标题文本
  if (titleTextElement) {
    titleTextElement.textContent = operation ? `${operation} 结果` : '处理结果';
  } else {
    // 此情况理论上不应发生，因为 titleTextElement 要么被找到，要么被创建
    console.error("错误：无法找到标题文本元素进行更新。");
  }

  // 更新内容区域
  if (contentAreaElement) {
    contentAreaElement.innerHTML = ''; // 清空先前的内容
    contentAreaElement.style.whiteSpace = ''; // 重置 white-space，以防影响HTML内容

    if (isLoading) {
      contentAreaElement.innerHTML = '<div class="plugin-result-loading">处理中...</div>';
    } else if (isJson) { // 根据原逻辑，isJson 为 true 时显示错误
      contentAreaElement.innerHTML = '<div class="plugin-result-error">处理失败，请稍后重试</div>';
    } else {
      // 显示正常结果内容
      if (typeof content === 'string') {
        // 尝试检测内容是否为HTML (简单检测)
        if (content.trim().startsWith('<') && content.trim().endsWith('>') && content.includes('</')) {
          contentAreaElement.innerHTML = content; // 直接设置为HTML
        } else {
          // 普通文本，保留换行并进行HTML转义
          contentAreaElement.style.whiteSpace = 'pre-wrap'; // 使用CSS保留换行和空格
          contentAreaElement.style.wordBreak = 'break-word'; // 允许长单词换行
          contentAreaElement.textContent = content; // textContent 会自动转义HTML特殊字符
        }
      } else {
        // 如果 content 不是字符串 (例如对象或数组)，则格式化为JSON显示
        contentAreaElement.style.whiteSpace = 'pre-wrap';
        contentAreaElement.style.wordBreak = 'break-all';
        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(content, null, 2);
        contentAreaElement.appendChild(pre);
      }
    }
  } else {
    // 此情况理论上不应发生
    console.error("错误：无法找到内容区域元素进行更新。");
  }

  return resultBox;
}

console.log("内容脚本: 开始执行了 (文件末尾)");