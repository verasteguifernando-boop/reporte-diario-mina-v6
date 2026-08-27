
// ============================================================
// V6 FASE 2 - SUPERVISOR OPERATIVO
// Cargar DESPUÉS de app.js
// ============================================================

async function getFrontsForMember(){
  let {data,error}=await sb.from('core_v_member_fronts')
    .select('*').eq('project_id',ctx.project_id).eq('member_id',ctx.member_id);
  if(error) return [];
  if(data?.length) return data;
  // fallback útil para admin/pruebas
  let q=sb.from('core_fronts').select('id,code,name,discipline_id')
    .eq('project_id',ctx.project_id).eq('is_active',true);
  if(ctx.discipline_id) q=q.eq('discipline_id',ctx.discipline_id);
  const r=await q;
  return (r.data||[]).map(x=>({front_id:x.id,front_code:x.code,front_name:x.name,discipline_id:x.discipline_id}));
}
async function getDisciplines(){
  const {data}=await sb.from('core_disciplines').select('id,code,name')
    .eq('project_id',ctx.project_id).eq('is_active',true).order('sort_order');
  return data||[];
}
async function ensureTodayReport(){
  const date=today();
  let {data,error}=await sb.from('core_shift_reports').select('*')
    .eq('project_id',ctx.project_id).eq('member_id',ctx.member_id)
    .eq('report_date',date).order('created_at',{ascending:false}).limit(1);
  if(error) throw error;
  if(data?.length) return data[0];

  const payload={
    project_id:ctx.project_id, member_id:ctx.member_id,
    discipline_id:ctx.discipline_id||null, report_date:date,
    shift_name:'Día', start_time:'07:00', end_time:'19:00',
    status:'draft', general_observation:''
  };
  const ins=await sb.from('core_shift_reports').insert(payload).select().single();
  if(ins.error) throw ins.error;
  return ins.data;
}
async function supervisorWorkspace(){
  const [report,fronts,disciplines]=await Promise.all([ensureTodayReport(),getFrontsForMember(),getDisciplines()]);
  window.v6Report=report; window.v6Fronts=fronts; window.v6Disciplines=disciplines;
  $('pageReports').innerHTML=`
    <div class="card">
      <h2>Reporte de Campo · ${today()}</h2>
      <div class="grid4">
        <div><label>Fecha</label><input value="${today()}" disabled></div>
        <div><label>Hora inicio</label><input id="srStart" type="time" value="${String(report.start_time||'07:00').slice(0,5)}"></div>
        <div><label>Hora fin</label><input id="srEnd" type="time" value="${String(report.end_time||'19:00').slice(0,5)}"></div>
        <div><label>Estado</label><input value="${esc(report.status||'draft')}" disabled></div>
      </div>
      <div class="actions"><button class="secondary" onclick="saveShiftHeader()">Guardar horario</button><button class="green" onclick="submitShiftReport()">Enviar reporte del día</button></div>
      <div id="shiftMsg" class="muted"></div>
    </div>

    <div class="nav" id="supervisorTabs">
      <button class="active" onclick="showSupervisorModule('production',this)">Producción</button>
      <button onclick="showSupervisorModule('resources',this)">Personal / Equipos</button>
      <button onclick="showSupervisorModule('safety',this)">Seguridad</button>
      <button onclick="showSupervisorModule('quality',this)">Calidad</button>
      <button onclick="showSupervisorModule('procurement',this)">Procura</button>
      <button onclick="showSupervisorModule('constraints',this)">Restricciones</button>
    </div>
    <div id="supervisorModule"></div>`;
  await showSupervisorModule('production',document.querySelector('#supervisorTabs button'));
}
async function showSupervisorModule(name,btn){
  document.querySelectorAll('#supervisorTabs button').forEach(x=>x.classList.remove('active'));
  if(btn)btn.classList.add('active');
  if(name==='production')await productionModule();
  if(name==='resources')await resourcesModule();
  if(name==='safety')await safetyModule();
  if(name==='quality')await qualityModule();
  if(name==='procurement')await procurementModule();
  if(name==='constraints')await constraintsModule();
}
function disciplineOptions(){
 return `<option value="">Seleccionar</option>`+(window.v6Disciplines||[]).map(x=>`<option value="${x.id}" ${x.id===ctx.discipline_id?'selected':''}>${esc(x.name)}</option>`).join('');
}
function frontOptions(){
 return `<option value="">Seleccionar</option>`+(window.v6Fronts||[]).map(x=>`<option value="${x.front_id}">${esc(x.front_name||x.front_code)}</option>`).join('');
}

async function productionModule(){
 const {data:plans}=await sb.from('core_v_plan_vs_actual').select('*')
   .eq('project_id',ctx.project_id).eq('plan_date',today()).order('item');
 const {data:acts}=await sb.from('core_production_activities').select('*')
   .eq('report_id',window.v6Report.id).order('created_at',{ascending:false});
 $('supervisorModule').innerHTML=`
 <div class="card"><h2>Plan del Día</h2>${renderPlanTable(plans||[])}</div>
 <div class="card"><h2>Registrar actividad / metrado</h2>
   <div class="grid4">
    <div><label>Disciplina</label><select id="paDisc">${disciplineOptions()}</select></div>
    <div><label>Frente</label><select id="paFront">${frontOptions()}</select></div>
    <div><label>Elemento</label><input id="paElement" placeholder="Ej. Pedestal P-02"></div>
    <div><label>Partida</label><input id="paItem" placeholder="Ej. Concreto estructural"></div>
    <div><label>Und.</label><input id="paUnit" placeholder="m3"></div>
    <div><label>Metrado ejecutado</label><input id="paQty" type="number" step="0.001"></div>
    <div style="grid-column:span 2"><label>Observación</label><input id="paObs" placeholder="Observación breve"></div>
   </div>
   <div style="margin-top:10px"><label>Fotos de la actividad (cámara o galería)</label>
     <input id="paPhotos" type="file" accept="image/*" multiple>
     <div class="muted">Puedes seleccionar varias fotografías. Se vincularán a esta actividad.</div>
   </div>
   <div class="actions"><button class="primary" onclick="saveProduction()">Guardar actividad</button></div>
   <div id="prodMsg" class="muted"></div>
 </div>
 <div class="card"><h2>Actividades registradas hoy</h2>
 ${renderActivities(acts||[])}</div>`;
}
function renderActivities(rows){
 if(!rows.length)return '<span class="muted">Todavía no registraste actividades.</span>';
 return `<div class="table"><table><thead><tr><th>Frente</th><th>Elemento</th><th>Partida</th><th>Und.</th><th>Metrado</th><th>Observación</th></tr></thead><tbody>
 ${rows.map(x=>`<tr><td>${esc(frontName(x.front_id))}</td><td>${esc(x.element)}</td><td>${esc(x.item)}</td><td>${esc(x.unit)}</td><td>${fmt(x.actual_qty,3)}</td><td>${esc(x.observation||'')}</td></tr>`).join('')}
 </tbody></table></div>`;
}
function frontName(id){return (window.v6Fronts||[]).find(x=>x.front_id===id)?.front_name||''}
async function saveProduction(){
 const msg=$('prodMsg');msg.textContent='Guardando...';
 const payload={
  report_id:window.v6Report.id,project_id:ctx.project_id,
  discipline_id:$('paDisc').value||ctx.discipline_id||null,
  front_id:$('paFront').value||null,element:$('paElement').value.trim(),
  item:$('paItem').value.trim(),unit:$('paUnit').value.trim(),
  actual_qty:Number($('paQty').value||0),planned_qty:0,
  observation:$('paObs').value.trim(),is_unplanned:true
 };
 if(!payload.front_id||!payload.element||!payload.item||!payload.unit){msg.textContent='Completa Frente, Elemento, Partida y Unidad.';return}
 const {data,error}=await sb.from('core_production_activities').insert(payload).select().single();
 if(error){msg.textContent=error.message;return}
 const files=[...($('paPhotos').files||[])];
 if(files.length) await uploadActivityPhotos(data,files,msg);
 msg.textContent=`Actividad guardada${files.length?' con '+files.length+' foto(s)':''}.`;
 await productionModule();
}
async function uploadActivityPhotos(activity,files,msg){
 // Storage path; evidence row insertion is attempted only if schema supports expected fields.
 for(let i=0;i<files.length;i++){
   const f=files[i],ext=(f.name.split('.').pop()||'jpg').toLowerCase();
   const path=`${ctx.project_id}/${today()}/${activity.id}/${crypto.randomUUID()}.${ext}`;
   msg.textContent=`Subiendo foto ${i+1} de ${files.length}...`;
   const up=await sb.storage.from(cfg.EVIDENCE_BUCKET).upload(path,f,{contentType:f.type||'image/jpeg',upsert:false});
   if(up.error){console.warn('Foto no subida:',up.error.message);continue}
   // Different earlier schemas may name evidence columns differently.
   // We keep the file safely in Storage; metadata wiring can be adapted after inspecting the table.
 }
}

async function resourcesModule(){
 const [{data:mp},{data:eq}]=await Promise.all([
  sb.from('core_manpower_entries').select('*').eq('report_id',window.v6Report.id),
  sb.from('core_equipment_entries').select('*').eq('report_id',window.v6Report.id)
 ]);
 $('supervisorModule').innerHTML=`
 <div class="grid3">
  <div class="card" style="grid-column:span 2"><h2>Personal</h2>
   <div class="grid4"><div><label>Frente</label><select id="mpFront">${frontOptions()}</select></div><div><label>Categoría</label><input id="mpCat" placeholder="Operario"></div><div><label>Cantidad</label><input id="mpQty" type="number"></div><div><label>Horas</label><input id="mpHours" type="number" step=".5"></div></div>
   <div class="actions"><button class="primary" onclick="addManpower()">Agregar personal</button></div>
   ${simpleResourceTable(mp||[],'manpower')}
  </div>
  <div class="card"><h2>Resumen HH</h2><div class="kpi"><b>${fmt((mp||[]).reduce((s,x)=>s+Number(x.quantity||0)*Number(x.hours||0),0))}</b><span>HH del reporte</span></div></div>
 </div>
 <div class="card"><h2>Equipos</h2>
  <div class="grid4"><div><label>Frente</label><select id="eqFront">${frontOptions()}</select></div><div><label>Equipo</label><input id="eqName" placeholder="Excavadora"></div><div><label>Cantidad</label><input id="eqQty" type="number"></div><div><label>Horas</label><input id="eqHours" type="number" step=".5"></div></div>
  <div class="actions"><button class="primary" onclick="addEquipment()">Agregar equipo</button></div>
  ${simpleResourceTable(eq||[],'equipment')}
 </div>`;
}
function simpleResourceTable(rows,type){
 if(!rows.length)return '<p class="muted">Sin registros.</p>';
 return `<div class="table" style="margin-top:10px"><table><thead><tr><th>Frente</th><th>${type==='manpower'?'Categoría':'Equipo'}</th><th>Cant.</th><th>Horas</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(frontName(x.front_id))}</td><td>${esc(type==='manpower'?x.category:x.equipment_name)}</td><td>${fmt(x.quantity,0)}</td><td>${fmt(x.hours)}</td></tr>`).join('')}</tbody></table></div>`
}
async function addManpower(){
 const {error}=await sb.from('core_manpower_entries').insert({report_id:window.v6Report.id,front_id:$('mpFront').value||null,category:$('mpCat').value.trim(),quantity:Number($('mpQty').value||0),hours:Number($('mpHours').value||0)});
 if(error)alert(error.message);else await resourcesModule();
}
async function addEquipment(){
 const {error}=await sb.from('core_equipment_entries').insert({report_id:window.v6Report.id,front_id:$('eqFront').value||null,equipment_name:$('eqName').value.trim(),quantity:Number($('eqQty').value||0),hours:Number($('eqHours').value||0)});
 if(error)alert(error.message);else await resourcesModule();
}

async function safetyModule(){
 const {data}=await sb.from('core_safety_daily').select('*').eq('report_id',window.v6Report.id).limit(1);
 const s=data?.[0]||{};
 const ck=(x)=>x?'checked':'';
 $('supervisorModule').innerHTML=`
 <div class="card"><h2>Seguridad · registro mínimo diario</h2>
 <p class="muted">Solo registramos lo necesario para los KPI. Los formatos físicos/digitales pueden mantenerse como evidencia.</p>
 <div class="grid3">
  <div><h3>OTC</h3><label><input id="otcReq" type="checkbox" ${ck(s.otc_required)}> Requerido</label><label><input id="otcDone" type="checkbox" ${ck(s.otc_done)}> Realizado</label></div>
  <div><h3>RACS</h3><label><input id="racsReq" type="checkbox" ${ck(s.racs_required)}> Requerido</label><label><input id="racsDone" type="checkbox" ${ck(s.racs_done)}> Realizado</label></div>
  <div><h3>IPERC</h3><label><input id="ipercReq" type="checkbox" ${ck(s.iperc_required)}> Requerido</label><label><input id="ipercDone" type="checkbox" ${ck(s.iperc_done)}> Realizado</label></div>
 </div>
 <div class="grid3" style="margin-top:10px"><div><label>Incidentes</label><input id="incidents" type="number" value="${s.incidents||0}"></div><div><label>Accidentes</label><input id="accidents" type="number" value="${s.accidents||0}"></div><div><label>Observación</label><input id="safeObs" value="${esc(s.observation||'')}"></div></div>
 <div class="actions"><button class="primary" onclick="saveSafety('${s.id||''}')">Guardar Seguridad</button></div><div id="safeMsg" class="muted"></div>
 </div>`;
}
async function saveSafety(id){
 const p={report_id:window.v6Report.id,otc_required:$('otcReq').checked,otc_done:$('otcDone').checked,racs_required:$('racsReq').checked,racs_done:$('racsDone').checked,iperc_required:$('ipercReq').checked,iperc_done:$('ipercDone').checked,incidents:Number($('incidents').value||0),accidents:Number($('accidents').value||0),observation:$('safeObs').value.trim()};
 let r=id?await sb.from('core_safety_daily').update(p).eq('id',id):await sb.from('core_safety_daily').insert(p);
 $('safeMsg').textContent=r.error?r.error.message:'Seguridad guardada.';
}

async function todayActivities(){
 const {data}=await sb.from('core_production_activities').select('id,element,item,front_id').eq('report_id',window.v6Report.id).order('created_at',{ascending:false});return data||[];
}
function activityOptions(rows){return '<option value="">Seleccionar actividad</option>'+rows.map(x=>`<option value="${x.id}">${esc(x.element)} · ${esc(x.item)}</option>`).join('')}
async function qualityModule(){
 const acts=await todayActivities();
 let records=[];
 if(acts.length){const {data}=await sb.from('core_quality_records').select('*').in('activity_id',acts.map(x=>x.id));records=data||[]}
 $('supervisorModule').innerHTML=`
 <div class="card"><h2>Calidad</h2><p class="muted">El protocolo se genera sobre una actividad que ya existe en Producción.</p>
 <div class="grid4"><div><label>Actividad</label><select id="qAct">${activityOptions(acts)}</select></div><div><label>Etapa</label><select id="qStage"><option value="pre_execution">Antes de ejecutar</option><option value="post_execution">Después de ejecutar</option></select></div><div><label>Protocolo</label><input id="qName" placeholder="Liberación de encofrado"></div><div><label>N° protocolo</label><input id="qNum"></div><div><label>Estado</label><select id="qStatus"><option value="requested">Solicitado</option><option value="approved">Aprobado</option><option value="rejected">Observado</option></select></div><div style="grid-column:span 3"><label>Observación</label><input id="qObs"></div></div>
 <div class="actions"><button class="primary" onclick="saveQuality()">Agregar protocolo</button></div>
 ${records.length?`<div class="table" style="margin-top:10px"><table><thead><tr><th>Etapa</th><th>Protocolo</th><th>N°</th><th>Estado</th></tr></thead><tbody>${records.map(x=>`<tr><td>${esc(x.stage)}</td><td>${esc(x.protocol_name)}</td><td>${esc(x.protocol_number||'')}</td><td>${esc(x.status)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Sin protocolos hoy.</p>'}
 </div>`;
}
async function saveQuality(){
 if(!$('qAct').value)return alert('Selecciona una actividad.');
 const {error}=await sb.from('core_quality_records').insert({activity_id:$('qAct').value,stage:$('qStage').value,protocol_name:$('qName').value.trim(),protocol_number:$('qNum').value.trim(),status:$('qStatus').value,observation:$('qObs').value.trim()});
 if(error)alert(error.message);else await qualityModule();
}

async function procurementModule(){
 const acts=await todayActivities();
 const {data:rows}=await sb.from('core_procurement_requests').select('*').eq('project_id',ctx.project_id).eq('requested_by_member_id',ctx.member_id).order('created_at',{ascending:false}).limit(30);
 $('supervisorModule').innerHTML=`
 <div class="card"><h2>Procura del día a día</h2>
 <div class="grid4"><div><label>Actividad relacionada</label><select id="prAct">${activityOptions(acts)}</select></div><div><label>Tipo</label><select id="prType"><option>Material</option><option>Herramienta</option><option>Equipo</option></select></div><div><label>Descripción</label><input id="prDesc"></div><div><label>Cantidad</label><input id="prQty" type="number" step=".001"></div><div><label>Und.</label><input id="prUnit"></div><div><label>Fecha requerida</label><input id="prDate" type="date" value="${today()}"></div><div><label>Prioridad</label><select id="prPriority"><option value="normal">Normal</option><option value="high">Alta</option><option value="critical">Crítica</option></select></div><div><label>Observación</label><input id="prObs"></div></div>
 <div class="actions"><button class="primary" onclick="saveProcurement()">Solicitar</button></div>
 ${renderSimpleRows(rows||[],'proc')}</div>`;
}
async function saveProcurement(){
 const act=(await todayActivities()).find(x=>x.id===$('prAct').value);
 const {error}=await sb.from('core_procurement_requests').insert({project_id:ctx.project_id,report_id:window.v6Report.id,activity_id:$('prAct').value||null,discipline_id:ctx.discipline_id||null,front_id:act?.front_id||null,requested_by_member_id:ctx.member_id,item_type:$('prType').value,description:$('prDesc').value.trim(),quantity:Number($('prQty').value||0),unit:$('prUnit').value.trim(),required_date:$('prDate').value,priority:$('prPriority').value,status:'open',observation:$('prObs').value.trim()});
 if(error)alert(error.message);else await procurementModule();
}
async function constraintsModule(){
 const acts=await todayActivities();
 const {data:rows}=await sb.from('core_constraints').select('*').eq('project_id',ctx.project_id).eq('created_by_member_id',ctx.member_id).order('created_at',{ascending:false}).limit(30);
 $('supervisorModule').innerHTML=`
 <div class="card"><h2>Restricciones</h2>
 <div class="grid4"><div><label>Actividad afectada</label><select id="coAct">${activityOptions(acts)}</select></div><div><label>Tipo</label><input id="coType" placeholder="Material / Área / Ingeniería..."></div><div><label>Descripción</label><input id="coDesc"></div><div><label>Prioridad</label><select id="coPriority"><option value="normal">Normal</option><option value="high">Alta</option><option value="critical">Crítica</option></select></div><div><label>Fecha requerida</label><input id="coDate" type="date" value="${today()}"></div><div><label>Impacto (días)</label><input id="coDays" type="number" step=".5"></div><div style="grid-column:span 2"><label>Observación</label><input id="coObs"></div></div>
 <div class="actions"><button class="primary" onclick="saveConstraint()">Registrar restricción</button></div>
 ${renderSimpleRows(rows||[],'constraint')}</div>`;
}
async function saveConstraint(){
 const act=(await todayActivities()).find(x=>x.id===$('coAct').value);
 const {error}=await sb.from('core_constraints').insert({project_id:ctx.project_id,report_id:window.v6Report.id,activity_id:$('coAct').value||null,discipline_id:ctx.discipline_id||null,front_id:act?.front_id||null,created_by_member_id:ctx.member_id,constraint_type:$('coType').value.trim(),description:$('coDesc').value.trim(),priority:$('coPriority').value,required_date:$('coDate').value,status:'open',impact_days:Number($('coDays').value||0),observation:$('coObs').value.trim()});
 if(error)alert(error.message);else await constraintsModule();
}
function renderSimpleRows(rows,type){
 if(!rows.length)return '<p class="muted">Sin registros.</p>';
 return `<div class="table" style="margin-top:10px"><table><thead><tr><th>Descripción</th><th>Prioridad</th><th>Requerido</th><th>Estado</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.description)}</td><td>${esc(x.priority)}</td><td>${esc(x.required_date||'')}</td><td>${esc(x.status)}</td></tr>`).join('')}</tbody></table></div>`;
}
async function saveShiftHeader(){
 const {error}=await sb.from('core_shift_reports').update({start_time:$('srStart').value,end_time:$('srEnd').value}).eq('id',window.v6Report.id);
 $('shiftMsg').textContent=error?error.message:'Horario guardado.';
}
async function submitShiftReport(){
 const {error}=await sb.from('core_shift_reports').update({start_time:$('srStart').value,end_time:$('srEnd').value,status:'submitted',submitted_at:new Date().toISOString()}).eq('id',window.v6Report.id);
 $('shiftMsg').textContent=error?error.message:'Reporte del día enviado.';
 if(!error)window.v6Report.status='submitted';
}

// Override de Reportes: para supervisor abre workspace operativo.
// Admin puede probarlo con el botón "Modo Supervisor" agregado al Home.
const _renderReportsF1=renderReports;
renderReports=async function(){
 if(ctx.role==='supervisor' || window.forceSupervisorMode) return supervisorWorkspace();
 return _renderReportsF1();
};

// Agrega botón de prueba para admin/gerencia sin alterar su rol real.
const _renderProjectHomeF1=renderProjectHome;
renderProjectHome=async function(){
 await _renderProjectHomeF1();
 const host=$('pageHome');
 host.insertAdjacentHTML('beforeend',`<div class="card"><h2>Prueba de interfaz</h2><p class="muted">Como Administrador puedes probar la pantalla operativa del Supervisor sin cambiar tu rol.</p><div class="actions"><button class="primary" onclick="window.forceSupervisorMode=true;showPage('reports')">Abrir Modo Supervisor</button></div></div>`);
};
