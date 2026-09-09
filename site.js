/* Prism Global: property browsing, ordered galleries and explicit WhatsApp enquiries. */
'use strict';
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escapePropertyText = escapeHtml;
const propertyId = p => String(p.id || p.title || '');
const formatEnquiryPrice = price => Number(price) > 0 && Number.isFinite(Number(price)) ? '₦' + Number(price).toLocaleString('en-NG') : 'Price on request';
const waLink = text => 'https://wa.me/2348165160797?text=' + encodeURIComponent(text);
function safeMedia(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try { const url = new URL(text, location.origin + '/'); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
function plainCaption(value) { return String(value || '').replace(/\s*[—–]\s*/g, ' · '); }
window.prismProperties = [];
let gallery = [], galleryCategory = 'all', galleryLimit = 6, viewerImages = [], viewerIndex = 0;
const requestData = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('/api.php?action=getData', {signal: controller.signal, cache: 'no-store'});
    if (!response.ok) throw new Error('Property data is unavailable.');
    const data = await response.json();
    if (!data || !Array.isArray(data.properties)) throw new Error('Invalid property data.');
    return data;
  } finally { clearTimeout(timer); }
};
function populateEnquiryProperties(properties) {
  window.prismProperties = properties;
  const select = $('enquiry-property');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="general">General enquiry / help me choose</option>' + properties.filter(p => !/^sold$/i.test(p.status || '')).map(p =>
    '<option value="' + escapeHtml(propertyId(p)) + '">' + escapeHtml(p.title) + ' · ' + escapeHtml(propertyPriceLabel(p)) + (p.location ? ' · ' + escapeHtml(p.location) : '') + '</option>').join('');
  select.value = properties.some(p => propertyId(p) === current) ? current : 'general';
  updateEnquiryPropertySummary();
}
function selectedEnquiryProperty() { return window.prismProperties.find(p => propertyId(p) === $('enquiry-property')?.value) || null; }
function updateEnquiryPropertySummary() {
  const summary = $('enquiry-property-summary');
  if (!summary) return;
  const p = selectedEnquiryProperty();
  summary.textContent = p ? [propertyPriceLabel(p), p.location, p.status].filter(Boolean).join(' · ') + '. Price and availability will be reconfirmed before commitment.' : 'Tell us the location, your budget or the property you would like checked.';
}
function selectEnquiryProperty(id) {
  if (!$('enquiry-property')) return;
  $('enquiry-property').value = id;
  $('enquiry-service').value = 'Buying a property';
  updateEnquiryPropertySummary();
}
function propertyHref(p) { return '/property.html?id=' + encodeURIComponent(propertyId(p)); }
function propertyEnquiry(p) {
  return waLink(['Hello Prism Global. I am interested in this property:', p.title, 'Reference: ' + propertyId(p), 'Listed price: ' + propertyPriceLabel(p), p.location, 'Please reconfirm price and availability.', 'https://prismglobalservicesltd.com' + propertyHref(p)].filter(Boolean).join('\n'));
}
function renderProperties() {
  const grid = $('units-grid');
  if (!grid) return;
  const city = $('location-filter').value, type = $('type-filter').value, status = $('status-filter').value;
  const properties = window.prismProperties.filter(p => !/^sold$/i.test(p.status || '') && (city === 'all' || String(p.location || '').toLowerCase().includes(city.toLowerCase())) && (type === 'all' || p.type === type) && (status === 'all' || p.status === status));
  $('results-note').textContent = properties.length + (properties.length === 1 ? ' property' : ' properties') + (city === 'all' ? '' : ' in ' + city);
  grid.setAttribute('aria-busy','false');
  if (!properties.length) {
    grid.innerHTML = '<div class="empty"><h3>No matching listings right now.</h3><p>' + (city === 'Lagos' ? 'Tell us your preferred Lagos neighbourhood and budget for current options.' : 'Try another filter or ask our team about your preferred area.') + '</p><a class="button secondary" href="' + waLink('Hello Prism Global. I am looking for a property' + (city !== 'all' ? ' in ' + city : '') + '. My budget and preferred area are: ') + '">Ask about properties</a></div>';
    return;
  }
  grid.innerHTML = properties.map(p => {
    const photo = safeMedia(p.images?.[0]);
    const facts = [p.bedrooms ? p.bedrooms + ' beds' : '', p.bathrooms ? p.bathrooms + ' baths' : '', p.size || ''].filter(Boolean);
    return '<article class="property-card"><a class="property-photo" href="' + propertyHref(p) + '" aria-label="View ' + escapeHtml(p.title) + '">' + (photo ? '<img src="' + escapeHtml(photo) + '" alt="' + escapeHtml(p.title) + '" loading="lazy" decoding="async" width="640" height="480">' : '<span class="empty">Photos available on request</span>') + '</a>' + (p.imageMeta?.[p.images?.[0]]?.kind === 'render' ? '<p class="form-help">Completion render · illustrative</p>' : '') + '<p class="property-status">' + escapeHtml(p.status || 'Confirm availability') + ' · ' + escapeHtml(p.type || 'Property') + '</p><h3><a href="' + propertyHref(p) + '">' + escapeHtml(plainCaption(p.title)) + '</a></h3><p class="property-location">' + escapeHtml(p.location || 'Ask for location') + '</p><p class="property-price">' + escapeHtml(propertyPriceLabel(p)) + '</p><ul class="property-facts">' + facts.map(f => '<li>' + escapeHtml(f) + '</li>').join('') + '</ul><div class="property-actions"><a class="text-link" href="' + propertyHref(p) + '">View property →</a><a href="#enquiry" data-enquire="' + escapeHtml(propertyId(p)) + '">Enquire</a></div></article>';
  }).join('');
}
function initializeFilters(properties) {
  ['type', 'status'].forEach(key => {
    const select = $(key + '-filter');
    if (!select) return;
    const values = [...new Set(properties.filter(p => !/^sold$/i.test(p.status || '')).map(p => p[key]).filter(Boolean))].sort();
    select.innerHTML = '<option value="all">' + (key === 'type' ? 'All property types' : 'All available listings') + '</option>' + values.map(v => '<option value="' + escapeHtml(v) + '">' + escapeHtml(v) + '</option>').join('');
  });
  if ($('location-filter')) {
    const known = ['Abuja','Lagos'];
    const others = [...new Set(properties.map(p => String(p.location || '').split(',').pop().trim()).filter(v => v && !known.some(k => v.includes(k))))].sort();
    others.forEach(v => { const option = document.createElement('option'); option.value = v; option.textContent = v; $('location-filter').append(option); });
  }
}
function normalizeGallery(item) {
  const src = safeMedia(item.src || item.url || item.image);
  let category = Array.isArray(item.category) ? item.category.join(' ') : String(item.category || item.categories || 'exterior');
  const caption = plainCaption(item.caption || item.cap || item.title || 'Project photograph');
  if (/shell stage|construction stage|partially finished/i.test(caption)) category = 'construction';
  return {src, cap: caption, category, capturedAt: /^\d{4}-\d{2}-\d{2}$/.test(item.capturedAt || '') ? item.capturedAt : ''};
}
function dateLabel(value) {
  if (!value) return '';
  const date = new Date(value + 'T12:00:00Z');
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(date);
}
function matchingGallery() {
  return gallery.filter(p => galleryCategory === 'all' ? !p.category.includes('construction') : galleryCategory === 'interior' ? /interior|bathroom/.test(p.category) : p.category.includes(galleryCategory));
}
function renderGallery() {
  if (!$('galleryGrid')) return;
  const matches = matchingGallery();
  $('galleryGrid').innerHTML = matches.slice(0,galleryLimit).map((item,index) =>
    '<button type="button" class="gallery-item" data-photo="' + index + '" aria-label="Open photo: ' + escapeHtml(item.cap) + '"><img src="' + escapeHtml(item.src) + '" alt="' + escapeHtml(item.cap) + '" width="640" height="480" loading="lazy" decoding="async"><span class="gallery-caption">' + escapeHtml(item.cap) + '</span><span class="gallery-date">' + (item.capturedAt ? 'Photographed ' + escapeHtml(dateLabel(item.capturedAt)) : (item.category.includes('construction') ? 'Ask for current site evidence' : '')) + '</span></button>').join('') || '<p class="form-help">No photographs in this category yet. Ask our team for current site evidence.</p>';
  $('gallery-more').hidden = matches.length <= galleryLimit;
  $('gallery-more').textContent = 'Show more photos (' + Math.max(0,matches.length-galleryLimit) + ')';
}
function openPhotos(items,index) {
  if (!items.length || !$('photo-dialog')) return;
  viewerImages = items; viewerIndex = index;
  updatePhoto();
  if (!$('photo-dialog').open) $('photo-dialog').showModal();
  document.body.style.overflow = 'hidden';
}
function updatePhoto() {
  const photo = viewerImages[viewerIndex];
  $('dialog-image').src = photo.src;
  $('dialog-image').alt = photo.cap;
  $('photo-caption').textContent = (viewerIndex + 1) + ' / ' + viewerImages.length + ' · ' + photo.cap + (photo.capturedAt ? ' · ' + dateLabel(photo.capturedAt) : '');
  $('photo-prev').disabled = $('photo-next').disabled = viewerImages.length < 2;
}
function changePhoto(direction) { viewerIndex = (viewerIndex + direction + viewerImages.length) % viewerImages.length; updatePhoto(); }
function renderVideos(videos) {
  const items = (videos || []).filter(v => safeMedia(v.src));
  if (!$('cinematic')) return;
  $('cinematic').hidden = !items.length;
  $('video-list').innerHTML = items.map(v => '<a class="button secondary" href="' + escapeHtml(safeMedia(v.src)) + '" target="_blank" rel="noopener">' + escapeHtml(plainCaption(v.caption || 'Watch property walkthrough')) + ' ↗</a>').join('');
}
function renderPropertyDetail(properties) {
  if (!$('property-detail')) return;
  const id = new URLSearchParams(location.search).get('id');
  const p = properties.find(item => propertyId(item) === id);
  if (!p) { $('property-detail').innerHTML = '<h1>Property not found.</h1><p>This listing may have been removed. Browse current properties or contact us for help.</p><a class="button" href="/#availability">Browse properties</a>'; return; }
  document.title = p.title + ' | Prism Global';
  const description = [p.title,p.location,formatEnquiryPrice(p.price),p.status,'Contact Prism Global for current details.'].filter(Boolean).join('. ');
  document.querySelector('meta[name="description"]').content = description;
  document.querySelector('link[rel="canonical"]').href = 'https://prismglobalservicesltd.com' + propertyHref(p);
  const setMeta = (key,value) => {
    let tag=document.querySelector('meta[property="'+key+'"]');
    if(!tag){tag=document.createElement('meta');tag.setAttribute('property',key);document.head.append(tag);}
    tag.content=value;
  };
  setMeta('og:title',p.title + ' | Prism Global');
  setMeta('og:description',description);
  setMeta('og:type','website');
  setMeta('og:url','https://prismglobalservicesltd.com'+propertyHref(p));
  if(safeMedia(p.images?.[0])) setMeta('og:image',new URL(p.images[0],'https://prismglobalservicesltd.com/').href);
  const photos = (p.images || []).map((src,i) => ({src:safeMedia(src),cap:propertyMediaCaption(p,src,i)})).filter(x => x.src);
  const facts = [['Location',p.location],['Type',p.type],['Bedrooms',p.bedrooms],['Bathrooms',p.bathrooms],['Size',p.size],['Availability',p.status],['Development units',p.totalUnits],['Site area',p.landArea?p.landArea+' m²':null],['Expected delivery',p.expectedDelivery?new Date(p.expectedDelivery+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}):null]].filter(([,value])=> value);
  $('property-detail').innerHTML = '<p class="kicker"><a href="/#availability">← All properties</a></p><h1>' + escapeHtml(plainCaption(p.title)) + '</h1><p class="intro">' + escapeHtml(p.location || 'Request location details') + '</p>' +
    (photos.length ? '<button class="gallery-item" id="detail-cover" aria-label="Open property photos" type="button" style="width:100%"><img class="detail-hero" src="' + escapeHtml(photos[0].src) + '" alt="' + escapeHtml(p.title) + '" fetchpriority="high"></button><p class="gallery-caption">' + escapeHtml(photos[0].cap) + '</p><div class="detail-gallery">' + photos.map((photo,i)=>'<button type="button" data-detail-photo="' + i + '" aria-label="Open property photo ' + (i+1) + '"><img src="' + escapeHtml(photo.src) + '" alt="' + escapeHtml(photo.cap) + '" loading="lazy" width="120" height="90"></button>').join('') + '</div>' : '<p>Photos available on request.</p>') +
    '<div class="detail-summary"><strong class="property-price">' + escapeHtml(propertyPriceLabel(p)) + '</strong><span>' + escapeHtml(p.status || 'Confirm availability') + '</span></div><div class="actions"><a class="button" href="' + propertyEnquiry(p) + '">WhatsApp about this property</a><a class="button secondary" href="tel:+2348165160797">Call Nigeria</a><a class="button secondary" href="tel:+12023271323">Call USA</a><button class="button secondary" id="share-property" type="button">Copy property link</button></div><p class="form-help" id="share-feedback" role="status"></p><dl class="detail-facts">' + facts.map(([key,value]) => '<div><dt>' + escapeHtml(key) + '</dt><dd>' + escapeHtml(value) + '</dd></div>').join('') + '</dl><h2>About this property</h2><p class="detail-description">' + escapeHtml(plainCaption(p.description || 'Ask our team for the property information pack.')) + '</p>' +
    (p.features?.length ? '<h3>Property features</h3><ul>' + p.features.map(f=>'<li style="margin-bottom:10px">' + escapeHtml(f) + '</li>').join('') + '</ul>' : '') +
    renderDevelopmentDetail(p) + '<p class="notice">Reference: ' + escapeHtml(propertyId(p)) + '. Confirm current price, condition, availability and documentation with our team. Photos may show different stages. <a href="/verify-property/">Arrange independent checks before commitment.</a></p>';
  $('detail-cover')?.addEventListener('click',()=>openPhotos(photos,0));
  document.querySelectorAll('[data-detail-photo]').forEach(button=>button.addEventListener('click',()=>openPhotos(photos,Number(button.dataset.detailPhoto))));
  $('share-property').addEventListener('click',async()=>{
    const url = 'https://prismglobalservicesltd.com' + propertyHref(p);
    try { await navigator.clipboard.writeText(url); $('share-feedback').textContent = 'Property link copied.'; }
    catch { $('share-feedback').textContent = 'Property link: ' + url; }
  });
  document.querySelectorAll('.contact-bar a')[0].href = propertyEnquiry(p);
}
async function loadSite() {
  try {
    const data = await requestData();
    populateEnquiryProperties(data.properties);
    initializeFilters(data.properties);
    renderProperties();
    gallery = (Array.isArray(data.gallery) ? data.gallery : []).map(normalizeGallery).filter(item=>item.src);
    renderGallery();
    renderVideos(data.videos);
    renderPropertyDetail(data.properties);
    const requested = new URLSearchParams(location.search).get('enquire');
    if (requested) selectEnquiryProperty(requested);
  } catch (error) {
    if ($('units-grid')) {
      $('units-grid').setAttribute('aria-busy','false');
      $('results-note').textContent = 'Listings are temporarily unavailable.';
      $('units-grid').innerHTML = '<div class="empty"><p>We could not load current prices and availability. Please contact our team for the latest options.</p><a class="button secondary" href="https://wa.me/2348165160797">Ask about available properties</a> <button class="button secondary" type="button" id="retry-data">Try again</button></div>';
      $('retry-data').addEventListener('click', loadSite);
      $('galleryGrid').textContent = 'Photographs could not be loaded. Ask our team for current site images.';
    }
    if ($('property-detail')) $('property-detail').innerHTML = '<h1>We could not load this property.</h1><p>Please ask our team for current details and photographs.</p><a class="button" href="https://wa.me/2348165160797">Contact Prism Global</a>';
  }
}
document.querySelector('.menu-toggle')?.addEventListener('click',()=>{
  const button = document.querySelector('.menu-toggle');
  const expanded = button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded',String(expanded)); $('main-nav').classList.toggle('open',expanded);
});
document.querySelectorAll('#main-nav a').forEach(a=>a.addEventListener('click',()=>{
  $('main-nav').classList.remove('open'); document.querySelector('.menu-toggle').setAttribute('aria-expanded','false');
}));
['location','type','status'].forEach(key=>$(key+'-filter')?.addEventListener('change',renderProperties));
$('units-grid')?.addEventListener('click',e=>{const link=e.target.closest('[data-enquire]');if(link)selectEnquiryProperty(link.dataset.enquire);});
$('enquiry-property')?.addEventListener('change',updateEnquiryPropertySummary);
$('enquiry-service')?.addEventListener('change',()=>{
  if ($('enquiry-service').value !== 'Buying a property') { $('enquiry-property').value='general'; updateEnquiryPropertySummary(); }
});
document.querySelectorAll('.gallery-tab').forEach(button=>button.addEventListener('click',()=>{
  galleryCategory=button.dataset.category;galleryLimit=6;
  document.querySelectorAll('.gallery-tab').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderGallery();
}));
$('gallery-more')?.addEventListener('click',()=>{galleryLimit+=6;renderGallery();});
$('galleryGrid')?.addEventListener('click',e=>{const button=e.target.closest('[data-photo]');if(button)openPhotos(matchingGallery(),Number(button.dataset.photo));});
document.querySelector('.dialog-close')?.addEventListener('click',()=>$('photo-dialog').close());
$('photo-dialog')?.addEventListener('close',()=>{document.body.style.overflow='';});
$('photo-dialog')?.addEventListener('click',e=>{if(e.target===$('photo-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('photo-prev')?.addEventListener('click',()=>changePhoto(-1));$('photo-next')?.addEventListener('click',()=>changePhoto(1));
document.addEventListener('keydown',e=>{if($('photo-dialog')?.open){if(e.key==='ArrowLeft'){e.preventDefault();changePhoto(-1);}if(e.key==='ArrowRight'){e.preventDefault();changePhoto(1);}}});
$('enquiry-form')?.addEventListener('submit',e=>{
  e.preventDefault();
  const form=e.currentTarget;
  if(!form.reportValidity())return;
  const phone=$('enquiry-phone').value.trim();
  const feedback=$('form-feedback'); feedback.hidden=false;
  if(phone.replace(/\D/g,'').length<8){feedback.textContent='Please enter a phone number including your country code.';$('enquiry-phone').focus();return;}
  const p=selectedEnquiryProperty();
  const text=['Hello Prism Global. My name is '+$('enquiry-name').value.trim()+'.','Service: '+$('enquiry-service').value,p?'Property: '+p.title:'General enquiry',p?'Reference: '+propertyId(p):'',p?'Current listed price: '+propertyPriceLabel(p):'',p?.location?'Location: '+p.location:'',p?.status?'Status: '+p.status:'',p?'Please reconfirm current price and availability before commitment.':'',p?'https://prismglobalservicesltd.com'+propertyHref(p):'',$('enquiry-message').value.trim(),'Phone: '+phone,$('enquiry-email').value.trim()?'Email: '+$('enquiry-email').value.trim():''].filter(Boolean).join('\n');
  const url=waLink(text);
  feedback.innerHTML='Your message is ready. <a href="'+escapeHtml(url)+'" target="_blank" rel="noopener">Open WhatsApp</a> and send it there to contact us.';
  window.open(url,'_blank','noopener');
});
loadSite();



function propertyPriceLabel(p) {
 const prices=(p.unitOptions||[]).map(u=>Number(u.price)).filter(v=>Number.isFinite(v)&&v>0);
 return prices.length?'From '+formatEnquiryPrice(Math.min(...prices)):formatEnquiryPrice(p.price);
}
function propertyMediaCaption(p,src,index){
 const meta=p.imageMeta?.[src]||{};
 const kind=meta.kind==='render'?'Completion render · illustrative':meta.kind==='construction'?'Construction progress':'Site photograph';
 return (meta.caption||plainCaption(p.title)+' · Photo '+(index+1))+' · '+kind;
}
function renderDevelopmentDetail(p){
 const textBlock=(title,value)=>value?'<section style="margin:32px 0"><h3>'+escapeHtml(title)+'</h3><p class="detail-description">'+escapeHtml(value)+'</p></section>':'';
 const options=Array.isArray(p.unitOptions)?p.unitOptions:[];
 const units=options.length?'<section style="margin:32px 0"><h2>Apartment options</h2><div class="unit-options">'+options.map(u=>'<article class="unit-option"><h3>'+escapeHtml(u.label)+'</h3><p class="property-price">'+escapeHtml(formatEnquiryPrice(u.price))+'</p>'+(u.area?'<p>'+escapeHtml(u.area)+' m² · supplied room-area total</p>':'')+'<a class="text-link" href="'+waLink('Hello Prism Global. I am interested in '+u.label+' at '+p.title+'. Listed price: '+formatEnquiryPrice(u.price)+'. Please confirm the configuration and availability. Reference: '+propertyId(p))+'">Enquire about this option →</a></article>').join('')+'</div><p class="notice">Prices are per apartment. Confirm the precise layout and availability with our team. Room-area totals exclude the separately stated common area and are not independently verified saleable measurements.</p></section>':'';
 const videos=(p.propertyVideos||[]).filter(v=>safeMedia(v.src));
 return units+textBlock('Approval and title status',p.approvalStatus)+textBlock('Payment plan',p.paymentPlan)+(p.plannedAmenities?.length?'<h3>Planned amenities</h3><ul>'+p.plannedAmenities.map(a=>'<li>'+escapeHtml(a)+'</li>').join('')+'</ul>':'')+(p.floorAreas?'<details style="margin:28px 0"><summary style="cursor:pointer;font-weight:700">View the floor-area breakdown</summary><p class="detail-description" style="margin-top:18px">'+escapeHtml(p.floorAreas)+'</p></details>':'')+(videos.length?'<h3>Development videos</h3><div class="development-videos">'+videos.map(v=>'<figure><video controls playsinline preload="metadata" src="'+escapeHtml(safeMedia(v.src))+'"></video><figcaption>'+escapeHtml(v.caption||'Development video')+' · '+(v.kind==='render'?'Completion simulation · illustrative':'Construction / site footage')+'</figcaption></figure>').join('')+'</div>':'');
}

