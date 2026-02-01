<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Desktop PDF Viewer — High Performance</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    :root { 
      --accent: #222; 
      /* Прозрачный фон */
      --bg: transparent; 
    }
    
    html, body { margin:0; padding:0; height:100%; overflow: hidden; background: var(--bg); font-family: system-ui, sans-serif; }
    
    #app { display: flex; flex-direction: column; height: 100vh; width: 100%; background: transparent; }
    
    #bookWrap { 
      flex: 1; 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      overflow: hidden; 
      padding: 20px;
      box-sizing: border-box;
    }

    #bookPages { 
      display: flex; 
      gap: 5px; /* Минимальный зазор для эффекта книги */
      align-items: center; 
      justify-content: center;
    }

    .page { 
      background: #fff; 
      box-shadow: 0 10px 40px rgba(0,0,0,0.1); 
      border-radius: 2px;
      overflow: hidden;
      display: none;
    }

    canvas { display: block; }

    /* Панель управления (полупрозрачная для эстетики) */
    #controls { 
      height: 70px; 
      background: rgba(255, 255, 255, 0.8); 
      backdrop-filter: blur(5px);
      display: flex; 
      align-items: center; 
      justify-content: center; 
      gap: 15px;
      z-index: 100;
      border-top: 1px solid rgba(0,0,0,0.05);
    }

    .btn { 
      background: var(--accent); 
      color: #fff; 
      padding: 10px 20px; 
      border: none;
      border-radius: 6px; 
      cursor: pointer; 
      font-size: 13px; 
      font-weight: 500;
      transition: all 0.2s;
    }
    .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .btn.secondary { background: #fff; color: #222; border: 1px solid #ddd; }
    .btn:disabled { background: #eee; color: #aaa; cursor: default; transform: none; box-shadow: none; }

    #pageInfo { font-size: 14px; color: #555; min-width: 120px; text-align: center; }

    /* Оглавление */
    #tocOverlay { 
      position: fixed; right: 30px; bottom: 90px; 
      width: 280px; max-height: 50vh; 
      background: #fff; border-radius: 12px; 
      box-shadow: 0 10px 40px rgba(0,0,0,0.2); 
      display: none; overflow-y: auto; z-index: 200; 
      border: 1px solid #eee;
    }
    .tocItem { padding: 12px 18px; border-bottom: 1px solid #f8f8f8; cursor: pointer; font-size: 13px; transition: 0.2s; }
    .tocItem:hover { background: #f0f4f8; color: var(--accent); }

    /* Лоадер */
    #loader { position: fixed; left: 50%; top: 50%; transform: translate(-50%,-50%); z-index: 1000; }
    .spin { width: 35px; height: 35px; border: 3px solid rgba(0,0,0,0.05); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>

<div id="app">
  <div id="bookWrap">
    <div id="loader"><div class="spin"></div></div>
    <div id="bookPages">
      <div id="left" class="page"></div>
      <div id="right" class="page"></div>
    </div>
  </div>

  <div id="controls">
    <button id="prevBtn" class="btn">❮ Назад</button>
    <div id="pageInfo">...</div>
    <button id="tocBtn" class="btn secondary">Содержание</button>
    <button id="fullBtn" class="btn secondary">⛶ Во весь экран</button>
    <button id="nextBtn" class="btn">Вперед ❯</button>
  </div>
</div>

<div id="tocOverlay"></div>

<script>
const PDF_URL = "https://zumrudin.github.io/peri-clinic/price.pdf";
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

let pdfDoc = null, currentPage = 1, isRendering = false;
const leftEl = document.getElementById('left'), 
      rightEl = document.getElementById('right'),
      wrap = document.getElementById('bookWrap'),
      loader = document.getElementById('loader'),
      pageInfo = document.getElementById('pageInfo'),
      tocOverlay = document.getElementById('tocOverlay');

// Функция рендеринга (возвращает Promise)
async function renderPage(pageNum, container) {
    if (pageNum < 1 || pageNum > pdfDoc.numPages) {
        container.style.display = 'none';
        return Promise.resolve();
    }
    
    const page = await pdfDoc.getPage(pageNum);
    const viewportBase = page.getViewport({ scale: 1 });
    
    const padding = 0.94;
    const availableW = (wrap.clientWidth / 2) * padding;
    const availableH = wrap.clientHeight * padding;
    
    const scale = Math.min(availableW / viewportBase.width, availableH / viewportBase.height);
    const viewport = page.getViewport({ scale: scale });

    let canvas = container.querySelector('canvas') || document.createElement('canvas');
    if (!canvas.parentNode) container.appendChild(canvas);
    
    const context = canvas.getContext('2d');
    const outputScale = window.devicePixelRatio || 1;
    
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = Math.floor(viewport.width) + "px";
    canvas.style.height = Math.floor(viewport.height) + "px";
    
    context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
    
    container.style.display = 'block';
    return page.render({ canvasContext: context, viewport: viewport }).promise;
}

async function renderBook() {
    if (isRendering) return;
    isRendering = true;
    loader.style.display = 'block';

    try {
        // ОПТИМИЗАЦИЯ: Рендерим обе страницы ОДНОВРЕМЕННО
        await Promise.all([
            renderPage(currentPage, leftEl),
            renderPage(currentPage + 1, rightEl)
        ]);

        if (currentPage + 1 <= pdfDoc.numPages) {
            pageInfo.textContent = `${currentPage} – ${currentPage + 1} / ${pdfDoc.numPages}`;
        } else {
            pageInfo.textContent = `${currentPage} / ${pdfDoc.numPages}`;
        }
    } catch (e) { console.error("Rendering error:", e); }

    loader.style.display = 'none';
    isRendering = false;
    updateButtons();
}

function updateButtons() {
    document.getElementById('prevBtn').disabled = (currentPage <= 1);
    document.getElementById('nextBtn').disabled = (currentPage + 1 >= pdfDoc.numPages);
}

function navigate(dir) {
    const step = 2;
    let nextP = currentPage + (dir * step);
    
    if (nextP < 1) nextP = 1;
    if (nextP > pdfDoc.numPages) return;
    
    currentPage = nextP;
    renderBook();
}

// Полноэкранный режим
document.getElementById('fullBtn').onclick = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            alert(`Ошибка: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
};

// Оглавление
async function buildTOC() {
    const outline = await pdfDoc.getOutline();
    if (!outline) {
        document.getElementById('tocBtn').style.display = 'none';
        return;
    }
    
    tocOverlay.innerHTML = '';
    outline.forEach(item => {
        const div = document.createElement('div');
        div.className = 'tocItem';
        div.textContent = item.title;
        div.onclick = async () => {
            if (item.dest) {
                const dest = typeof item.dest === 'string' ? await pdfDoc.getDestination(item.dest) : item.dest;
                const pageIdx = await pdfDoc.getPageIndex(dest[0]);
                let targetPage = pageIdx + 1;
                // Всегда делаем левую страницу нечетной для разворота
                currentPage = targetPage % 2 === 0 ? targetPage - 1 : targetPage;
                renderBook();
                tocOverlay.style.display = 'none';
            }
        };
        tocOverlay.appendChild(div);
    });
}

document.getElementById('nextBtn').onclick = () => navigate(1);
document.getElementById('prevBtn').onclick = () => navigate(-1);
document.getElementById('tocBtn').onclick = () => {
    tocOverlay.style.display = tocOverlay.style.display === 'block' ? 'none' : 'block';
};

window.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') navigate(1);
    if (e.key === 'ArrowLeft') navigate(-1);
});

window.addEventListener('resize', () => {
    clearTimeout(window.resT);
    window.resT = setTimeout(renderBook, 150);
});

(async function init() {
    try {
        const loadingTask = pdfjsLib.getDocument({
            url: PDF_URL,
            disableRange: false,
            disableStream: false,
            disableAutoFetch: false, // Предзагрузка данных для скорости
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
        });
        pdfDoc = await loadingTask.promise;
        renderBook();
        buildTOC();
    } catch (e) {
        console.error(e);
        document.body.innerHTML = `<div style="padding:50px; text-align:center;">Ошибка загрузки: ${e.message}</div>`;
    }
})();
</script>
</body>
</html>
