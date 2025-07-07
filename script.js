// Tabs logic
const tabs = document.querySelectorAll('.tab');
const tabContents = {
  filtrado: document.getElementById('tab-filtrado'),
  dashboard: document.getElementById('tab-dashboard'),
};
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const selected = tab.dataset.tab;
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    for (const key in tabContents) {
      tabContents[key].style.display = (key === selected) ? 'block' : 'none';
    }

    // Mostrar/ocultar resultados y filtros
    document.getElementById('filtradoResultados').style.display =
      selected === 'filtrado' ? 'block' : 'none';
  });
});


const proxy = 'https://corsproxy.io/?';
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRbLYaAIqxr9yPhNHhKvs-CgjMOwm3_DGiNCe0vhRuGSqjlWHIJey1DO0O0RuU1Zk67aepYgb-yirUS/pub?output=csv';
const fullUrl = proxy + encodeURIComponent(csvUrl);

const resultsDiv = document.getElementById('results');
const searchInput = document.getElementById('search');
let currentSortKey = null;
let sortAsc = true;

// Referencias a los selects
const filterSelects = {
  Club: document.getElementById('filterClub'),
  Categoría: document.getElementById('filterCategoria'),
  Nivel: document.getElementById('filterNivel'),
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

function renderResults(items) {
  const headers = Object.keys(items[0]);
  const tableHeader = `<tr>${headers.map(h => {
    let icon = '';
    if (h === currentSortKey) {
      icon = sortAsc ? ' 🔼' : ' 🔽';
    }
    return `<th data-key="${h}">${h}${icon}</th>`;
  }).join('')}</tr>`;

  const tableRows = items.map(item => {
    return `<tr data-cedula="${item["Cédula"]}">
      ${headers.map(h => {
        const editable = ["Viga", "Suelo", "Asimétrica"].includes(h);
        const content = item[h] !== undefined ? item[h] : '';
        return `<td data-key="${h}" ${editable ? 'class="editable"' : ''}>${content}</td>`;
      }).join('')}
    </tr>`;
  }).join('');

  resultsDiv.innerHTML = `
    <table>
      <thead>${tableHeader}</thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;

  // 💡 Edición inline
  resultsDiv.querySelectorAll('.editable').forEach(cell => {
    cell.addEventListener('click', () => {
      if (cell.querySelector('input')) return;

      const originalValue = cell.textContent;
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '0.1';
      input.value = originalValue;
      input.style.width = '60px';

      cell.textContent = '';
      cell.appendChild(input);
      input.focus();

      const td = cell;
      const tr = td.closest('tr');
      const cedula = tr.getAttribute('data-cedula');
      const key = td.getAttribute('data-key');

      const guardar = () => {
        const nuevoValor = parseFloat(input.value);
        if (isNaN(nuevoValor)) {
          td.textContent = originalValue;
          return;
        }

        // Actualizar en `data`
        const index = data.findIndex(d => d["Cédula"] === cedula && d["Aparato"] === key);
        if (index !== -1) {
          data[index]["Resultado"] = nuevoValor.toString();
        } else {
          const alumna = data.find(d => d["Cédula"] === cedula);
          if (alumna) {
            data.push({
              "Cédula": cedula,
              "Nombre": alumna["Nombre"],
              "Club": alumna["Club"],
              "Categoría": alumna["Categoría"],
              "Nivel": alumna["Nivel"],
              "Turno": alumna["Turno"],
              "Aparato": key,
              "Resultado": nuevoValor.toString()
            });
          }
        }

        fuse.setCollection(data);
        filterDataAndRender(); // re-render
        mostrarDashboard(data);
      };

      input.addEventListener('blur', guardar);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') {
          td.textContent = originalValue;
        }
      });
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
    if (globalQuery) {
      const fuseResults = fuse.search(globalQuery).map(r => r.item);
      if (!fuseResults.includes(item)) return false;
    }

    for (const key in filters) {
      if (filters[key] && !(item[key] || '').toLowerCase().includes(filters[key])) {
        return false;
      }
    }

    return true;
  });

  renderResults(currentFilteredData);
  renderActiveFilters(filters); // 👈 ¡esto!
}


const activeFiltersDiv = document.getElementById('activeFilters');

function renderActiveFilters(filters) {
  activeFiltersDiv.innerHTML = '';

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      const chip = document.createElement('div');
      chip.className = 'filter-chip';

      chip.innerHTML = `
        <span>${key}: ${value}</span>
        <button data-key="${key}">&times;</button>
      `;

      chip.querySelector('button').addEventListener('click', () => {
        filterSelects[key].value = '';
        filterDataAndRender();
      });

      activeFiltersDiv.appendChild(chip);
    }
  });
}

// Dashboard
function mostrarDashboard(data) {
  const categorias = {};
  const sumaPorCedula = {};
  const cedulasPorCategoria = {}; // Evita duplicados por categoría

  data.forEach(item => {
    const cat = item["Categoría"] || "Sin Categoría";
    const cedula = item["Cédula"];
    const nombre = item["Nombre"] || "";
    const viga = parseFloat(item["Viga"]) || 0;
    const suelo = parseFloat(item["Suelo"]) || 0;
    const asimetrica = parseFloat(item["Asimétrica"]) || 0;

    const resultado = viga + suelo + asimetrica;
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
  Object.values(filterSelects).forEach(select => {
    select.value = '';
  });
  searchInput.value = '';
  filterDataAndRender();
});

// Llenar selects del form
const cedulaSelect = document.getElementById('cedulaSelect');
const aparatoSelect = document.getElementById('aparatoSelect');

function llenarFormSelects() {
  // Cédulas únicas
  const cedulas = [...new Set(data.map(d => d["Cédula"]).filter(c => c))].sort();
  cedulaSelect.innerHTML = '<option value="">--Seleccionar--</option>' + cedulas.map(c => `<option value="${c}">${c}</option>`).join('');

  // Aparatos únicos
  const aparatos = [...new Set(data.map(d => d["Aparato"]).filter(a => a))].sort();
  aparatoSelect.innerHTML = '<option value="">--Seleccionar--</option>' + aparatos.map(a => `<option value="${a}">${a}</option>`).join('');
}

// Llamar cuando cargamos datos (por ejemplo justo después de llenar los selects principales)
llenarFormSelects();

// Manejar el submit del form
document.getElementById('formAgregarResultado').addEventListener('submit', e => {
  e.preventDefault();

  const cedula = cedulaSelect.value.trim();
  const aparato = aparatoSelect.value.trim();
  const resultado = parseFloat(document.getElementById('resultadoInput').value);

  if (!cedula || !aparato || isNaN(resultado)) {
    document.getElementById('formMensaje').textContent = 'Por favor complete todos los campos correctamente.';
    return;
  }

  // Buscar info de la alumna por cédula para completar datos (ejemplo: nombre, club, categoría, nivel, turno)
  const alumna = data.find(d => d["Cédula"] === cedula);

  if (!alumna) {
    document.getElementById('formMensaje').textContent = 'Cédula no encontrada.';
    return;
  }

  // Crear nuevo objeto resultado
  const nuevoResultado = {
    "Cédula": cedula,
    "Nombre": alumna["Nombre"],
    "Club": alumna["Club"],
    "Categoría": alumna["Categoría"],
    "Nivel": alumna["Nivel"],
    "Aparato": aparato,
    "Turno": alumna["Turno"],
    "Resultado": resultado.toString()
  };

  // Agregar al arreglo data
  data.push(nuevoResultado);

  // Actualizar Fuse para búsqueda
  fuse.setCollection(data);

  // Actualizar selects si fuera necesario (opcional)
  llenarFormSelects();

  // Actualizar vista: renderizado resultados o dashboard según convenga
  filterDataAndRender();
  mostrarDashboard(data);

  document.getElementById('formMensaje').textContent = 'Resultado agregado correctamente.';

  // Resetear form
  e.target.reset();
});

document.getElementById('btnAgregarNuevaFila').addEventListener('click', () => {
  // Activar la pestaña de formulario
  const formTab = document.querySelector('.tab[data-tab="form"]');
  formTab.click();

  // Opcional: scrollear al formulario
  document.getElementById('tab-form').scrollIntoView({ behavior: 'smooth' });
});



