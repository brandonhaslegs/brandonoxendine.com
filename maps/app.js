const cityMapState=new WeakMap();
const cityCenterState=new WeakMap();
let citySections=[];
let activeCityIndex=0;
let citySelectorEl=null;
let categorySelectorEl=null;
let selectorControlsEl=null;
let placesCountEl=null;
let activeCategoryFilter="all";
let cityMapObserver=null;
let userLocation=null;
let userLocationRequested=false;
const combinedCafeBakeryKey="cafes and bakeries";
function normalizeCategoryKey(key){const k=(key||"").toLowerCase().trim();if(k==="cafe"||k==="bakery"||k==="cafes & bakeries"||k==="cafes and bakeries")return combinedCafeBakeryKey;return k;}
function cityTitleFor(cityKey){const key=(cityKey||"").trim();const meta=(window.CITY_META&&window.CITY_META[key])||null;const emoji=(meta&&typeof meta.emoji==="string"&&meta.emoji.trim())?meta.emoji.trim():"📍";return `${emoji} ${key}`;}
function categoryLabelFor(categoryKey){const key=normalizeCategoryKey(categoryKey);const meta=(window.CATEGORY_META&&window.CATEGORY_META[key])||null;if(meta){const label=(typeof meta.label==="string"?meta.label.trim():"");const emoji=(typeof meta.emoji==="string"?meta.emoji.trim():"");if(emoji&&label)return `${emoji} ${label}`;if(label)return label;if(emoji)return emoji;}if(key===combinedCafeBakeryKey)return "☕🥐 Cafes & Bakeries";return `📍 ${key.replace(/\\b\\w/g,c=>c.toUpperCase())}`;}
function normalizeListValue(list){const v=(list||"").toLowerCase().trim();if(v==="favorite"||v==="want to go"||v==="closed")return v;return "want to go";}
function reorderCategories(categories){const cats=[...categories];const comboIdx=cats.findIndex(c=>c.key===combinedCafeBakeryKey);const artIdx=cats.findIndex(c=>c.key==="art");if(comboIdx!==-1&&artIdx!==-1&&comboIdx!==artIdx-1){const [combo]=cats.splice(comboIdx,1);const target=Math.max(0,cats.findIndex(c=>c.key==="art"));cats.splice(target,0,combo);}const artIdx2=cats.findIndex(c=>c.key==="art");const barIdx=cats.findIndex(c=>c.key==="bar");if(artIdx2!==-1&&barIdx!==-1){const tmp=cats[artIdx2];cats[artIdx2]=cats[barIdx];cats[barIdx]=tmp;}return cats;}
function renderPlacesData(){const content=document.getElementById("content");if(!content)return;const data=window.PLACES_DATA;if(!data)return;const cities=[];if(Array.isArray(data.places)){const byCity=new Map();data.places.forEach(place=>{const cityKey=(place.city||"").trim();if(!cityKey)return;if(!byCity.has(cityKey))byCity.set(cityKey,{key:cityKey,title:cityTitleFor(cityKey),categories:new Map()});const city=byCity.get(cityKey);const key=normalizeCategoryKey(place.category);const label=categoryLabelFor(key);if(!city.categories.has(key))city.categories.set(key,{key,label,places:[]});city.categories.get(key).places.push({list:normalizeListValue(place.list),name:(place.name||"").trim(),url:(place.url||"").trim(),note:(place.note||"").trim(),lat:Number(place.lat),lng:Number(place.lng)});});byCity.forEach(city=>{cities.push({key:city.key,title:city.title,categories:[...city.categories.values()]});});}else if(Array.isArray(data.cities)){data.cities.forEach(cityData=>{const cityKey=(cityData.key||"").trim();const byKey=new Map();(cityData.categories||[]).forEach(cat=>{const key=normalizeCategoryKey(cat.key);const label=categoryLabelFor(key);if(!byKey.has(key))byKey.set(key,{key,label,places:[]});byKey.get(key).places.push(...(cat.places||[]));});cities.push({key:cityKey,title:cityTitleFor(cityKey),categories:[...byKey.values()]});});}else{return;}content.innerHTML="";cities.forEach(cityData=>{const city=document.createElement("section");city.className="city";city.setAttribute("data-city",(cityData.key||"").trim());const h4=document.createElement("h4");const cityNameWrap=document.createElement("span");cityNameWrap.className="city-name-wrap";const cityTitle=document.createElement("span");cityTitle.className="city-title";cityTitle.textContent=(cityData.title||cityData.key||"").trim();const cityCount=document.createElement("span");cityCount.className="city-count";cityNameWrap.appendChild(cityTitle);cityNameWrap.appendChild(cityCount);h4.appendChild(cityNameWrap);city.appendChild(h4);const ordered=reorderCategories([...(cityData.categories||[])]);ordered.forEach(cat=>{if(!cat.places||!cat.places.length)return;const sec=document.createElement("section");sec.className="category";sec.setAttribute("data-category",cat.key);const h5=document.createElement("h5");h5.textContent=cat.label;sec.appendChild(h5);const ul=document.createElement("ul");cat.places.forEach(place=>{const list=normalizeListValue(place.list);const li=document.createElement("li");li.setAttribute("data-list",list);if(list==="closed")li.classList.add("closed");const lat=Number(place.lat);const lng=Number(place.lng);if(Number.isFinite(lat)&&Number.isFinite(lng)){li.setAttribute("data-lat",String(lat));li.setAttribute("data-lng",String(lng));}const a=document.createElement("a");a.href=(place.url||"").trim();a.rel="noopener noreferrer";a.target="_blank";a.textContent=(place.name||"").trim();li.appendChild(a);if((place.note||"").trim()){const sep=document.createElement("span");sep.className="place-sep";sep.textContent=" — ";const note=document.createElement("em");note.className="place-note";note.textContent=place.note.trim();li.appendChild(sep);li.appendChild(note);}ul.appendChild(li);});sec.appendChild(ul);city.appendChild(sec);});content.appendChild(city);});}
function setupMasonry(){[...document.querySelectorAll("section.city")].forEach(city=>{const cats=[...city.children].filter(el=>el.tagName==="SECTION"&&el.classList.contains("category"));if(!cats.length)return;const wrap=document.createElement("div");wrap.className="category-masonry";cats.forEach(c=>wrap.appendChild(c));city.appendChild(wrap);});}
function updateCityTotalCount(city){if(!city)return;const badge=city.querySelector(":scope > h4 .city-count");if(!badge)return;const n=city.querySelectorAll(":scope > .category-masonry section.category li[data-list]").length;badge.textContent=`${n} place${n===1?"":"s"}`;}
function updateAllCityTotalCounts(){[...document.querySelectorAll("section.city")].forEach(city=>updateCityTotalCount(city));}
function countVisiblePlacesInCity(city){if(!city)return 0;return [...city.querySelectorAll(":scope > .category-masonry section.category li[data-list]")].filter(li=>li.style.display!=="none"&&(li.closest("section.category")?.style.display!=="none")).length;}
function updateHeaderPlaceCount(city){if(!placesCountEl||!citySections.length||!city)return;const activeCity=citySections[activeCityIndex];if(city!==activeCity)return;const n=countVisiblePlacesInCity(city);placesCountEl.textContent=`${n} place${n===1?"":"s"}`;}
function applyCityCategoryFilter(city,categoryKey){const key=(categoryKey||"all").toLowerCase();city.setAttribute("data-category-filter",key);const cards=[...city.querySelectorAll(":scope > .category-masonry > section.category")];cards.forEach(card=>{const cardKey=(card.getAttribute("data-category")||"").toLowerCase();const any=[...card.querySelectorAll("li[data-list]")].some(li=>li.style.display!=="none");const matches=key==="all"||cardKey===key;card.style.display=(any&&matches)?"block":"none";});layoutMasonryForCity(city);updateHeaderPlaceCount(city);if(cityMapState.has(city))refreshCityMap(city,{fitBounds:false});}
function applyCityListFilter(city,listType){const key=(listType||"all").toLowerCase();city.setAttribute("data-list-filter",key);const items=[...city.querySelectorAll(":scope > .category-masonry section.category li[data-list]")];items.forEach(li=>{const v=(li.getAttribute("data-list")||"").toLowerCase();if(key==="all"){li.style.display="list-item";return;}if(key==="closed"){li.style.display=v==="closed"?"list-item":"none";return;}li.style.display=v===key?"list-item":"none";});[...city.querySelectorAll(":scope > h4 .city-filter-btn")].forEach(btn=>btn.classList.toggle("active",(btn.getAttribute("data-list-filter")||"")===key));applyCityCategoryFilter(city,city.getAttribute("data-category-filter")||activeCategoryFilter||"all");}
function setupCityListFilters(){[...document.querySelectorAll("section.city")].forEach(city=>{const h4=city.querySelector(":scope > h4");if(!h4)return;let host=h4.querySelector(":scope > .city-filters");if(!host){host=document.createElement("span");host.className="city-filters";h4.appendChild(host);}host.innerHTML="";const mk=(key,label)=>{const btn=document.createElement("button");btn.className="city-filter-btn";btn.type="button";btn.setAttribute("data-list-filter",key);btn.textContent=label;btn.addEventListener("click",()=>{const current=(city.getAttribute("data-list-filter")||"all").toLowerCase();applyCityListFilter(city,current===key?"all":key);});return btn;};host.appendChild(mk("favorite","Favorites"));host.appendChild(mk("want to go","Want to Go"));host.appendChild(mk("closed","Closed"));applyCityListFilter(city,city.getAttribute("data-list-filter")||"all");});}
function layoutMasonryForCity(city){const wrap=[...city.children].find(el=>el.classList&&el.classList.contains("category-masonry"));if(!wrap)return;const cards=[...wrap.children].filter(el=>el.tagName==="SECTION"&&el.classList.contains("category")&&el.style.display!=="none");const isSingleCategory=(city.getAttribute("data-category-filter")||"all").toLowerCase()!=="all";if(isSingleCategory){cards.forEach(card=>{card.style.display="block";card.style.position="relative";card.style.width="100%";card.style.left="0px";card.style.top="0px";});wrap.style.height="auto";return;}const gap=12;const minColWidth=320;const wrapWidth=Math.max(0,wrap.clientWidth||city.clientWidth||800);const cols=Math.max(1,Math.floor((wrapWidth+gap)/(minColWidth+gap)));const colWidth=Math.floor((wrapWidth-gap*(cols-1))/cols);const heights=Array(cols).fill(0);cards.forEach(card=>{card.style.display="block";card.style.position="absolute";card.style.width=`${colWidth}px`;card.style.left="0px";card.style.top="0px";});cards.forEach(card=>{let idx=0;for(let i=1;i<heights.length;i++){if(heights[i]<heights[idx])idx=i;}const x=idx*(colWidth+gap);const y=heights[idx];card.style.left=`${x}px`;card.style.top=`${y}px`;const h=card.offsetHeight||card.getBoundingClientRect().height||0;heights[idx]=y+h+gap;});const maxH=heights.length?Math.max(...heights):0;wrap.style.height=(maxH>0?maxH-gap:0)+"px";}
function layoutAllMasonry(){[...document.querySelectorAll("section.city")].forEach(city=>layoutMasonryForCity(city));}
let masonryTick=null;let masonryObserver=null;function scheduleMasonry(){if(masonryTick)cancelAnimationFrame(masonryTick);masonryTick=requestAnimationFrame(layoutAllMasonry);}window.addEventListener("resize",()=>{scheduleMasonry();});
function normText(s){return String(s||"").toLowerCase().trim().replace(/\s+/g," ");}
function emojiForCategory(category){const c=normText(category);const map={"restaurant":"🍽️","bar":"🍺","art":"🖼️","cafe":"☕","bakery":"🥐","club":"🎶","shop":"🛍️","vintage":"🧥","flea market":"🏷️","hotel":"🛏️","park":"🌳","pool":"🏊","experience":"🎟️","music venue":"🎤","nail salon":"💅","tattoo":"🖋️","tattoo shop":"🖋️","tattoo studio":"🖋️","nature":"🏔️","other":"📍"};return map[c]||"📍";}
function haversineKm(lat1,lng1,lat2,lng2){const R=6371;const toRad=d=>d*Math.PI/180;const dLat=toRad(lat2-lat1);const dLng=toRad(lng2-lng1);const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(a)));}
function requestUserLocation(){if(userLocationRequested)return;userLocationRequested=true;if(!("geolocation" in navigator))return;navigator.geolocation.getCurrentPosition(pos=>{userLocation={lat:pos.coords.latitude,lng:pos.coords.longitude};[...document.querySelectorAll("section.city")].forEach(city=>{if(cityMapState.has(city))refreshCityMap(city);});},()=>{}, {enableHighAccuracy:false,timeout:7000,maximumAge:300000});}
function searchCoordsFromHref(href){const s=String(href||"");let m=/\/maps\/search\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(s);if(m){const lat=parseFloat(m[1]);const lng=parseFloat(m[2]);if(Number.isFinite(lat)&&Number.isFinite(lng))return {lat,lng};}m=/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(s);if(m){const lat=parseFloat(m[1]);const lng=parseFloat(m[2]);if(Number.isFinite(lat)&&Number.isFinite(lng))return {lat,lng};}m=/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(s);if(m){const lat=parseFloat(m[1]);const lng=parseFloat(m[2]);if(Number.isFinite(lat)&&Number.isFinite(lng))return {lat,lng};}return null;}
function ensureCityMapContainers(){[...document.querySelectorAll("section.city")].forEach(city=>{const h4=city.querySelector(":scope > h4");if(!h4)return;let mapDiv=city.querySelector(":scope > .city-map");if(!mapDiv){mapDiv=document.createElement("div");mapDiv.className="city-map";h4.insertAdjacentElement("afterend",mapDiv);}});}
function moveSelectorToActiveCityHeader(){if(!selectorControlsEl||!citySections.length)return;const activeCity=citySections[activeCityIndex];if(!activeCity)return;const h4=activeCity.querySelector(":scope > h4");if(!h4)return;let slot=h4.querySelector(":scope > .city-selector-slot");if(!slot){slot=document.createElement("span");slot.className="city-selector-slot";const nameWrap=h4.querySelector(":scope > .city-name-wrap");if(nameWrap)nameWrap.replaceWith(slot);else h4.prepend(slot);}slot.appendChild(selectorControlsEl);}
function autoSizeSelectToValue(select){if(!select)return;const text=select.options?.[select.selectedIndex]?.textContent||"";const s=getComputedStyle(select);const probe=document.createElement("span");probe.textContent=text;probe.style.position="absolute";probe.style.visibility="hidden";probe.style.whiteSpace="pre";probe.style.font=s.font;probe.style.letterSpacing=s.letterSpacing;probe.style.textTransform=s.textTransform;document.body.appendChild(probe);const textW=probe.getBoundingClientRect().width;probe.remove();const horizontalPad=52;select.style.width=`${Math.ceil(textW+horizontalPad)}px`;}
function syncCategorySelectorForCity(city){if(!categorySelectorEl)return;const cards=[...city.querySelectorAll(":scope > .category-masonry > section.category")];const seen=new Set();const options=[];cards.forEach(card=>{const key=(card.getAttribute("data-category")||"").toLowerCase();if(!key||seen.has(key))return;seen.add(key);const label=(card.querySelector(":scope > h5")?.textContent||key).trim();options.push({key,label});});categorySelectorEl.innerHTML="";const allOpt=document.createElement("option");allOpt.value="all";allOpt.textContent="All Categories";categorySelectorEl.appendChild(allOpt);options.forEach(({key,label})=>{const opt=document.createElement("option");opt.value=key;opt.textContent=label;categorySelectorEl.appendChild(opt);});if(activeCategoryFilter!=="all"&&!seen.has(activeCategoryFilter))activeCategoryFilter="all";categorySelectorEl.value=activeCategoryFilter;}
function normalizeCategoryForCity(city,categoryKey){const key=normalizeCategoryKey((categoryKey||"all").toLowerCase());if(key==="all")return "all";const hasCategory=[...city.querySelectorAll(":scope > .category-masonry > section.category")].some(card=>(card.getAttribute("data-category")||"").toLowerCase()===key);return hasCategory?key:"all";}
function getCityIndexFromUrl(){if(!citySections.length)return null;const params=new URLSearchParams(window.location.search);const raw=(params.get("city")||"").trim();if(!raw)return null;if(/^\d+$/.test(raw)){const idx=Number(raw);if(Number.isInteger(idx)&&idx>=0&&idx<citySections.length)return idx;}const wanted=raw.toLowerCase();const idx=citySections.findIndex(city=>(city.getAttribute("data-city")||"").trim().toLowerCase()===wanted);return idx===-1?null:idx;}
function getCategoryFromUrl(){const params=new URLSearchParams(window.location.search);const raw=(params.get("category")||"").trim().toLowerCase();return raw||null;}
function writeCityToUrl(index,categoryKey){if(!citySections.length)return;const cityName=(citySections[index]?.getAttribute("data-city")||"").trim();if(!cityName)return;const category=(categoryKey||"all").toLowerCase();const url=new URL(window.location.href);url.searchParams.set("city",cityName);if(category!=="all")url.searchParams.set("category",category);else url.searchParams.delete("category");window.history.replaceState(null,"",url.toString());}
function selectCityByIndex(index,opts={}){if(!citySections.length)return;const nextIndex=Math.max(0,Math.min(citySections.length-1,Number(index)||0));activeCityIndex=nextIndex;if(citySelectorEl){citySelectorEl.value=String(nextIndex);autoSizeSelectToValue(citySelectorEl);}citySections.forEach((city,i)=>{city.style.display=i===nextIndex?"block":"none";});moveSelectorToActiveCityHeader();const activeCity=citySections[nextIndex];if(!activeCity)return;syncCategorySelectorForCity(activeCity);activeCategoryFilter=normalizeCategoryForCity(activeCity,opts.categoryKey??activeCategoryFilter);if(categorySelectorEl){categorySelectorEl.value=activeCategoryFilter;autoSizeSelectToValue(categorySelectorEl);}applyCityCategoryFilter(activeCity,activeCategoryFilter);updateHeaderPlaceCount(activeCity);if(opts.updateUrl!==false)writeCityToUrl(nextIndex,activeCategoryFilter);const state=cityMapState.get(activeCity);if(state&&state.map)state.map.invalidateSize(true);}
function setupCitySelector(){citySections=[...document.querySelectorAll("section.city")];if(!citySections.length)return;const citySelect=document.createElement("select");citySelect.id="city-selector";citySelect.className="city-selector";citySections.forEach((city,index)=>{const option=document.createElement("option");option.value=String(index);const title=city.querySelector(":scope > h4 .city-title")?.textContent?.trim()||city.getAttribute("data-city")||`City ${index+1}`;option.textContent=title;citySelect.appendChild(option);});citySelect.addEventListener("change",e=>{activeCategoryFilter="all";selectCityByIndex(e.target.value,{updateUrl:true,categoryKey:"all"});});const categorySelect=document.createElement("select");categorySelect.id="category-selector";categorySelect.className="city-selector category-selector";categorySelect.addEventListener("change",e=>{activeCategoryFilter=(e.target.value||"all").toLowerCase();autoSizeSelectToValue(categorySelect);const city=citySections[activeCityIndex];if(city){applyCityCategoryFilter(city,activeCategoryFilter);writeCityToUrl(activeCityIndex,activeCategoryFilter);}});const countText=document.createElement("span");countText.className="active-places-count";const controls=document.createElement("span");controls.className="city-selector-controls";controls.appendChild(citySelect);controls.appendChild(categorySelect);controls.appendChild(countText);citySelectorEl=citySelect;categorySelectorEl=categorySelect;placesCountEl=countText;selectorControlsEl=controls;const berlinIndex=citySections.findIndex(city=>(city.getAttribute("data-city")||"").trim().toLowerCase()==="berlin");const fallbackIndex=berlinIndex!==-1?berlinIndex:activeCityIndex;const urlIndex=getCityIndexFromUrl();const urlCategory=getCategoryFromUrl();const initialIndex=urlIndex??fallbackIndex;selectCityByIndex(initialIndex,{updateUrl:urlIndex===null&&urlCategory===null,categoryKey:urlCategory||undefined});window.addEventListener("popstate",()=>{const i=getCityIndexFromUrl();const c=getCategoryFromUrl();if(i!==null){selectCityByIndex(i,{updateUrl:false,categoryKey:c||undefined});return;}selectCityByIndex(fallbackIndex,{updateUrl:true,categoryKey:c||undefined});});}
function getVisibleCityPoints(city){const lis=[...city.querySelectorAll(":scope > .category-masonry section.category li[data-list]")].filter(li=>li.style.display!=="none"&&(li.closest("section.category")?.style.display!=="none"));const points=[];lis.forEach(li=>{const a=li.querySelector("a");const name=(a?.textContent||li.textContent||"").trim();const href=(a?.getAttribute("href")||"").trim();const lat=Number(li.getAttribute("data-lat"));const lng=Number(li.getAttribute("data-lng"));const coord=(Number.isFinite(lat)&&Number.isFinite(lng))?{lat,lng}:searchCoordsFromHref(href);if(!coord)return;const cat=(li.closest("section.category")?.getAttribute("data-category")||"other").trim();const list=(li.getAttribute("data-list")||"").toLowerCase();const isClosed=list==="closed";points.push({lat:coord.lat,lng:coord.lng,name,href,list,category:cat,closed:isClosed});});return points;}
function getCityCenter(city){if(cityCenterState.has(city))return cityCenterState.get(city);const lis=[...city.querySelectorAll(":scope > .category-masonry section.category li[data-list]")];const coords=[];lis.forEach(li=>{const a=li.querySelector("a");const href=(a?.getAttribute("href")||"").trim();const lat=Number(li.getAttribute("data-lat"));const lng=Number(li.getAttribute("data-lng"));const coord=(Number.isFinite(lat)&&Number.isFinite(lng))?{lat,lng}:searchCoordsFromHref(href);if(!coord)return;coords.push(coord);});if(!coords.length){cityCenterState.set(city,null);return null;}const lat=coords.reduce((sum,c)=>sum+c.lat,0)/coords.length;const lng=coords.reduce((sum,c)=>sum+c.lng,0)/coords.length;const center={lat,lng};cityCenterState.set(city,center);return center;}
function refreshCityMap(city,opts={}){
if(!window.L)return;
const mapDiv=city.querySelector(":scope > .city-map");
if(!mapDiv)return;
const points=getVisibleCityPoints(city);
if(!points.length){
mapDiv.style.display="none";
const state=cityMapState.get(city);
if(state&&state.layer)state.layer.clearLayers();
return;
}
mapDiv.style.display="block";
let state=cityMapState.get(city);
if(!state){
const map=L.map(mapDiv,{scrollWheelZoom:false,zoomControl:true,attributionControl:false});
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{maxZoom:20,subdomains:"abcd",attribution:"&copy; OpenStreetMap contributors &copy; CARTO"}).addTo(map);
const layer=L.layerGroup().addTo(map);
state={map,layer};
cityMapState.set(city,state);
}
state.layer.clearLayers();
points.forEach(p=>{
const status=(p.list||"").toLowerCase();
const dotClass=p.closed?"dot-closed":status==="favorite"?"dot-favorite":status==="want to go"?"dot-want":"dot-closed";
const popupDotClass=p.closed?"closed":status==="favorite"?"favorite":status==="want to go"?"want":"closed";
const icon=L.divIcon({className:`dot-hit ${dotClass}`,html:'<span class="dot-core"></span>',iconSize:[14,14],iconAnchor:[7,7],popupAnchor:[0,-6]});
const marker=L.marker([p.lat,p.lng],{icon});
const title=p.href?`<a href="${p.href}" target="_blank" rel="noopener noreferrer">${p.name}</a>`:p.name;
marker.bindPopup(`<div class="map-popup-dot-row"><span class="map-popup-dot ${popupDotClass}"></span></div><div class="map-popup-title">${title}</div><div class="map-popup-cat">${p.category}</div>`);
marker.off("click");
let closeTimer=null;
let openTimer=null;
marker.on("mouseover",()=>{
if(closeTimer)clearTimeout(closeTimer);
if(openTimer)clearTimeout(openTimer);
openTimer=setTimeout(()=>marker.openPopup(),500);
});
marker.on("mouseout",()=>{
if(openTimer)clearTimeout(openTimer);
if(closeTimer)clearTimeout(closeTimer);
closeTimer=setTimeout(()=>marker.closePopup(),200);
});
marker.on("popupopen",()=>{
const popupEl=marker.getPopup()?.getElement();
if(!popupEl||popupEl.dataset.hoverBound==="1")return;
popupEl.dataset.hoverBound="1";
popupEl.addEventListener("mouseenter",()=>{if(openTimer)clearTimeout(openTimer);if(closeTimer)clearTimeout(closeTimer);});
popupEl.addEventListener("mouseleave",()=>{if(closeTimer)clearTimeout(closeTimer);closeTimer=setTimeout(()=>marker.closePopup(),200);});
});
marker.addTo(state.layer);
});
if(userLocation){
let minDist=Infinity;
points.forEach(p=>{const d=haversineKm(userLocation.lat,userLocation.lng,p.lat,p.lng);if(d<minDist)minDist=d;});
if(minDist<=80){
const youIcon=L.divIcon({className:"user-location-hit",html:'<span class="user-location-core"></span>',iconSize:[14,14],iconAnchor:[7,7],popupAnchor:[0,-6]});
const you=L.marker([userLocation.lat,userLocation.lng],{icon:youIcon,zIndexOffset:10000});
you.bindPopup("<strong>Your location</strong>");
you.addTo(state.layer);
}
}
const cityCenter=getCityCenter(city);
if(cityCenter){
const zoom=opts.zoom??12;
state.map.setView([cityCenter.lat,cityCenter.lng],zoom);
}else{
const first=points[0];
if(first)state.map.setView([first.lat,first.lng],opts.zoom??12);
}
}
function setupCityMapObserver(){if(!("IntersectionObserver" in window)){[...document.querySelectorAll("section.city")].forEach(city=>refreshCityMap(city));return;}if(cityMapObserver)cityMapObserver.disconnect();cityMapObserver=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(!entry.isIntersecting)return;const city=entry.target.closest("section.city");if(!city)return;refreshCityMap(city);});},{root:null,rootMargin:"300px 0px",threshold:0.01});[...document.querySelectorAll("section.city .city-map")].forEach(el=>cityMapObserver.observe(el));}

renderPlacesData();
setupMasonry();
updateAllCityTotalCounts();
setupCityListFilters();
ensureCityMapContainers();
setupCitySelector();
setupCityMapObserver();
requestUserLocation();
requestAnimationFrame(()=>{layoutAllMasonry();requestAnimationFrame(layoutAllMasonry);});
window.addEventListener("load",()=>{layoutAllMasonry();setTimeout(layoutAllMasonry,120);selectCityByIndex(activeCityIndex,{updateUrl:false});[...document.querySelectorAll("section.city")].forEach(city=>{if(cityMapState.has(city))refreshCityMap(city);});});
if("ResizeObserver" in window){masonryObserver=new ResizeObserver(()=>scheduleMasonry());document.querySelectorAll(".category-masonry, .category-masonry section.category").forEach(el=>masonryObserver.observe(el));}
