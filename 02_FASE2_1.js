
// ============================================================
// V6 FASE 2.1 — Correcciones sobre Fase 2
// Cargar DESPUÉS de supervisor.js
// ============================================================

function f21CanPlan(){
  return ['admin','project_manager','construction_manager','project_controls','superintendent'].includes(ctx.role);
}
function f21CanConfigure(){
  return ['admin','project_manager','construction_manager'].includes(ctx.role);
}

// ---------- Catálogos ----------
getDisciplines=async function(){
  const {data,error}=await sb.from('core_disciplines')
    .select('id,code,name,sort_order')
    .eq('project_id',ctx.project_id).eq('is_active',true)
    .order('sort_order');
  if(error){console.warn(error);return []}
  return data||[];
};

getFrontsForMember=async function(){
  const a=await sb.from('core_v_member_fronts').select('*')
    .eq('project_id',ctx.project_id).eq('member_id',ctx.member_id);
  if(!a.error && a.data?.length)return a.data;

  let q=sb.from('core_fronts').select('id,code,name,discipline_id')
    .eq('project_id',ctx.project_id).eq('is_active',true).order('name');
  if(ctx.role==='supervisor' && ctx.discipline_id)q=q.eq('discipline_id',ctx.discipline_id);
  const r=await q;
  return (r.data||[]).map(x=>({
    front_id:x.id,front_code:x.code,front_name:x.name,discipline_id:x.discipline_id
  }));
};

async function f21RefreshCatalogs(){
  [window.v6Disciplines,window.v6Fronts]=await Promise.all([getDisciplines(),getFrontsForMember()]);
}
disciplineOptions=function(selected=''){
  return '<option value="">Seleccionar</option>'+
    (window.v6Disciplines||[]).map(x=>`<option value="${x.id}" ${String(x.id)===String(selected||ctx.discipline_id||'')?'selected':''}>${esc(x.name)}</option>`).join('');
};
frontOptions=function(selected='',discipline=''){
  return '<option value="">Seleccionar</option>'+
    (window.v6Fronts||[]).filter(x=>!discipline||!x.discipline_id||x.discipline_id===discipline)
      .map(x=>`<option value="${x.front_id}" ${String(x.front_id)===String(selected)?'selected':''}>${esc(x.front_name||x.front_code)}</option>`).join('');
};
frontName=function(id){
  return (window.v6Fronts||[]).find(x=>x.front_id===id)?.front_name||'';
};

// ---------- Producción: Plan Diario -> ejecución ----------
async function f21TodayPlans(){
  let q=sb.from('core_v_plan_vs_actual').select('*')
    .eq('project_id',ctx.project_id).eq('plan_date',today()).order('item');
  if(ctx.role==='supervisor')q=q.eq('assigned_member_id',ctx.member_id);
  const {data,error}=await q;
  if(error){console.warn(error);return []}
  return data||[];
}

productionModule=async function(){
  await f21RefreshCatalogs();
  const [plans,actsRes]=await Promise.all([
    f21TodayPlans(),
    sb.from('core_production_activities').select('*')
      .eq('report_id',window.v6Report.id).order('created_at',{ascending:false})
  ]);
  window.v6Plans=plans;
  const acts=actsRes.data||[];

  $('supervisorModule').innerHTML=`
  <div class="card"><h2>Plan del Día</h2>${renderPlanTable(plans)}</div>

  <div class="card">
   <h2>Registrar ejecución</h2>
   <div class="grid3">
    <div><label>Origen</label>
      <select id="f21Source" onchange="f21ToggleSource()">
       <option value="planned">Actividad programada</option>
       <option value="unplanned">Actividad no programada</option>
      </select>
    </div>
    <div style="grid-column:span 2"><label>Actividad programada</label>
      <select id="f21Plan" onchange="f21ApplyPlan()">
       <option value="">Seleccionar actividad</option>
       ${plans.map(x=>`<option value="${x.daily_plan_id}">${esc(x.element)} · ${esc(x.item)} · ${fmt(x.planned_qty,3)} ${esc(x.unit)}</option>`).join('')}
      </select>
    </div>
   </div>

   <div class="grid4" style="margin-top:10px">
    <div><label>Disciplina</label><select id="paDisc">${disciplineOptions()}</select></div>
    <div><label>Frente</label><select id="paFront">${frontOptions()}</select></div>
    <div><label>Elemento</label><input id="paElement"></div>
    <div><label>Partida</label><input id="paItem"></div>
    <div><label>Und.</label><input id="paUnit"></div>
    <div><label>Meta del día</label><input id="paPlanQty" type="number" step=".001" readonly></div>
    <div><label>Metrado ejecutado</label><input id="paQty" type="number" step=".001"></div>
    <div><label>Observación</label><input id="paObs" placeholder="Observación breve"></div>
   </div>

   <div style="margin-top:10px">
    <label>Fotos de la actividad</label>
    <input id="paPhotos" type="file" accept="image/*" multiple>
    <div class="muted">Puedes seleccionar varias fotos desde cámara o galería.</div>
   </div>

   <div class="actions"><button class="primary" data-permission="construction.execute" onclick="saveProduction()">Guardar ejecución</button></div>
   <div id="prodMsg" class="muted"></div>
  </div>

  <div class="card"><h2>Actividades registradas hoy</h2>${renderActivities(acts)}</div>`;
  f21ToggleSource();
};

function f21ToggleSource(){
  const unplanned=$('f21Source').value==='unplanned';
  $('f21Plan').disabled=unplanned;
  ['paDisc','paFront','paElement','paItem','paUnit'].forEach(id=>$(id).disabled=!unplanned);
  if(unplanned){
    $('f21Plan').value='';$('paPlanQty').value='';
    ['paElement','paItem','paUnit'].forEach(id=>$(id).value='');
    $('paFront').value='';
  }
}
function f21ApplyPlan(){
  const p=(window.v6Plans||[]).find(x=>String(x.daily_plan_id)===String($('f21Plan').value));
  if(!p)return;
  $('paDisc').value=p.discipline_id||'';
  $('paFront').innerHTML=frontOptions(p.front_id||'',p.discipline_id||'');
  $('paFront').value=p.front_id||'';
  $('paElement').value=p.element||'';
  $('paItem').value=p.item||'';
  $('paUnit').value=p.unit||'';
  $('paPlanQty').value=p.planned_qty??'';
}

saveProduction=async function(){
  const msg=$('prodMsg');msg.textContent='Guardando...';
  const planned=$('f21Source').value==='planned';
  const plan=planned?(window.v6Plans||[]).find(x=>String(x.daily_plan_id)===String($('f21Plan').value)):null;
  if(planned&&!plan){msg.textContent='Selecciona una actividad del Plan del Día.';return}

  const payload={
    report_id:window.v6Report.id,project_id:ctx.project_id,
    discipline_id:$('paDisc').value||ctx.discipline_id||null,
    front_id:$('paFront').value||null,
    element:$('paElement').value.trim(),item:$('paItem').value.trim(),
    unit:$('paUnit').value.trim(),planned_qty:Number($('paPlanQty').value||0),
    actual_qty:Number($('paQty').value||0),observation:$('paObs').value.trim(),
    is_unplanned:!planned,daily_plan_id:plan?.daily_plan_id||null
  };
  if(!payload.discipline_id||!payload.front_id||!payload.element||!payload.item||!payload.unit){
    msg.textContent='Faltan datos de la actividad.';return;
  }
  const ins=await sb.from('core_production_activities').insert(payload).select().single();
  if(ins.error){msg.textContent=ins.error.message;return}

  const files=[...($('paPhotos').files||[])];
  for(let i=0;i<files.length;i++){
    const f=files[i],ext=(f.name.split('.').pop()||'jpg').toLowerCase();
    const path=`${ctx.project_id}/production/${ins.data.id}/${crypto.randomUUID()}.${ext}`;
    msg.textContent=`Subiendo foto ${i+1} de ${files.length}...`;
    const up=await sb.storage.from(cfg.EVIDENCE_BUCKET).upload(path,f,{contentType:f.type||'image/jpeg'});
    if(up.error){console.warn(up.error);continue}
    await sb.from('core_activity_photos').insert({
      activity_id:ins.data.id,storage_path:path,captured_at:new Date().toISOString(),
      uploaded_by:sessionUser.id,description:'',comment:''
    });
  }
  await productionModule();
};

// ---------- Plan Diario: creación desde nivel superior ----------
const f21OldRenderPlan=renderPlan;
renderPlan=async function(){
  const canCreatePlan = window.b17Can?.('planning.create') === true;
  const canAssignTeam = window.b17Can?.('planning.team.assign') === true;

  if(!canCreatePlan && !canAssignTeam){
    return f21OldRenderPlan();
  }

  await f21RefreshCatalogs();

  const [p,m]=await Promise.all([
    sb.from('core_v_plan_vs_actual')
      .select('*')
      .eq('project_id',ctx.project_id)
      .eq('plan_date',today())
      .order('item'),

    sb.from('core_project_members')
      .select('id,display_name,role,discipline_id,reports_to_member_id')
      .eq('project_id',ctx.project_id)
      .eq('is_active',true)
  ]);

  const plans=p.data||[];
  const members=m.data||[];

  const formalPlanCard = canCreatePlan ? `
  <div class="card">
   <h2>Asignar actividad al Plan Diario</h2>
   <div class="grid4">
    <div><label>Disciplina</label><select id="dpDisc" onchange="f21PlanDisc()">${disciplineOptions()}</select></div>
    <div><label>Frente</label><select id="dpFront">${frontOptions()}</select></div>
    <div><label>Responsable</label><select id="dpMember"><option value="">Seleccionar</option>${members.map(x=>`<option value="${x.id}" data-disc="${x.discipline_id||''}">${esc(x.display_name)} · ${esc(roleName(x.role))}</option>`).join('')}</select></div>
    <div><label>Turno</label><select id="dpShift"><option>Día</option><option>Noche</option></select></div>
    <div><label>Elemento</label><input id="dpElement"></div>
    <div><label>Partida</label><input id="dpItem"></div>
    <div><label>Und.</label><input id="dpUnit"></div>
    <div><label>Meta del día</label><input id="dpQty" type="number" step=".001"></div>
   </div>
   <div class="actions">
    <button class="primary" data-permission="planning.create" onclick="f21SavePlan()">Asignar al Plan del Día</button>
   </div>
   <div id="dpMsg" class="muted"></div>
  </div>` : '';

  const operationalCard = canAssignTeam ? `
  <div class="card">
    <h2>Asignación operativa</h2>
    <p class="muted">
      Distribución de trabajo al equipo durante el turno.
    </p>
    <div class="muted">
      B18.3 · Formulario de asignación operativa en preparación.
    </div>
  </div>` : '';

  $('pagePlan').innerHTML=`
    <div class="card">
      <h2>Plan Diario · ${today()}</h2>
      ${renderPlanTable(plans)}
    </div>

    ${formalPlanCard}
    ${operationalCard}
  `;
};
  const d=$('dpDisc').value;
  $('dpFront').innerHTML=frontOptions('',d);
  [...$('dpMember').options].forEach((o,i)=>{if(i)o.hidden=!!d&&!!o.dataset.disc&&o.dataset.disc!==d});
}
async function f21SavePlan(){
  const p={
    project_id:ctx.project_id,discipline_id:$('dpDisc').value,front_id:$('dpFront').value||null,
    assigned_member_id:$('dpMember').value||null,plan_date:today(),shift_name:$('dpShift').value,
    element:$('dpElement').value.trim(),item:$('dpItem').value.trim(),unit:$('dpUnit').value.trim(),
    planned_qty:Number($('dpQty').value||0),notes:'',status:'open'
  };
  if(!p.discipline_id||!p.front_id||!p.assigned_member_id||!p.element||!p.item||!p.unit){
    $('dpMsg').textContent='Completa Disciplina, Frente, Responsable, Elemento, Partida y Unidad.';return;
  }
  const r=await sb.from('core_daily_plan').insert(p);
  $('dpMsg').textContent=r.error?r.error.message:'Actividad asignada.';
  if(!r.error)await renderPlan();
}

// ---------- Configuración: disciplinas, frentes, jerarquía ----------
const f21OldAdmin=renderAdmin;
renderAdmin=async function(){
  if(!f21CanConfigure())return f21OldAdmin();
  await f21RefreshCatalogs();
  const [m,f]=await Promise.all([
    sb.from('core_project_members').select('id,display_name,role,discipline_id').eq('project_id',ctx.project_id).eq('is_active',true),
    sb.from('core_fronts').select('id,code,name,discipline_id').eq('project_id',ctx.project_id).eq('is_active',true).order('name')
  ]);
  const members=m.data||[],fronts=f.data||[];
  $('pageAdmin').innerHTML=`
  <div class="card"><h2>Datos maestros</h2>
   <p><b>Disciplinas:</b> ${(window.v6Disciplines||[]).map(x=>esc(x.name)).join(' · ')||'—'}</p>
   <p><b>Frentes:</b> ${fronts.map(x=>esc(x.name)).join(' · ')||'—'}</p>
  </div>
  <div class="grid3">
   <div class="card"><h2>Agregar disciplina</h2>
    <label>Código</label><input id="cfgDCode"><label style="margin-top:7px">Nombre</label><input id="cfgDName">
    <div class="actions"><button class="primary" data-permission="administration.manage" onclick="f21AddDisc()">Agregar</button></div>
   </div>
   <div class="card"><h2>Agregar frente</h2>
    <label>Disciplina</label><select id="cfgFDisc">${disciplineOptions()}</select>
    <label style="margin-top:7px">Código</label><input id="cfgFCode">
    <label style="margin-top:7px">Nombre</label><input id="cfgFName">
    <div class="actions"><button class="primary" data-permission="administration.manage" onclick="f21AddFront()">Agregar</button></div>
   </div>
   <div class="card"><h2>Invitar miembro</h2>
    <label>Nombre</label><input id="invName">
    <label style="margin-top:7px">Correo</label><input id="invEmail" type="email">
    <label style="margin-top:7px">Rol</label><select id="invRole">${roleOptions(ctx.role)}</select>
    <label style="margin-top:7px">Disciplina</label><select id="invDisc">${disciplineOptions()}</select>
    <label style="margin-top:7px">Reporta a</label><select id="invBoss"><option value="">—</option>${members.map(x=>`<option value="${x.id}">${esc(x.display_name)} · ${esc(roleName(x.role))}</option>`).join('')}</select>
    <div class="actions">
  <button
    class="primary"
    data-permission="organization.manage"
    onclick="sendInvite()"
  >
    Crear invitación
  </button>
</div>
<div id="invMsg" class="muted"></div>
   </div>
  </div>`;
};
async function f21AddDisc(){
  const p={project_id:ctx.project_id,code:$('cfgDCode').value.trim().toUpperCase(),name:$('cfgDName').value.trim(),sort_order:(window.v6Disciplines||[]).length+1,is_active:true};
  if(!p.code||!p.name)return alert('Completa código y nombre.');
  const r=await sb.from('core_disciplines').insert(p);if(r.error)alert(r.error.message);else await renderAdmin();
}
async function f21AddFront(){
  const p={project_id:ctx.project_id,discipline_id:$('cfgFDisc').value||null,code:$('cfgFCode').value.trim().toUpperCase(),name:$('cfgFName').value.trim(),is_active:true};
  if(!p.discipline_id||!p.name)return alert('Selecciona disciplina y escribe el frente.');
  const r=await sb.from('core_fronts').insert(p);if(r.error)alert(r.error.message);else await renderAdmin();
}

// ---------- Organización ----------
renderTeam=async function(){
  const {data,error}=await sb.from('core_v_organization').select('*').eq('project_id',ctx.project_id);
  $('pageTeam').innerHTML=`<div class="card"><h2>Organización</h2>${error?esc(error.message):`<div class="table"><table><thead><tr><th>Nombre</th><th>Rol</th><th>Disciplina</th><th>Reporta a</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td>${esc(x.display_name)}</td><td>${esc(roleName(x.role))}</td><td>${esc(x.discipline||'—')}</td><td>${esc(x.reports_to||'—')}</td></tr>`).join('')}</tbody></table></div>`}</div>`;
};

// ---------- UI corrections ----------
const f21OldShowPage=showPage;
showPage=async function(name){
  await f21OldShowPage(name);
  if($('navTeam'))$('navTeam').textContent='Organización';
  if(name==='home'){
    const cards=[...$('pageHome').querySelectorAll('.card')].filter(x=>x.querySelector('h2')?.textContent.trim()==='Prueba de interfaz');
    cards.slice(1).forEach(x=>x.remove());
  }
};

// El F2 original añade una tarjeta de prueba; este guard evita duplicados posteriores.
setTimeout(()=>{
  if($('navTeam'))$('navTeam').textContent='Organización';
  const cards=[...document.querySelectorAll('#pageHome .card')].filter(x=>x.querySelector('h2')?.textContent.trim()==='Prueba de interfaz');
  cards.slice(1).forEach(x=>x.remove());
},300);
