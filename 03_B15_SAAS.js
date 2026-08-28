// ============================================================
// B15 — CAPA VISUAL SaaS
// MIS PROYECTOS / SELECCIÓN DE PROYECTO
//
// Cargar DESPUÉS de:
// app.js
// supervisor.js
// 02_FASE2_1.js
// ============================================================

window.b15Projects = [];
window.b15SelectedProject = null;


// ============================================================
// BRANDING DINÁMICO
// ============================================================

function b15SetBrand(project = null) {

  const brand =
    project?.brand_name ||
    'Project Management';

  const h1 = document.querySelector('header h1');
  const sub = document.querySelector('header .sub');

  if (h1) h1.textContent = brand;

  if (sub) {
    sub.textContent = project
      ? `${project.organization_name} · ${project.project_name}`
      : 'Gestión integral de proyectos';
  }

  document.title = brand;
}


// ============================================================
// CREAR SECCIÓN "MIS PROYECTOS"
// ============================================================

function b15EnsureProjectSection() {

  if (document.getElementById('projectSelectorSection')) {
    return;
  }

  const main = document.querySelector('main');

  const section = document.createElement('section');

  section.id = 'projectSelectorSection';
  section.className = 'section';

  main.insertBefore(
    section,
    document.getElementById('appSection')
  );
}


// ============================================================
// TARJETA DE PROYECTO
// ============================================================

function b15ProjectCard(p) {

  return `
    <div
      class="card"
      style="cursor:pointer"
      onclick="b15OpenProject('${p.project_id}')"
    >

      <div style="
        display:flex;
        justify-content:space-between;
        gap:15px;
        align-items:flex-start;
        flex-wrap:wrap;
      ">

        <div>

          <div class="muted">
            ${esc(p.organization_name || '')}
          </div>

          <h2 style="margin-top:5px;margin-bottom:7px">
            ${esc(p.project_name)}
          </h2>

          <div style="font-size:11px">

            <b>Código:</b>
            ${esc(p.project_code || '—')}

            &nbsp; · &nbsp;

            <b>Tipo:</b>
            ${esc(p.project_type_name || 'Proyecto')}

          </div>

          ${
            p.location
              ? `
                <div class="muted" style="margin-top:6px">
                  ${esc(p.location)}
                </div>
              `
              : ''
          }

        </div>


        <div style="text-align:right">

          <span class="badge">
            ${esc(roleName(p.project_role))}
          </span>

          <div style="margin-top:12px">

            <button
              class="primary"
              onclick="
                event.stopPropagation();
                b15OpenProject('${p.project_id}')
              "
            >
              Abrir proyecto
            </button>

          </div>

        </div>

      </div>

    </div>
  `;
}


// ============================================================
// RENDERIZAR MIS PROYECTOS
// ============================================================

function b15RenderProjects() {

  b15EnsureProjectSection();

  const section =
    document.getElementById('projectSelectorSection');

  const projects =
    window.b15Projects || [];

  section.innerHTML = `

    <div class="card">

      <div style="
        display:flex;
        justify-content:space-between;
        gap:15px;
        align-items:center;
        flex-wrap:wrap;
      ">

        <div>

          <h2 style="margin-bottom:5px">
            Mis proyectos
          </h2>

          <div class="muted">
            Selecciona el proyecto que deseas gestionar.
          </div>

        </div>

        <div style="font-size:11px">
          ${projects.length}
          ${projects.length === 1 ? 'proyecto' : 'proyectos'}
        </div>

      </div>

    </div>

    ${
      projects.length

        ? projects
            .map(b15ProjectCard)
            .join('')

        : `
          <div class="card">
            <h2>Sin proyectos disponibles</h2>

            <p class="muted">
              Tu usuario todavía no tiene acceso
              a ningún proyecto activo.
            </p>
          </div>
        `
    }

  `;
}


// ============================================================
// ABRIR PROYECTO
// ============================================================

async function b15OpenProject(projectId) {

  const project =
    (window.b15Projects || [])
      .find(
        x => String(x.project_id) === String(projectId)
      );

  const projectContext =
    (contexts || [])
      .find(
        x => String(x.project_id) === String(projectId)
      );


  if (!project || !projectContext) {

    alert(
      'No se pudo cargar el contexto del proyecto.'
    );

    return;
  }


  window.b15SelectedProject = project;

  ctx = projectContext;


  document
    .getElementById('projectSelectorSection')
    .classList.remove('active');


  $('appSection')
    .classList.add('active');


  $('userBox')
    .classList.remove('hidden');


  $('userBox').innerHTML = `

    <b>
      ${esc(
        ctx.display_name ||
        sessionUser.email
      )}
    </b>

    <br>

    ${esc(roleName(ctx.role))}
    ·
    ${esc(ctx.project_name)}

    ${
      ctx.discipline
        ? '<br>' + esc(ctx.discipline)
        : ''
    }

  `;


  b15SetBrand(project);

  configureNav();

  b15AddChangeProjectButton();

  await showPage('home');
}


// ============================================================
// VOLVER A MIS PROYECTOS
// ============================================================

function b15BackToProjects() {

  $('appSection')
    .classList.remove('active');


  document
    .getElementById('projectSelectorSection')
    .classList.add('active');


  $('userBox')
    .classList.remove('hidden');


  $('userBox').innerHTML = `

    <b>
      ${esc(sessionUser?.email || '')}
    </b>

    <br>

    Mis proyectos

  `;


  b15SetBrand(null);

  b15RenderProjects();
}


// ============================================================
// BOTÓN "MIS PROYECTOS"
// ============================================================

function b15AddChangeProjectButton() {

  const nav =
    document.querySelector('#appSection .nav');


  if (!nav) return;


  let button =
    document.getElementById('navProjects');


  if (!button) {

    button =
      document.createElement('button');

    button.id = 'navProjects';

    button.textContent = 'Mis proyectos';

    button.onclick = b15BackToProjects;


    const logoutButton =
      [...nav.querySelectorAll('button')]
        .find(
          x =>
            x.textContent.trim() === 'Salir'
        );


    if (logoutButton) {

      nav.insertBefore(
        button,
        logoutButton
      );

    } else {

      nav.appendChild(button);
    }
  }
}


// ============================================================
// NUEVO START APP
//
// Antes:
// login -> primer proyecto
//
// Ahora:
// login -> Mis proyectos -> proyecto seleccionado
// ============================================================

startApp = async function() {

  try {

    await sb.rpc('core_accept_my_invites');

  } catch (e) {

    console.warn(e);
  }


  // ----------------------------------------------------------
  // CONTEXTOS OPERATIVOS
  // ----------------------------------------------------------

  const contextResult =
    await sb
      .from('core_v_user_context')
      .select('*')
      .eq(
        'user_id',
        sessionUser.id
      );


  if (contextResult.error) {

    alert(
      'No se pudo cargar tu contexto: ' +
      contextResult.error.message
    );

    return;
  }


  contexts =
    contextResult.data || [];


  // ----------------------------------------------------------
  // MIS PROYECTOS SaaS
  // ----------------------------------------------------------

  const projectsResult =
    await sb
      .from('core_my_projects')
      .select('*')
      .order('organization_name')
      .order('project_name');


  if (projectsResult.error) {

    alert(
      'No se pudo cargar Mis proyectos: ' +
      projectsResult.error.message
    );

    return;
  }


  window.b15Projects =
    projectsResult.data || [];


  // ----------------------------------------------------------
  // USUARIO SIN PROYECTOS
  // ----------------------------------------------------------

  if (!window.b15Projects.length) {

    $('loginMsg').textContent =
      'Tu usuario aún no tiene proyectos disponibles.';

    await sb.auth.signOut();

    return;
  }


  // ----------------------------------------------------------
  // CERRAR LOGIN
  // ----------------------------------------------------------

  $('loginSection')
    .classList.remove('active');


  $('appSection')
    .classList.remove('active');


  $('userBox')
    .classList.remove('hidden');


  // ----------------------------------------------------------
  // MOSTRAR MIS PROYECTOS
  // ----------------------------------------------------------

  b15SetBrand(null);

  b15EnsureProjectSection();

  b15RenderProjects();


  document
    .getElementById('projectSelectorSection')
    .classList.add('active');


  $('userBox').innerHTML = `

    <b>
      ${esc(sessionUser.email)}
    </b>

    <br>

    Mis proyectos

  `;
};
