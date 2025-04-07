// filepath: c:\Users\sluo6\projects\fabric-chrome-extension\content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractText') {
      console.log('Extracting text content...');
      let textContent = '';
      const elements = document.body.getElementsByTagName('*');

      for (let element of elements) {
          if (['SCRIPT', 'STYLE', 'META', 'LINK', 'HEAD'].includes(element.tagName)) {
              continue;
          }
          if (element.innerText) {
              textContent += element.innerText + '\n';
          }
      }

      console.log('Extracted text content:', textContent);
      sendResponse({ text: textContent });
  }
});