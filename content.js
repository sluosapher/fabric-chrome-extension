chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractText') {
      textContent = extractTextContent();
      sendResponse({ text: textContent });
  }
});

function extractTextContent() {
    let textContent = '';
    // const elements = document.body.getElementsByTagName('*');
    const visibleElements = getVisibleText();
  
    // console.log('Extracting text from elements:', elements); // Debugging line to check extracted elements
    console.log('Extracting text from visible elements:', visibleElements); // Debugging line to check extracted elements
    
    for (let element of visibleElements) {
      // // exclude element of ads, style, script, meta, format, and other trivial elements
      // if (element.tag === 'SCRIPT' || element.tagName === 'STYLE' || element.tagName === 'META' || element.tagName === 'LINK' || element.tagName === 'HEAD') {
      //     continue;
      // }
      if (element.text) {
        textContent += element.text + '\\n';
      }
    }
  
    console.log('Extracted text content:', textContent); // Debugging line to check extracted text content
    
    return textContent;
  }
  
  function getVisibleText() {
    const results = [];
    
    // Process all elements that might contain text
    const textElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, td, th, a, span, div, label, button');
    
    textElements.forEach(element => {
      // Skip if the element contains other text elements (to avoid duplication)
      if (containsTextElements(element)) {
        return;
      }
      
      // Get the text content
      const text = element.textContent.trim();
      if (!text) return;
      
      // Check if the element is visible
      if (isVisible(element)) {
        results.push({
          text: text,
          tag: element.tagName.toLowerCase(),
          path: getElementPath(element)
        });
      }
    });
    
    return results;
  }
  
  function isVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    
    return !(
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      element.offsetWidth === 0 ||
      element.offsetHeight === 0
    );
  }

  function containsTextElements(element) {
    return element.querySelector('h1, h2, h3, h4, h5, h6, p, li, td, th, a, span, div, label, button');
  }
  
  function getElementPath(element) {
    let path = '';
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let selector = element.nodeName.toLowerCase();
      if (element.id) {
        selector += '#' + element.id;
      } else if (element.className) {
        selector += '.' + element.className.replace(/\s+/g, '.');
      }
      path = selector + (path ? ' > ' + path : '');
      element = element.parentNode;
    }
    return path;
  }