// ============================================================
// B17 - PERMISSIONS
// Gestión de permisos por proyecto, rol y módulo
//
// Fuente de verdad:
// Supabase -> public.core_my_permissions
//
// Principio:
// El frontend consulta permisos.
// La seguridad real permanece en Supabase / RLS.
// ============================================================

(() => {

  "use strict";

  // ==========================================================
  // 1. ESTADO GLOBAL DE PERMISOS
  // ==========================================================

  window.b17Permissions = [];
  window.b17PermissionSet = new Set();
  window.b17PermissionsLoaded = false;


  // ==========================================================
  // 2. OBTENER CLIENTE SUPABASE
  // ==========================================================

  function getSupabaseClient() {

    // La aplicación actual utiliza normalmente "sb".
    if (typeof sb !== "undefined" && sb) {
      return sb;
    }

    // Compatibilidad por si posteriormente exponemos el cliente
    // explícitamente en window.
    if (window.sb) {
      return window.sb;
    }

    console.error(
      "[B17] No se encontró el cliente Supabase."
    );

    return null;
  }


  // ==========================================================
  // 3. OBTENER PROYECTO ACTUAL
  // ==========================================================

  function getCurrentProjectId() {

    // B15 guarda el proyecto seleccionado.
    if (
      window.b15SelectedProject &&
      window.b15SelectedProject.project_id
    ) {
      return window.b15SelectedProject.project_id;
    }

    if (
      window.b15SelectedProject &&
      window.b15SelectedProject.id
    ) {
      return window.b15SelectedProject.id;
    }

    // Compatibilidad con posibles variables anteriores.
    if (
      window.currentProject &&
      window.currentProject.id
    ) {
      return window.currentProject.id;
    }

    if (window.currentProjectId) {
      return window.currentProjectId;
    }

    return null;
  }


  // ==========================================================
  // 4. CARGAR PERMISOS DEL USUARIO
  // ==========================================================

  async function b17LoadPermissions() {

    const client = getSupabaseClient();

    if (!client) {
      return [];
    }

    const projectId = getCurrentProjectId();

    if (!projectId) {

      console.warn(
        "[B17] Todavía no existe un proyecto activo."
      );

      window.b17Permissions = [];
      window.b17PermissionSet = new Set();
      window.b17PermissionsLoaded = false;

      return [];
    }


    const { data, error } = await client
      .from("core_my_permissions")
      .select(`
        project_id,
        user_id,
        role,
        permission_code,
        permission_name,
        action,
        module_code,
        module_name
      `)
      .eq("project_id", projectId);


    if (error) {

      console.error(
        "[B17] Error cargando permisos:",
        error
      );

      window.b17Permissions = [];
      window.b17PermissionSet = new Set();
      window.b17PermissionsLoaded = false;

      return [];
    }


    window.b17Permissions = data || [];

    window.b17PermissionSet = new Set(
      window.b17Permissions.map(
        item => item.permission_code
      )
    );

    window.b17PermissionsLoaded = true;


    console.log(
      `[B17] ${window.b17Permissions.length} permisos cargados.`
    );

    console.table(
      window.b17Permissions.map(item => ({
        module: item.module_code,
        permission: item.permission_code,
        action: item.action
      }))
    );


    document.dispatchEvent(
      new CustomEvent(
        "b17:permissions-loaded",
        {
          detail: {
            projectId,
            permissions: window.b17Permissions
          }
        }
      )
    );


    return window.b17Permissions;
  }


  // ==========================================================
  // 5. VERIFICAR UN PERMISO
  //
  // Ejemplo:
  //
  // b17Can("planning.create")
  // b17Can("quality.validate")
  // ==========================================================

  function b17Can(permissionCode) {

    if (!permissionCode) {
      return false;
    }

    return window.b17PermissionSet.has(
      permissionCode
    );
  }


  // ==========================================================
  // 6. VERIFICAR VARIOS PERMISOS
  // ==========================================================

  function b17CanAny(permissionCodes = []) {

    if (!Array.isArray(permissionCodes)) {
      return false;
    }

    return permissionCodes.some(
      permission => b17Can(permission)
    );
  }


  function b17CanAll(permissionCodes = []) {

    if (!Array.isArray(permissionCodes)) {
      return false;
    }

    return permissionCodes.every(
      permission => b17Can(permission)
    );
  }


  // ==========================================================
  // 7. OBTENER PERMISOS POR MÓDULO
  // ==========================================================

  function b17PermissionsForModule(moduleCode) {

    if (!moduleCode) {
      return [];
    }

    return window.b17Permissions.filter(
      item => item.module_code === moduleCode
    );
  }


  // ==========================================================
  // 8. SABER SI EL USUARIO TIENE ACCESO AL MÓDULO
  // ==========================================================

  function b17CanAccessModule(moduleCode) {

    return b17PermissionsForModule(
      moduleCode
    ).length > 0;
  }


  // ==========================================================
  // 9. PROTEGER ELEMENTOS HTML POR PERMISO
  //
  // Uso futuro:
  //
  // <button data-permission="quality.validate">
  //   Validar
  // </button>
  //
  // Si no tiene permiso, B17 lo oculta.
  // ==========================================================

  function b17ApplyPermissionUI(root = document) {

    if (!root) {
      return;
    }

    const elements =
      root.querySelectorAll(
        "[data-permission]"
      );

    elements.forEach(element => {

      const permission =
        element.dataset.permission;

      if (!permission) {
        return;
      }

      const allowed =
        b17Can(permission);

      element.hidden = !allowed;

      element.setAttribute(
        "aria-hidden",
        allowed ? "false" : "true"
      );

    });

  }


  // ==========================================================
  // 10. PROTEGER ELEMENTOS POR MÓDULO
  //
  // Uso futuro:
  //
  // data-module-permission="QUALITY"
  // ==========================================================

  function b17ApplyModuleUI(root = document) {

    if (!root) {
      return;
    }

    const elements =
      root.querySelectorAll(
        "[data-module-permission]"
      );

    elements.forEach(element => {

      const moduleCode =
        element.dataset.modulePermission;

      if (!moduleCode) {
        return;
      }

      const allowed =
        b17CanAccessModule(moduleCode);

      element.hidden = !allowed;

      element.setAttribute(
        "aria-hidden",
        allowed ? "false" : "true"
      );

    });

  }


  // ==========================================================
  // 11. APLICAR SEGURIDAD VISUAL
  // ==========================================================

  function b17ApplySecurityUI(root = document) {

    b17ApplyPermissionUI(root);
    b17ApplyModuleUI(root);

  }


  // ==========================================================
  // 12. RECARGAR PERMISOS
  //
  // Se utilizará al cambiar de proyecto.
  // ==========================================================

  async function b17RefreshPermissions() {

    window.b17Permissions = [];
    window.b17PermissionSet = new Set();
    window.b17PermissionsLoaded = false;

    const permissions =
      await b17LoadPermissions();

    b17ApplySecurityUI();

    return permissions;
  }


  // ==========================================================
  // 13. DIAGNÓSTICO
  //
  // Desde consola:
  //
  // b17DebugPermissions()
  // ==========================================================

  function b17DebugPermissions() {

    const projectId =
      getCurrentProjectId();

    const result = {

      projectId,

      loaded:
        window.b17PermissionsLoaded,

      total:
        window.b17Permissions.length,

      role:
        window.b17Permissions[0]?.role || null,

      modules:
        [
          ...new Set(
            window.b17Permissions.map(
              item => item.module_code
            )
          )
        ],

      permissions:
        [
          ...window.b17PermissionSet
        ]

    };


    console.log(
      "[B17] Estado de permisos"
    );

    console.log(result);

    console.table(
      window.b17Permissions
    );

    return result;
  }


  // ==========================================================
  // 14. EXPONER API B17
  // ==========================================================

  window.b17LoadPermissions =
    b17LoadPermissions;

  window.b17RefreshPermissions =
    b17RefreshPermissions;

  window.b17Can =
    b17Can;

  window.b17CanAny =
    b17CanAny;

  window.b17CanAll =
    b17CanAll;

  window.b17PermissionsForModule =
    b17PermissionsForModule;

  window.b17CanAccessModule =
    b17CanAccessModule;

  window.b17ApplyPermissionUI =
    b17ApplyPermissionUI;

  window.b17ApplyModuleUI =
    b17ApplyModuleUI;

  window.b17ApplySecurityUI =
    b17ApplySecurityUI;

  window.b17DebugPermissions =
    b17DebugPermissions;


  // ==========================================================
  // 15. INTEGRACIÓN CON B15
  //
  // B15 selecciona el proyecto.
  // Cuando exista proyecto activo intentamos cargar permisos.
  // ==========================================================

  async function tryInitialLoad() {

    const projectId =
      getCurrentProjectId();

    if (!projectId) {
      return;
    }

    await b17RefreshPermissions();

  }


  // Ejecutamos después de que los scripts anteriores
  // hayan terminado su inicialización.
  setTimeout(
    tryInitialLoad,
    500
  );

// ==========================================================
// 16. RECARGAR PERMISOS AL ABRIR/CAMBIAR PROYECTO
// ==========================================================

if (typeof window.b15OpenProject === "function") {

  const b17OriginalOpenProject =
    window.b15OpenProject;

  window.b15OpenProject =
    async function(projectId) {

      await b17OriginalOpenProject(projectId);

      await b17RefreshPermissions();

    };

}
  console.log(
    "[B17] Motor de permisos cargado."
  );

})();
