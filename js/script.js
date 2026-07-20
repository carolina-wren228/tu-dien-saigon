let dictionaryData = []; 

async function loadDictionaryData(){ 
    const status = document.getElementById('status'); 
    const input = document.getElementById('searchInput'); 
    try{ 
        const response = await fetch('/data/data.json'); 
        if(!response.ok) throw new Error('Không thể đọc file data.json'); 
        dictionaryData = await response.json(); 
        status.style.display = 'none'; 
        input.disabled = false; 
        input.placeholder = 'Tra cứu từ ngữ (ví dụ: a)…'; 
        input.focus(); 
    }catch(err){ 
        status.textContent = 'Lỗi: Không thể kết nối thư viện từ điển.'; 
        console.error(err); 
    } 
} 
loadDictionaryData(); 

function escapeHtml(str){ 
    if (!str) return ''; 
    // Cleanse the text first to keep your system safe 
    let cleanStr = String(str) 
        .replace(/&/g,'&amp;') 
        .replace(/</g,'&lt;') 
        .replace(/>/g,'&gt;'); 
    // Turn pairs of asterisks into matching italic elements 
    cleanStr = cleanStr.replace(/\*(.*?)\*/g, '<i>$1</i>'); 
    return cleanStr; 
} 

// Helper to remove accents specifically for matching highlight locations
function cleanForHighlight(str) {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/-/g, ' ')
        .trim();
}

function highlightWord(word, query){ 
    const safeWord = escapeHtml(word); 
    if(!query) return safeWord; 
    
    // Normalize both strings to baseline Latin characters and drop dashes/spaces
    const normalizedWord = cleanForHighlight(word);
    const normalizedQuery = cleanForHighlight(query);
    
    // Find where the clean query sits inside the clean word
    const idx = normalizedWord.indexOf(normalizedQuery); 
    if(idx === -1) return safeWord; 
    
    // Extract the original un-cleansed slices using the match positions
    const before = escapeHtml(word.slice(0, idx)); 
    const match = escapeHtml(word.slice(idx, idx + query.length)); 
    const after = escapeHtml(word.slice(idx + query.length)); 
    
    return `${before}<mark>${match}</mark>${after}`; 
}

function buildExamplesHTML(examples){ 
    if(!examples || examples.length === 0) return ''; 
    const items = examples.map(ex => { 
        const phrase = escapeHtml(ex.phrase || ''); 
        const meaning = ex.meaning ? ' — ' + escapeHtml(ex.meaning) : ''; 
        return `<div class="example-item"><strong>${phrase}</strong>${meaning}</div>`; 
    }).join(''); 
    return `<div class="examples">${items}</div>`; 
} 

// Group flat entries that share the same word + part_of_speech 
// into a single card with numbered senses. 
function groupEntries(entries){ 
    const groups = []; 
    const index = new Map(); 
    entries.forEach(entry => { 
        const key = entry.word + '|' + entry.part_of_speech; 
        if(!index.has(key)){ 
            const group = { word: entry.word, part_of_speech: entry.part_of_speech, senses: [] }; 
            index.set(key, group); 
            groups.push(group); 
        } 
        const activeGroup = index.get(key); 
        // OPTION B TWEAK: Check if this entry contains a list of definitions 
        if (entry.definitions && Array.isArray(entry.definitions)) { 
            entry.definitions.forEach(subDef => { 
                activeGroup.senses.push({ 
                    definition: subDef.text, 
                    examples: subDef.examples || [] 
                }); 
            }); 
        } else { 
            activeGroup.senses.push({ 
                definition: entry.definition, 
                examples: entry.examples || [] 
            }); 
        } 
    }); 
    return groups; 
} 

function renderCard(group, query){ 
    const card = document.createElement('div'); 
    card.className = 'card'; 
    const senseHTML = group.senses.map((sense, i) => { 
        const defText = sense.definition || ''; 
        const hasNumberAlready = /^\d+[\s\.]/.test(defText.trim()); 
        const number = (group.senses.length > 1 && !hasNumberAlready) ? `<span class="sense-number">${i + 1}.</span>` : ''; 
        return ` <div class="sense"> <div class="sense-def">${number}${escapeHtml(defText)}</div> ${buildExamplesHTML(sense.examples)} </div> `; 
    }).join(''); 
    card.innerHTML = ` <div class="card-head"> <h2 class="word-title">${highlightWord(group.word, query)}</h2> <span class="pos-stamp">${escapeHtml(group.part_of_speech)}</span> </div> ${senseHTML} `; 
    return card; 
} 

let abbreviationsData = null; 
async function loadAbbreviations(){ 
    if(abbreviationsData) return abbreviationsData; 
    const list = document.getElementById('abbrList'); 
    try{ 
        const response = await fetch('/data/abbreviations.json'); 
        if(!response.ok) throw new Error('Không thể đọc file abbreviations.json'); 
        abbreviationsData = await response.json(); 
    }catch(err){ 
        console.error(err); 
        list.innerHTML = '<p class="abbr-loading">Lỗi: Không thể tải bảng chữ viết tắt.</p>'; 
        abbreviationsData = []; 
    } 
    return abbreviationsData; 
} 

function renderAbbreviations(data){ 
    const list = document.getElementById('abbrList'); 
    if(data.length === 0){ 
        list.innerHTML = '<p class="abbr-loading">Chưa có dữ liệu.</p>'; 
        return; 
    } 
    const sorted = [...data].sort((a, b) => a.abbr.localeCompare(b.abbr, 'vi')); 
    list.innerHTML = sorted.map(item => ` <div class="abbr-row"> <span class="abbr-key">${escapeHtml(item.abbr)}</span> <span class="abbr-val">${escapeHtml(item.meaning)}</span> </div> `).join(''); 
} 

async function openAbbrPanel(){ 
    const overlay = document.getElementById('abbrOverlay'); 
    overlay.classList.add('open'); 
    document.addEventListener('keydown', handleModalKeydown); 
    const data = await loadAbbreviations(); 
    renderAbbreviations(data); 
} 

function closeAbbrPanel(){ 
    document.getElementById('abbrOverlay').classList.remove('open'); 
    document.removeEventListener('keydown', handleModalKeydown); 
} 

function openTuaPanel(){ 
    document.getElementById('tuaOverlay').classList.add('open'); 
    document.addEventListener('keydown', handleModalKeydown); 
} 

function closeTuaPanel(){ 
    document.getElementById('tuaOverlay').classList.remove('open'); 
    document.removeEventListener('keydown', handleModalKeydown); 
} 

function handleModalKeydown(e){ 
    if(e.key === 'Escape'){ 
        closeAbbrPanel(); 
        closeTuaPanel(); 
    } 
} 

// THE TRUE SEARCH FUNCTION (With space, dash, and array searching features)
function searchDictionary(){ 
    const inputEl = document.getElementById('searchInput'); 
    const clearBtn = document.getElementById('clearButton'); 
    const container = document.getElementById('resultsContainer'); 
    const noResult = document.getElementById('noResult'); 
    const placeholder = document.getElementById('placeholder'); 
    
    // Toggle the clear button visibility via CSS classes safely
    if (inputEl.value.length > 0) {
        clearBtn.style.display = 'inline-flex';
    } else {
        clearBtn.style.display = 'none';
    }
    
    container.innerHTML = ''; 
    
    const rawQuery = inputEl.value.trim().toLowerCase(); 
    const spaceQuery = rawQuery.replace(/-/g, ' '); 
    
    if(rawQuery === ''){ 
        noResult.style.display = 'none'; 
        placeholder.style.display = 'block'; 
        return; 
    } 
    
    placeholder.style.display = 'none'; 
    
    // Filter your entries 
    const matches = dictionaryData.filter(item => { 
        const wordClean = item.word.toLowerCase(); 
        
        // 1. Check if the raw query or space query matches the main headword
        if (wordClean.includes(rawQuery) || wordClean.replace(/-/g, ' ').includes(spaceQuery)) { 
            return true; 
        } 
        
        // 2. Check the native search terms array (supporting search_terms or search_term)
        const targetArray = item.search_terms || item.search_term;
        if (targetArray && Array.isArray(targetArray)) { 
            return targetArray.some(term => { 
                const termClean = term.toLowerCase(); 
                return termClean.includes(rawQuery) || termClean.includes(spaceQuery); 
            }); 
        } 
        return false; 
    }); 
    
    // 3. Render the results cards 
    if(matches.length === 0){ 
        noResult.style.display = 'block'; 
        return; 
    } 
    
    noResult.style.display = 'none'; 
    const groups = groupEntries(matches); 
    groups.forEach(group => container.appendChild(renderCard(group, rawQuery))); 
} 

function clearSearch() { 
    const input = document.getElementById('searchInput'); 
    const clearBtn = document.getElementById('clearButton'); 
    input.value = ''; 
    clearBtn.classList.remove('visible'); 
    input.focus(); 
    searchDictionary(); 
}
