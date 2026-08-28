// ============================================================
// B18.1 - NAVEGACIÓN SEGÚN MÓDULOS + PERMISOS
//
// Regla:
// Botón visible =
// módulo habilitado
// +
// usuario con acceso al módulo
//
// B16:
// determina si el módulo está habilitado en el proyecto.
//
// B17:
// determina si el usuario tiene permisos sobre ese módulo.
//
// La seguridad real permanece en Supabase / RLS.
// ============================================================

(() => {

  "use strict";


  // ==========================================================
  // 1. MAPEO NAVEGACIÓN -> MÓDULO
  // ==========================================================

  const B18_NAV_MODULE_MAP = {

    navHome: "DASHBOARD",

    navPlan: "PLANNING",

    navReports: "CONSTRUCTION",

    navActions: "WORKFLOW",

    navTeam: "ORGANIZATION",

    navAdmin: "ADMINISTRATION"

  };


  // ==========================================================
  // 2. VERIFICAR ACCESO COMPLETO A MÓDULO
  // ==========================================================

  function b18CanUseModule(moduleCode) {

    if (!moduleCode) {
      return false;
    }


    const moduleEnabled =
      typeof window.b16HasModule === "function"
        ? window.b16HasModule(moduleCode)
        : false;


    const permissionGranted =
      typeof window.b17CanAccessModule === "function"
        ? window.b17CanAccessModule(moduleCode)
        : false;


    return (
      moduleEnabled &&
      permissionGranted
    );

  }


  // ==========================================================
  // 3. APLICAR NAVEGACIÓN
  // ==========================================================

  function b18ApplyNavigation() {

    Object.entries(
      B18_NAV_MODULE_MAP
    ).forEach(
      ([navId, moduleCode]) => {

        const element =
          document.getElementById(navId);

        if (!element) {
          return;
        }


        const allowed =
          b18CanUseModule(moduleCode);


        element.style.display =
          allowed ? "" : "none";

      }
    );


    // --------------------------------------------------------
    // Mis proyectos siempre visible
    // --------------------------------------------------------

    const navProjects =
      document.getElementById(
        "navProjects"
      );

    if (navProjects) {
      navProjects.style.display = "";
    }


    // --------------------------------------------------------
    // Salir siempre visible
    // --------------------------------------------------------

    const nav =
      document.querySelector(
        "#appSection .nav"
      );

    if (nav) {

      [...nav.querySelectorAll("button")]
        .forEach(button => {

          if (
            button.textContent.trim() ===
            "Salir"
          ) {

            button.style.display = "";

          }

        });

    }

  }


  // ==========================================================
  // 4. REAPLICAR CUANDO B17 TERMINE DE CARGAR
  // ==========================================================

  document.addEventListener(
    "b17:permissions-loaded",
    () => {

      b18ApplyNavigation();

    }
  );


  // ==========================================================
  // 5. EXTENDER configureNav
  // ==========================================================

  if (
    typeof configureNav === "function"
  ) {

    const b18OldConfigureNav =
      configureNav;


    configureNav =
    function() {

      b18OldConfigureNav();

      b18ApplyNavigation();

    };

  }


  // ==========================================================
  // 6. FUNCIÓN DE DIAGNÓSTICO
  // ==========================================================

  window.b18DebugNavigation =
  function() {

    const result = {};

    Object.entries(
      B18_NAV_MODULE_MAP
    ).forEach(
      ([navId, moduleCode]) => {

        result[navId] = {

          module: moduleCode,

          moduleEnabled:
            typeof window.b16HasModule ===
            "function"
              ? window.b16HasModule(
                  moduleCode
                )
              : false,

          permissionGranted:
            typeof window.b17CanAccessModule ===
            "function"
              ? window.b17CanAccessModule(
                  moduleCode
                )
              : false,

          visible:
            b18CanUseModule(
              moduleCode
            )

        };

      }
    );


    console.table(result);

    return result;

  };


  // ==========================================================
  // 7. EXPONER API
  // ==========================================================

  window.b18CanUseModule =
    b18CanUseModule;

  window.b18ApplyNavigation =
    b18ApplyNavigation;


  console.log(
    "[B18] Navegación por permisos cargada."
  );

})();
