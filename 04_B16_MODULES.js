// ============================================================
// B16 — MÓDULOS HABILITADOS POR PROYECTO
//
// Objetivos:
// 1. Cargar módulos habilitados desde Supabase.
// 2. Ocultar navegación no habilitada.
// 3. Preparar la app para distintos tipos de proyecto.
// 4. Mantener compatibilidad con la app actual.
// ============================================================

window.b16Modules = [];
window.b16ModuleCodes = new Set();


// ============================================================
// MAPEO ENTRE MÓDULOS Y NAVEGACIÓN ACTUAL
// ============================================================

const B16_NAV_MAP = {

  DASHBOARD: 'navHome',

  PLANNING: 'navPlan',

  CONSTRUCTION: 'navReports',

  WORKFLOW: 'navActions',

  ORGANIZATION: 'navTeam',

  ADMINISTRATION: 'navAdmin'

};


// ============================================================
// CARGAR MÓDULOS DEL PROYECTO
// ============================================================

async function b16LoadProjectModules() {

  if (!ctx?.project_id) {

    window.b16Modules = [];
    window.b16ModuleCodes = new Set();

    return;
  }


  const { data, error } =
    await sb
      .from('core_project_modules')
      .select(`
        id,
        project_id,
        is_enabled,
        module_id,
        core_modules (
          id,
          code,
          name,
          category,
          sort_order,
          is_active
        )
      `)
      .eq('project_id', ctx.project_id)
      .eq('is_enabled', true);


  if (error) {

    console.warn(
      'B16: no se pudieron cargar módulos',
      error
    );

    window.b16Modules = [];
    window.b16ModuleCodes = new Set();

    return;
  }


  const rows =
    (data || [])
      .filter(
        x =>
          x.core_modules &&
          x.core_modules.is_active !== false
      )
      .sort(
        (a, b) =>
          Number(
            a.core_modules.sort_order || 100
          ) -
          Number(
            b.core_modules.sort_order || 100
          )
      );


  window.b16Modules = rows;

  window.b16ModuleCodes =
    new Set(
      rows.map(
        x => x.core_modules.code
      )
    );
}


// ============================================================
// ¿MÓDULO HABILITADO?
// ============================================================

function b16HasModule(code) {

  return window.b16ModuleCodes.has(code);
}


// ============================================================
// APLICAR MÓDULOS A LA NAVEGACIÓN
// ============================================================

function b16ApplyNavigation() {

  Object.entries(B16_NAV_MAP)
    .forEach(([moduleCode, navId]) => {

      const el =
        document.getElementById(navId);

      if (!el) return;


      const enabled =
        b16HasModule(moduleCode);


      el.style.display =
        enabled ? '' : 'none';
    });


  // ----------------------------------------------------------
  // MIS PROYECTOS y SALIR siempre visibles
  // ----------------------------------------------------------

  const navProjects =
    document.getElementById('navProjects');

  if (navProjects) {
    navProjects.style.display = '';
  }


  const nav =
    document.querySelector(
      '#appSection .nav'
    );


  if (nav) {

    [...nav.querySelectorAll('button')]
      .forEach(btn => {

        if (
          btn.textContent.trim() === 'Salir'
        ) {
          btn.style.display = '';
        }

      });
  }
}


// ============================================================
// LISTA DE MÓDULOS HABILITADOS
// Para configuración / diagnóstico
// ============================================================

function b16ModulesSummary() {

  return (window.b16Modules || [])
    .map(
      x => ({
        code: x.core_modules.code,
        name: x.core_modules.name,
        category: x.core_modules.category
      })
    );
}


// ============================================================
// AGREGAR INFORMACIÓN DE MÓDULOS AL HOME
// SOLO ADMINISTRADORES / PM
// ============================================================

function b16CanSeeModuleSummary() {

  return [
    'admin',
    'project_manager',
    'construction_manager'
  ].includes(ctx?.role);
}


function b16RenderModuleSummary() {

  if (!b16CanSeeModuleSummary()) {
    return '';
  }


  const modules =
    b16ModulesSummary();


  if (!modules.length) {
    return '';
  }


  return `

    <div class="card">

      <h2>Módulos habilitados</h2>

      <div style="
        display:flex;
        gap:7px;
        flex-wrap:wrap;
      ">

        ${
          modules
            .map(
              m =>
                `<span class="badge">
                  ${esc(m.name)}
                </span>`
            )
            .join('')
        }

      </div>

    </div>

  `;
}


// ============================================================
// INTERCEPTAR renderProjectHome
// para mostrar módulos del proyecto
// ============================================================

const b16OldRenderProjectHome =
  renderProjectHome;


renderProjectHome =
async function() {

  await b16OldRenderProjectHome();

  if (!b16CanSeeModuleSummary()) {
    return;
  }


  $('pageHome').insertAdjacentHTML(
    'beforeend',
    b16RenderModuleSummary()
  );
};


// ============================================================
// INTERCEPTAR renderConstructionHome
// ============================================================

const b16OldRenderConstructionHome =
  renderConstructionHome;


renderConstructionHome =
async function() {

  await b16OldRenderConstructionHome();

  if (!b16CanSeeModuleSummary()) {
    return;
  }


  $('pageHome').insertAdjacentHTML(
    'beforeend',
    b16RenderModuleSummary()
  );
};


// ============================================================
// EXTENDER configureNav
//
// Primero aplica permisos de rol existentes.
// Luego aplica módulos habilitados.
// ============================================================

const b16OldConfigureNav =
  configureNav;


configureNav =
function() {

  b16OldConfigureNav();

  b16ApplyNavigation();
};


// ============================================================
// EXTENDER b15OpenProject
//
// Antes:
// abrir proyecto -> ctx -> navegación -> home
//
// Ahora:
// abrir proyecto
// -> ctx
// -> módulos habilitados
// -> navegación
// -> home
// ============================================================

const b16OldOpenProject =
  b15OpenProject;


b15OpenProject =
async function(projectId) {

  const projectContext =
    (contexts || [])
      .find(
        x =>
          String(x.project_id) ===
          String(projectId)
      );


  if (!projectContext) {

    alert(
      'No se pudo cargar el contexto del proyecto.'
    );

    return;
  }


  ctx = projectContext;


  // ----------------------------------------------------------
  // Cargar módulos antes de abrir
  // ----------------------------------------------------------

  await b16LoadProjectModules();


  // ----------------------------------------------------------
  // Continuar con lógica B15
  // ----------------------------------------------------------

  await b16OldOpenProject(projectId);


  // ----------------------------------------------------------
  // Reaplicar navegación por seguridad
  // ----------------------------------------------------------

  b16ApplyNavigation();
};


// ============================================================
// FUNCIÓN DE DIAGNÓSTICO
// ============================================================

window.b16Debug =
function() {

  console.table(
    b16ModulesSummary()
  );

  return {
    project: ctx?.project_name,
    modules: b16ModulesSummary()
  };
};
