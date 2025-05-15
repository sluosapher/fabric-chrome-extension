// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.js');

// Function to check if the current page is a PDF
function isPDF() {
  return document.contentType === 'application/pdf' || 
         window.location.href.toLowerCase().endsWith('.pdf');
}

// Function to parse page ranges
function parsePageRanges(pageRangeStr, maxPages) {
  if (!pageRangeStr || pageRangeStr.trim() === '') {
    return Array.from({ length: maxPages }, (_, i) => i + 1);
  }

  const pages = new Set();
  const ranges = pageRangeStr.split(',').map(range => range.trim());

  for (const range of ranges) {
    if (range.includes('-')) {
      const [start, end] = range.split('-').map(num => parseInt(num.trim()));
      if (isNaN(start) || isNaN(end) || start < 1 || end > maxPages || start > end) {
        throw new Error(`Invalid page range: ${range}`);
      }
      for (let i = start; i <= end; i++) {
        pages.add(i);
      }
    } else {
      const pageNum = parseInt(range);
      if (isNaN(pageNum) || pageNum < 1 || pageNum > maxPages) {
        throw new Error(`Invalid page number: ${range}`);
      }
      pages.add(pageNum);
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

// Function to extract text from PDF
async function extractPDFText(pageRangeStr = '') {
  try {
    const pdfUrl = window.location.href;
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    
    let textContent = '';
    const pagesToExtract = parsePageRanges(pageRangeStr, pdf.numPages);
    
    // Extract text from specified pages
    for (const pageNum of pagesToExtract) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);
      textContent += `[Page ${pageNum}]\n${strings.join(' ')}\n\n`;
    }
    
    return textContent;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return null;
  }
}

// Function to extract text content from regular web pages
function extractWebPageText() {
  let textContent = '';
  const visibleElements = getVisibleText();
  
  console.log('Extracting text from visible elements:', visibleElements); // Debugging line to check extracted elements
  
  for (let element of visibleElements) {
    if (element.text) {
      textContent += element.text + '\n';
    }
  }
  
  console.log('Extracted text content:', textContent); // Debugging line to check extracted text content
  
  return textContent;
}

// Function to get visible text elements
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

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractText') {
    (async () => {
      try {
        let textContent;
        if (isPDF()) {
          textContent = await extractPDFText(request.pageRange);
        } else {
          textContent = extractWebPageText();
        }
        sendResponse({ text: textContent });
      } catch (error) {
        console.error('Error extracting text:', error);
        sendResponse({ error: error.message });
      }
    })();
    return true; // Will respond asynchronously
  }

  if (request.action === 'checkIsPDF') {
    sendResponse({ isPDF: isPDF() });
    return true;
  }
});