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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractText') {
    const text = extractTextContent();
    sendResponse({ text });
  }
});
