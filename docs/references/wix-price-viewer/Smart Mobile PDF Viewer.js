<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Smart Mobile PDF Viewer</title>
  <style>
    :root { 
      --primary: #222; 
      --accent: #007bff; 
      /* Устанавливаем фон как у вашего сайта (например, белый) */
      --bg: transparent; 
    }
    
    body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; font-family: -apple-system, sans-serif; background: var(--bg); }
    
    #app { display: flex; flex-direction: column; height: 100%; }
    
    /* Контейнер теперь занимает 100% и центрирует контент */
    #pdf-wrapper { 
      flex: 1; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      position: relative;
      overflow: hidden; /* Чтобы не было двойных скроллов */
    }
    
    #pdf-canvas { 
      box-shadow: 0 5px 20px rgba(0,0,0,0.1); 
      background: #fff; 
      max-width: 100%;
      max-height: 100%;
    }

    #toolbar { height: 50px; background: #fff; border-top: 1px solid #eee; display: flex; align-items: center; justify-content: space-around; z-index: 100; }
    .btn { background: none; border: none; font-size: 20px; color: var(--primary); padding: 8px; cursor: pointer; }
    .btn:disabled { opacity: 0.15; }
    #page-info { font-size: 13px; color: #888; }

    /* Компактное оглавление */
    #tocPanel { 
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: #fff; z-index: 200; transform: translateX(100%); 
      transition: transform 0.3s ease; overflow-y: auto; 
    }
    #tocPanel.active { transform: translateX(0); }
    .toc-header { padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: #fff; }
    .toc-item { padding: 12px 20px; border-bottom: 1px solid #f9f9f9; font-size: 14px; color: #444; }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
</head>
<body>

<div id="app">
  <div id="pdf-wrapper">
    <div id="loader" style="position:absolute;"><div class="spinner"></div></div>
    <canvas id="pdf-canvas"></canvas>
  </div>

  <div id="toolbar">
    <button id="prevBtn" class="btn">❮</button>
    <div id="page-info">...</div>
    <button id="menuBtn" class="btn">☰</button>
    <button id="nextBtn" class="btn">❯</button>
  </div>
</div>

<div id="tocPanel">
  <div class="toc-header">
    <span style="font-weight:600;">Содержание</span>
    <button class="btn" onclick="toggleTOC()">✕</button>
  </div>
  <div id="tocContent"></div>
</div>

<script>
(function() {
  const PDF_URL = "https://zumrudin.github.io/peri-clinic/price.pdf";
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  let pdfDoc = null, currentPage = 1, isRendering = false;

  const canvas = document.getElementById("pdf-canvas"),
        ctx = canvas.getContext("2d"),
        pageInfo = document.getElementById("page-info"),
        tocPanel = document.getElementById("tocPanel"),
        wrapper = document.getElementById("pdf-wrapper");

  async function renderPage(num) {
    if (isRendering) return;
    isRendering = true;

    try {
      const page = await pdfDoc.getPage(num);
      const viewport = page.getViewport({ scale: 1 });
      
      // АВТО-МАСШТАБ: Вычисляем масштаб так, чтобы страница вписалась 
      // и в ширину, и в высоту контейнера (с небольшим запасом 4%)
      const padding = 0.96; 
      const scaleW = (wrapper.clientWidth * padding) / viewport.width;
      const scaleH = (wrapper.clientHeight * padding) / viewport.height;
      const scale = Math.min(scaleW, scaleH);

      const scaledViewport = page.getViewport({ scale: scale });
      const outputScale = window.devicePixelRatio || 1;

      canvas.width = Math.floor(scaledViewport.width * outputScale);
      canvas.height = Math.floor(scaledViewport.height * outputScale);
      canvas.style.width = Math.floor(scaledViewport.width) + "px";
      canvas.style.height = Math.floor(scaledViewport.height) + "px";

      ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
      
      currentPage = num;
      pageInfo.textContent = `${currentPage} / ${pdfDoc.numPages}`;
      updateButtons();
    } catch (err) { console.error(err); } 
    finally { isRendering = false; }
  }

  function updateButtons() {
    document.getElementById("prevBtn").disabled = (currentPage <= 1);
    document.getElementById("nextBtn").disabled = (currentPage >= pdfDoc.numPages);
  }

  window.toggleTOC = () => tocPanel.classList.toggle("active");

  function navigate(step) {
    const nextP = currentPage + step;
    if (nextP >= 1 && nextP <= pdfDoc.numPages) renderPage(nextP);
  }

  // Свайпы по канвасу
  let touchStartX = 0;
  canvas.addEventListener('touchstart', e => touchStartX = e.changedTouches[0].screenX);
  canvas.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) navigate(diff > 0 ? 1 : -1);
  });

  document.getElementById("prevBtn").onclick = () => navigate(-1);
  document.getElementById("nextBtn").onclick = () => navigate(1);
  document.getElementById("menuBtn").onclick = () => toggleTOC();

  // Следим за изменением размера окна (например, при повороте телефона)
  window.addEventListener('resize', () => {
    clearTimeout(window.resizeFinished);
    window.resizeFinished = setTimeout(() => { renderPage(currentPage); }, 200);
  });

  async function init() {
    try {
      pdfDoc = await pdfjsLib.getDocument({
        url: PDF_URL,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true,
      }).promise;
      renderPage(1);
      const outline = await pdfDoc.getOutline();
      if (outline) buildTOC(outline);
    } catch (err) { console.log(err); }
  }

  function buildTOC(items) {
    const container = document.getElementById("tocContent");
    const list = document.createElement("div");
    items.forEach(item => {
      const div = document.createElement("div");
      div.className = "toc-item";
      div.textContent = item.title;
      div.onclick = async () => {
        toggleTOC();
        if (item.dest) {
          const dest = typeof item.dest === 'string' ? await pdfDoc.getDestination(item.dest) : item.dest;
          const index = await pdfDoc.getPageIndex(dest[0]);
          renderPage(index + 1);
        }
      };
      list.appendChild(div);
    });
    container.appendChild(list);
  }
  init();
})();
</script>
</body>
</html>
