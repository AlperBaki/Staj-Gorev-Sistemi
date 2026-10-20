(function(){
  let tasks = [];
  let filter = 'tumu';
  let editingId = null;
  let addStatus = 'devam';

  const taskListEl = document.getElementById('taskList');
  const saveMsg = document.getElementById('saveMsg');
  const todayTag = document.getElementById('todayTag');

  const fmtDate = (iso) => {
    if(!iso) return '-';
    const [y,m,d] = iso.split('-');
    return `${d}.${m}.${y}`;
  };

  todayTag.textContent = 'BUGÜN: ' + fmtDate(new Date().toISOString().slice(0,10));
  document.getElementById('dateInput').value = new Date().toISOString().slice(0,10);

  function uid(){
    return 'g_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
  }

  // Bağımsız çalıştırırken veri tarayıcı localStorage'ında saklanıyor.
  // Backend'e bağlamak isterseniz bu iki fonksiyonu kendi API çağrınızla değiştirin.
  async function loadTasks(){
    try{
      const raw = localStorage.getItem('gorevler');
      tasks = raw ? JSON.parse(raw) : [];
    }catch(e){
      tasks = [];
    }
    render();
  }

  async function persist(){
    try{
      localStorage.setItem('gorevler', JSON.stringify(tasks));
      saveMsg.textContent = 'Kaydedildi · ' + new Date().toLocaleTimeString('tr-TR');
    }catch(e){
      saveMsg.textContent = 'Kaydedilemedi, tekrar deneyin.';
    }
  }

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function escapeAttr(str){
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function reorderTasks(draggedId, targetId){
    const dragIndex = tasks.findIndex(t=>t.id===draggedId);
    if(dragIndex === -1) return;
    const [draggedItem] = tasks.splice(dragIndex, 1);
    const targetIndex = tasks.findIndex(t=>t.id===targetId);
    tasks.splice(targetIndex, 0, draggedItem);
  }

  function render(){
    document.getElementById('cAll').textContent = tasks.length;
    document.getElementById('cDevam').textContent = tasks.filter(t=>t.status==='devam').length;
    document.getElementById('cTamam').textContent = tasks.filter(t=>t.status==='tamam').length;

    document.getElementById('deleteAllBtn').disabled = tasks.length === 0;

    let visible = tasks;
    if(filter === 'devam') visible = tasks.filter(t=>t.status==='devam');
    if(filter === 'tamam') visible = tasks.filter(t=>t.status==='tamam');

    taskListEl.innerHTML = '';

    if(visible.length === 0){
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = tasks.length === 0
        ? 'Henüz görev kaydı yok. Sol taraftan ilk kaydı ekleyin.'
        : 'Bu filtrede görev bulunmuyor.';
      taskListEl.appendChild(empty);
      return;
    }

    visible.forEach(task => {
      const row = document.createElement('div');
      row.className = 'task-row ' + task.status;
      row.dataset.id = task.id;

      if(editingId === task.id){
        row.classList.add('edit-row');
        row.innerHTML = `
          <div class="task-main" style="width:100%">
            <div class="field">
              <label>Yapılan İş</label>
              <input type="text" id="edit-title-${task.id}" value="${escapeAttr(task.title)}">
            </div>
            <div class="field">
              <label>Açıklama</label>
              <textarea rows="3" id="edit-desc-${task.id}">${escapeHtml(task.description)}</textarea>
            </div>
            <div class="field">
              <label>Tarih</label>
              <input type="date" id="edit-date-${task.id}" value="${task.date}">
            </div>
            <div class="status-toggle" id="edit-status-${task.id}">
              <button type="button" data-s="devam" class="${task.status==='devam'?'active':''}">Devam Ediyor</button>
              <button type="button" data-s="tamam" class="${task.status==='tamam'?'active':''}">Tamamlandı</button>
            </div>
            <div class="field" id="edit-progress-field-${task.id}" style="display:${task.status==='devam' ? 'block':'none'}">
              <label>İlerleme (%)</label>
              <div class="progress-input-row">
                <input type="range" id="edit-progress-${task.id}" min="0" max="100" step="5" value="${task.progress||0}">
                <span id="edit-progress-value-${task.id}">${task.progress||0}%</span>
              </div>
            </div>
            <div class="edit-row-actions">
              <button class="save-btn" data-action="save" data-id="${task.id}">Kaydet</button>
              <button class="cancel-btn" data-action="cancel">Vazgeç</button>
            </div>
          </div>
        `;
      } else {
        row.draggable = true;
        row.innerHTML = `
          <span class="drag-handle" title="Sürükleyerek sırala">⋮⋮</span>
          <div class="task-main">
            <p class="task-title">${escapeHtml(task.title)}</p>
            <p class="task-desc">${escapeHtml(task.description)}</p>
            <div class="task-meta">
              <span class="task-date">${fmtDate(task.date)}</span>
              <span class="stamp ${task.status}">${task.status === 'tamam' ? 'Tamamlandı' : 'Devam Ediyor'}</span>
            </div>
            ${task.status === 'devam' ? `
              <div class="progress-track"><div class="progress-fill" style="width:${task.progress||0}%"></div></div>
              <span class="progress-label">${task.progress||0}% tamamlandı</span>
            ` : ''}
          </div>
          <div class="task-actions">
            <button class="icon-btn" data-action="edit" data-id="${task.id}">Düzenle</button>
            <button class="icon-btn del" data-action="delete" data-id="${task.id}">Sil</button>
          </div>
        `;

        row.addEventListener('dragstart', (e)=>{
          row.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', task.id);
        });
        row.addEventListener('dragend', ()=>{
          row.classList.remove('dragging');
        });
        row.addEventListener('dragover', (e)=>{
          e.preventDefault();
          row.classList.add('drag-over');
        });
        row.addEventListener('dragleave', ()=>{
          row.classList.remove('drag-over');
        });
        row.addEventListener('drop', async (e)=>{
          e.preventDefault();
          row.classList.remove('drag-over');
          const draggedId = e.dataTransfer.getData('text/plain');
          if(draggedId && draggedId !== task.id){
            reorderTasks(draggedId, task.id);
            render();
            await persist();
          }
        });
      }
      taskListEl.appendChild(row);
    });

    if(editingId){
      const toggle = document.getElementById('edit-status-' + editingId);
      if(toggle){
        toggle.querySelectorAll('button').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            toggle.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            const progField = document.getElementById('edit-progress-field-' + editingId);
            if(progField) progField.style.display = btn.dataset.s === 'devam' ? 'block' : 'none';
          });
        });
      }
      const progInput = document.getElementById('edit-progress-' + editingId);
      if(progInput){
        progInput.addEventListener('input', ()=>{
          document.getElementById('edit-progress-value-' + editingId).textContent = progInput.value + '%';
        });
      }
    }
  }

  // Yeni kayıt formu
  document.getElementById('statusToggle').addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    document.querySelectorAll('#statusToggle button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    addStatus = btn.dataset.s;
    document.getElementById('progressField').style.display = addStatus === 'devam' ? 'block' : 'none';
  });

  document.getElementById('progressInput').addEventListener('input', (e)=>{
    document.getElementById('progressValue').textContent = e.target.value + '%';
  });

  document.getElementById('addBtn').addEventListener('click', async ()=>{
    const taskInput = document.getElementById('taskInput');
    const descInput = document.getElementById('descInput');
    const dateInput = document.getElementById('dateInput');
    const progressInput = document.getElementById('progressInput');

    const title = taskInput.value.trim();
    const desc = descInput.value.trim();
    const date = dateInput.value;

    if(!title){
      taskInput.focus();
      taskInput.style.outline = '2px solid var(--rust)';
      setTimeout(()=>{ taskInput.style.outline=''; }, 1200);
      return;
    }

    tasks.push({
      id: uid(),
      title,
      description: desc,
      date: date || new Date().toISOString().slice(0,10),
      status: addStatus === 'tamam' ? 'tamam' : 'devam',
      progress: addStatus === 'tamam' ? 100 : parseInt(progressInput.value, 10)
    });

    taskInput.value = '';
    descInput.value = '';
    dateInput.value = new Date().toISOString().slice(0,10);
    progressInput.value = 0;
    document.getElementById('progressValue').textContent = '0%';
    addStatus = 'devam';
    document.querySelectorAll('#statusToggle button').forEach(b=>b.classList.remove('active'));
    document.querySelector('#statusToggle button[data-s="devam"]').classList.add('active');
    document.getElementById('progressField').style.display = 'block';

    render();
    await persist();
  });

  // Sekmeler
  document.getElementById('tabs').addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    filter = btn.dataset.f;
    document.querySelectorAll('#tabs button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    render();
  });

  // Liste aksiyonları: düzenle / sil / kaydet / vazgeç
  taskListEl.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if(action === 'delete'){
      tasks = tasks.filter(t=>t.id !== id);
      render();
      await persist();
    } else if(action === 'edit'){
      editingId = id;
      render();
    } else if(action === 'cancel'){
      editingId = null;
      render();
    } else if(action === 'save'){
      const task = tasks.find(t=>t.id === id);
      if(task){
        const titleEl = document.getElementById('edit-title-' + id);
        const descEl = document.getElementById('edit-desc-' + id);
        const dateEl = document.getElementById('edit-date-' + id);
        const statusEl = document.getElementById('edit-status-' + id);
        const progressEl = document.getElementById('edit-progress-' + id);
        const activeStatusBtn = statusEl.querySelector('button.active');

        const newTitle = titleEl.value.trim();
        if(!newTitle){
          titleEl.style.outline = '2px solid var(--rust)';
          return;
        }
        task.title = newTitle;
        task.description = descEl.value.trim();
        task.date = dateEl.value || task.date;
        task.status = activeStatusBtn ? activeStatusBtn.dataset.s : task.status;
        task.progress = task.status === 'tamam' ? 100 : parseInt(progressEl.value, 10);
      }
      editingId = null;
      render();
      await persist();
    }
  });

  // Tümünü sil + onay penceresi
  const modalOverlay = document.getElementById('modalOverlay');
  document.getElementById('deleteAllBtn').addEventListener('click', ()=>{
    if(tasks.length === 0) return;
    modalOverlay.style.display = 'flex';
  });
  document.getElementById('modalCancel').addEventListener('click', ()=>{
    modalOverlay.style.display = 'none';
  });
  document.getElementById('modalConfirm').addEventListener('click', async ()=>{
    tasks = [];
    modalOverlay.style.display = 'none';
    render();
    await persist();
  });
  modalOverlay.addEventListener('click', (e)=>{
    if(e.target === modalOverlay) modalOverlay.style.display = 'none';
  });

  loadTasks();
})();