storedMenuItems = []; // 存储菜单项的数组

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background收到消息:", message, sender);

  if (message.type === "REQUEST_INITIAL_MENU_LIST") { // 新增：处理来自content_script的菜单列表请求
    console.log("Background: 收到菜单列表请求 已有菜单项:", storedMenuItems);

    if (storedMenuItems && storedMenuItems.length > 0) {
      sendResponse(storedMenuItems); // 直接发送存储的菜单项      
    } else {
      serverAddress = message.payload.serverAddress;

      getOpNamesFromServer(serverAddress)
        .then(menuItems => {
          // 确保menuItems是一个数组
          if (Array.isArray(menuItems)) {
            console.log('成功获取菜单项:', menuItems);
            storedMenuItems = menuItems; // 修改：存储菜单项

            sendResponse(storedMenuItems); // 直接发送存储的菜单项
          } else {
            console.error('API返回的不是有效的菜单数组:', menuItems);
          }
        })
        .catch(error => {
          console.error('获取菜单列表失败:', error);
          sendResponse({ status: error.message });
        });
    }
    return true; // 表示将异步响应或已处理
  }

  if (message.type === "PROCESS_TEXT") {
    // 从background script发送请求到服务器
    const { opName, text, serverAddress } = message.payload;

    sendRequestToServer(serverAddress, opName, text)
      .then(result => {
        console.log('PROCESS_TEXT 从服务器返回的结果:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('Background发送请求失败:', error);
        sendResponse({ status: error.message });
      });

    // 返回true表示将异步发送响应
    return true;
  }
});

async function getOpNamesFromServer(serverAddress) {
  // 从服务器获取操作名称列表
  try {
    var url = serverAddress + '/api/Record/GetOpList';
    console.log('Background: 发送请求到服务器获取操作名称列表:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const menuItems = await response.json();
    console.log('成功获取菜单项:', menuItems);
    return menuItems;
  } catch (error) {
    console.error('获取菜单列表失败:', error);
    throw error;
  }
}

// 从background script发送请求到服务器
async function sendRequestToServer(serverAddress, opName, text) {
  try {
    // 检查参数是否有效
    if (!opName || !text) {
      console.error('Background: 无效的参数:', { opName, text });
      throw new Error(`缺少必要参数 ${!opName ? 'opName' : ''} ${!text ? 'text' : ''}`);
    }

    console.log('Background: 发送请求到服务器:', { opName, text });

    const url = serverAddress + '/api/Record/NewRecord';
    const requestBody = JSON.stringify({
      opName: opName,
      text: text
    });

    console.log('Background: 请求体:', requestBody);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody
    });

    const responseText = await response.text();
    console.log('Background: 服务器原始响应:', responseText);

    if (!response.ok) {
      throw new Error(`服务器响应错误: ${response.status}, ${responseText}`);
    }

    // 尝试将响应解析为JSON
    let jsonResult;
    try {
      jsonResult = JSON.parse(responseText);
    } catch (e) {
      console.warn('无法解析JSON响应，返回原始文本:', e);
      return responseText;
    }

    return jsonResult;
  } catch (error) {
    console.error('Background: 发送请求到服务器失败:', error);
    throw error;
  }
}
