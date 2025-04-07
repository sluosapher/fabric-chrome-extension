function checkAndPromptForConfig() {
  chrome.storage.local.get(['apiKey', 'apiUrl','modelName'], (result) => {
    console.log('Stored API configurations:', result); // Debugging line to check stored credentials
    if (!result.apiKey || !result.apiUrl || !result.modelName) {
      console.log('API configurations not set. Opening options page for input.');
      chrome.runtime.openOptionsPage(); // Opens the extension's options page
    } 
  });
}

function extractTextContent() {
  let textContent = '';
  const elements = document.body.getElementsByTagName('*');

  console.log('Extracting text from elements:', elements); // Debugging line to check extracted elements
  
  for (let element of elements) {
    // exclude element of ads, style, script, meta, format, and other trivial elements
    if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE' || element.tagName === 'META' || element.tagName === 'LINK' || element.tagName === 'HEAD') {
        continue;
    }
    if (element.innerText) {
      textContent += element.innerText + '\\n';
    }
  }

  console.log('Extracted text content:', textContent); // Debugging line to check extracted text content
  
  return textContent;
}

// Remove the call from the onInstalled listener
chrome.runtime.onInstalled.addListener(() => {
  console.log('Fabric Extension installed.');
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendToLLM') {
    const { systemPrompt, UserPrompt } = request.data;
    chrome.storage.local.get(['apiKey', 'apiUrl', 'modelName'], (result) => {
      console.log('Stored API configurations:', result); // Debugging line to check stored credentials
      if (!result.apiKey || !result.apiUrl || !result.modelName) {
        sendResponse({ success: false, error: 'API configurations not set.' });
        return;
      }

      fetch(result.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.apiKey}`
        },
        body: JSON.stringify({
          model: result.modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: UserPrompt }
          ],
          max_tokens: 300,
        })
      })
      .then(response => response.json())
      .then(data => {
        console.log('LLM response:', data); // Debugging line to check LLM response
        const message = data.choices[0].message.content;
        console.log('LLM message:', message); // Debugging line to check LLM message
        sendResponse({ success: true, result: message });
      })
      .catch(error => {
        console.error('Error:', error);
        sendResponse({ success: false, error: error.message });
      });
    });

    return true; // Indicates that the response will be sent asynchronously
  }

  if (request.action === 'checkConfig') {
    checkAndPromptForConfig();
  }

  if (request.action === 'extractText') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'extractText' }, (response) => {
                sendResponse(response);
            });
        } else {
            sendResponse({ error: 'No active tab found' });
        }
    });
    return true; // Indicates that the response will be sent asynchronously
}

});
