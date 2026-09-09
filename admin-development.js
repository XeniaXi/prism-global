/* Owner-editable development details; existing property records stay compatible. */
let developmentUnits=[], developmentImageMeta={}, developmentVideos=[];
const devField=(id,label,type='text')=>'<div class="form-group"><label class="form-label" for="'+id+'">'+label+'</label><input class="form-input" id="'+id+'" type="'+type+'" '+(type==='number'?'min="0"':'')+'></div>';
document.getElementById('development-fields').innerHTML='<details style="margin:24px 0" open><summary style="cursor:pointer;font-weight:700;margin-bottom:20px">Development details (optional)</summary><button type="button" class="btn-sm btn-edit" id="prefill-lekki">Fill the supplied Lekki brief</button><p style="margin:12px 0;color:#b7c6bd">Fills this draft only. Add your images and review before saving. Prices are per apartment; total units refers to the whole development.</p><div class="form-grid">'+devField('d-total','Total units in development','number')+devField('d-land','Total site area (m²)','number')+devField('d-delivery','Expected delivery','month')+'<div class="form-group form-full"><label class="form-label" for="d-approval">Approval and title status</label><textarea class="form-textarea" id="d-approval" placeholder="Describe approvals held and applications still in process"></textarea></div><div class="form-group form-full"><label class="form-label" for="d-amenities">Planned amenities (one per line)</label><textarea class="form-textarea" id="d-amenities"></textarea></div><div class="form-group form-full"><label class="form-label" for="d-payments">Payment milestones (one per line)</label><textarea class="form-textarea" id="d-payments" placeholder="Initial payment: 60%"></textarea></div></div><h3 style="margin:24px 0 12px">Apartment options</h3><div id="development-units"></div><button type="button" class="btn-sm btn-edit" id="add-unit-option">Add apartment option</button><div class="form-group" style="margin-top:24px"><label class="form-label" for="d-floor">Floor-area breakdown and notes</label><textarea class="form-textarea" id="d-floor" rows="8"></textarea></div><h3 style="margin:24px 0 12px">Property videos</h3><label for="d-video-upload">Upload construction footage or a completion simulation</label><input id="d-video-upload" type="file" accept="video/mp4,video/webm" multiple style="display:block;margin:12px 0"><p id="d-video-status" role="status"></p><div id="development-videos"></div></details>';
function renderDevelopmentUnits(){
 document.getElementById('development-units').innerHTML=developmentUnits.map((u,i)=>'<div class="form-grid" style="border-bottom:1px solid #405448;padding:12px 0;margin-bottom:14px">'+devField('unit-label-'+i,'Apartment type')+devField('unit-price-'+i,'Price (₦)','number')+devField('unit-area-'+i,'Sum of supplied room areas (m²)','number')+'<button type="button" class="btn-sm btn-delete" data-remove-unit="'+i+'">Remove option</button></div>').join('');
 developmentUnits.forEach((u,i)=>{['label','price','area'].forEach(k=>{const input=document.getElementById('unit-'+k+'-'+i);input.value=u[k]??'';input.addEventListener('input',()=>developmentUnits[i][k]=k==='label'?input.value:input.value===''?null:Number(input.value));});});
 document.querySelectorAll('[data-remove-unit]').forEach(b=>b.onclick=()=>{developmentUnits.splice(Number(b.dataset.removeUnit),1);renderDevelopmentUnits();});
}
function mediaControls(kind,index,value,caption){
 return '<label style="display:block;margin:8px 0;font-size:.8rem">Media type<select class="form-select" data-media-kind="'+kind+'" data-media-index="'+index+'"><option value="photo">Site photograph / footage</option><option value="construction">Construction progress</option><option value="render">Completion render / simulation</option></select></label><label style="display:block;font-size:.8rem">Caption<input class="form-input" data-media-caption="'+kind+'" data-media-index="'+index+'" value="'+escapeHtml(caption||'')+'"></label>';
}
const originalImagePreviews=renderImagePreviews;
renderImagePreviews=function(){
 originalImagePreviews();
 getPropertyImages().forEach((url,i)=>{
  const container=document.getElementById('image-preview-area').children[i];
  const meta=developmentImageMeta[url]||{};
  container.insertAdjacentHTML('beforeend',mediaControls('image',i,meta.kind,meta.caption));
  container.querySelector('select').value=meta.kind||'photo';
  container.querySelector('select').onchange=e=>{developmentImageMeta[url]={...developmentImageMeta[url],kind:e.target.value};};
  container.querySelector('input').oninput=e=>{developmentImageMeta[url]={...developmentImageMeta[url],caption:e.target.value};};
 });
};
function renderDevelopmentVideos(){
 document.getElementById('development-videos').innerHTML=developmentVideos.map((v,i)=>'<div style="padding:16px 0;border-bottom:1px solid #405448"><a href="'+escapeHtml(v.src)+'" target="_blank" rel="noopener">Preview video '+(i+1)+'</a>'+mediaControls('video',i,v.kind,v.caption)+'<button type="button" class="btn-sm btn-delete" data-remove-video="'+i+'">Remove video</button></div>').join('');
 developmentVideos.forEach((v,i)=>{
  const select=document.querySelector('[data-media-kind="video"][data-media-index="'+i+'"]');select.value=v.kind||'construction';select.onchange=e=>v.kind=e.target.value;
  document.querySelector('[data-media-caption="video"][data-media-index="'+i+'"]').oninput=e=>v.caption=e.target.value;
 });
 document.querySelectorAll('[data-remove-video]').forEach(b=>b.onclick=()=>{developmentVideos.splice(Number(b.dataset.removeVideo),1);renderDevelopmentVideos();});
}
function populateDevelopmentFields(p={}){
 developmentUnits=(p.unitOptions||[]).map(u=>({...u}));developmentImageMeta=structuredClone(p.imageMeta||{});developmentVideos=(p.propertyVideos||[]).map(v=>({...v}));
 const values={'d-total':p.totalUnits,'d-land':p.landArea,'d-delivery':p.expectedDelivery,'d-approval':p.approvalStatus,'d-amenities':(p.plannedAmenities||[]).join('\n'),'d-payments':p.paymentPlan,'d-floor':p.floorAreas};
 Object.entries(values).forEach(([id,value])=>document.getElementById(id).value=value??'');
 renderDevelopmentUnits();renderDevelopmentVideos();
}
function readDevelopmentFields(){
 const val=id=>document.getElementById(id).value.trim();
 const images=getPropertyImages();
 return {totalUnits:val('d-total')?Number(val('d-total')):null,landArea:val('d-land')?Number(val('d-land')):null,expectedDelivery:val('d-delivery'),approvalStatus:val('d-approval'),plannedAmenities:val('d-amenities').split('\n').map(x=>x.trim()).filter(Boolean),paymentPlan:val('d-payments'),floorAreas:val('d-floor'),unitOptions:developmentUnits.filter(u=>u.label.trim()).map(u=>({...u,label:u.label.trim()})),imageMeta:Object.fromEntries(images.filter(src=>developmentImageMeta[src]).map(src=>[src,developmentImageMeta[src]])),propertyVideos:developmentVideos.map(v=>({...v}))};
}
document.getElementById('add-unit-option').onclick=()=>{developmentUnits.push({label:'',price:null,area:null});renderDevelopmentUnits();};
document.getElementById('property-form').addEventListener('reset',()=>{developmentUnits=[];developmentImageMeta={};developmentVideos=[];renderDevelopmentUnits();renderDevelopmentVideos();});
document.getElementById('d-video-upload').onchange=async e=>{
 const status=document.getElementById('d-video-status'),submit=document.getElementById('submit-btn');
 submit.disabled=true;
 try{for(const file of e.target.files){status.textContent='Uploading '+file.name;const src=await uploadVideoFile(file,pct=>status.textContent='Uploading '+file.name+': '+Math.round(pct)+'%');developmentVideos.push({src,kind:'construction',caption:''});renderDevelopmentVideos();}status.textContent='Uploaded. Label each video and save the property to publish it.';}
 catch(err){status.textContent='Upload failed: '+err.message;}
 finally{submit.disabled=false;e.target.value='';}
};
document.getElementById('prefill-lekki').onclick=()=>{
 if(document.getElementById('edit-id').value || document.getElementById('f-title').value.trim()){
  if(!confirm('Replace the current form draft with the Lekki brief? Nothing is saved until you choose Save Property.'))return;
 }
 document.getElementById('property-form').reset();document.getElementById('edit-id').value='';
 document.getElementById('form-title').textContent='Add Lekki Development';document.getElementById('submit-btn').textContent='Save Property';
 const fields={'f-title':'Lekki Apartments · 10-unit development','f-price':150000000,'f-location':'Lekki, Lagos','f-type':'Apartment','f-status':'Off-Plan','f-size':'802 m² site','f-description':'A planned 10-unit apartment development in Lekki, Lagos, with 1-bedroom, 2-bedroom and 3-bedroom plus guest room / 4-bedroom layouts. Expected delivery: May 2027. Prices are per apartment, not for the whole development. Exact address and unit allocation available on enquiry.'};
 Object.entries(fields).forEach(([id,value])=>document.getElementById(id).value=value);
 populateDevelopmentFields({totalUnits:10,landArea:802,expectedDelivery:'2027-05',approvalStatus:"Building Approval: stated as available.\nGovernor’s Consent: in process; file number available on request.",plannedAmenities:['Gym','Recreation room','24-hour power','Metered gas system'],paymentPlan:'Initial payment: 60%\nAfter two months: 20%\nOn completion: 20%',unitOptions:[{label:'1-bedroom apartment',price:150000000,area:67},{label:'2-bedroom apartment',price:250000000,area:112},{label:'3-bedroom + guest room / 4-bedroom apartment',price:350000000,area:206}],floorAreas:'Areas below are sums of the supplied room schedule, not independently verified saleable areas. Common staircase and elevator lobby: 14 m², shown separately and not allocated to each apartment.\n\n3/4-BEDROOM APARTMENT: 206 m² total of listed spaces\nLiving room, visitor toilet and balcony: 48 m²\nKitchen, dining and balcony: 23 m²\nStore: 5 m²\nCorridor between BQ and store: 3 m²\nBQ: 16 m²; toilet: 5 m²\nBedroom 1: 18 m²; toilet: 7 m²\nBedroom 2: 19 m²; toilet: 7 m²\nBalcony: 6 m²\nMaster bedroom and balcony: 38 m²\nMaster bathroom: 11 m²\n\n2-BEDROOM APARTMENT: 112 m² total of listed spaces\nLiving room, kitchen and dining: 49 m²\nBedroom lobby: 7 m²\nBedroom 1: 20 m²; toilet: 6 m²\nBedroom 2: 20 m²; toilet: 4 m²\nVisitor toilet and lobby: 6 m²\n\n1-BEDROOM APARTMENT: 67 m² total of listed spaces\nLiving room, kitchen, dining and balcony: 40 m²\nVisitor toilet and lobby: 6 m²\nBedroom: 16 m²; toilet: 5 m²'});
 setPropertyImages([]);
};


if(['127.0.0.1','localhost'].includes(location.hostname)){const note=document.createElement('p');note.textContent='Local preview: explore the forms and prepare a draft. Uploading and saving require the deployed site.';note.style.cssText='padding:16px;background:#203e30;color:#fff';document.getElementById('development-fields').prepend(note);}
