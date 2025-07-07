// Tabs logic
const tabs = document.querySelectorAll('.tab');
const tabContents = {
  filtrado: document.getElementById('tab-filtrado'),
  dashboard: document.getElementById('tab-dashboard'),
  otros: document.getElementById('tab-otros'),
};
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const selected = tab.dataset.tab;
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    for (const key in tabContents) {
      tabContents[key].style.display = (key === selected) ? 'block' : 'none';
    }
  });
});

const proxy = 'https://corsproxy.io/?';
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRbLYaAIqxr9yPhNHhKvs-CgjMOwm3_DGiNCe0vhRuGSqjlWHIJey1DO0O0RuU1Zk67aepYgb-yirUS/pub?output=csv';
const fullUrl = proxy + encodeURIComponent(csvUrl);

const resultsDiv = document.getElementById('results');
const searchInput = document.getElementById('search');

// Referencias a los selects
const filterSelects = {
  Club: document.getElementById('filterClub'),
  Categoría: document.getElementById('filterCategoria'),
  Nivel: document.getElementById('filterNivel'),
  Aparato: document.getElementById('filterAparato'),
  Turno: document.getElementById('filterTurno')
};


let data = [];
let fuse;
let currentFilteredData = [];

fetch(fullUrl)
  .then(response => response.text())
  .then(csvText => {
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true
    });

    data = parsed.data;

    // Ordenar por "Resultado" descendente al cargar
    data.sort((a, b) => {
      const aVal = parseFloat(a["Resultado"]);
      const bVal = parseFloat(b["Resultado"]);
      return isNaN(bVal) - isNaN(aVal) || bVal - aVal;
    });

    fuse = new Fuse(data, {
      keys: ['Club', 'Categoría', 'Nivel', 'Aparato', 'Turno', 'Cédula', 'Nombre'],
      threshold: 0.3
    });

    // 🔽 Llenar selects con valores únicos
    Object.entries(filterSelects).forEach(([key, select]) => {
      const opciones = [...new Set(data.map(item => item[key]).filter(v => v))].sort();
      select.innerHTML = `<option value="">Todos</option>` + opciones.map(op => `<option value="${op}">${op}</option>`).join('');
    });

    currentFilteredData = [...data];
    renderResults(currentFilteredData);
    mostrarDashboard(data);
  })
  .catch(err => {
    resultsDiv.innerHTML = `<p>Error cargando datos: ${err.message}</p>`;
  });

// Función para renderizar tabla
function renderResults(items, currentSortKey = null, sortAsc = false) {
  if (items.length === 0) {
    resultsDiv.innerHTML = '<p>No se encontraron resultados.</p>';
    return;
  }

  const headers = Object.keys(items[0]);
  const tableHeader = `<tr>${headers.map(h => {
    let icon = '';
    if (h === currentSortKey) {
      icon = sortAsc ? ' 🔼' : ' 🔽';
    }
    return `<th data-key="${h}">${h}${icon}</th>`;
  }).join('')}</tr>`;

  const tableRows = items.map(item => {
    return `<tr>${headers.map(h => `<td>${item[h] || ''}</td>`).join('')}</tr>`;
  }).join('');

  resultsDiv.innerHTML = `
    <table>
      <thead>${tableHeader}</thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;

  // Eventos a headers para ordenar
  const ths = resultsDiv.querySelectorAll('th');
  ths.forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      const newSortAsc = currentSortKey === key ? !sortAsc : false;
      renderResults([...items], key, newSortAsc);
    });
  });
}

// 🎯 Filtros individuales por select
Object.entries(filterSelects).forEach(([key, select]) => {
  select.addEventListener('change', () => {
    filterDataAndRender();
  });
});

// 🔍 Búsqueda global
searchInput.addEventListener('input', () => {
  filterDataAndRender();
});

function filterDataAndRender() {
  const globalQuery = searchInput.value.trim().toLowerCase();

  const filters = {};
  for (const key in filterSelects) {
    filters[key] = filterSelects[key].value.trim().toLowerCase();
  }

  currentFilteredData = data.filter(item => {
    // Filtro global fuzzy
    if (globalQuery) {
      const fuseResults = fuse.search(globalQuery).map(r => r.item);
      if (!fuseResults.includes(item)) return false;
    }

    // Filtros individuales
    for (const key in filters) {
      if (filters[key] && !(item[key] || '').toLowerCase().includes(filters[key])) {
        return false;
      }
    }

    return true;
  });

  renderResults(currentFilteredData);
}

// Dashboard
function mostrarDashboard(data) {
  const categorias = {};
  const sumaPorCedula = {};
  const cedulasPorCategoria = {}; // Evita duplicados por categoría

  data.forEach(item => {
    const cedula = item["Cédula"];
    const resultadoNum = parseFloat(item["Resultado"]) || 0;
    if (!sumaPorCedula[cedula]) {
      sumaPorCedula[cedula] = 0;
    }
    sumaPorCedula[cedula] += resultadoNum;
  });

  data.forEach(item => {
    const cat = item["Categoría"] || "Sin Categoría";
    const cedula = item["Cédula"];
    const nombre = item["Nombre"] || "";
    const resultado = parseFloat(sumaPorCedula[cedula]) || 0;

    if (!categorias[cat]) categorias[cat] = [];
    if (!cedulasPorCategoria[cat]) cedulasPorCategoria[cat] = new Set();
    
    if (!cedulasPorCategoria[cat].has(cedula)) {
      categorias[cat].push({ cedula, nombre, resultado });
    cedulasPorCategoria[cat].add(cedula);
  }
  });

  for (const cat in categorias) {
    categorias[cat].sort((a, b) => b.resultado - a.resultado);
    categorias[cat] = categorias[cat].slice(0, 5);
  }

  const top5Container = document.getElementById('top5Categorias');
  top5Container.innerHTML = '';

  for (const cat in categorias) {
    const rows = categorias[cat].map(item =>
      `<tr><td>${item.cedula}</td><td>${item.nombre}</td><td>${item.resultado}</td></tr>`
    ).join('');

    top5Container.innerHTML += `
      <h4>${cat}</h4>
      <table>
        <thead><tr><th>Cédula</th><th>Nombre</th><th>Resultado total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // Mejor club
  const clubes = {};
  data.forEach(item => {
    const club = item["Club"] || "Sin Club";
    const resultado = parseFloat(item["Resultado"]) || 0;
    if (!clubes[club]) clubes[club] = { suma: 0, count: 0 };
    clubes[club].suma += resultado;
    clubes[club].count++;
  });

  let mejorClub = null;
  let mejorPromedio = -Infinity;
  for (const club in clubes) {
    const promedio = clubes[club].suma / clubes[club].count;
    if (promedio > mejorPromedio) {
      mejorPromedio = promedio;
      mejorClub = club;
    }
  }

  const mejorClubDiv = document.getElementById('mejorClub');
  mejorClubDiv.innerHTML = `<p><strong>${mejorClub}</strong> con promedio de resultado: ${mejorPromedio.toFixed(2)}</p>`;
}

document.getElementById('clearFilters').addEventListener('click', () => {
  Object.values(filterInputs).forEach(select => {
    select.value = '';
  });
  searchInput.value = '';
  filterDataAndRender();
});
