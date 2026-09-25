var e=[`gateway`,`switch`,`access_point`,`client`,`other`],t=`unifi_insights/topology/sources`,n=`unifi_insights/topology/subscribe`,r=`entry_unloaded`,i=`site_unavailable`,a=`devices_unavailable`,o=`legacy_uplink_missing`,s=`parents_unresolved`,c=`clients_truncated`,l=`entry_not_found`,u=`entry_not_loaded`,d=`site_not_selected`,f=class extends Error{received;constructor(e){super(`Unsupported topology schema_version ${String(e)}`),this.name=`IncompatibleSchemaError`,this.received=e}},p=e=>typeof e==`object`&&!!e&&!Array.isArray(e);function m(e){if(!p(e))throw TypeError(`Topology snapshot is not an object`);if(typeof e.schema_version!=`number`)throw TypeError(`Topology snapshot field schema_version is not a number`);if(e.schema_version!==1)throw new f(e.schema_version);for(let t of[`nodes`,`edges`,`issues`,`unresolved`])if(!Array.isArray(e[t]))throw TypeError(`Topology snapshot field ${t} is not a list`);for(let t of[`entry_id`,`site_id`,`site_name`,`revision`,`status`])if(typeof e[t]!=`string`)throw TypeError(`Topology snapshot field ${t} is not a string`);return e}var h=`unifi-insights-topology-card`,g=`unifi-insights-topology-card-editor`,_=`custom:${h}`,v=[`graph`,`list`],y=[`collapsed`,`expanded`,`hidden`],b=[`comfortable`,`compact`],ee=[`vertical`,`horizontal`];function x(e,t,n){if(e!==void 0&&!(typeof e==`string`&&t.includes(e)))throw Error(`${n} must be one of: ${t.join(`, `)}`)}function te(t){if(typeof t!=`object`||!t||Array.isArray(t))throw Error(`Card configuration must be an object`);let n=t;if(typeof n.type!=`string`)throw Error(`type is required`);for(let e of[`entry_id`,`site_id`,`title`]){let t=n[e];if(t!==void 0&&(typeof t!=`string`||t===``))throw Error(`${e} must be a non-empty string`)}if(n.entry_id===void 0!=(n.site_id===void 0))throw Error(`entry_id and site_id must be set together`);x(n.view,v,`view`),x(n.clients,y,`clients`),x(n.density,b,`density`),x(n.orientation,ee,`orientation`);for(let e of[`show_site_selector`,`show_labels`])if(n[e]!==void 0&&typeof n[e]!=`boolean`)throw Error(`${e} must be true or false`);if(n.kinds!==void 0&&(!Array.isArray(n.kinds)||n.kinds.length===0||!n.kinds.every(t=>e.includes(t))))throw Error(`kinds must be a non-empty list of: ${e.join(`, `)}`);let r=n.max_clients;if(r!==void 0&&(typeof r!=`number`||!Number.isInteger(r)||r<1||r>500))throw Error(`max_clients must be a whole number from 1 to 500`);return n}function ne(t){return{entry_id:t.entry_id,site_id:t.site_id,title:t.title,view:t.view??`graph`,show_site_selector:t.show_site_selector??!1,clients:t.clients??`collapsed`,kinds:t.kinds?[...t.kinds]:[...e],density:t.density,orientation:t.orientation??`vertical`,show_labels:t.show_labels??!0,max_clients:t.max_clients??500}}function re(e){return e.flatMap(e=>e.sites.map(t=>({binding:{entry_id:e.entry_id,site_id:t.id},label:`${e.title} — ${t.name}`})))}function ie(e,t){if(e.entry_id!==void 0&&e.site_id!==void 0)return{entry_id:e.entry_id,site_id:e.site_id};let n=re(t??[]);return n.length===1?n[0].binding:void 0}function ae(e,t){return e?.entry_id===t?.entry_id&&e?.site_id===t?.site_id}function S(e,t){customElements.get(e)||customElements.define(e,t)}var oe={"card.name":`UniFi Insights Topology`,"card.description":`Interactive network topology of a UniFi site, from UniFi Insights.`,"state.loading":`Loading network topology…`,"state.no_sources":`No UniFi Insights integration is loaded.`,"state.unconfigured":`Choose a site to show.`,"state.empty":`No devices reported for {site}.`,"state.incompatible":`Card and integration versions don't match. Refresh the browser (clear cache) after updating.`,"state.stale":`Stale`,"state.reconnecting":`Reconnecting…`,"state.online":`Online`,"state.offline":`Offline`,"state.unknown":`Unknown`,"issue.site_unavailable":`Site data temporarily unavailable; will recover automatically.`,"issue.devices_unavailable":`Device data unavailable; showing last known layout.`,"issue.legacy_uplink_missing":`Uplink details unavailable; device links may be missing.`,"issue.parents_unresolved":`{count} nodes couldn't be placed under a parent.`,"issue.clients_truncated":`Showing {included} of {total} clients (limit {max}).`,"issue.entry_unloaded":`Integration is reloading.`,"issue.unknown":`Topology problem: {code}.`,"error.entry_not_found":`The configured site no longer exists or is disabled.`,"error.site_not_selected":`The configured site no longer exists or is disabled.`,"error.entry_not_loaded":`Integration isn't loaded (retrying).`,"error.unknown":`Could not load the topology ({code}).`,"action.integration":`Integration`,"action.edit":`Edit card`,"view.graph":`Graph`,"view.list":`List`,"toolbar.view":`View`,"toolbar.filters":`Show`,"toolbar.zoom":`Zoom`,"toolbar.options":`Options`,"toolbar.site":`Site`,"zoom.in":`Zoom in`,"zoom.out":`Zoom out`,"zoom.fit":`Fit to view`,"zoom.hint":`Use Ctrl + scroll to zoom`,"kind.gateway":`Gateway`,"kind.switch":`Switch`,"kind.access_point":`Access point`,"kind.client":`Client`,"kind.other":`Other`,"medium.wired":`Wired`,"medium.wireless":`Wireless`,"medium.unknown":`Unknown`,"group.clients":`{count} clients`,"group.client_one":`1 client`,"group.unconnected":`Unconnected clients`,"group.root":`Clients`,"group.summary":`{wireless} wireless, {offline} offline`,"graph.label":`{site} topology, {devices} devices, {clients} clients`,"graph.roledescription":`network topology`,"node.label":`{kind} {name}, {state}`,"node.clients":`{count} clients`,"node.client_one":`1 client`,"node.uplink":`uplink port {port}`,"node.uplink_speed":`uplink port {port} at {speed}`,"list.label":`{site} devices and clients`,"list.search":`Search`,"list.no_matches":`No matches`,"detail.close":`Close`,"detail.kind":`Type`,"detail.model":`Model`,"detail.state":`State`,"detail.parent":`Connected to`,"detail.port":`Port`,"detail.speed":`Speed`,"detail.medium":`Link`,"detail.poe":`PoE`,"detail.clients":`Clients`,"detail.clients_value":`{total} ({wired} wired, {wireless} wireless)`,"detail.connection":`Connection`,"detail.vlan":`VLAN`,"detail.network":`Network`,"detail.via_hidden":`Via hidden`,"detail.open_device":`Open device`,"detail.search_members":`Search clients`,"announce.updated":`Topology updated.`,"announce.offline":`{count} devices offline.`,"editor.site":`Site`,"editor.site_unavailable":`{site} (unavailable)`,"editor.title":`Title`,"editor.view":`Default view`,"editor.clients":`Clients`,"editor.kinds":`Show node types`,"editor.density":`Density`,"editor.orientation":`Orientation`,"editor.show_site_selector":`Show site selector`,"editor.show_labels":`Show labels`,"editor.max_clients":`Maximum clients`,"clients.collapsed":`Grouped`,"clients.expanded":`Expanded`,"clients.hidden":`Hidden`,"density.auto":`Automatic`,"density.comfortable":`Comfortable`,"density.compact":`Compact`,"orientation.vertical":`Top to bottom`,"orientation.horizontal":`Left to right`},se={en:oe};function ce(e){let t=(e??`en`).toLowerCase(),n=se[t]??se[t.split(`-`)[0]??`en`]??{};return(e,t)=>{let r=n[e]??oe[e];if(t)for(let[e,n]of Object.entries(t))r=r.replaceAll(`{${e}}`,String(n));return r}}var le=globalThis,ue=le.ShadowRoot&&(le.ShadyCSS===void 0||le.ShadyCSS.nativeShadow)&&`adoptedStyleSheets`in Document.prototype&&`replace`in CSSStyleSheet.prototype,de=Symbol(),fe=/* @__PURE__ */ new WeakMap,pe=class{constructor(e,t,n){if(this._$cssResult$=!0,n!==de)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o,t=this.t;if(ue&&e===void 0){let n=t!==void 0&&t.length===1;n&&(e=fe.get(t)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),n&&fe.set(t,e))}return e}toString(){return this.cssText}},me=e=>new pe(typeof e==`string`?e:e+``,void 0,de),C=(e,...t)=>new pe(e.length===1?e[0]:t.reduce((t,n,r)=>t+(e=>{if(!0===e._$cssResult$)return e.cssText;if(typeof e==`number`)return e;throw Error(`Value passed to 'css' function must be a 'css' function result: `+e+`. Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.`)})(n)+e[r+1],e[0]),e,de),he=(e,t)=>{if(ue)e.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(let n of t){let t=document.createElement(`style`),r=le.litNonce;r!==void 0&&t.setAttribute(`nonce`,r),t.textContent=n.cssText,e.appendChild(t)}},ge=ue?e=>e:e=>e instanceof CSSStyleSheet?(e=>{let t=``;for(let n of e.cssRules)t+=n.cssText;return me(t)})(e):e,{is:_e,defineProperty:ve,getOwnPropertyDescriptor:ye,getOwnPropertyNames:be,getOwnPropertySymbols:xe,getPrototypeOf:Se}=Object,Ce=globalThis,we=Ce.trustedTypes,Te=we?we.emptyScript:``,Ee=Ce.reactiveElementPolyfillSupport,De=(e,t)=>e,Oe={toAttribute(e,t){switch(t){case Boolean:e=e?Te:null;break;case Object:case Array:e=e==null?e:JSON.stringify(e)}return e},fromAttribute(e,t){let n=e;switch(t){case Boolean:n=e!==null;break;case Number:n=e===null?null:Number(e);break;case Object:case Array:try{n=JSON.parse(e)}catch{n=null}}return n}},ke=(e,t)=>!_e(e,t),Ae={attribute:!0,type:String,converter:Oe,reflect:!1,useDefault:!1,hasChanged:ke};Symbol.metadata??=Symbol(`metadata`),Ce.litPropertyMetadata??=/* @__PURE__ */ new WeakMap;var je=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=Ae){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){let n=Symbol(),r=this.getPropertyDescriptor(e,n,t);r!==void 0&&ve(this.prototype,e,r)}}static getPropertyDescriptor(e,t,n){let{get:r,set:i}=ye(this.prototype,e)??{get(){return this[t]},set(e){this[t]=e}};return{get:r,set(t){let a=r?.call(this);i?.call(this,t),this.requestUpdate(e,a,n)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??Ae}static _$Ei(){if(this.hasOwnProperty(De(`elementProperties`)))return;let e=Se(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(De(`finalized`)))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(De(`properties`))){let e=this.properties,t=[...be(e),...xe(e)];for(let n of t)this.createProperty(n,e[n])}let e=this[Symbol.metadata];if(e!==null){let t=litPropertyMetadata.get(e);if(t!==void 0)for(let[e,n]of t)this.elementProperties.set(e,n)}this._$Eh=/* @__PURE__ */ new Map;for(let[e,t]of this.elementProperties){let n=this._$Eu(e,t);n!==void 0&&this._$Eh.set(n,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){let t=[];if(Array.isArray(e)){let n=new Set(e.flat(1/0).reverse());for(let e of n)t.unshift(ge(e))}else e!==void 0&&t.push(ge(e));return t}static _$Eu(e,t){let n=t.attribute;return!1===n?void 0:typeof n==`string`?n:typeof e==`string`?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=/* @__PURE__ */ new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=/* @__PURE__ */ new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){let e=/* @__PURE__ */ new Map,t=this.constructor.elementProperties;for(let n of t.keys())this.hasOwnProperty(n)&&(e.set(n,this[n]),delete this[n]);e.size>0&&(this._$Ep=e)}createRenderRoot(){let e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return he(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,n){this._$AK(e,n)}_$ET(e,t){let n=this.constructor.elementProperties.get(e),r=this.constructor._$Eu(e,n);if(r!==void 0&&!0===n.reflect){let i=(n.converter?.toAttribute===void 0?Oe:n.converter).toAttribute(t,n.type);this._$Em=e,i==null?this.removeAttribute(r):this.setAttribute(r,i),this._$Em=null}}_$AK(e,t){let n=this.constructor,r=n._$Eh.get(e);if(r!==void 0&&this._$Em!==r){let e=n.getPropertyOptions(r),i=typeof e.converter==`function`?{fromAttribute:e.converter}:e.converter?.fromAttribute===void 0?Oe:e.converter;this._$Em=r;let a=i.fromAttribute(t,e.type);this[r]=a??this._$Ej?.get(r)??a,this._$Em=null}}requestUpdate(e,t,n,r=!1,i){if(e!==void 0){let a=this.constructor;if(!1===r&&(i=this[e]),n??=a.getPropertyOptions(e),!((n.hasChanged??ke)(i,t)||n.useDefault&&n.reflect&&i===this._$Ej?.get(e)&&!this.hasAttribute(a._$Eu(e,n))))return;this.C(e,t,n)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(e,t,{useDefault:n,reflect:r,wrapped:i},a){n&&!(this._$Ej??=/* @__PURE__ */ new Map).has(e)&&(this._$Ej.set(e,a??t??this[e]),!0!==i||a!==void 0)||(this._$AL.has(e)||(this.hasUpdated||n||(t=void 0),this._$AL.set(e,t)),!0===r&&this._$Em!==e&&(this._$Eq??=/* @__PURE__ */ new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}let e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[e,t]of this._$Ep)this[e]=t;this._$Ep=void 0}let e=this.constructor.elementProperties;if(e.size>0)for(let[t,n]of e){let{wrapped:e}=n,r=this[t];!0!==e||this._$AL.has(t)||r===void 0||this.C(t,void 0,n,r)}}let e=!1,t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(e=>e.hostUpdate?.()),this.update(t)):this._$EM()}catch(t){throw e=!1,this._$EM(),t}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=/* @__PURE__ */ new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(e){}firstUpdated(e){}};je.elementStyles=[],je.shadowRootOptions={mode:`open`},je[De(`elementProperties`)]=/* @__PURE__ */ new Map,je[De(`finalized`)]=/* @__PURE__ */ new Map,Ee?.({ReactiveElement:je}),(Ce.reactiveElementVersions??=[]).push(`2.1.2`);var Me=globalThis,Ne=e=>e,Pe=Me.trustedTypes,Fe=Pe?Pe.createPolicy(`lit-html`,{createHTML:e=>e}):void 0,Ie=`$lit$`,w=`lit$${Math.random().toFixed(9).slice(2)}$`,Le=`?`+w,Re=`<${Le}>`,T=document,ze=()=>T.createComment(``),Be=e=>e===null||typeof e!=`object`&&typeof e!=`function`,Ve=Array.isArray,He=e=>Ve(e)||typeof e?.[Symbol.iterator]==`function`,Ue=`[ 	
\f\r]`,We=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Ge=/-->/g,Ke=/>/g,E=RegExp(`>|${Ue}(?:([^\\s"'>=/]+)(${Ue}*=${Ue}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,`g`),qe=/'/g,Je=/"/g,Ye=/^(?:script|style|textarea|title)$/i,Xe=e=>(t,...n)=>({_$litType$:e,strings:t,values:n}),D=Xe(1),O=Xe(2),k=Symbol.for(`lit-noChange`),A=Symbol.for(`lit-nothing`),Ze=/* @__PURE__ */ new WeakMap,j=T.createTreeWalker(T,129);function Qe(e,t){if(!Ve(e)||!e.hasOwnProperty(`raw`))throw Error(`invalid template strings array`);return Fe===void 0?t:Fe.createHTML(t)}var $e=(e,t)=>{let n=e.length-1,r=[],i,a=t===2?`<svg>`:t===3?`<math>`:``,o=We;for(let t=0;t<n;t++){let n=e[t],s,c,l=-1,u=0;for(;u<n.length&&(o.lastIndex=u,c=o.exec(n),c!==null);)u=o.lastIndex,o===We?c[1]===`!--`?o=Ge:c[1]===void 0?c[2]===void 0?c[3]!==void 0&&(o=E):(Ye.test(c[2])&&(i=RegExp(`</`+c[2],`g`)),o=E):o=Ke:o===E?c[0]===`>`?(o=i??We,l=-1):c[1]===void 0?l=-2:(l=o.lastIndex-c[2].length,s=c[1],o=c[3]===void 0?E:c[3]===`"`?Je:qe):o===Je||o===qe?o=E:o===Ge||o===Ke?o=We:(o=E,i=void 0);let d=o===E&&e[t+1].startsWith(`/>`)?` `:``;a+=o===We?n+Re:l>=0?(r.push(s),n.slice(0,l)+Ie+n.slice(l)+w+d):n+w+(l===-2?t:d)}return[Qe(e,a+(e[n]||`<?>`)+(t===2?`</svg>`:t===3?`</math>`:``)),r]},et=class e{constructor({strings:t,_$litType$:n},r){let i;this.parts=[];let a=0,o=0,s=t.length-1,c=this.parts,[l,u]=$e(t,n);if(this.el=e.createElement(l,r),j.currentNode=this.el.content,n===2||n===3){let e=this.el.content.firstChild;e.replaceWith(...e.childNodes)}for(;(i=j.nextNode())!==null&&c.length<s;){if(i.nodeType===1){if(i.hasAttributes())for(let e of i.getAttributeNames())if(e.endsWith(Ie)){let t=u[o++],n=i.getAttribute(e).split(w),r=/([.?@])?(.*)/.exec(t);c.push({type:1,index:a,name:r[2],strings:n,ctor:r[1]===`.`?it:r[1]===`?`?at:r[1]===`@`?ot:rt}),i.removeAttribute(e)}else e.startsWith(w)&&(c.push({type:6,index:a}),i.removeAttribute(e));if(Ye.test(i.tagName)){let e=i.textContent.split(w),t=e.length-1;if(t>0){i.textContent=Pe?Pe.emptyScript:``;for(let n=0;n<t;n++)i.append(e[n],ze()),j.nextNode(),c.push({type:2,index:++a});i.append(e[t],ze())}}}else if(i.nodeType===8){if(i.data===Le)c.push({type:2,index:a});else{let e=-1;for(;(e=i.data.indexOf(w,e+1))!==-1;)c.push({type:7,index:a}),e+=w.length-1}}a++}}static createElement(e,t){let n=T.createElement(`template`);return n.innerHTML=e,n}};function M(e,t,n=e,r){if(t===k)return t;let i=r===void 0?n._$Cl:n._$Co?.[r],a=Be(t)?void 0:t._$litDirective$;return i?.constructor!==a&&(i?._$AO?.(!1),a===void 0?i=void 0:(i=new a(e),i._$AT(e,n,r)),r===void 0?n._$Cl=i:(n._$Co??=[])[r]=i),i!==void 0&&(t=M(e,i._$AS(e,t.values),i,r)),t}var tt=class{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){let{el:{content:t},parts:n}=this._$AD,r=(e?.creationScope??T).importNode(t,!0);j.currentNode=r;let i=j.nextNode(),a=0,o=0,s=n[0];for(;s!==void 0;){if(a===s.index){let t;s.type===2?t=new nt(i,i.nextSibling,this,e):s.type===1?t=new s.ctor(i,s.name,s.strings,this,e):s.type===6&&(t=new st(i,this,e)),this._$AV.push(t),s=n[++o]}a!==s?.index&&(i=j.nextNode(),a++)}return j.currentNode=T,r}p(e){let t=0;for(let n of this._$AV)n!==void 0&&(n.strings===void 0?n._$AI(e[t]):(n._$AI(e,n,t),t+=n.strings.length-2)),t++}},nt=class e{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,n,r){this.type=2,this._$AH=A,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=n,this.options=r,this._$Cv=r?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode,t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=M(this,e,t),Be(e)?e===A||e==null||e===``?(this._$AH!==A&&this._$AR(),this._$AH=A):e!==this._$AH&&e!==k&&this._(e):e._$litType$===void 0?e.nodeType===void 0?He(e)?this.k(e):this._(e):this.T(e):this.$(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==A&&Be(this._$AH)?this._$AA.nextSibling.data=e:this.T(T.createTextNode(e)),this._$AH=e}$(e){let{values:t,_$litType$:n}=e,r=typeof n==`number`?this._$AC(e):(n.el===void 0&&(n.el=et.createElement(Qe(n.h,n.h[0]),this.options)),n);if(this._$AH?._$AD===r)this._$AH.p(t);else{let e=new tt(r,this),n=e.u(this.options);e.p(t),this.T(n),this._$AH=e}}_$AC(e){let t=Ze.get(e.strings);return t===void 0&&Ze.set(e.strings,t=new et(e)),t}k(t){Ve(this._$AH)||(this._$AH=[],this._$AR());let n=this._$AH,r,i=0;for(let a of t)i===n.length?n.push(r=new e(this.O(ze()),this.O(ze()),this,this.options)):r=n[i],r._$AI(a),i++;i<n.length&&(this._$AR(r&&r._$AB.nextSibling,i),n.length=i)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){let t=Ne(e).nextSibling;Ne(e).remove(),e=t}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}},rt=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,n,r,i){this.type=1,this._$AH=A,this._$AN=void 0,this.element=e,this.name=t,this._$AM=r,this.options=i,n.length>2||n[0]!==``||n[1]!==``?(this._$AH=Array(n.length-1).fill(/* @__PURE__ */ new String),this.strings=n):this._$AH=A}_$AI(e,t=this,n,r){let i=this.strings,a=!1;if(i===void 0)e=M(this,e,t,0),a=!Be(e)||e!==this._$AH&&e!==k,a&&(this._$AH=e);else{let r=e,o,s;for(e=i[0],o=0;o<i.length-1;o++)s=M(this,r[n+o],t,o),s===k&&(s=this._$AH[o]),a||=!Be(s)||s!==this._$AH[o],s===A?e=A:e!==A&&(e+=(s??``)+i[o+1]),this._$AH[o]=s}a&&!r&&this.j(e)}j(e){e===A?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??``)}},it=class extends rt{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===A?void 0:e}},at=class extends rt{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==A)}},ot=class extends rt{constructor(e,t,n,r,i){super(e,t,n,r,i),this.type=5}_$AI(e,t=this){if((e=M(this,e,t,0)??A)===k)return;let n=this._$AH,r=e===A&&n!==A||e.capture!==n.capture||e.once!==n.once||e.passive!==n.passive,i=e!==A&&(n===A||r);r&&this.element.removeEventListener(this.name,this,n),i&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH==`function`?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},st=class{constructor(e,t,n){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=n}get _$AU(){return this._$AM._$AU}_$AI(e){M(this,e)}},ct={M:Ie,P:w,A:Le,C:1,L:$e,R:tt,D:He,V:M,I:nt,H:rt,N:at,U:ot,B:it,F:st},lt=Me.litHtmlPolyfillSupport;lt?.(et,nt),(Me.litHtmlVersions??=[]).push(`3.3.3`);var ut=(e,t,n)=>{let r=n?.renderBefore??t,i=r._$litPart$;if(i===void 0){let e=n?.renderBefore??null;r._$litPart$=i=new nt(t.insertBefore(ze(),e),e,void 0,n??{})}return i._$AI(e),i},dt=globalThis,N=class extends je{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){let t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=ut(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return k}};N._$litElement$=!0,N.finalized=!0,dt.litElementHydrateSupport?.({LitElement:N});var ft=dt.litElementPolyfillSupport;ft?.({LitElement:N}),(dt.litElementVersions??=[]).push(`4.2.2`);var pt=class{last=-1/0;pending;timer;emit;intervalMs;constructor(e,t=5e3){this.emit=e,this.intervalMs=t}announce(e){let t=this.last+this.intervalMs-Date.now();if(t<=0&&this.timer===void 0){this.last=Date.now(),this.emit(e);return}this.pending=e,this.timer??=setTimeout(()=>{this.timer=void 0;let e=this.pending;this.pending=void 0,e!==void 0&&(this.last=Date.now(),this.emit(e))},Math.max(t,0))}dispose(){this.timer!==void 0&&clearTimeout(this.timer),this.timer=void 0,this.pending=void 0}},mt={[i]:{key:`issue.site_unavailable`},[a]:{key:`issue.devices_unavailable`,action:`integration`},[o]:{key:`issue.legacy_uplink_missing`},[s]:{key:`issue.parents_unresolved`},[c]:{key:`issue.clients_truncated`},[r]:{key:`issue.entry_unloaded`}},ht={[l]:{key:`error.entry_not_found`,action:`edit`},[d]:{key:`error.site_not_selected`,action:`edit`},[u]:{key:`error.entry_not_loaded`,action:`integration`}};function gt(e,t,n){let r=mt[e.code];if(!r)return{code:e.code,severity:e.severity,key:`issue.unknown`,vars:{code:e.code}};let i={code:e.code,severity:e.severity,key:r.key};return e.code===`parents_unresolved`&&(i.vars={count:t.unresolved.length}),e.code===`clients_truncated`&&t.truncation&&(i.vars={included:t.truncation.clients_included,total:t.truncation.clients_total,max:n}),r.action&&(i.action=r.action),i}function _t(e){let t=ht[e.code];if(!t)return{code:e.code,severity:`error`,key:`error.unknown`,vars:{code:e.code}};let n={code:e.code,severity:`error`,key:t.key};return t.action&&(n.action=t.action),n}function vt(e){if(e.incompatible)return{phase:`incompatible`,stale:!1,notices:[]};if(e.error)return{phase:`error`,render:e.lastGood,stale:e.lastGood!==void 0,notices:[_t(e.error)]};if(e.disconnected){let t=e.snapshot,n=t&&t.nodes.length>0?t:e.lastGood;if(n)return{phase:`reloading`,render:n,stale:!0,notices:[]}}if(e.sources!==void 0&&e.sources.length===0&&e.snapshot===void 0)return{phase:`no_sources`,stale:!1,notices:[]};if(e.binding===void 0)return{phase:e.sources===void 0?`loading`:`unconfigured`,stale:!1,notices:[]};let t=e.snapshot;if(t===void 0)return{phase:`loading`,stale:!1,notices:[]};let n=t.issues.map(n=>gt(n,t,e.maxClients));if(t.status===`unavailable`){let i=t.issues.some(e=>e.code===r),a=t.nodes.length>0?t:e.lastGood;return{phase:i?`reloading`:`unavailable`,render:a,stale:a!==void 0,notices:n}}return t.nodes.length===0?{phase:`empty`,stale:!1,notices:n}:{phase:t.status===`partial`?`partial`:`ok`,render:t,stale:!1,notices:n}}function yt(e){return typeof e==`object`&&!!e&&typeof e.code==`string`}function bt(e){return yt(e)?{code:e.code,message:typeof e.message==`string`?e.message:``}:{code:`unknown_error`,message:String(e)}}function P(e,t,n){e.dispatchEvent(new CustomEvent(t,{detail:n,bubbles:!0,composed:!0}))}function xt(e){history.pushState(null,``,e),P(window,`location-changed`,{replace:!1})}var St=/* @__PURE__ */ new Set([u,`unknown_command`]),Ct=2e3,wt=6e4;function Tt(e,t=Math.random){let n=Math.min(Ct*2**e,wt);return Math.round(n*(.8+.4*t()))}var Et=class{generation=0;connection;key;keyId;unsubscribe;retryTimer;attempt=0;lastRevision;isLive=!1;handlers;random;constructor(e,t=Math.random){this.handlers=e,this.random=t}get live(){return this.isLive}update(e,t){let n=t?JSON.stringify([t.entry_id,t.site_id,t.max_clients]):void 0;(e!==this.connection||n!==this.keyId)&&(this.stop(),this.connection=e,this.key=t,this.keyId=n,e&&(e.addEventListener(`ready`,this.onReady),e.addEventListener(`disconnected`,this.onDisconnected)),e&&t&&this.open())}stop(){this.generation++,this.clearRetry(),this.attempt=0,this.release(),this.connection?.removeEventListener(`ready`,this.onReady),this.connection?.removeEventListener(`disconnected`,this.onDisconnected),this.connection=void 0,this.key=void 0,this.keyId=void 0}clearRetry(){this.retryTimer!==void 0&&clearTimeout(this.retryTimer),this.retryTimer=void 0}drop(){this.generation++,this.clearRetry(),this.unsubscribe=void 0,this.isLive=!1,this.lastRevision=void 0}onDisconnected=()=>{this.drop(),this.handlers.onDisconnected()};onReady=()=>{this.drop(),this.attempt=0,this.key&&this.open(),this.handlers.onReconnected()};release(){let e=this.unsubscribe;this.unsubscribe=void 0,this.isLive=!1,this.lastRevision=void 0,e&&e().catch(()=>void 0)}open(){let e=++this.generation,{connection:t,key:r}=this;t&&r&&t.subscribeMessage(t=>{e===this.generation&&this.receive(t)},{type:n,entry_id:r.entry_id,site_id:r.site_id,max_clients:r.max_clients},{resubscribe:!1}).then(t=>{e===this.generation?this.unsubscribe=t:t().catch(()=>void 0)},t=>{if(e!==this.generation)return;let n=bt(t);this.handlers.onError(n),St.has(n.code)&&this.scheduleRetry()})}receive(e){let t;try{t=m(e)}catch(e){e instanceof f?this.handlers.onIncompatible():this.handlers.onError({code:`invalid_payload`,message:String(e)});return}let n=t.issues.some(e=>e.code===r);n||(this.isLive=!0,this.attempt=0),(t.revision===``||t.revision!==this.lastRevision)&&(this.lastRevision=t.revision,this.handlers.onSnapshot(t),n&&(this.generation++,this.release(),this.scheduleRetry()))}scheduleRetry(){let e=this.generation,t=Tt(this.attempt++,this.random);this.retryTimer=setTimeout(()=>{this.retryTimer=void 0,e===this.generation&&this.open()},t)}},Dt=`M4.93,4.93C3.12,6.74 2,9.24 2,12C2,14.76 3.12,17.26 4.93,19.07L6.34,17.66C4.89,16.22 4,14.22 4,12C4,9.79 4.89,7.78 6.34,6.34L4.93,4.93M19.07,4.93L17.66,6.34C19.11,7.78 20,9.79 20,12C20,14.22 19.11,16.22 17.66,17.66L19.07,19.07C20.88,17.26 22,14.76 22,12C22,9.24 20.88,6.74 19.07,4.93M7.76,7.76C6.67,8.85 6,10.35 6,12C6,13.65 6.67,15.15 7.76,16.24L9.17,14.83C8.45,14.11 8,13.11 8,12C8,10.89 8.45,9.89 9.17,9.17L7.76,7.76M16.24,7.76L14.83,9.17C15.55,9.89 16,10.89 16,12C16,13.11 15.55,14.11 14.83,14.83L16.24,16.24C17.33,15.15 18,13.65 18,12C18,10.35 17.33,8.85 16.24,7.76M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10Z`,Ot=`M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z`,kt=`M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z`,At=`M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z`,jt=`M3 6H21V4H3C1.9 4 1 4.9 1 6V18C1 19.1 1.9 20 3 20H7V18H3V6M13 12H9V13.78C8.39 14.33 8 15.11 8 16C8 16.89 8.39 17.67 9 18.22V20H13V18.22C13.61 17.67 14 16.88 14 16S13.61 14.33 13 13.78V12M11 17.5C10.17 17.5 9.5 16.83 9.5 16S10.17 14.5 11 14.5 12.5 15.17 12.5 16 11.83 17.5 11 17.5M22 8H16C15.5 8 15 8.5 15 9V19C15 19.5 15.5 20 16 20H22C22.5 20 23 19.5 23 19V9C23 8.5 22.5 8 22 8M21 18H17V10H21V18Z`,Mt=`M17 4H20C21.1 4 22 4.9 22 6V8H20V6H17V4M4 8V6H7V4H4C2.9 4 2 4.9 2 6V8H4M20 16V18H17V20H20C21.1 20 22 19.1 22 18V16H20M7 18H4V16H2V18C2 19.1 2.9 20 4 20H7V18M16 10V14H8V10H16M18 8H6V16H18V8Z`,Nt=`M4,1C2.89,1 2,1.89 2,3V7C2,8.11 2.89,9 4,9H1V11H13V9H10C11.11,9 12,8.11 12,7V3C12,1.89 11.11,1 10,1H4M4,3H10V7H4V3M3,13V18L3,20H10V18H5V13H3M14,13C12.89,13 12,13.89 12,15V19C12,20.11 12.89,21 14,21H11V23H23V21H20C21.11,21 22,20.11 22,19V15C22,13.89 21.11,13 20,13H14M14,15H20V19H14V15Z`,Pt=`M15.5,14H14.71L14.43,13.73C15.41,12.59 16,11.11 16,9.5A6.5,6.5 0 0,0 9.5,3A6.5,6.5 0 0,0 3,9.5A6.5,6.5 0 0,0 9.5,16C11.11,16 12.59,15.41 13.73,14.43L14,14.71V15.5L19,20.5L20.5,19L15.5,14M9.5,14C7,14 5,12 5,9.5C5,7 7,5 9.5,5C12,5 14,7 14,9.5C14,12 12,14 9.5,14M7,9H12V10H7V9Z`,Ft=`M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M12,10H10V12H9V10H7V9H9V7H10V9H12V10Z`,It=`M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z`,Lt=`M5 9C3.9 9 3 9.9 3 11V15C3 16.11 3.9 17 5 17H11V19H10C9.45 19 9 19.45 9 20H2V22H9C9 22.55 9.45 23 10 23H14C14.55 23 15 22.55 15 22H22V20H15C15 19.45 14.55 19 14 19H13V17H19C20.11 17 21 16.11 21 15V11C21 9.9 20.11 9 19 9H5M6 12H8V14H6V12M9.5 12H11.5V14H9.5V12M13 12H15V14H13V12Z`,Rt=`M13,18H14A1,1 0 0,1 15,19H22V21H15A1,1 0 0,1 14,22H10A1,1 0 0,1 9,21H2V19H9A1,1 0 0,1 10,18H11V16H8A1,1 0 0,1 7,15V3A1,1 0 0,1 8,2H16A1,1 0 0,1 17,3V15A1,1 0 0,1 16,16H13V18M13,6H14V4H13V6M9,4V6H11V4H9M9,8V10H11V8H9M9,12V14H11V12H9Z`,zt=`M12,21L15.6,16.2C14.6,15.45 13.35,15 12,15C10.65,15 9.4,15.45 8.4,16.2L12,21M12,3C7.95,3 4.21,4.34 1.2,6.6L3,9C5.5,7.12 8.62,6 12,6C15.38,6 18.5,7.12 21,9L22.8,6.6C19.79,4.34 16.05,3 12,3M12,9C9.3,9 6.81,9.89 4.8,11.4L6.6,13.8C8.1,12.67 9.97,12 12,12C14.03,12 15.9,12.67 17.4,13.8L19.2,11.4C17.19,9.89 14.7,9 12,9Z`,Bt=jt;function Vt(e){switch(e.kind){case`gateway`:return Lt;case`switch`:return Rt;case`access_point`:return Dt;case`client`:return e.connection===`wireless`?zt:Nt;default:return jt}}function Ht(e){return D`<svg
        class="icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
    >
        <path d=${e}></path>
    </svg>`}var Ut=`group:unconnected`,Wt=`group:root`,Gt=e=>`group:${e}`,Kt={gateway:0,switch:1,access_point:2,other:3,client:4},qt=(e,t)=>e.name.localeCompare(t.name)||e.id.localeCompare(t.id),Jt=(e,t)=>Kt[e.kind]-Kt[t.kind]||qt(e,t);function Yt(e,t){let n=e.toggledGroups.has(t);return e.clients===`expanded`?!n:n}var Xt=()=>({total:0,wired:0,wireless:0,offline:0});function Zt(e,t){e.total++,t.connection===`wired`&&e.wired++,t.connection===`wireless`&&e.wireless++,t.state===`offline`&&e.offline++}function Qt(e,t,n){let r=/* @__PURE__ */ new Set;for(let i of e){let e=/* @__PURE__ */ new Set,a=i.id;for(;a!==void 0&&!r.has(a);){e.add(a);let r=t.get(a);if(r!==void 0&&e.has(r)){t.delete(a),n.delete(a);break}a=r}for(let t of e)r.add(t)}}function $t(e,t){let n=new Map(e.nodes.map(e=>[e.id,e])),r=/* @__PURE__ */ new Map,i=/* @__PURE__ */ new Map;for(let t of e.edges){let e=n.get(t.source),a=n.get(t.target);e&&a&&e.id!==a.id&&a.kind!==`client`&&!r.has(e.id)&&(r.set(e.id,a.id),i.set(e.id,t))}Qt(e.nodes,r,i);let a=e.nodes.filter(e=>e.kind!==`client`).sort(Jt),o=e.nodes.filter(e=>e.kind===`client`).sort(qt),s=/* @__PURE__ */ new Map;for(let e of o){let t=r.get(e.id);if(t===void 0)continue;let n=s.get(t);n||s.set(t,n=Xt()),Zt(n,e)}let c=/* @__PURE__ */ new Map,l=/* @__PURE__ */ new Map,u=/* @__PURE__ */ new Map,d=/* @__PURE__ */ new Map,f=[],p=e=>t.kinds.has(e.kind),m=e=>{let t=[],i=r.get(e);for(;i!==void 0;){let e=n.get(i);if(p(e))return{id:i,skipped:t};t.push(e.kind),i=r.get(i)}return{id:void 0,skipped:t}},h=(e,t,n,r)=>{if(t===void 0){f.push(e);return}u.set(e,t),d.set(e,{childId:e,parentId:t,edge:n,viaHidden:[...new Set(r)]});let i=l.get(t);i?i.push(e):l.set(t,[e])};for(let e of a){if(!p(e))continue;c.set(e.id,{type:`device`,id:e.id,node:e});let t=m(e.id);h(e.id,t.id,i.get(e.id),t.skipped)}if(t.clients!==`hidden`&&t.kinds.has(`client`)){let e=/* @__PURE__ */ new Map;for(let t of o){let i=r.get(t.id),a,o=[],s;if(i===void 0)s=Ut;else{let e=n.get(i);if(p(e))a=i;else{let t=m(i);a=t.id,o=[e.kind,...t.skipped]}s=a===void 0?Wt:Gt(a)}let c=e.get(s);c||e.set(s,c={parent:a,members:[],skipped:/* @__PURE__ */ new Set}),c.members.push(t);for(let e of o)c.skipped.add(e)}let a=[...e].sort(([e],[t])=>Number(e===Ut)-Number(t===Ut));for(let[e,n]of a){let r=Xt();for(let e of n.members)Zt(r,e);let a=Yt(t,e);if(c.set(e,{type:`group`,id:e,members:n.members,counts:r,expanded:a}),h(e,n.parent,void 0,n.skipped),a)for(let t of n.members)c.set(t.id,{type:`client`,id:t.id,node:t}),h(t.id,e,i.get(t.id),[])}}return{snapshot:e,roots:f,visuals:c,children:l,parentOf:u,links:d,nodes:n,realParent:r,edges:i,clientCounts:s,stats:{devices:a.length,clients:o.length,offlineDevices:a.filter(e=>e.state===`offline`).length}}}function en(){let e,t,n;return(r,i)=>n&&r===e&&i===t?n:(e=r,t=i,n=$t(r,i),n)}function tn(e,t){let n=e.parentOf.get(t);return n===void 0?e.roots:e.children.get(n)??[]}function nn(e,t){for(let n of e.visuals.values())if(n.type===`group`&&n.members.some(e=>e.id===t))return n}var rn=C`
    :host {
        --uit-online: var(--success-color, #43a047);
        --uit-offline: var(--error-color, #db4437);
        --uit-warning: var(--warning-color, #ffa600);
        --uit-unknown: var(--disabled-text-color, #bdbdbd);
        --uit-focus: var(--primary-color, #03a9f4);
        --uit-line: var(--divider-color, rgba(0, 0, 0, 0.12));
        color: var(--primary-text-color);
        font-family: var(
            --ha-font-family-body,
            var(--paper-font-body1_-_font-family, sans-serif)
        );
    }
    @media (forced-colors: active) {
        :host {
            --uit-online: CanvasText;
            --uit-offline: CanvasText;
            --uit-warning: CanvasText;
            --uit-unknown: GrayText;
            --uit-focus: Highlight;
        }
    }
`,an=C`
    button {
        font: inherit;
        color: var(--primary-text-color);
        background: none;
        border: 1px solid var(--uit-line);
        border-radius: 18px;
        min-height: 44px;
        min-width: 44px;
        padding: 0 14px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }
    button[aria-pressed="true"] {
        background: var(--primary-color);
        border-color: var(--primary-color);
        color: var(--text-primary-color, #fff);
    }
    input,
    select {
        font: inherit;
        color: var(--primary-text-color);
        background: var(--card-background-color);
        border: 1px solid var(--uit-line);
        border-radius: 8px;
        min-height: 44px;
        padding: 0 12px;
        box-sizing: border-box;
    }
    :focus-visible {
        outline: 2px solid var(--uit-focus);
        outline-offset: 2px;
    }
    .icon {
        width: 20px;
        height: 20px;
        fill: currentColor;
        flex: none;
    }
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
    }
    @media (prefers-reduced-motion: reduce) {
        * {
            transition: none !important;
            animation: none !important;
        }
    }
`,on={gateway:`kind.gateway`,switch:`kind.switch`,access_point:`kind.access_point`,client:`kind.client`,other:`kind.other`},F={online:`state.online`,offline:`state.offline`,unknown:`state.unknown`},sn={graph:`view.graph`,list:`view.list`},cn={wired:`medium.wired`,wireless:`medium.wireless`,unknown:`medium.unknown`};function ln(e,t){let n=[...e];return n.length>t?`${n.slice(0,t-1).join(``)}…`:e}var un=e=>Number.isInteger(e)?String(e):e.toFixed(1);function dn(e){return e>=1e3?`${un(e/1e3)}G`:`${e}M`}function fn(e){return e>=1e3?`${un(e/1e3)} gigabit`:`${e} megabit`}function pn(e){if(!e)return``;let t=[];return e.parent_port!==void 0&&t.push(`p${e.parent_port}`),e.speed_mbps&&t.push(dn(e.speed_mbps)),e.poe_power_w!==void 0&&t.push(`PoE`),t.join(` · `)}function mn(e,t){return e.type===`group`?e.id===`group:unconnected`?t(`group.unconnected`):e.id===`group:root`?t(`group.root`):e.counts.total===1?t(`group.client_one`):t(`group.clients`,{count:e.counts.total}):e.node.name}function hn(e){return e.type===`group`?e.counts.offline===e.counts.total?`offline`:`online`:e.node.state}function gn(e,t,n){if(t.type===`group`)return`${mn(t,n)}: ${n(`group.summary`,{wireless:t.counts.wireless,offline:t.counts.offline})}`;let r=t.node,i=[n(`node.label`,{kind:n(on[r.kind]),name:r.name,state:n(F[r.state]).toLocaleLowerCase()})],a=e.clientCounts.get(r.id)?.total??0;a>0&&i.push(a===1?n(`node.client_one`):n(`node.clients`,{count:a}));let o=e.edges.get(r.id);return o?.parent_port===void 0?r.connection&&i.push(n(cn[r.connection]).toLocaleLowerCase()):i.push(o.speed_mbps?n(`node.uplink_speed`,{port:o.parent_port,speed:fn(o.speed_mbps)}):n(`node.uplink`,{port:o.parent_port})),i.join(`, `)}S(`uit-detail-panel`,class extends N{static properties={model:{attribute:!1},selectedId:{attribute:!1},localize:{attribute:!1},narrow:{type:Boolean,reflect:!0},memberQuery:{state:!0}};constructor(){super(),this.narrow=!1,this.memberQuery=``}willUpdate(e){e.has(`selectedId`)&&(this.memberQuery=``)}render(){let{model:e,selectedId:t,localize:n}=this;if(!e||!t||!n)return A;let r=e.visuals.get(t);if(r?.type===`group`)return this.shell(mn(r,n),this.groupBody(r,n));let i=e.nodes.get(t);if(!i)return A;let a=i.kind===`client`?this.clientBody(e,i,n):this.deviceBody(e,i,n);return this.shell(i.name,a)}shell(e,t){let n=this.localize;return D`<section class="panel" role="region" aria-label=${e}>
            <header>
                <h3 title=${e}>${e}</h3>
                <button
                    class="close"
                    aria-label=${n(`detail.close`)}
                    title=${n(`detail.close`)}
                    @click=${()=>P(this,`uit-close`)}
                >
                    ${Ht(At)}
                </button>
            </header>
            ${t}
        </section>`}rows(e){return D`<dl>
            ${e.filter(e=>e[1]!==void 0&&e[1]!==``).map(([e,t])=>D`<div class="row">
                        <dt>${this.localize(e)}</dt>
                        <dd>${t}</dd>
                    </div>`)}
        </dl>`}uplinkRows(e,t,n,r){let i=e.realParent.get(t),a=e.edges.get(t),o;return a?.parent_port!==void 0&&(o=a.child_port===void 0?String(a.parent_port):`${a.parent_port} → ${a.child_port}`),[[`detail.parent`,i===void 0?void 0:e.nodes.get(i)?.name],[`detail.port`,o],[`detail.speed`,a?.speed_mbps?dn(a.speed_mbps):void 0],[`detail.medium`,r&&a?n(cn[a.medium]):void 0],[`detail.poe`,a?.poe_power_w===void 0?void 0:`${a.poe_power_w.toFixed(1)} W`]]}deviceBody(e,t,n){let r=e.clientCounts.get(t.id),i=e.links.get(t.id)?.viaHidden??[];return D`${this.rows([[`detail.kind`,n(on[t.kind])],[`detail.model`,t.model],[`detail.state`,n(F[t.state])],...this.uplinkRows(e,t.id,n,!0),[`detail.clients`,r?n(`detail.clients_value`,{total:r.total,wired:r.wired,wireless:r.wireless}):void 0],[`detail.via_hidden`,i.length>0?i.map(e=>n(on[e])).join(`, `):void 0]])}
        ${t.ha_device_id?D`<button
                  class="action"
                  @click=${()=>xt(`/config/devices/device/${encodeURIComponent(t.ha_device_id)}`)}
              >
                  ${Ht(It)}${n(`detail.open_device`)}
              </button>`:A}`}clientBody(e,t,n){return this.rows([[`detail.state`,n(F[t.state])],[`detail.connection`,t.connection?n(cn[t.connection]):void 0],[`detail.vlan`,t.vlan_id===void 0?void 0:String(t.vlan_id)],[`detail.network`,t.network_name],...this.uplinkRows(e,t.id,n,!1)])}groupBody(e,t){let n=this.memberQuery.trim().toLowerCase(),r=n?e.members.filter(e=>e.name.toLowerCase().includes(n)):e.members,i=e.counts;return D`${this.rows([[`detail.clients`,t(`detail.clients_value`,{total:i.total,wired:i.wired,wireless:i.wireless})]])}
            <input
                type="search"
                .value=${this.memberQuery}
                placeholder=${t(`detail.search_members`)}
                aria-label=${t(`detail.search_members`)}
                @input=${e=>{this.memberQuery=e.target.value}}
            />
            <ul class="members">
                ${r.map(e=>D`<li>
                            <button
                                class="member ${e.state}"
                                @click=${()=>P(this,`uit-select`,{id:e.id})}
                            >
                                ${Ht(Vt(e))}<span
                                    class="name"
                                    title=${e.name}
                                    >${e.name}</span
                                >
                                ${e.state===`online`?A:D`<span class="state-text"
                                          >${t(F[e.state])}</span
                                      >`}
                            </button>
                        </li>`)}
            </ul>`}static styles=[rn,an,C`
            :host {
                position: absolute;
                top: 8px;
                right: 8px;
                bottom: 8px;
                width: min(320px, 45%);
                z-index: 2;
                pointer-events: none;
            }
            :host([narrow]) {
                top: auto;
                left: 0;
                right: 0;
                bottom: 0;
                width: auto;
                max-height: 60%;
            }
            .panel {
                pointer-events: auto;
                box-sizing: border-box;
                height: 100%;
                overflow: auto;
                padding: 4px 16px 16px;
                background: var(--card-background-color);
                border: 1px solid var(--uit-line);
                border-radius: var(--ha-card-border-radius, 12px);
                box-shadow: var(--ha-card-box-shadow, none);
            }
            header {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            h3 {
                flex: 1;
                min-width: 0;
                margin: 0;
                font-size: 1.1em;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            button.close {
                border: none;
                padding: 0;
            }
            dl {
                margin: 8px 0;
            }
            .row {
                display: flex;
                gap: 12px;
                padding: 4px 0;
            }
            dt {
                color: var(--secondary-text-color);
                min-width: 7em;
            }
            dd {
                margin: 0;
                overflow-wrap: anywhere;
            }
            input {
                width: 100%;
            }
            .members {
                list-style: none;
                margin: 8px 0 0;
                padding: 0;
            }
            .member {
                width: 100%;
                border: none;
                border-radius: 8px;
                justify-content: flex-start;
            }
            .member .name {
                flex: 1;
                min-width: 0;
                text-align: start;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .member.offline .name {
                opacity: 0.55;
            }
            .state-text {
                color: var(--uit-offline);
                font-weight: 600;
            }
            .action {
                margin-top: 8px;
            }
        `]});var _n={svg:`http://www.w3.org/2000/svg`,xhtml:`http://www.w3.org/1999/xhtml`,xlink:`http://www.w3.org/1999/xlink`,xml:`http://www.w3.org/XML/1998/namespace`,xmlns:`http://www.w3.org/2000/xmlns/`};function vn(e){var t=e+=``,n=t.indexOf(`:`);return n>=0&&(t=e.slice(0,n))!==`xmlns`&&(e=e.slice(n+1)),_n.hasOwnProperty(t)?{space:_n[t],local:e}:e}function yn(e){return function(){var t=this.ownerDocument,n=this.namespaceURI;return n===`http://www.w3.org/1999/xhtml`&&t.documentElement.namespaceURI===`http://www.w3.org/1999/xhtml`?t.createElement(e):t.createElementNS(n,e)}}function bn(e){return function(){return this.ownerDocument.createElementNS(e.space,e.local)}}function xn(e){var t=vn(e);return(t.local?bn:yn)(t)}function Sn(){}function Cn(e){return e==null?Sn:function(){return this.querySelector(e)}}function wn(e){typeof e!=`function`&&(e=Cn(e));for(var t=this._groups,n=t.length,r=Array(n),i=0;i<n;++i)for(var a=t[i],o=a.length,s=r[i]=Array(o),c,l,u=0;u<o;++u)(c=a[u])&&(l=e.call(c,c.__data__,u,a))&&(`__data__`in c&&(l.__data__=c.__data__),s[u]=l);return new L(r,this._parents)}function Tn(e){return e==null?[]:Array.isArray(e)?e:Array.from(e)}function En(){return[]}function Dn(e){return e==null?En:function(){return this.querySelectorAll(e)}}function On(e){return function(){return Tn(e.apply(this,arguments))}}function kn(e){e=typeof e==`function`?On(e):Dn(e);for(var t=this._groups,n=t.length,r=[],i=[],a=0;a<n;++a)for(var o=t[a],s=o.length,c,l=0;l<s;++l)(c=o[l])&&(r.push(e.call(c,c.__data__,l,o)),i.push(c));return new L(r,i)}function An(e){return function(){return this.matches(e)}}function jn(e){return function(t){return t.matches(e)}}var Mn=Array.prototype.find;function Nn(e){return function(){return Mn.call(this.children,e)}}function Pn(){return this.firstElementChild}function Fn(e){return this.select(e==null?Pn:Nn(typeof e==`function`?e:jn(e)))}var In=Array.prototype.filter;function Ln(){return Array.from(this.children)}function Rn(e){return function(){return In.call(this.children,e)}}function zn(e){return this.selectAll(e==null?Ln:Rn(typeof e==`function`?e:jn(e)))}function Bn(e){typeof e!=`function`&&(e=An(e));for(var t=this._groups,n=t.length,r=Array(n),i=0;i<n;++i)for(var a=t[i],o=a.length,s=r[i]=[],c,l=0;l<o;++l)(c=a[l])&&e.call(c,c.__data__,l,a)&&s.push(c);return new L(r,this._parents)}function Vn(e){return Array(e.length)}function Hn(){return new L(this._enter||this._groups.map(Vn),this._parents)}function Un(e,t){this.ownerDocument=e.ownerDocument,this.namespaceURI=e.namespaceURI,this._next=null,this._parent=e,this.__data__=t}Un.prototype={constructor:Un,appendChild:function(e){return this._parent.insertBefore(e,this._next)},insertBefore:function(e,t){return this._parent.insertBefore(e,t)},querySelector:function(e){return this._parent.querySelector(e)},querySelectorAll:function(e){return this._parent.querySelectorAll(e)}};function Wn(e){return function(){return e}}function Gn(e,t,n,r,i,a){for(var o=0,s,c=t.length,l=a.length;o<l;++o)(s=t[o])?(s.__data__=a[o],r[o]=s):n[o]=new Un(e,a[o]);for(;o<c;++o)(s=t[o])&&(i[o]=s)}function Kn(e,t,n,r,i,a,o){var s,c,l=/* @__PURE__ */ new Map,u=t.length,d=a.length,f=Array(u),p;for(s=0;s<u;++s)(c=t[s])&&(f[s]=p=o.call(c,c.__data__,s,t)+``,l.has(p)?i[s]=c:l.set(p,c));for(s=0;s<d;++s)p=o.call(e,a[s],s,a)+``,(c=l.get(p))?(r[s]=c,c.__data__=a[s],l.delete(p)):n[s]=new Un(e,a[s]);for(s=0;s<u;++s)(c=t[s])&&l.get(f[s])===c&&(i[s]=c)}function qn(e){return e.__data__}function Jn(e,t){if(!arguments.length)return Array.from(this,qn);var n=t?Kn:Gn,r=this._parents,i=this._groups;typeof e!=`function`&&(e=Wn(e));for(var a=i.length,o=Array(a),s=Array(a),c=Array(a),l=0;l<a;++l){var u=r[l],d=i[l],f=d.length,p=Yn(e.call(u,u&&u.__data__,l,r)),m=p.length,h=s[l]=Array(m),g=o[l]=Array(m);n(u,d,h,g,c[l]=Array(f),p,t);for(var _=0,v=0,y,b;_<m;++_)if(y=h[_]){for(_>=v&&(v=_+1);!(b=g[v])&&++v<m;);y._next=b||null}}return o=new L(o,r),o._enter=s,o._exit=c,o}function Yn(e){return typeof e==`object`&&`length`in e?e:Array.from(e)}function Xn(){return new L(this._exit||this._groups.map(Vn),this._parents)}function Zn(e,t,n){var r=this.enter(),i=this,a=this.exit();return typeof e==`function`?(r=e(r),r&&=r.selection()):r=r.append(e+``),t!=null&&(i=t(i),i&&=i.selection()),n==null?a.remove():n(a),r&&i?r.merge(i).order():i}function Qn(e){for(var t=e.selection?e.selection():e,n=this._groups,r=t._groups,i=n.length,a=r.length,o=Math.min(i,a),s=Array(i),c=0;c<o;++c)for(var l=n[c],u=r[c],d=l.length,f=s[c]=Array(d),p,m=0;m<d;++m)(p=l[m]||u[m])&&(f[m]=p);for(;c<i;++c)s[c]=n[c];return new L(s,this._parents)}function $n(){for(var e=this._groups,t=-1,n=e.length;++t<n;)for(var r=e[t],i=r.length-1,a=r[i],o;--i>=0;)(o=r[i])&&(a&&o.compareDocumentPosition(a)^4&&a.parentNode.insertBefore(o,a),a=o);return this}function er(e){e||=tr;function t(t,n){return t&&n?e(t.__data__,n.__data__):!t-!n}for(var n=this._groups,r=n.length,i=Array(r),a=0;a<r;++a){for(var o=n[a],s=o.length,c=i[a]=Array(s),l,u=0;u<s;++u)(l=o[u])&&(c[u]=l);c.sort(t)}return new L(i,this._parents).order()}function tr(e,t){return e<t?-1:e>t?1:e>=t?0:NaN}function nr(){var e=arguments[0];return arguments[0]=this,e.apply(null,arguments),this}function rr(){return Array.from(this)}function ir(){for(var e=this._groups,t=0,n=e.length;t<n;++t)for(var r=e[t],i=0,a=r.length;i<a;++i){var o=r[i];if(o)return o}return null}function ar(){let e=0;for(let t of this)++e;return e}function or(){return!this.node()}function sr(e){for(var t=this._groups,n=0,r=t.length;n<r;++n)for(var i=t[n],a=0,o=i.length,s;a<o;++a)(s=i[a])&&e.call(s,s.__data__,a,i);return this}function cr(e){return function(){this.removeAttribute(e)}}function lr(e){return function(){this.removeAttributeNS(e.space,e.local)}}function ur(e,t){return function(){this.setAttribute(e,t)}}function dr(e,t){return function(){this.setAttributeNS(e.space,e.local,t)}}function fr(e,t){return function(){var n=t.apply(this,arguments);n==null?this.removeAttribute(e):this.setAttribute(e,n)}}function pr(e,t){return function(){var n=t.apply(this,arguments);n==null?this.removeAttributeNS(e.space,e.local):this.setAttributeNS(e.space,e.local,n)}}function mr(e,t){var n=vn(e);if(arguments.length<2){var r=this.node();return n.local?r.getAttributeNS(n.space,n.local):r.getAttribute(n)}return this.each((t==null?n.local?lr:cr:typeof t==`function`?n.local?pr:fr:n.local?dr:ur)(n,t))}function hr(e){return e.ownerDocument&&e.ownerDocument.defaultView||e.document&&e||e.defaultView}function gr(e){return function(){this.style.removeProperty(e)}}function _r(e,t,n){return function(){this.style.setProperty(e,t,n)}}function vr(e,t,n){return function(){var r=t.apply(this,arguments);r==null?this.style.removeProperty(e):this.style.setProperty(e,r,n)}}function yr(e,t,n){return arguments.length>1?this.each((t==null?gr:typeof t==`function`?vr:_r)(e,t,n??``)):I(this.node(),e)}function I(e,t){return e.style.getPropertyValue(t)||hr(e).getComputedStyle(e,null).getPropertyValue(t)}function br(e){return function(){delete this[e]}}function xr(e,t){return function(){this[e]=t}}function Sr(e,t){return function(){var n=t.apply(this,arguments);n==null?delete this[e]:this[e]=n}}function Cr(e,t){return arguments.length>1?this.each((t==null?br:typeof t==`function`?Sr:xr)(e,t)):this.node()[e]}function wr(e){return e.trim().split(/^|\s+/)}function Tr(e){return e.classList||new Er(e)}function Er(e){this._node=e,this._names=wr(e.getAttribute(`class`)||``)}Er.prototype={add:function(e){this._names.indexOf(e)<0&&(this._names.push(e),this._node.setAttribute(`class`,this._names.join(` `)))},remove:function(e){var t=this._names.indexOf(e);t>=0&&(this._names.splice(t,1),this._node.setAttribute(`class`,this._names.join(` `)))},contains:function(e){return this._names.indexOf(e)>=0}};function Dr(e,t){for(var n=Tr(e),r=-1,i=t.length;++r<i;)n.add(t[r])}function Or(e,t){for(var n=Tr(e),r=-1,i=t.length;++r<i;)n.remove(t[r])}function kr(e){return function(){Dr(this,e)}}function Ar(e){return function(){Or(this,e)}}function jr(e,t){return function(){(t.apply(this,arguments)?Dr:Or)(this,e)}}function Mr(e,t){var n=wr(e+``);if(arguments.length<2){for(var r=Tr(this.node()),i=-1,a=n.length;++i<a;)if(!r.contains(n[i]))return!1;return!0}return this.each((typeof t==`function`?jr:t?kr:Ar)(n,t))}function Nr(){this.textContent=``}function Pr(e){return function(){this.textContent=e}}function Fr(e){return function(){var t=e.apply(this,arguments);this.textContent=t??``}}function Ir(e){return arguments.length?this.each(e==null?Nr:(typeof e==`function`?Fr:Pr)(e)):this.node().textContent}function Lr(){this.innerHTML=``}function Rr(e){return function(){this.innerHTML=e}}function zr(e){return function(){var t=e.apply(this,arguments);this.innerHTML=t??``}}function Br(e){return arguments.length?this.each(e==null?Lr:(typeof e==`function`?zr:Rr)(e)):this.node().innerHTML}function Vr(){this.nextSibling&&this.parentNode.appendChild(this)}function Hr(){return this.each(Vr)}function Ur(){this.previousSibling&&this.parentNode.insertBefore(this,this.parentNode.firstChild)}function Wr(){return this.each(Ur)}function Gr(e){var t=typeof e==`function`?e:xn(e);return this.select(function(){return this.appendChild(t.apply(this,arguments))})}function Kr(){return null}function qr(e,t){var n=typeof e==`function`?e:xn(e),r=t==null?Kr:typeof t==`function`?t:Cn(t);return this.select(function(){return this.insertBefore(n.apply(this,arguments),r.apply(this,arguments)||null)})}function Jr(){var e=this.parentNode;e&&e.removeChild(this)}function Yr(){return this.each(Jr)}function Xr(){var e=this.cloneNode(!1),t=this.parentNode;return t?t.insertBefore(e,this.nextSibling):e}function Zr(){var e=this.cloneNode(!0),t=this.parentNode;return t?t.insertBefore(e,this.nextSibling):e}function Qr(e){return this.select(e?Zr:Xr)}function $r(e){return arguments.length?this.property(`__data__`,e):this.node().__data__}function ei(e){return function(t){e.call(this,t,this.__data__)}}function ti(e){return e.trim().split(/^|\s+/).map(function(e){var t=``,n=e.indexOf(`.`);return n>=0&&(t=e.slice(n+1),e=e.slice(0,n)),{type:e,name:t}})}function ni(e){return function(){var t=this.__on;if(t){for(var n=0,r=-1,i=t.length,a;n<i;++n)a=t[n],(!e.type||a.type===e.type)&&a.name===e.name?this.removeEventListener(a.type,a.listener,a.options):t[++r]=a;++r?t.length=r:delete this.__on}}}function ri(e,t,n){return function(){var r=this.__on,i,a=ei(t);if(r){for(var o=0,s=r.length;o<s;++o)if((i=r[o]).type===e.type&&i.name===e.name){this.removeEventListener(i.type,i.listener,i.options),this.addEventListener(i.type,i.listener=a,i.options=n),i.value=t;return}}this.addEventListener(e.type,a,n),i={type:e.type,name:e.name,value:t,listener:a,options:n},r?r.push(i):this.__on=[i]}}function ii(e,t,n){var r=ti(e+``),i,a=r.length,o;if(arguments.length<2){var s=this.node().__on;if(s){for(var c=0,l=s.length,u;c<l;++c)for(i=0,u=s[c];i<a;++i)if((o=r[i]).type===u.type&&o.name===u.name)return u.value}return}for(s=t?ri:ni,i=0;i<a;++i)this.each(s(r[i],t,n));return this}function ai(e,t,n){var r=hr(e),i=r.CustomEvent;typeof i==`function`?i=new i(t,n):(i=r.document.createEvent(`Event`),n?(i.initEvent(t,n.bubbles,n.cancelable),i.detail=n.detail):i.initEvent(t,!1,!1)),e.dispatchEvent(i)}function oi(e,t){return function(){return ai(this,e,t)}}function si(e,t){return function(){return ai(this,e,t.apply(this,arguments))}}function ci(e,t){return this.each((typeof t==`function`?si:oi)(e,t))}function*li(){for(var e=this._groups,t=0,n=e.length;t<n;++t)for(var r=e[t],i=0,a=r.length,o;i<a;++i)(o=r[i])&&(yield o)}var ui=[null];function L(e,t){this._groups=e,this._parents=t}function di(){return new L([[document.documentElement]],ui)}function fi(){return this}L.prototype=di.prototype={constructor:L,select:wn,selectAll:kn,selectChild:Fn,selectChildren:zn,filter:Bn,data:Jn,enter:Hn,exit:Xn,join:Zn,merge:Qn,selection:fi,order:$n,sort:er,call:nr,nodes:rr,node:ir,size:ar,empty:or,each:sr,attr:mr,style:yr,property:Cr,classed:Mr,text:Ir,html:Br,raise:Hr,lower:Wr,append:Gr,insert:qr,remove:Yr,clone:Qr,datum:$r,on:ii,dispatch:ci,[Symbol.iterator]:li};function R(e){return typeof e==`string`?new L([[document.querySelector(e)]],[document.documentElement]):new L([[e]],ui)}function pi(e){let t;for(;t=e.sourceEvent;)e=t;return e}function z(e,t){if(e=pi(e),t===void 0&&(t=e.currentTarget),t){var n=t.ownerSVGElement||t;if(n.createSVGPoint){var r=n.createSVGPoint();return r.x=e.clientX,r.y=e.clientY,r=r.matrixTransform(t.getScreenCTM().inverse()),[r.x,r.y]}if(t.getBoundingClientRect){var i=t.getBoundingClientRect();return[e.clientX-i.left-t.clientLeft,e.clientY-i.top-t.clientTop]}}return[e.pageX,e.pageY]}var mi={value:()=>{}};function hi(){for(var e=0,t=arguments.length,n={},r;e<t;++e){if(!(r=arguments[e]+``)||r in n||/[\s.]/.test(r))throw Error(`illegal type: `+r);n[r]=[]}return new gi(n)}function gi(e){this._=e}function _i(e,t){return e.trim().split(/^|\s+/).map(function(e){var n=``,r=e.indexOf(`.`);if(r>=0&&(n=e.slice(r+1),e=e.slice(0,r)),e&&!t.hasOwnProperty(e))throw Error(`unknown type: `+e);return{type:e,name:n}})}gi.prototype=hi.prototype={constructor:gi,on:function(e,t){var n=this._,r=_i(e+``,n),i,a=-1,o=r.length;if(arguments.length<2){for(;++a<o;)if((i=(e=r[a]).type)&&(i=vi(n[i],e.name)))return i;return}if(t!=null&&typeof t!=`function`)throw Error(`invalid callback: `+t);for(;++a<o;)if(i=(e=r[a]).type)n[i]=yi(n[i],e.name,t);else if(t==null)for(i in n)n[i]=yi(n[i],e.name,null);return this},copy:function(){var e={},t=this._;for(var n in t)e[n]=t[n].slice();return new gi(e)},call:function(e,t){if((i=arguments.length-2)>0)for(var n=Array(i),r=0,i,a;r<i;++r)n[r]=arguments[r+2];if(!this._.hasOwnProperty(e))throw Error(`unknown type: `+e);for(a=this._[e],r=0,i=a.length;r<i;++r)a[r].value.apply(t,n)},apply:function(e,t,n){if(!this._.hasOwnProperty(e))throw Error(`unknown type: `+e);for(var r=this._[e],i=0,a=r.length;i<a;++i)r[i].value.apply(t,n)}};function vi(e,t){for(var n=0,r=e.length,i;n<r;++n)if((i=e[n]).name===t)return i.value}function yi(e,t,n){for(var r=0,i=e.length;r<i;++r)if(e[r].name===t){e[r]=mi,e=e.slice(0,r).concat(e.slice(r+1));break}return n!=null&&e.push({name:t,value:n}),e}var B=0,bi=0,xi=0,Si=1e3,Ci,wi,Ti=0,V=0,Ei=0,Di=typeof performance==`object`&&performance.now?performance:Date,Oi=typeof window==`object`&&window.requestAnimationFrame?window.requestAnimationFrame.bind(window):function(e){setTimeout(e,17)};function ki(){return V||=(Oi(Ai),Di.now()+Ei)}function Ai(){V=0}function ji(){this._call=this._time=this._next=null}ji.prototype=Mi.prototype={constructor:ji,restart:function(e,t,n){if(typeof e!=`function`)throw TypeError(`callback is not a function`);n=(n==null?ki():+n)+(t==null?0:+t),!this._next&&wi!==this&&(wi?wi._next=this:Ci=this,wi=this),this._call=e,this._time=n,Li()},stop:function(){this._call&&(this._call=null,this._time=1/0,Li())}};function Mi(e,t,n){var r=new ji;return r.restart(e,t,n),r}function Ni(){ki(),++B;for(var e=Ci,t;e;)(t=V-e._time)>=0&&e._call.call(void 0,t),e=e._next;--B}function Pi(){V=(Ti=Di.now())+Ei,B=bi=0;try{Ni()}finally{B=0,Ii(),V=0}}function Fi(){var e=Di.now(),t=e-Ti;t>Si&&(Ei-=t,Ti=e)}function Ii(){for(var e,t=Ci,n,r=1/0;t;)t._call?(r>t._time&&(r=t._time),e=t,t=t._next):(n=t._next,t._next=null,t=e?e._next=n:Ci=n);wi=e,Li(r)}function Li(e){B||(bi&&=clearTimeout(bi),e-V>24?(e<1/0&&(bi=setTimeout(Pi,e-Di.now()-Ei)),xi&&=clearInterval(xi)):(xi||=(Ti=Di.now(),setInterval(Fi,Si)),B=1,Oi(Pi)))}function Ri(e,t,n){var r=new ji;return t=t==null?0:+t,r.restart(n=>{r.stop(),e(n+t)},t,n),r}var zi=hi(`start`,`end`,`cancel`,`interrupt`),Bi=[];function Vi(e,t,n,r,i,a){var o=e.__transition;if(!o)e.__transition={};else if(n in o)return;Ui(e,n,{name:t,index:r,group:i,on:zi,tween:Bi,time:a.time,delay:a.delay,duration:a.duration,ease:a.ease,timer:null,state:0})}function Hi(e,t){var n=U(e,t);if(n.state>0)throw Error(`too late; already scheduled`);return n}function H(e,t){var n=U(e,t);if(n.state>3)throw Error(`too late; already running`);return n}function U(e,t){var n=e.__transition;if(!n||!(n=n[t]))throw Error(`transition not found`);return n}function Ui(e,t,n){var r=e.__transition,i;r[t]=n,n.timer=Mi(a,0,n.time);function a(e){n.state=1,n.timer.restart(o,n.delay,n.time),n.delay<=e&&o(e-n.delay)}function o(a){var l,u,d,f;if(n.state!==1)return c();for(l in r)if(f=r[l],f.name===n.name){if(f.state===3)return Ri(o);f.state===4?(f.state=6,f.timer.stop(),f.on.call(`interrupt`,e,e.__data__,f.index,f.group),delete r[l]):+l<t&&(f.state=6,f.timer.stop(),f.on.call(`cancel`,e,e.__data__,f.index,f.group),delete r[l])}if(Ri(function(){n.state===3&&(n.state=4,n.timer.restart(s,n.delay,n.time),s(a))}),n.state=2,n.on.call(`start`,e,e.__data__,n.index,n.group),n.state===2){for(n.state=3,i=Array(d=n.tween.length),l=0,u=-1;l<d;++l)(f=n.tween[l].value.call(e,e.__data__,n.index,n.group))&&(i[++u]=f);i.length=u+1}}function s(t){for(var r=t<n.duration?n.ease.call(null,t/n.duration):(n.timer.restart(c),n.state=5,1),a=-1,o=i.length;++a<o;)i[a].call(e,r);n.state===5&&(n.on.call(`end`,e,e.__data__,n.index,n.group),c())}function c(){for(var i in n.state=6,n.timer.stop(),delete r[t],r)return;delete e.__transition}}function Wi(e,t){var n=e.__transition,r,i,a=!0,o;if(n){for(o in t=t==null?null:t+``,n){if((r=n[o]).name!==t){a=!1;continue}i=r.state>2&&r.state<5,r.state=6,r.timer.stop(),r.on.call(i?`interrupt`:`cancel`,e,e.__data__,r.index,r.group),delete n[o]}a&&delete e.__transition}}function Gi(e){return this.each(function(){Wi(this,e)})}function Ki(e,t,n){e.prototype=t.prototype=n,n.constructor=e}function qi(e,t){var n=Object.create(e.prototype);for(var r in t)n[r]=t[r];return n}function Ji(){}var Yi=.7,Xi=1/Yi,Zi=`\\s*([+-]?\\d+)\\s*`,Qi=`\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*`,W=`\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*`,$i=/^#([0-9a-f]{3,8})$/,ea=RegExp(`^rgb\\(${Zi},${Zi},${Zi}\\)$`),ta=RegExp(`^rgb\\(${W},${W},${W}\\)$`),na=RegExp(`^rgba\\(${Zi},${Zi},${Zi},${Qi}\\)$`),ra=RegExp(`^rgba\\(${W},${W},${W},${Qi}\\)$`),ia=RegExp(`^hsl\\(${Qi},${W},${W}\\)$`),aa=RegExp(`^hsla\\(${Qi},${W},${W},${Qi}\\)$`),oa={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074};Ki(Ji,da,{copy(e){return Object.assign(new this.constructor,this,e)},displayable(){return this.rgb().displayable()},hex:sa,formatHex:sa,formatHex8:ca,formatHsl:la,formatRgb:ua,toString:ua});function sa(){return this.rgb().formatHex()}function ca(){return this.rgb().formatHex8()}function la(){return xa(this).formatHsl()}function ua(){return this.rgb().formatRgb()}function da(e){var t,n;return e=(e+``).trim().toLowerCase(),(t=$i.exec(e))?(n=t[1].length,t=parseInt(t[1],16),n===6?fa(t):n===3?new G(t>>8&15|t>>4&240,t>>4&15|t&240,(t&15)<<4|t&15,1):n===8?pa(t>>24&255,t>>16&255,t>>8&255,(t&255)/255):n===4?pa(t>>12&15|t>>8&240,t>>8&15|t>>4&240,t>>4&15|t&240,((t&15)<<4|t&15)/255):null):(t=ea.exec(e))?new G(t[1],t[2],t[3],1):(t=ta.exec(e))?new G(t[1]*255/100,t[2]*255/100,t[3]*255/100,1):(t=na.exec(e))?pa(t[1],t[2],t[3],t[4]):(t=ra.exec(e))?pa(t[1]*255/100,t[2]*255/100,t[3]*255/100,t[4]):(t=ia.exec(e))?ba(t[1],t[2]/100,t[3]/100,1):(t=aa.exec(e))?ba(t[1],t[2]/100,t[3]/100,t[4]):oa.hasOwnProperty(e)?fa(oa[e]):e===`transparent`?new G(NaN,NaN,NaN,0):null}function fa(e){return new G(e>>16&255,e>>8&255,e&255,1)}function pa(e,t,n,r){return r<=0&&(e=t=n=NaN),new G(e,t,n,r)}function ma(e){return e instanceof Ji||(e=da(e)),e?(e=e.rgb(),new G(e.r,e.g,e.b,e.opacity)):new G}function ha(e,t,n,r){return arguments.length===1?ma(e):new G(e,t,n,r??1)}function G(e,t,n,r){this.r=+e,this.g=+t,this.b=+n,this.opacity=+r}Ki(G,ha,qi(Ji,{brighter(e){return e=e==null?Xi:Xi**+e,new G(this.r*e,this.g*e,this.b*e,this.opacity)},darker(e){return e=e==null?Yi:Yi**+e,new G(this.r*e,this.g*e,this.b*e,this.opacity)},rgb(){return this},clamp(){return new G(K(this.r),K(this.g),K(this.b),ya(this.opacity))},displayable(){return-.5<=this.r&&this.r<255.5&&-.5<=this.g&&this.g<255.5&&-.5<=this.b&&this.b<255.5&&0<=this.opacity&&this.opacity<=1},hex:ga,formatHex:ga,formatHex8:_a,formatRgb:va,toString:va}));function ga(){return`#${q(this.r)}${q(this.g)}${q(this.b)}`}function _a(){return`#${q(this.r)}${q(this.g)}${q(this.b)}${q((isNaN(this.opacity)?1:this.opacity)*255)}`}function va(){let e=ya(this.opacity);return`${e===1?`rgb(`:`rgba(`}${K(this.r)}, ${K(this.g)}, ${K(this.b)}${e===1?`)`:`, ${e})`}`}function ya(e){return isNaN(e)?1:Math.max(0,Math.min(1,e))}function K(e){return Math.max(0,Math.min(255,Math.round(e)||0))}function q(e){return e=K(e),(e<16?`0`:``)+e.toString(16)}function ba(e,t,n,r){return r<=0?e=t=n=NaN:n<=0||n>=1?e=t=NaN:t<=0&&(e=NaN),new J(e,t,n,r)}function xa(e){if(e instanceof J)return new J(e.h,e.s,e.l,e.opacity);if(e instanceof Ji||(e=da(e)),!e)return new J;if(e instanceof J)return e;e=e.rgb();var t=e.r/255,n=e.g/255,r=e.b/255,i=Math.min(t,n,r),a=Math.max(t,n,r),o=NaN,s=a-i,c=(a+i)/2;return s?(o=t===a?(n-r)/s+(n<r)*6:n===a?(r-t)/s+2:(t-n)/s+4,s/=c<.5?a+i:2-a-i,o*=60):s=c>0&&c<1?0:o,new J(o,s,c,e.opacity)}function Sa(e,t,n,r){return arguments.length===1?xa(e):new J(e,t,n,r??1)}function J(e,t,n,r){this.h=+e,this.s=+t,this.l=+n,this.opacity=+r}Ki(J,Sa,qi(Ji,{brighter(e){return e=e==null?Xi:Xi**+e,new J(this.h,this.s,this.l*e,this.opacity)},darker(e){return e=e==null?Yi:Yi**+e,new J(this.h,this.s,this.l*e,this.opacity)},rgb(){var e=this.h%360+(this.h<0)*360,t=isNaN(e)||isNaN(this.s)?0:this.s,n=this.l,r=n+(n<.5?n:1-n)*t,i=2*n-r;return new G(Ta(e>=240?e-240:e+120,i,r),Ta(e,i,r),Ta(e<120?e+240:e-120,i,r),this.opacity)},clamp(){return new J(Ca(this.h),wa(this.s),wa(this.l),ya(this.opacity))},displayable(){return(0<=this.s&&this.s<=1||isNaN(this.s))&&0<=this.l&&this.l<=1&&0<=this.opacity&&this.opacity<=1},formatHsl(){let e=ya(this.opacity);return`${e===1?`hsl(`:`hsla(`}${Ca(this.h)}, ${wa(this.s)*100}%, ${wa(this.l)*100}%${e===1?`)`:`, ${e})`}`}}));function Ca(e){return e=(e||0)%360,e<0?e+360:e}function wa(e){return Math.max(0,Math.min(1,e||0))}function Ta(e,t,n){return(e<60?t+(n-t)*e/60:e<180?n:e<240?t+(n-t)*(240-e)/60:t)*255}var Ea=e=>()=>e;function Da(e,t){return function(n){return e+n*t}}function Oa(e,t,n){return e**=+n,t=t**+n-e,n=1/n,function(r){return(e+r*t)**+n}}function ka(e){return(e=+e)==1?Aa:function(t,n){return n-t?Oa(t,n,e):Ea(isNaN(t)?n:t)}}function Aa(e,t){var n=t-e;return n?Da(e,n):Ea(isNaN(e)?t:e)}var ja=(function e(t){var n=ka(t);function r(e,t){var r=n((e=ha(e)).r,(t=ha(t)).r),i=n(e.g,t.g),a=n(e.b,t.b),o=Aa(e.opacity,t.opacity);return function(t){return e.r=r(t),e.g=i(t),e.b=a(t),e.opacity=o(t),e+``}}return r.gamma=e,r})(1);function Y(e,t){return e=+e,t=+t,function(n){return e*(1-n)+t*n}}var Ma=/[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,Na=new RegExp(Ma.source,`g`);function Pa(e){return function(){return e}}function Fa(e){return function(t){return e(t)+``}}function Ia(e,t){var n=Ma.lastIndex=Na.lastIndex=0,r,i,a,o=-1,s=[],c=[];for(e+=``,t+=``;(r=Ma.exec(e))&&(i=Na.exec(t));)(a=i.index)>n&&(a=t.slice(n,a),s[o]?s[o]+=a:s[++o]=a),(r=r[0])===(i=i[0])?s[o]?s[o]+=i:s[++o]=i:(s[++o]=null,c.push({i:o,x:Y(r,i)})),n=Na.lastIndex;return n<t.length&&(a=t.slice(n),s[o]?s[o]+=a:s[++o]=a),s.length<2?c[0]?Fa(c[0].x):Pa(t):(t=c.length,function(e){for(var n=0,r;n<t;++n)s[(r=c[n]).i]=r.x(e);return s.join(``)})}var La=180/Math.PI,Ra={translateX:0,translateY:0,rotate:0,skewX:0,scaleX:1,scaleY:1};function za(e,t,n,r,i,a){var o,s,c;return(o=Math.sqrt(e*e+t*t))&&(e/=o,t/=o),(c=e*n+t*r)&&(n-=e*c,r-=t*c),(s=Math.sqrt(n*n+r*r))&&(n/=s,r/=s,c/=s),e*r<t*n&&(e=-e,t=-t,c=-c,o=-o),{translateX:i,translateY:a,rotate:Math.atan2(t,e)*La,skewX:Math.atan(c)*La,scaleX:o,scaleY:s}}var Ba;function Va(e){let t=new(typeof DOMMatrix==`function`?DOMMatrix:WebKitCSSMatrix)(e+``);return t.isIdentity?Ra:za(t.a,t.b,t.c,t.d,t.e,t.f)}function Ha(e){return e==null||(Ba||=document.createElementNS(`http://www.w3.org/2000/svg`,`g`),Ba.setAttribute(`transform`,e),!(e=Ba.transform.baseVal.consolidate()))?Ra:(e=e.matrix,za(e.a,e.b,e.c,e.d,e.e,e.f))}function Ua(e,t,n,r){function i(e){return e.length?e.pop()+` `:``}function a(e,r,i,a,o,s){if(e!==i||r!==a){var c=o.push(`translate(`,null,t,null,n);s.push({i:c-4,x:Y(e,i)},{i:c-2,x:Y(r,a)})}else(i||a)&&o.push(`translate(`+i+t+a+n)}function o(e,t,n,a){e===t?t&&n.push(i(n)+`rotate(`+t+r):(e-t>180?t+=360:t-e>180&&(e+=360),a.push({i:n.push(i(n)+`rotate(`,null,r)-2,x:Y(e,t)}))}function s(e,t,n,a){e===t?t&&n.push(i(n)+`skewX(`+t+r):a.push({i:n.push(i(n)+`skewX(`,null,r)-2,x:Y(e,t)})}function c(e,t,n,r,a,o){if(e!==n||t!==r){var s=a.push(i(a)+`scale(`,null,`,`,null,`)`);o.push({i:s-4,x:Y(e,n)},{i:s-2,x:Y(t,r)})}else(n!==1||r!==1)&&a.push(i(a)+`scale(`+n+`,`+r+`)`)}return function(t,n){var r=[],i=[];return t=e(t),n=e(n),a(t.translateX,t.translateY,n.translateX,n.translateY,r,i),o(t.rotate,n.rotate,r,i),s(t.skewX,n.skewX,r,i),c(t.scaleX,t.scaleY,n.scaleX,n.scaleY,r,i),t=n=null,function(e){for(var t=-1,n=i.length,a;++t<n;)r[(a=i[t]).i]=a.x(e);return r.join(``)}}}var Wa=Ua(Va,`px, `,`px)`,`deg)`),Ga=Ua(Ha,`, `,`)`,`)`),Ka=1e-12;function qa(e){return((e=Math.exp(e))+1/e)/2}function Ja(e){return((e=Math.exp(e))-1/e)/2}function Ya(e){return((e=Math.exp(2*e))-1)/(e+1)}var Xa=(function e(t,n,r){function i(e,i){var a=e[0],o=e[1],s=e[2],c=i[0],l=i[1],u=i[2],d=c-a,f=l-o,p=d*d+f*f,m,h;if(p<Ka)h=Math.log(u/s)/t,m=function(e){return[a+e*d,o+e*f,s*Math.exp(t*e*h)]};else{var g=Math.sqrt(p),_=(u*u-s*s+r*p)/(2*s*n*g),v=(u*u-s*s-r*p)/(2*u*n*g),y=Math.log(Math.sqrt(_*_+1)-_);h=(Math.log(Math.sqrt(v*v+1)-v)-y)/t,m=function(e){var r=e*h,i=qa(y),c=s/(n*g)*(i*Ya(t*r+y)-Ja(y));return[a+c*d,o+c*f,s*i/qa(t*r+y)]}}return m.duration=h*1e3*t/Math.SQRT2,m}return i.rho=function(t){var n=Math.max(.001,+t),r=n*n;return e(n,r,r*r)},i})(Math.SQRT2,2,4);function Za(e,t){var n,r;return function(){var i=H(this,e),a=i.tween;if(a!==n){r=n=a;for(var o=0,s=r.length;o<s;++o)if(r[o].name===t){r=r.slice(),r.splice(o,1);break}}i.tween=r}}function Qa(e,t,n){var r,i;if(typeof n!=`function`)throw Error();return function(){var a=H(this,e),o=a.tween;if(o!==r){i=(r=o).slice();for(var s={name:t,value:n},c=0,l=i.length;c<l;++c)if(i[c].name===t){i[c]=s;break}c===l&&i.push(s)}a.tween=i}}function $a(e,t){var n=this._id;if(e+=``,arguments.length<2){for(var r=U(this.node(),n).tween,i=0,a=r.length,o;i<a;++i)if((o=r[i]).name===e)return o.value;return null}return this.each((t==null?Za:Qa)(n,e,t))}function eo(e,t,n){var r=e._id;return e.each(function(){var e=H(this,r);(e.value||={})[t]=n.apply(this,arguments)}),function(e){return U(e,r).value[t]}}function to(e,t){var n;return(typeof t==`number`?Y:t instanceof da?ja:(n=da(t))?(t=n,ja):Ia)(e,t)}function no(e){return function(){this.removeAttribute(e)}}function ro(e){return function(){this.removeAttributeNS(e.space,e.local)}}function io(e,t,n){var r,i=n+``,a;return function(){var o=this.getAttribute(e);return o===i?null:o===r?a:a=t(r=o,n)}}function ao(e,t,n){var r,i=n+``,a;return function(){var o=this.getAttributeNS(e.space,e.local);return o===i?null:o===r?a:a=t(r=o,n)}}function oo(e,t,n){var r,i,a;return function(){var o,s=n(this),c;return s==null?void this.removeAttribute(e):(o=this.getAttribute(e),c=s+``,o===c?null:o===r&&c===i?a:(i=c,a=t(r=o,s)))}}function so(e,t,n){var r,i,a;return function(){var o,s=n(this),c;return s==null?void this.removeAttributeNS(e.space,e.local):(o=this.getAttributeNS(e.space,e.local),c=s+``,o===c?null:o===r&&c===i?a:(i=c,a=t(r=o,s)))}}function co(e,t){var n=vn(e),r=n===`transform`?Ga:to;return this.attrTween(e,typeof t==`function`?(n.local?so:oo)(n,r,eo(this,`attr.`+e,t)):t==null?(n.local?ro:no)(n):(n.local?ao:io)(n,r,t))}function lo(e,t){return function(n){this.setAttribute(e,t.call(this,n))}}function uo(e,t){return function(n){this.setAttributeNS(e.space,e.local,t.call(this,n))}}function fo(e,t){var n,r;function i(){var i=t.apply(this,arguments);return i!==r&&(n=(r=i)&&uo(e,i)),n}return i._value=t,i}function po(e,t){var n,r;function i(){var i=t.apply(this,arguments);return i!==r&&(n=(r=i)&&lo(e,i)),n}return i._value=t,i}function mo(e,t){var n=`attr.`+e;if(arguments.length<2)return(n=this.tween(n))&&n._value;if(t==null)return this.tween(n,null);if(typeof t!=`function`)throw Error();var r=vn(e);return this.tween(n,(r.local?fo:po)(r,t))}function ho(e,t){return function(){Hi(this,e).delay=+t.apply(this,arguments)}}function go(e,t){return t=+t,function(){Hi(this,e).delay=t}}function _o(e){var t=this._id;return arguments.length?this.each((typeof e==`function`?ho:go)(t,e)):U(this.node(),t).delay}function vo(e,t){return function(){H(this,e).duration=+t.apply(this,arguments)}}function yo(e,t){return t=+t,function(){H(this,e).duration=t}}function bo(e){var t=this._id;return arguments.length?this.each((typeof e==`function`?vo:yo)(t,e)):U(this.node(),t).duration}function xo(e,t){if(typeof t!=`function`)throw Error();return function(){H(this,e).ease=t}}function So(e){var t=this._id;return arguments.length?this.each(xo(t,e)):U(this.node(),t).ease}function Co(e,t){return function(){var n=t.apply(this,arguments);if(typeof n!=`function`)throw Error();H(this,e).ease=n}}function wo(e){if(typeof e!=`function`)throw Error();return this.each(Co(this._id,e))}function To(e){typeof e!=`function`&&(e=An(e));for(var t=this._groups,n=t.length,r=Array(n),i=0;i<n;++i)for(var a=t[i],o=a.length,s=r[i]=[],c,l=0;l<o;++l)(c=a[l])&&e.call(c,c.__data__,l,a)&&s.push(c);return new X(r,this._parents,this._name,this._id)}function Eo(e){if(e._id!==this._id)throw Error();for(var t=this._groups,n=e._groups,r=t.length,i=n.length,a=Math.min(r,i),o=Array(r),s=0;s<a;++s)for(var c=t[s],l=n[s],u=c.length,d=o[s]=Array(u),f,p=0;p<u;++p)(f=c[p]||l[p])&&(d[p]=f);for(;s<r;++s)o[s]=t[s];return new X(o,this._parents,this._name,this._id)}function Do(e){return(e+``).trim().split(/^|\s+/).every(function(e){var t=e.indexOf(`.`);return t>=0&&(e=e.slice(0,t)),!e||e===`start`})}function Oo(e,t,n){var r,i,a=Do(t)?Hi:H;return function(){var o=a(this,e),s=o.on;s!==r&&(i=(r=s).copy()).on(t,n),o.on=i}}function ko(e,t){var n=this._id;return arguments.length<2?U(this.node(),n).on.on(e):this.each(Oo(n,e,t))}function Ao(e){return function(){var t=this.parentNode;for(var n in this.__transition)if(+n!==e)return;t&&t.removeChild(this)}}function jo(){return this.on(`end.remove`,Ao(this._id))}function Mo(e){var t=this._name,n=this._id;typeof e!=`function`&&(e=Cn(e));for(var r=this._groups,i=r.length,a=Array(i),o=0;o<i;++o)for(var s=r[o],c=s.length,l=a[o]=Array(c),u,d,f=0;f<c;++f)(u=s[f])&&(d=e.call(u,u.__data__,f,s))&&(`__data__`in u&&(d.__data__=u.__data__),l[f]=d,Vi(l[f],t,n,f,l,U(u,n)));return new X(a,this._parents,t,n)}function No(e){var t=this._name,n=this._id;typeof e!=`function`&&(e=Dn(e));for(var r=this._groups,i=r.length,a=[],o=[],s=0;s<i;++s)for(var c=r[s],l=c.length,u,d=0;d<l;++d)if(u=c[d]){for(var f=e.call(u,u.__data__,d,c),p,m=U(u,n),h=0,g=f.length;h<g;++h)(p=f[h])&&Vi(p,t,n,h,f,m);a.push(f),o.push(u)}return new X(a,o,t,n)}var Po=di.prototype.constructor;function Fo(){return new Po(this._groups,this._parents)}function Io(e,t){var n,r,i;return function(){var a=I(this,e),o=(this.style.removeProperty(e),I(this,e));return a===o?null:a===n&&o===r?i:i=t(n=a,r=o)}}function Lo(e){return function(){this.style.removeProperty(e)}}function Ro(e,t,n){var r,i=n+``,a;return function(){var o=I(this,e);return o===i?null:o===r?a:a=t(r=o,n)}}function zo(e,t,n){var r,i,a;return function(){var o=I(this,e),s=n(this),c=s+``;return s??(c=s=(this.style.removeProperty(e),I(this,e))),o===c?null:o===r&&c===i?a:(i=c,a=t(r=o,s))}}function Bo(e,t){var n,r,i,a=`style.`+t,o=`end.`+a,s;return function(){var c=H(this,e),l=c.on,u=c.value[a]==null?s||=Lo(t):void 0;(l!==n||i!==u)&&(r=(n=l).copy()).on(o,i=u),c.on=r}}function Vo(e,t,n){var r=(e+=``)==`transform`?Wa:to;return t==null?this.styleTween(e,Io(e,r)).on(`end.style.`+e,Lo(e)):typeof t==`function`?this.styleTween(e,zo(e,r,eo(this,`style.`+e,t))).each(Bo(this._id,e)):this.styleTween(e,Ro(e,r,t),n).on(`end.style.`+e,null)}function Ho(e,t,n){return function(r){this.style.setProperty(e,t.call(this,r),n)}}function Uo(e,t,n){var r,i;function a(){var a=t.apply(this,arguments);return a!==i&&(r=(i=a)&&Ho(e,a,n)),r}return a._value=t,a}function Wo(e,t,n){var r=`style.`+(e+=``);if(arguments.length<2)return(r=this.tween(r))&&r._value;if(t==null)return this.tween(r,null);if(typeof t!=`function`)throw Error();return this.tween(r,Uo(e,t,n??``))}function Go(e){return function(){this.textContent=e}}function Ko(e){return function(){var t=e(this);this.textContent=t??``}}function qo(e){return this.tween(`text`,typeof e==`function`?Ko(eo(this,`text`,e)):Go(e==null?``:e+``))}function Jo(e){return function(t){this.textContent=e.call(this,t)}}function Yo(e){var t,n;function r(){var r=e.apply(this,arguments);return r!==n&&(t=(n=r)&&Jo(r)),t}return r._value=e,r}function Xo(e){var t=`text`;if(arguments.length<1)return(t=this.tween(t))&&t._value;if(e==null)return this.tween(t,null);if(typeof e!=`function`)throw Error();return this.tween(t,Yo(e))}function Zo(){for(var e=this._name,t=this._id,n=es(),r=this._groups,i=r.length,a=0;a<i;++a)for(var o=r[a],s=o.length,c,l=0;l<s;++l)if(c=o[l]){var u=U(c,t);Vi(c,e,n,l,o,{time:u.time+u.delay+u.duration,delay:0,duration:u.duration,ease:u.ease})}return new X(r,this._parents,e,n)}function Qo(){var e,t,n=this,r=n._id,i=n.size();return new Promise(function(a,o){var s={value:o},c={value:function(){--i===0&&a()}};n.each(function(){var n=H(this,r),i=n.on;i!==e&&(t=(e=i).copy(),t._.cancel.push(s),t._.interrupt.push(s),t._.end.push(c)),n.on=t}),i===0&&a()})}var $o=0;function X(e,t,n,r){this._groups=e,this._parents=t,this._name=n,this._id=r}function es(){return++$o}var Z=di.prototype;X.prototype={constructor:X,select:Mo,selectAll:No,selectChild:Z.selectChild,selectChildren:Z.selectChildren,filter:To,merge:Eo,selection:Fo,transition:Zo,call:Z.call,nodes:Z.nodes,node:Z.node,size:Z.size,empty:Z.empty,each:Z.each,on:ko,attr:co,attrTween:mo,style:Vo,styleTween:Wo,text:qo,textTween:Xo,remove:jo,tween:$a,delay:_o,duration:bo,ease:So,easeVarying:wo,end:Qo,[Symbol.iterator]:Z[Symbol.iterator]};function ts(e){return((e*=2)<=1?e*e*e:(e-=2)*e*e+2)/2}var ns={time:null,delay:0,duration:250,ease:ts};function rs(e,t){for(var n;!(n=e.__transition)||!(n=n[t]);)if(!(e=e.parentNode))throw Error(`transition ${t} not found`);return n}function is(e){var t,n;e instanceof X?(t=e._id,e=e._name):(t=es(),(n=ns).time=ki(),e=e==null?null:e+``);for(var r=this._groups,i=r.length,a=0;a<i;++a)for(var o=r[a],s=o.length,c,l=0;l<s;++l)(c=o[l])&&Vi(c,e,t,l,o,n||rs(c,t));return new X(r,this._parents,e,t)}di.prototype.interrupt=Gi,di.prototype.transition=is;var as={capture:!0,passive:!1};function os(e){e.preventDefault(),e.stopImmediatePropagation()}function ss(e){var t=e.document.documentElement,n=R(e).on(`dragstart.drag`,os,as);`onselectstart`in t?n.on(`selectstart.drag`,os,as):(t.__noselect=t.style.MozUserSelect,t.style.MozUserSelect=`none`)}function cs(e,t){var n=e.document.documentElement,r=R(e).on(`dragstart.drag`,null);t&&(r.on(`click.drag`,os,as),setTimeout(function(){r.on(`click.drag`,null)},0)),`onselectstart`in n?r.on(`selectstart.drag`,null):(n.style.MozUserSelect=n.__noselect,delete n.__noselect)}var ls=e=>()=>e;function us(e,{sourceEvent:t,target:n,transform:r,dispatch:i}){Object.defineProperties(this,{type:{value:e,enumerable:!0,configurable:!0},sourceEvent:{value:t,enumerable:!0,configurable:!0},target:{value:n,enumerable:!0,configurable:!0},transform:{value:r,enumerable:!0,configurable:!0},_:{value:i}})}function Q(e,t,n){this.k=e,this.x=t,this.y=n}Q.prototype={constructor:Q,scale:function(e){return e===1?this:new Q(this.k*e,this.x,this.y)},translate:function(e,t){return e===0&t===0?this:new Q(this.k,this.x+this.k*e,this.y+this.k*t)},apply:function(e){return[e[0]*this.k+this.x,e[1]*this.k+this.y]},applyX:function(e){return e*this.k+this.x},applyY:function(e){return e*this.k+this.y},invert:function(e){return[(e[0]-this.x)/this.k,(e[1]-this.y)/this.k]},invertX:function(e){return(e-this.x)/this.k},invertY:function(e){return(e-this.y)/this.k},rescaleX:function(e){return e.copy().domain(e.range().map(this.invertX,this).map(e.invert,e))},rescaleY:function(e){return e.copy().domain(e.range().map(this.invertY,this).map(e.invert,e))},toString:function(){return`translate(`+this.x+`,`+this.y+`) scale(`+this.k+`)`}};var ds=new Q(1,0,0);fs.prototype=Q.prototype;function fs(e){for(;!e.__zoom;)if(!(e=e.parentNode))return ds;return e.__zoom}function ps(e){e.stopImmediatePropagation()}function ms(e){e.preventDefault(),e.stopImmediatePropagation()}function hs(e){return(!e.ctrlKey||e.type===`wheel`)&&!e.button}function gs(){var e=this;return e instanceof SVGElement?(e=e.ownerSVGElement||e,e.hasAttribute(`viewBox`)?(e=e.viewBox.baseVal,[[e.x,e.y],[e.x+e.width,e.y+e.height]]):[[0,0],[e.width.baseVal.value,e.height.baseVal.value]]):[[0,0],[e.clientWidth,e.clientHeight]]}function _s(){return this.__zoom||ds}function vs(e){return-e.deltaY*(e.deltaMode===1?.05:e.deltaMode?1:.002)*(e.ctrlKey?10:1)}function ys(){return navigator.maxTouchPoints||`ontouchstart`in this}function bs(e,t,n){var r=e.invertX(t[0][0])-n[0][0],i=e.invertX(t[1][0])-n[1][0],a=e.invertY(t[0][1])-n[0][1],o=e.invertY(t[1][1])-n[1][1];return e.translate(i>r?(r+i)/2:Math.min(0,r)||Math.max(0,i),o>a?(a+o)/2:Math.min(0,a)||Math.max(0,o))}function xs(){var e=hs,t=gs,n=bs,r=vs,i=ys,a=[0,1/0],o=[[-1/0,-1/0],[1/0,1/0]],s=250,c=Xa,l=hi(`start`,`zoom`,`end`),u,d,f,p=500,m=150,h=0,g=10;function _(e){e.property(`__zoom`,_s).on(`wheel.zoom`,ne,{passive:!1}).on(`mousedown.zoom`,re).on(`dblclick.zoom`,ie).filter(i).on(`touchstart.zoom`,ae).on(`touchmove.zoom`,S).on(`touchend.zoom touchcancel.zoom`,oe).style(`-webkit-tap-highlight-color`,`rgba(0,0,0,0)`)}_.transform=function(e,t,n,r){var i=e.selection?e.selection():e;i.property(`__zoom`,_s),e===i?i.interrupt().each(function(){x(this,arguments).event(r).start().zoom(null,typeof t==`function`?t.apply(this,arguments):t).end()}):ee(e,t,n,r)},_.scaleBy=function(e,t,n,r){_.scaleTo(e,function(){return this.__zoom.k*(typeof t==`function`?t.apply(this,arguments):t)},n,r)},_.scaleTo=function(e,r,i,a){_.transform(e,function(){var e=t.apply(this,arguments),a=this.__zoom,s=i==null?b(e):typeof i==`function`?i.apply(this,arguments):i,c=a.invert(s),l=typeof r==`function`?r.apply(this,arguments):r;return n(y(v(a,l),s,c),e,o)},i,a)},_.translateBy=function(e,r,i,a){_.transform(e,function(){return n(this.__zoom.translate(typeof r==`function`?r.apply(this,arguments):r,typeof i==`function`?i.apply(this,arguments):i),t.apply(this,arguments),o)},null,a)},_.translateTo=function(e,r,i,a,s){_.transform(e,function(){var e=t.apply(this,arguments),s=this.__zoom,c=a==null?b(e):typeof a==`function`?a.apply(this,arguments):a;return n(ds.translate(c[0],c[1]).scale(s.k).translate(typeof r==`function`?-r.apply(this,arguments):-r,typeof i==`function`?-i.apply(this,arguments):-i),e,o)},a,s)};function v(e,t){return t=Math.max(a[0],Math.min(a[1],t)),t===e.k?e:new Q(t,e.x,e.y)}function y(e,t,n){var r=t[0]-n[0]*e.k,i=t[1]-n[1]*e.k;return r===e.x&&i===e.y?e:new Q(e.k,r,i)}function b(e){return[(+e[0][0]+ +e[1][0])/2,(+e[0][1]+ +e[1][1])/2]}function ee(e,n,r,i){e.on(`start.zoom`,function(){x(this,arguments).event(i).start()}).on(`interrupt.zoom end.zoom`,function(){x(this,arguments).event(i).end()}).tween(`zoom`,function(){var e=this,a=arguments,o=x(e,a).event(i),s=t.apply(e,a),l=r==null?b(s):typeof r==`function`?r.apply(e,a):r,u=Math.max(s[1][0]-s[0][0],s[1][1]-s[0][1]),d=e.__zoom,f=typeof n==`function`?n.apply(e,a):n,p=c(d.invert(l).concat(u/d.k),f.invert(l).concat(u/f.k));return function(e){if(e===1)e=f;else{var t=p(e),n=u/t[2];e=new Q(n,l[0]-t[0]*n,l[1]-t[1]*n)}o.zoom(null,e)}})}function x(e,t,n){return!n&&e.__zooming||new te(e,t)}function te(e,n){this.that=e,this.args=n,this.active=0,this.sourceEvent=null,this.extent=t.apply(e,n),this.taps=0}te.prototype={event:function(e){return e&&(this.sourceEvent=e),this},start:function(){return++this.active===1&&(this.that.__zooming=this,this.emit(`start`)),this},zoom:function(e,t){return this.mouse&&e!==`mouse`&&(this.mouse[1]=t.invert(this.mouse[0])),this.touch0&&e!==`touch`&&(this.touch0[1]=t.invert(this.touch0[0])),this.touch1&&e!==`touch`&&(this.touch1[1]=t.invert(this.touch1[0])),this.that.__zoom=t,this.emit(`zoom`),this},end:function(){return--this.active===0&&(delete this.that.__zooming,this.emit(`end`)),this},emit:function(e){var t=R(this.that).datum();l.call(e,this.that,new us(e,{sourceEvent:this.sourceEvent,target:_,type:e,transform:this.that.__zoom,dispatch:l}),t)}};function ne(t,...i){if(!e.apply(this,arguments))return;var s=x(this,i).event(t),c=this.__zoom,l=Math.max(a[0],Math.min(a[1],c.k*2**r.apply(this,arguments))),u=z(t);if(s.wheel)(s.mouse[0][0]!==u[0]||s.mouse[0][1]!==u[1])&&(s.mouse[1]=c.invert(s.mouse[0]=u)),clearTimeout(s.wheel);else if(c.k===l)return;else s.mouse=[u,c.invert(u)],Wi(this),s.start();ms(t),s.wheel=setTimeout(d,m),s.zoom(`mouse`,n(y(v(c,l),s.mouse[0],s.mouse[1]),s.extent,o));function d(){s.wheel=null,s.end()}}function re(t,...r){if(f||!e.apply(this,arguments))return;var i=t.currentTarget,a=x(this,r,!0).event(t),s=R(t.view).on(`mousemove.zoom`,d,!0).on(`mouseup.zoom`,p,!0),c=z(t,i),l=t.clientX,u=t.clientY;ss(t.view),ps(t),a.mouse=[c,this.__zoom.invert(c)],Wi(this),a.start();function d(e){if(ms(e),!a.moved){var t=e.clientX-l,r=e.clientY-u;a.moved=t*t+r*r>h}a.event(e).zoom(`mouse`,n(y(a.that.__zoom,a.mouse[0]=z(e,i),a.mouse[1]),a.extent,o))}function p(e){s.on(`mousemove.zoom mouseup.zoom`,null),cs(e.view,a.moved),ms(e),a.event(e).end()}}function ie(r,...i){if(e.apply(this,arguments)){var a=this.__zoom,c=z(r.changedTouches?r.changedTouches[0]:r,this),l=a.invert(c),u=a.k*(r.shiftKey?.5:2),d=n(y(v(a,u),c,l),t.apply(this,i),o);ms(r),s>0?R(this).transition().duration(s).call(ee,d,c,r):R(this).call(_.transform,d,c,r)}}function ae(t,...n){if(e.apply(this,arguments)){var r=t.touches,i=r.length,a=x(this,n,t.changedTouches.length===i).event(t),o,s,c,l;for(ps(t),s=0;s<i;++s)c=r[s],l=z(c,this),l=[l,this.__zoom.invert(l),c.identifier],a.touch0?!a.touch1&&a.touch0[2]!==l[2]&&(a.touch1=l,a.taps=0):(a.touch0=l,o=!0,a.taps=1+!!u);u&&=clearTimeout(u),o&&(a.taps<2&&(d=l[0],u=setTimeout(function(){u=null},p)),Wi(this),a.start())}}function S(e,...t){if(this.__zooming){var r=x(this,t).event(e),i=e.changedTouches,a=i.length,s,c,l,u;for(ms(e),s=0;s<a;++s)c=i[s],l=z(c,this),r.touch0&&r.touch0[2]===c.identifier?r.touch0[0]=l:r.touch1&&r.touch1[2]===c.identifier&&(r.touch1[0]=l);if(c=r.that.__zoom,r.touch1){var d=r.touch0[0],f=r.touch0[1],p=r.touch1[0],m=r.touch1[1],h=(h=p[0]-d[0])*h+(h=p[1]-d[1])*h,g=(g=m[0]-f[0])*g+(g=m[1]-f[1])*g;c=v(c,Math.sqrt(h/g)),l=[(d[0]+p[0])/2,(d[1]+p[1])/2],u=[(f[0]+m[0])/2,(f[1]+m[1])/2]}else if(r.touch0)l=r.touch0[0],u=r.touch0[1];else return;r.zoom(`touch`,n(y(c,l,u),r.extent,o))}}function oe(e,...t){if(this.__zooming){var n=x(this,t).event(e),r=e.changedTouches,i=r.length,a,o;for(ps(e),f&&clearTimeout(f),f=setTimeout(function(){f=null},p),a=0;a<i;++a)o=r[a],n.touch0&&n.touch0[2]===o.identifier?delete n.touch0:n.touch1&&n.touch1[2]===o.identifier&&delete n.touch1;if(n.touch1&&!n.touch0&&(n.touch0=n.touch1,delete n.touch1),n.touch0)n.touch0[1]=this.__zoom.invert(n.touch0[0]);else if(n.end(),n.taps===2&&(o=z(o,this),Math.hypot(d[0]-o[0],d[1]-o[1])<g)){var s=R(this).on(`dblclick.zoom`);s&&s.apply(this,arguments)}}}return _.wheelDelta=function(e){return arguments.length?(r=typeof e==`function`?e:ls(+e),_):r},_.filter=function(t){return arguments.length?(e=typeof t==`function`?t:ls(!!t),_):e},_.touchable=function(e){return arguments.length?(i=typeof e==`function`?e:ls(!!e),_):i},_.extent=function(e){return arguments.length?(t=typeof e==`function`?e:ls([[+e[0][0],+e[0][1]],[+e[1][0],+e[1][1]]]),_):t},_.scaleExtent=function(e){return arguments.length?(a[0]=+e[0],a[1]=+e[1],_):[a[0],a[1]]},_.translateExtent=function(e){return arguments.length?(o[0][0]=+e[0][0],o[1][0]=+e[1][0],o[0][1]=+e[0][1],o[1][1]=+e[1][1],_):[[o[0][0],o[0][1]],[o[1][0],o[1][1]]]},_.constrain=function(e){return arguments.length?(n=e,_):n},_.duration=function(e){return arguments.length?(s=+e,_):s},_.interpolate=function(e){return arguments.length?(c=e,_):c},_.on=function(){var e=l.on.apply(l,arguments);return e===l?_:e},_.clickDistance=function(e){return arguments.length?(h=(e=+e)*e,_):Math.sqrt(h)},_.tapDistance=function(e){return arguments.length?(g=+e,_):g},_}var Ss={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4,EVENT:5,ELEMENT:6},Cs=e=>(...t)=>({_$litDirective$:e,values:t}),ws=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,t,n){this._$Ct=e,this._$AM=t,this._$Ci=n}_$AS(e,t){return this.update(e,t)}update(e,t){return this.render(...t)}},{I:Ts}=ct,Es=e=>e,Ds=()=>document.createComment(``),Os=(e,t,n)=>{let r=e._$AA.parentNode,i=t===void 0?e._$AB:t._$AA;if(n===void 0)n=new Ts(r.insertBefore(Ds(),i),r.insertBefore(Ds(),i),e,e.options);else{let t=n._$AB.nextSibling,a=n._$AM,o=a!==e;if(o){let t;n._$AQ?.(e),n._$AM=e,n._$AP!==void 0&&(t=e._$AU)!==a._$AU&&n._$AP(t)}if(t!==i||o){let e=n._$AA;for(;e!==t;){let t=Es(e).nextSibling;Es(r).insertBefore(e,i),e=t}}}return n},$=(e,t,n=e)=>(e._$AI(t,n),e),ks={},As=(e,t=ks)=>e._$AH=t,js=e=>e._$AH,Ms=e=>{e._$AR(),e._$AA.remove()},Ns=(e,t,n)=>{let r=/* @__PURE__ */ new Map;for(let i=t;i<=n;i++)r.set(e[i],i);return r},Ps=Cs(class extends ws{constructor(e){if(super(e),e.type!==Ss.CHILD)throw Error(`repeat() can only be used in text expressions`)}dt(e,t,n){let r;n===void 0?n=t:t!==void 0&&(r=t);let i=[],a=[],o=0;for(let t of e)i[o]=r?r(t,o):o,a[o]=n(t,o),o++;return{values:a,keys:i}}render(e,t,n){return this.dt(e,t,n).values}update(e,[t,n,r]){let i=js(e),{values:a,keys:o}=this.dt(t,n,r);if(!Array.isArray(i))return this.ut=o,a;let s=this.ut??=[],c=[],l,u,d=0,f=i.length-1,p=0,m=a.length-1;for(;d<=f&&p<=m;)if(i[d]===null)d++;else if(i[f]===null)f--;else if(s[d]===o[p])c[p]=$(i[d],a[p]),d++,p++;else if(s[f]===o[m])c[m]=$(i[f],a[m]),f--,m--;else if(s[d]===o[m])c[m]=$(i[d],a[m]),Os(e,c[m+1],i[d]),d++,m--;else if(s[f]===o[p])c[p]=$(i[f],a[p]),Os(e,i[d],i[f]),f--,p++;else if(l===void 0&&(l=Ns(o,p,m),u=Ns(s,d,f)),l.has(s[d])){if(l.has(s[f])){let t=u.get(o[p]),n=t===void 0?null:i[t];if(n===null){let t=Os(e,i[d]);$(t,a[p]),c[p]=t}else c[p]=$(n,a[p]),Os(e,i[d],n),i[t]=null;p++}else Ms(i[f]),f--}else Ms(i[d]),d++;for(;p<=m;){let t=Os(e,c[m+1]);$(t,a[p]),c[p++]=t}for(;d<=f;){let e=i[d++];e!==null&&Ms(e)}return this.ut=o,As(e,c),k}});function Fs(e){var t=0,n=e.children,r=n&&n.length;if(!r)t=1;else for(;--r>=0;)t+=n[r].value;e.value=t}function Is(){return this.eachAfter(Fs)}function Ls(e,t){let n=-1;for(let r of this)e.call(t,r,++n,this);return this}function Rs(e,t){for(var n=this,r=[n],i,a,o=-1;n=r.pop();)if(e.call(t,n,++o,this),i=n.children)for(a=i.length-1;a>=0;--a)r.push(i[a]);return this}function zs(e,t){for(var n=this,r=[n],i=[],a,o,s,c=-1;n=r.pop();)if(i.push(n),a=n.children)for(o=0,s=a.length;o<s;++o)r.push(a[o]);for(;n=i.pop();)e.call(t,n,++c,this);return this}function Bs(e,t){let n=-1;for(let r of this)if(e.call(t,r,++n,this))return r}function Vs(e){return this.eachAfter(function(t){for(var n=+e(t.data)||0,r=t.children,i=r&&r.length;--i>=0;)n+=r[i].value;t.value=n})}function Hs(e){return this.eachBefore(function(t){t.children&&t.children.sort(e)})}function Us(e){for(var t=this,n=Ws(t,e),r=[t];t!==n;)t=t.parent,r.push(t);for(var i=r.length;e!==n;)r.splice(i,0,e),e=e.parent;return r}function Ws(e,t){if(e===t)return e;var n=e.ancestors(),r=t.ancestors(),i=null;for(e=n.pop(),t=r.pop();e===t;)i=e,e=n.pop(),t=r.pop();return i}function Gs(){for(var e=this,t=[e];e=e.parent;)t.push(e);return t}function Ks(){return Array.from(this)}function qs(){var e=[];return this.eachBefore(function(t){t.children||e.push(t)}),e}function Js(){var e=this,t=[];return e.each(function(n){n!==e&&t.push({source:n.parent,target:n})}),t}function*Ys(){var e=this,t,n=[e],r,i,a;do for(t=n.reverse(),n=[];e=t.pop();)if(yield e,r=e.children)for(i=0,a=r.length;i<a;++i)n.push(r[i]);while(n.length)}function Xs(e,t){e instanceof Map?(e=[void 0,e],t===void 0&&(t=$s)):t===void 0&&(t=Qs);for(var n=new nc(e),r,i=[n],a,o,s,c;r=i.pop();)if((o=t(r.data))&&(c=(o=Array.from(o)).length))for(r.children=o,s=c-1;s>=0;--s)i.push(a=o[s]=new nc(o[s])),a.parent=r,a.depth=r.depth+1;return n.eachBefore(tc)}function Zs(){return Xs(this).eachBefore(ec)}function Qs(e){return e.children}function $s(e){return Array.isArray(e)?e[1]:null}function ec(e){e.data.value!==void 0&&(e.value=e.data.value),e.data=e.data.data}function tc(e){var t=0;do e.height=t;while((e=e.parent)&&e.height<++t)}function nc(e){this.data=e,this.depth=this.height=0,this.parent=null}nc.prototype=Xs.prototype={constructor:nc,count:Is,each:Ls,eachAfter:zs,eachBefore:Rs,find:Bs,sum:Vs,sort:Hs,path:Us,ancestors:Gs,descendants:Ks,leaves:qs,links:Js,copy:Zs,[Symbol.iterator]:Ys};function rc(e,t){return e.parent===t.parent?1:2}function ic(e){var t=e.children;return t?t[0]:e.t}function ac(e){var t=e.children;return t?t[t.length-1]:e.t}function oc(e,t,n){var r=n/(t.i-e.i);t.c-=r,t.s+=n,e.c+=r,t.z+=n,t.m+=n}function sc(e){for(var t=0,n=0,r=e.children,i=r.length,a;--i>=0;)a=r[i],a.z+=t,a.m+=t,t+=a.s+(n+=a.c)}function cc(e,t,n){return e.a.parent===t.parent?e.a:n}function lc(e,t){this._=e,this.parent=null,this.children=null,this.A=null,this.a=this,this.z=0,this.m=0,this.c=0,this.s=0,this.t=null,this.i=t}lc.prototype=Object.create(nc.prototype);function uc(e){for(var t=new lc(e,0),n,r=[t],i,a,o,s;n=r.pop();)if(a=n._.children)for(n.children=Array(s=a.length),o=s-1;o>=0;--o)r.push(i=n.children[o]=new lc(a[o],o)),i.parent=n;return(t.parent=new lc(null,0)).children=[t],t}function dc(){var e=rc,t=1,n=1,r=null;function i(i){var s=uc(i);if(s.eachAfter(a),s.parent.m=-s.z,s.eachBefore(o),r)i.eachBefore(c);else{var l=i,u=i,d=i;i.eachBefore(function(e){e.x<l.x&&(l=e),e.x>u.x&&(u=e),e.depth>d.depth&&(d=e)});var f=l===u?1:e(l,u)/2,p=f-l.x,m=t/(u.x+f+p),h=n/(d.depth||1);i.eachBefore(function(e){e.x=(e.x+p)*m,e.y=e.depth*h})}return i}function a(t){var n=t.children,r=t.parent.children,i=t.i?r[t.i-1]:null;if(n){sc(t);var a=(n[0].z+n[n.length-1].z)/2;i?(t.z=i.z+e(t._,i._),t.m=t.z-a):t.z=a}else i&&(t.z=i.z+e(t._,i._));t.parent.A=s(t,i,t.parent.A||r[0])}function o(e){e._.x=e.z+e.parent.m,e.m+=e.parent.m}function s(t,n,r){if(n){for(var i=t,a=t,o=n,s=i.parent.children[0],c=i.m,l=a.m,u=o.m,d=s.m,f;o=ac(o),i=ic(i),o&&i;)s=ic(s),a=ac(a),a.a=t,f=o.z+u-i.z-c+e(o._,i._),f>0&&(oc(cc(o,t,r),t,f),c+=f,l+=f),u+=o.m,c+=i.m,d+=s.m,l+=a.m;o&&!ac(a)&&(a.t=o,a.m+=u-l),i&&!ic(s)&&(s.t=i,s.m+=c-d,r=t)}return r}function c(e){e.x*=t,e.y=e.depth*n}return i.separation=function(t){return arguments.length?(e=t,i):e},i.size=function(e){return arguments.length?(r=!1,t=+e[0],n=+e[1],i):r?null:[t,n]},i.nodeSize=function(e){return arguments.length?(r=!0,t=+e[0],n=+e[1],i):r?[t,n]:null},i}var fc={comfortable:{breadth:132,depth:150},compact:{breadth:92,depth:112}},pc=`\0root`;function mc(e,t,n){let r=/* @__PURE__ */ new Map;if(e.roots.length===0)return{positions:r,bounds:{minX:0,minY:0,maxX:0,maxY:0}};let{breadth:i,depth:a}=fc[t],o=Xs(pc,t=>t===pc?e.roots:e.children.get(t)),s=dc().nodeSize([i,a]).separation((e,t)=>e.parent===t.parent?1:1.25)(o),c={minX:1/0,minY:1/0,maxX:-1/0,maxY:-1/0};for(let e of s.descendants()){if(e.data===pc)continue;let t=e.x,i=(e.depth-1)*a,o=n===`vertical`?{x:t,y:i}:{x:i,y:t};r.set(e.data,o),c.minX=Math.min(c.minX,o.x),c.minY=Math.min(c.minY,o.y),c.maxX=Math.max(c.maxX,o.x),c.maxY=Math.max(c.maxY,o.y)}return{positions:r,bounds:c}}function hc(e,t,n,r=48){let i=Math.max(e.maxX-e.minX,1),a=Math.max(e.maxY-e.minY,1),o=Math.min(1.5,Math.max(.2,Math.min((t-2*r)/i,(n-2*r)/a))),s=(e.minX+e.maxX)/2,c=(e.minY+e.maxY)/2;return{k:o,x:t/2-s*o,y:n/2-c*o}}function gc(e,t,n,r,i=120){let a=/* @__PURE__ */ new Set;for(let[o,s]of e.positions){let e=s.x*t.k+t.x,c=s.y*t.k+t.y;e>=-i&&e<=n+i&&c>=-i&&c<=r+i&&a.add(o)}return a}function _c(e,t,n,r){let i=r===`vertical`,a={parent:i?`ArrowUp`:`ArrowLeft`,child:i?`ArrowDown`:`ArrowRight`,previous:i?`ArrowLeft`:`ArrowUp`,next:i?`ArrowRight`:`ArrowDown`};if(!Object.values(a).includes(n))return;if(t===void 0||!e.visuals.has(t))return e.roots[0];let o=tn(e,t),s=o.indexOf(t);switch(n){case a.parent:return e.parentOf.get(t)??t;case a.child:return e.children.get(t)?.[0]??t;case a.previous:return o[s-1]??t;default:return o[s+1]??t}}var vc={comfortable:22,compact:16},yc=250,bc=22;function xc(e,t){if(e.type===`wheel`){let n=e;return t&&!n.ctrlKey&&!n.metaKey?`hint`:`zoom`}let n=e;return n.ctrlKey||(n.button??0)!==0?`ignore`:`zoom`}S(`uit-graph-view`,class extends N{static properties={model:{attribute:!1},density:{attribute:!1},orientation:{attribute:!1},showLabels:{attribute:!1},selectedId:{attribute:!1},localize:{attribute:!1},siteName:{attribute:!1},ctrlZoom:{attribute:!1},reducedMotion:{attribute:!1},focusId:{state:!0},hintVisible:{state:!0}};layout;entering=/* @__PURE__ */ new Set;exiting=/* @__PURE__ */ new Map;lastVisuals=/* @__PURE__ */ new Map;exitTimer;hintTimer;transform={x:0,y:0,k:1};width=0;height=0;fitted=!1;zoomBehavior;resizeObserver;constructor(){super(),this.density=`comfortable`,this.orientation=`vertical`,this.showLabels=!0,this.siteName=``,this.ctrlZoom=!0,this.reducedMotion=!1,this.hintVisible=!1}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(e=>{let t=e[0]?.contentRect;t&&this.setViewportSize(t.width,t.height)}),this.resizeObserver.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.resizeObserver?.disconnect(),this.exitTimer!==void 0&&clearTimeout(this.exitTimer),this.hintTimer!==void 0&&clearTimeout(this.hintTimer),this.exitTimer=void 0,this.hintTimer=void 0}setViewportSize(e,t){this.width=e,this.height=t,this.fitted?this.needsCulling&&this.requestUpdate():this.tryInitialFit()}get needsCulling(){return(this.layout?.positions.size??0)>300}get svgEl(){return this.renderRoot.querySelector(`svg.canvas`)}willUpdate(e){if(this.model&&(e.has(`model`)||e.has(`density`)||e.has(`orientation`))){let e=mc(this.model,this.density,this.orientation),t=this.layout;this.entering=new Set(t?[...e.positions.keys()].filter(e=>!t.positions.has(e)):[]);for(let t of e.positions.keys())this.exiting.delete(t);if(t&&!this.reducedMotion){for(let[n,r]of t.positions){let t=this.lastVisuals.get(n);!e.positions.has(n)&&t&&this.exiting.set(n,{point:r,visual:t})}this.scheduleExitCleanup()}this.layout=e,this.lastVisuals=new Map(this.model.visuals),(this.focusId===void 0||!this.model.visuals.has(this.focusId))&&(this.focusId=this.model.roots[0])}}firstUpdated(){let e=this.svgEl;e&&(this.zoomBehavior=xs().scaleExtent([.2,4]).extent(()=>[[0,0],[Math.max(this.width,1),Math.max(this.height,1)]]).filter(e=>{let t=xc(e,this.ctrlZoom);return t===`hint`&&this.flashHint(),t===`zoom`}).on(`zoom`,e=>this.onZoom(e.transform)).on(`end`,()=>{this.needsCulling&&this.requestUpdate()}),R(e).call(this.zoomBehavior).on(`dblclick.zoom`,null),this.tryInitialFit())}updated(){this.tryInitialFit()}tryInitialFit(){this.fitted||!this.layout||!this.zoomBehavior||this.width<=0||this.height<=0||(this.fitted=!0,this.fit(!1))}onZoom(e){this.transform={x:e.x,y:e.y,k:e.k},this.renderRoot.querySelector(`g.viewport`)?.setAttribute(`transform`,this.transformAttr())}transformAttr(){let{x:e,y:t,k:n}=this.transform;return`translate(${e},${t}) scale(${n})`}fit(e=!0){let t=this.svgEl;if(!this.layout||!this.zoomBehavior||!t)return;let n=hc(this.layout.bounds,this.width,this.height),r=ds.translate(n.x,n.y).scale(n.k);e&&!this.reducedMotion?this.zoomBehavior.transform(R(t).transition().duration(300),r):this.zoomBehavior.transform(R(t),r)}zoomBy(e){let t=this.svgEl;this.zoomBehavior&&t&&(this.reducedMotion?this.zoomBehavior.scaleBy(R(t),e):this.zoomBehavior.scaleBy(R(t).transition().duration(200),e))}async focusNode(e){this.focusId=e,await this.updateComplete;let t=this.layout?.positions.get(e),n=this.svgEl;if(t&&n&&this.zoomBehavior&&this.width>0){let e=t.x*this.transform.k+this.transform.x,r=t.y*this.transform.k+this.transform.y;(e<40||e>this.width-40||r<40||r>this.height-40)&&(this.zoomBehavior.translateTo(R(n),t.x,t.y),await this.updateComplete)}for(let t of this.renderRoot.querySelectorAll(`g.nodes g.node`))t.getAttribute(`data-id`)===e&&t.focus()}flashHint(){this.hintVisible=!0,this.hintTimer!==void 0&&clearTimeout(this.hintTimer),this.hintTimer=setTimeout(()=>{this.hintVisible=!1},1500)}scheduleExitCleanup(){this.exiting.size!==0&&this.exitTimer===void 0&&(this.exitTimer=setTimeout(()=>{this.exitTimer=void 0,this.exiting.clear(),this.requestUpdate()},yc))}highlightedPath(){let e=/* @__PURE__ */ new Set,t=this.model;if(!t||this.selectedId===void 0)return e;let n=t.visuals.has(this.selectedId)?this.selectedId:nn(t,this.selectedId)?.id;for(;n!==void 0;)e.add(n),n=t.parentOf.get(n);return e}onKeydown(e){let t=this.model;if(!t)return;let n=_c(t,this.focusId,e.key,this.orientation);if(n!==void 0){e.preventDefault(),this.focusNode(n);return}(e.key===`Enter`||e.key===` `)&&this.focusId!==void 0?(e.preventDefault(),P(this,`uit-activate`,{id:this.focusId})):e.key===`+`||e.key===`=`?(e.preventDefault(),this.zoomBy(1.25)):e.key===`-`?(e.preventDefault(),this.zoomBy(.8)):e.key===`0`&&(e.preventDefault(),this.fit())}render(){let{model:e,layout:t,localize:n}=this;if(!e||!t||!n)return A;let r=vc[this.density],i=[...t.positions.keys()],a=[...e.links.values()];if(this.needsCulling&&this.width>0){let e=gc(t,this.transform,this.width,this.height);this.focusId!==void 0&&e.add(this.focusId),this.selectedId!==void 0&&e.add(this.selectedId),i=i.filter(t=>e.has(t)),a=a.filter(t=>e.has(t.childId)||e.has(t.parentId))}let o=this.highlightedPath();return D`
            <svg
                class="canvas ${this.reducedMotion?`still`:``}"
                role="application"
                aria-roledescription=${n(`graph.roledescription`)}
                aria-label=${n(`graph.label`,{site:this.siteName,devices:e.stats.devices,clients:e.stats.clients})}
                @keydown=${this.onKeydown}
            >
                <g class="viewport" transform=${this.transformAttr()}>
                    <g class="links">
                        ${Ps(a,e=>e.childId,e=>this.renderLink(e,t,o))}
                    </g>
                    <g class="nodes">
                        ${Ps(i,e=>e,n=>this.renderNode(e,e.visuals.get(n),t.positions.get(n),r,o,!0))}
                    </g>
                    <g class="exits" aria-hidden="true">
                        ${Ps([...this.exiting],([e])=>e,([,t])=>this.renderGhost(e,t,r))}
                    </g>
                </g>
            </svg>
            <div class="hint" aria-hidden="true" ?hidden=${!this.hintVisible}>
                ${n(`zoom.hint`)}
            </div>
        `}renderLink(e,t,n){let r=t.positions.get(e.parentId),i=t.positions.get(e.childId);if(!r||!i)return A;let a=this.orientation===`vertical`?(r.y+i.y)/2:(r.x+i.x)/2,o=this.orientation===`vertical`?`M${r.x},${r.y} C${r.x},${a} ${i.x},${a} ${i.x},${i.y}`:`M${r.x},${r.y} C${a},${r.y} ${a},${i.y} ${i.x},${i.y}`,s=this.showLabels?pn(e.edge):``;return O`<path class=${[`link`,e.edge?.medium??`unknown`,e.viaHidden.length>0?`via-hidden`:``,n.has(e.childId)?`on-path`:``].join(` `)} d=${o}></path>${s?O`<text class="link-label" x=${(r.x+i.x)/2} y=${(r.y+i.y)/2}>${s}</text>`:A}`}renderNode(e,t,n,r,i,a){let o=this.localize,s=t.id,c=hn(t),l=mn(t,o),u=t.type===`group`?`group`:t.node.kind,d=[`node`,t.type,u,c,s===this.selectedId?`selected`:``,i.has(s)?`on-path`:``,this.entering.has(s)?`enter`:``],f=t.type===`group`?Bt:Vt(t.node),p=r+16;return O`<g
      class=${d.join(` `)}
      data-id=${s}
      role=${a?`button`:A}
      tabindex=${a?s===this.focusId?0:-1:A}
      aria-label=${a?gn(e,t,o):A}
      aria-expanded=${a&&t.type===`group`?String(t.expanded):A}
      style=${`transform: translate(${n.x}px, ${n.y}px)`}
      @click=${a?()=>P(this,`uit-activate`,{id:s}):A}
      @focus=${a?()=>{this.focusId=s}:A}
    >
      <title>${l}</title>
      <circle class="hit" r=${Math.max(r,22)}></circle>
      <circle class="ring" r=${r+5}></circle>
      <circle class="disc" r=${r}></circle>
      <svg class="glyph" x=${-r*.6} y=${-r*.6} width=${r*1.2} height=${r*1.2} viewBox="0 0 24 24" aria-hidden="true">
        <path d=${f}></path>
      </svg>
      <circle class="status" cx=${r*.72} cy=${-r*.72} r=${Math.max(4,r*.24)}></circle>
      ${t.type===`group`?O`<text class="badge" x=${r*.95} y=${r+2}>${t.counts.total}</text>`:A}
      ${this.showLabels?O`<text class="label" y=${p}>${ln(l,bc)}</text>`:A}
      ${c===`offline`?O`<text class="state-text" y=${this.showLabels?p+14:p}>${o(F.offline)}</text>`:A}
    </g>`}renderGhost(e,t,n){return this.renderNode(e,t.visual,t.point,n,/* @__PURE__ */ new Set,!1)}static styles=[rn,C`
            :host {
                display: block;
                position: relative;
                flex: 1;
                min-width: 0;
                min-height: 0;
            }
            svg.canvas {
                display: block;
                width: 100%;
                height: 100%;
                touch-action: none;
                user-select: none;
            }
            .node {
                cursor: pointer;
                outline: none;
                transition: transform 250ms ease;
            }
            .still .node {
                transition: none;
            }
            .node.enter {
                animation: uit-fade-in 250ms ease;
            }
            .exits .node {
                animation: uit-fade-out 250ms ease forwards;
                pointer-events: none;
            }
            .still .node.enter,
            .still .exits .node {
                animation: none;
            }
            @keyframes uit-fade-in {
                from {
                    opacity: 0;
                }
            }
            @keyframes uit-fade-out {
                to {
                    opacity: 0;
                }
            }
            .hit {
                fill: transparent;
            }
            .ring {
                fill: none;
                stroke: none;
            }
            .node:focus-visible .ring {
                stroke: var(--uit-focus);
                stroke-width: 2;
            }
            .disc {
                fill: var(--card-background-color, #fff);
                stroke: var(--uit-line);
                stroke-width: 2;
            }
            .selected .disc,
            .on-path .disc {
                stroke: var(--uit-focus);
            }
            .selected .disc {
                stroke-width: 3;
            }
            .glyph path {
                fill: var(--primary-text-color);
            }
            .offline .disc,
            .offline .glyph {
                opacity: 0.55;
            }
            .status {
                fill: var(--uit-online);
                stroke: var(--card-background-color, #fff);
                stroke-width: 2;
            }
            .offline .status {
                fill: var(--uit-offline);
            }
            .unknown .status {
                fill: var(--uit-unknown);
            }
            text {
                font-size: 12px;
                fill: var(--primary-text-color);
                text-anchor: middle;
                dominant-baseline: hanging;
            }
            .badge {
                font-weight: 600;
                text-anchor: start;
            }
            .state-text {
                fill: var(--uit-offline);
                font-weight: 600;
            }
            .link {
                fill: none;
                stroke: var(--secondary-text-color);
                stroke-opacity: 0.6;
                stroke-width: 1.5;
            }
            .link.wireless {
                stroke-dasharray: 2 4;
            }
            .link.via-hidden {
                stroke-dasharray: 8 4;
            }
            .link.on-path {
                stroke: var(--uit-focus);
                stroke-opacity: 1;
                stroke-width: 2.5;
            }
            .link-label {
                font-size: 10px;
                fill: var(--secondary-text-color);
                paint-order: stroke;
                stroke: var(--card-background-color, #fff);
                stroke-width: 3;
            }
            .hint {
                position: absolute;
                left: 50%;
                bottom: 12px;
                transform: translateX(-50%);
                padding: 6px 12px;
                border-radius: 16px;
                background: var(--primary-text-color);
                color: var(--card-background-color, #fff);
                font-size: 12px;
                pointer-events: none;
            }
            .hint[hidden] {
                display: none;
            }
            @media (prefers-reduced-motion: reduce) {
                .node {
                    transition: none;
                }
                .node.enter,
                .exits .node {
                    animation: none;
                }
            }
        `]});function Sc(e,t){return e.type===`group`?e.members.some(e=>e.name.toLowerCase().includes(t)):e.node.name.toLowerCase().includes(t)}function Cc(e,t,n){let r=n.trim().toLowerCase(),i;if(r){i=/* @__PURE__ */ new Set;for(let[t,n]of e.visuals)if(Sc(n,r))for(let n=t;n!==void 0&&!i.has(n);n=e.parentOf.get(n))i.add(n)}let a=[],o=(n,s,c)=>{let l=i?n.filter(e=>i.has(e)):n;l.forEach((n,i)=>{let u=e.visuals.get(n),d=e.children.get(n)??[],f=u.type===`group`,p=f||d.length>0,m=f?u.expanded:r!==``||!t.has(n);a.push({id:n,visual:u,level:s,posinset:i+1,setsize:l.length,hasChildren:p,expanded:p&&m,parentId:c}),m&&d.length>0&&o(d,s+1,n)})};return o(e.roots,1,void 0),a}S(`uit-list-view`,class extends N{static properties={model:{attribute:!1},selectedId:{attribute:!1},localize:{attribute:!1},siteName:{attribute:!1},query:{state:!0},collapsed:{state:!0},focusId:{state:!0}};rows=[];typeahead=``;typeaheadTimer;constructor(){super(),this.siteName=``,this.query=``,this.collapsed=/* @__PURE__ */ new Set}willUpdate(){this.model&&(this.rows=Cc(this.model,this.collapsed,this.query),this.rows.some(e=>e.id===this.focusId)||(this.focusId=this.rows[0]?.id))}render(){let{model:e,localize:t}=this;return!e||!t?A:D`
            <div class="search">
                <input
                    type="search"
                    .value=${this.query}
                    placeholder=${t(`list.search`)}
                    aria-label=${t(`list.search`)}
                    @input=${e=>{this.query=e.target.value}}
                />
            </div>
            ${this.rows.length===0?D`<p class="empty">${t(`list.no_matches`)}</p>`:D`<div
                      class="tree"
                      role="tree"
                      aria-label=${t(`list.label`,{site:this.siteName})}
                      @keydown=${this.onKeydown}
                  >
                      ${Ps(this.rows,e=>e.id,n=>this.renderRow(e,n,t))}
                  </div>`}
        `}renderRow(e,t,n){let r=t.visual,i=mn(r,n),a=hn(r);return D`<div
            class="row ${a} ${t.id===this.selectedId?`selected`:``}"
            role="treeitem"
            data-id=${t.id}
            aria-level=${t.level}
            aria-setsize=${t.setsize}
            aria-posinset=${t.posinset}
            aria-selected=${String(t.id===this.selectedId)}
            aria-expanded=${t.hasChildren?String(t.expanded):A}
            aria-label=${gn(e,r,n)}
            tabindex=${t.id===this.focusId?0:-1}
            style=${`--level: ${t.level}`}
            @click=${()=>P(this,`uit-activate`,{id:t.id})}
            @focus=${()=>{this.focusId=t.id}}
        >
            <span
                class="chevron"
                aria-hidden="true"
                @click=${e=>{e.stopPropagation(),t.hasChildren&&this.toggle(t)}}
                >${t.hasChildren?Ht(t.expanded?Ot:kt):A}</span
            >
            ${Ht(r.type===`group`?Bt:Vt(r.node))}
            <span class="name" title=${i}>${i}</span>
            ${r.type===`group`?D`<span class="count">${r.counts.total}</span>`:D`<span class="dot" aria-hidden="true"></span>${a===`online`?A:D`<span class="state-text"
                                >${n(F[a])}</span
                            >`}`}
        </div>`}toggle(e){if(e.visual.type===`group`){P(this,`uit-toggle-group`,{id:e.id});return}let t=new Set(this.collapsed);t.has(e.id)?t.delete(e.id):t.add(e.id),this.collapsed=t}onKeydown(e){let t=this.rows,n=t.findIndex(e=>e.id===this.focusId),r=t[n];if(!r)return;let i;switch(e.key){case`ArrowDown`:i=t[n+1]?.id;break;case`ArrowUp`:i=t[n-1]?.id;break;case`Home`:i=t[0]?.id;break;case`End`:i=t.at(-1)?.id;break;case`ArrowRight`:r.hasChildren&&!r.expanded?this.toggle(r):r.expanded&&(i=t[n+1]?.id);break;case`ArrowLeft`:r.expanded?this.toggle(r):i=r.parentId;break;case`Enter`:case` `:P(this,`uit-activate`,{id:r.id});break;default:e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&(e.preventDefault(),this.typeAhead(e.key,n));return}e.preventDefault(),i!==void 0&&this.focusRow(i)}typeAhead(e,t){this.typeahead+=e.toLowerCase(),this.typeaheadTimer!==void 0&&clearTimeout(this.typeaheadTimer),this.typeaheadTimer=setTimeout(()=>{this.typeahead=``},500);let n=this.rows;for(let e=1;e<=n.length;e++){let r=n[(t+e)%n.length];if(mn(r.visual,this.localize).toLowerCase().startsWith(this.typeahead)){this.focusRow(r.id);return}}}async focusRow(e){this.focusId=e,await this.updateComplete;let t=this.renderRoot.querySelectorAll(`[role="treeitem"]`);for(let n of t)n.getAttribute(`data-id`)===e&&n.focus()}static styles=[rn,an,C`
            :host {
                display: flex;
                flex-direction: column;
                flex: 1;
                min-height: 0;
                min-width: 0;
            }
            .search {
                padding: 8px 12px;
            }
            .search input {
                width: 100%;
            }
            .tree {
                overflow: auto;
                flex: 1;
                padding: 0 4px 8px;
            }
            .row {
                display: flex;
                align-items: center;
                gap: 8px;
                min-height: 44px;
                padding-inline-start: calc((var(--level) - 1) * 20px + 4px);
                padding-inline-end: 12px;
                border-radius: 8px;
                cursor: pointer;
            }
            .row.selected {
                background: color-mix(
                    in srgb,
                    var(--uit-focus) 16%,
                    transparent
                );
            }
            .row.offline .icon,
            .row.offline .name {
                opacity: 0.55;
            }
            .chevron {
                width: 24px;
                display: inline-flex;
            }
            .name {
                flex: 1;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: var(--uit-online);
                flex: none;
            }
            .offline .dot {
                background: var(--uit-offline);
            }
            .unknown .dot {
                background: var(--uit-unknown);
            }
            .state-text {
                color: var(--uit-offline);
                font-weight: 600;
                font-size: 0.85em;
            }
            .count {
                color: var(--secondary-text-color);
            }
            .empty {
                padding: 16px;
                color: var(--secondary-text-color);
            }
        `]});var wc=600,Tc=`/config/integrations/integration/unifi_insights`,Ec={integration:`action.integration`,edit:`action.edit`},Dc={loading:{key:`state.loading`},no_sources:{key:`state.no_sources`,action:`integration`},unconfigured:{key:`state.unconfigured`,action:`edit`},empty:{key:`state.empty`},incompatible:{key:`state.incompatible`},reloading:{key:`state.reconnecting`}},Oc=e=>e?.nodes.filter(e=>e.kind!==`client`&&e.state===`offline`).length??0,kc=class extends N{static properties={hass:{attribute:!1},layout:{attribute:!1},config:{state:!0},sources:{state:!0},snapshot:{state:!0},lastGood:{state:!0},error:{state:!0},incompatible:{state:!0},disconnected:{state:!0},ui:{state:!0},view:{state:!0},selectedId:{state:!0},siteOverride:{state:!0},narrow:{state:!0},reducedMotion:{state:!0},announcement:{state:!0}};subscription=new Et({onSnapshot:e=>this.applySnapshot(e),onError:e=>{this.error=e},onIncompatible:()=>{this.incompatible=!0},onDisconnected:()=>{this.disconnected=!0},onReconnected:()=>{this.hass&&this.loadSources(this.hass)}});buildModel=en();announcer=new pt(e=>{this.announcement=e});sourcesFor;sourcesPending=!1;sourcesRetry;sourcesAttempt=0;sourcesError;boundKey;cardState={phase:`loading`,stale:!1,notices:[]};model;resizeObserver;motionQuery;localizeLang;localizeFn;constructor(){super(),this.incompatible=!1,this.disconnected=!1,this.ui={kinds:new Set(e),clients:`collapsed`,toggledGroups:/* @__PURE__ */ new Set},this.view=`graph`,this.narrow=!1,this.reducedMotion=!1,this.announcement=``}setConfig(e){let t=ne(te(e));this.config=t,this.view=t.view,this.ui={kinds:new Set(t.kinds),clients:t.clients,toggledGroups:/* @__PURE__ */ new Set},this.siteOverride=void 0}getCardSize(){return 8}getGridOptions(){return{columns:12,rows:8,min_columns:6,min_rows:4}}static getConfigElement(){return document.createElement(g)}static async getStubConfig(e){try{let n=re(await e.callWS({type:t}))[0];if(n)return{type:_,...n.binding}}catch{}return{type:_}}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(e=>{let t=e[0]?.contentRect.width??0;this.narrow=t>0&&t<wc}),this.resizeObserver.observe(this),this.motionQuery=window.matchMedia(`(prefers-reduced-motion: reduce)`),this.motionQuery.addEventListener(`change`,this.onMotionChange),this.onMotionChange(),this.sync()}disconnectedCallback(){super.disconnectedCallback(),this.subscription.stop(),this.announcer.dispose(),this.resizeObserver?.disconnect(),this.resizeObserver=void 0,this.motionQuery?.removeEventListener(`change`,this.onMotionChange),this.sourcesFor=void 0,this.clearSourcesRetry()}shouldUpdate(e){if(e.size!==1||!e.has(`hass`))return!0;let t=e.get(`hass`),n=this.hass;return!t||!n||t.connection!==n.connection||(t.locale?.language??t.language)!==(n.locale?.language??n.language)}willUpdate(e){(e.has(`hass`)||e.has(`config`)||e.has(`sources`)||e.has(`siteOverride`))&&this.sync();let t=this.config;if(!t)return;this.cardState=vt({sources:this.sources,binding:this.binding,snapshot:this.snapshot,lastGood:this.lastGood,error:this.error,incompatible:this.incompatible,disconnected:this.disconnected,maxClients:t.max_clients}),this.model=this.cardState.render?this.buildModel(this.cardState.render,this.ui):void 0;let n=this.selectedId;n!==void 0&&!(this.model?.visuals.has(n)||this.model?.nodes.has(n))&&(this.selectedId=void 0)}get binding(){return this.config?this.siteOverride??ie(this.config,this.sources):void 0}get localize(){let e=this.hass?.locale?.language??this.hass?.language??`en`;return(e!==this.localizeLang||!this.localizeFn)&&(this.localizeLang=e,this.localizeFn=ce(e)),this.localizeFn}get graphView(){return this.renderRoot.querySelector(`uit-graph-view`)}sync(){let{hass:e,config:t}=this;if(!this.isConnected||!e||!t)return;this.sourcesFor!==e.connection&&(this.sourcesFor=e.connection,this.disconnected=!1,this.clearSourcesRetry(),this.sourcesAttempt=0,this.loadSources(e));let n=this.binding,r=n?`${n.entry_id}\u0000${n.site_id}`:void 0;r!==this.boundKey&&(this.boundKey=r,this.snapshot=void 0,this.lastGood=void 0,this.error=void 0,this.sourcesError=void 0,this.incompatible=!1,this.selectedId=void 0),this.subscription.update(e.connection,n?{...n,max_clients:t.max_clients}:void 0)}async loadSources(e){if(this.sourcesPending)return;this.sourcesPending=!0,this.clearSourcesRetry();let n=e.connection;try{let r=await e.callWS({type:t});if(this.sourcesFor!==n)return;this.sources=r,this.sourcesError&&this.error===this.sourcesError&&(this.error=void 0),this.sourcesError=void 0,r.length>0?this.sourcesAttempt=0:this.scheduleSourcesRetry()}catch(e){if(this.sourcesFor!==n)return;let t=this.sourcesError;this.sourcesError=bt(e),(!this.error||this.error===t)&&(this.error=this.sourcesError),this.scheduleSourcesRetry()}finally{this.sourcesPending=!1,this.isConnected&&this.sourcesFor!==void 0&&this.sourcesFor!==n&&this.hass&&this.loadSources(this.hass)}}scheduleSourcesRetry(){this.isConnected&&(this.sourcesRetry=setTimeout(()=>{this.sourcesRetry=void 0,this.hass&&this.loadSources(this.hass)},Tt(this.sourcesAttempt++)))}clearSourcesRetry(){this.sourcesRetry!==void 0&&clearTimeout(this.sourcesRetry),this.sourcesRetry=void 0}applySnapshot(e){let t=this.snapshot;this.snapshot=e,this.error=void 0,this.incompatible=!1,this.disconnected=!1,e.status!==`unavailable`&&e.nodes.length>0&&(this.lastGood=e),this.hass&&this.sources!==void 0&&!this.sources.some(t=>t.entry_id===e.entry_id)&&this.loadSources(this.hass);let n=this.localize,r=n(`announce.updated`),i=e.issues[0],a=Oc(e);if(e.status===`unavailable`&&i){let t=gt(i,e,this.config?.max_clients??0);r=n(t.key,t.vars)}else a>0&&a!==Oc(t)&&(r=n(`announce.offline`,{count:a}));this.announcer.announce(r)}onMotionChange=()=>{this.reducedMotion=this.motionQuery?.matches??!1};onActivate=e=>{let t=e.detail.id;this.model?.visuals.get(t)?.type===`group`&&this.toggleGroup(t),this.selectedId=t};onSelect=e=>{let t=e.detail.id,n=this.model;if(n&&!n.visuals.has(t)){let e=nn(n,t);e&&!e.expanded&&this.toggleGroup(e.id)}this.selectedId=t};onToggleGroup=e=>{this.toggleGroup(e.detail.id)};onClose=()=>{this.selectedId=void 0};onKeydown=e=>{e.key===`Escape`&&this.selectedId!==void 0&&(e.stopPropagation(),this.selectedId=void 0)};toggleGroup(e){let t=new Set(this.ui.toggledGroups);t.has(e)?t.delete(e):t.add(e),this.ui={...this.ui,toggledGroups:t}}toggleKind(e){let t=new Set(this.ui.kinds);if(t.has(e)){if(t.size===1)return;t.delete(e)}else t.add(e);this.ui={...this.ui,kinds:t}}runAction(e){xt(e===`integration`?Tc:`${location.pathname}?edit=1`)}render(){let e=this.config;if(!e)return A;let t=this.localize,n=this.cardState,r=this.model,i=e.title??n.render?.site_name??this.snapshot?.site_name??t(`card.name`);return D`<ha-card>
            <div
                class="card ${this.narrow?`narrow`:``}"
                @keydown=${this.onKeydown}
                @uit-activate=${this.onActivate}
                @uit-select=${this.onSelect}
                @uit-toggle-group=${this.onToggleGroup}
                @uit-close=${this.onClose}
            >
                <header>
                    <h2 class="title" title=${i}>${i}</h2>
                    ${this.renderSiteSelector(e,t)}
                </header>
                ${r?this.renderToolbar(t):A}
                ${r?this.renderNotices(n.notices,t):A}
                <div class="body">
                    ${r?this.renderContent(r,n,e,t):this.renderMessage(n,t)}
                </div>
                <div class="sr-only" role="status" aria-live="polite">
                    ${this.announcement}
                </div>
            </div>
        </ha-card>`}renderSiteSelector(e,t){let n=re(this.sources??[]);if(!e.show_site_selector||n.length<2)return A;let r=this.binding;return D`<label class="site">
            <span class="sr-only">${t(`toolbar.site`)}</span>
            <select
                @change=${e=>{let t=n[Number(e.target.value)];t&&(this.siteOverride=t.binding)}}
            >
                ${n.map((e,t)=>D`<option
                            value=${t}
                            ?selected=${ae(e.binding,r)}
                        >
                            ${e.label}
                        </option>`)}
            </select>
        </label>`}renderToolbar(t){let n=D`
            <div
                class="group"
                role="group"
                aria-label=${t(`toolbar.view`)}
            >
                ${v.map(e=>D`<button
                            aria-pressed=${String(this.view===e)}
                            @click=${()=>{this.view=e}}
                        >
                            ${t(sn[e])}
                        </button>`)}
            </div>
            <div
                class="group"
                role="group"
                aria-label=${t(`toolbar.filters`)}
            >
                ${e.map(e=>D`<button
                            aria-pressed=${String(this.ui.kinds.has(e))}
                            @click=${()=>this.toggleKind(e)}
                        >
                            ${t(on[e])}
                        </button>`)}
            </div>
            ${this.view===`graph`?D`<div
                      class="group"
                      role="group"
                      aria-label=${t(`toolbar.zoom`)}
                  >
                      ${this.iconButton(Ft,t(`zoom.in`),()=>this.graphView?.zoomBy(1.25))}
                      ${this.iconButton(Pt,t(`zoom.out`),()=>this.graphView?.zoomBy(.8))}
                      ${this.iconButton(Mt,t(`zoom.fit`),()=>this.graphView?.fit())}
                  </div>`:A}
        `;return this.narrow?D`<details class="toolbar">
                  <summary>${t(`toolbar.options`)}</summary>
                  <div class="controls">${n}</div>
              </details>`:D`<div class="toolbar">
                  <div class="controls">${n}</div>
              </div>`}iconButton(e,t,n){return D`<button
            class="icon-button"
            aria-label=${t}
            title=${t}
            @click=${n}
        >
            ${Ht(e)}
        </button>`}actionButton(e,t){return D`<button
            class="action"
            @click=${()=>this.runAction(e)}
        >
            ${t(Ec[e])}
        </button>`}renderNotices(e,t){return e.length===0?A:D`<ul class="notices">
            ${e.map(e=>D`<li class=${e.severity}>
                        <span>${t(e.key,e.vars)}</span>${e.action?this.actionButton(e.action,t):A}
                    </li>`)}
        </ul>`}renderMessage(e,t){let n=Dc[e.phase],r={site:this.snapshot?.site_name??``},i=[];return n&&i.push({...n,vars:r}),i.push(...e.notices),D`<div class="message ${e.phase}">
            ${e.phase===`loading`?D`<svg
                      class="skeleton"
                      viewBox="0 0 120 60"
                      aria-hidden="true"
                  >
                      <path d="M60 18 L30 37 M60 18 L90 37"></path>
                      <circle cx="60" cy="10" r="8"></circle>
                      <circle cx="30" cy="45" r="8"></circle>
                      <circle cx="90" cy="45" r="8"></circle>
                  </svg>`:A}
            ${i.map(e=>D`<p>${t(e.key,e.vars)}</p>
                        ${e.action?this.actionButton(e.action,t):A}`)}
        </div>`}renderContent(e,t,n,r){let i=n.density??(this.narrow?`compact`:`comfortable`),a=t.render?.site_name??``,o=t.phase===`reloading`?`${r(`state.stale`)} · ${r(`state.reconnecting`)}`:r(`state.stale`);return D`<div class="content ${t.stale?`stale`:``}">
            ${t.stale?D`<span class="badge stale">${o}</span>`:A}
            ${this.view===`graph`?D`<uit-graph-view
                      .model=${e}
                      .density=${i}
                      .orientation=${n.orientation}
                      .showLabels=${n.show_labels}
                      .selectedId=${this.selectedId}
                      .localize=${r}
                      .siteName=${a}
                      .ctrlZoom=${this.layout!==`panel`}
                      .reducedMotion=${this.reducedMotion}
                  ></uit-graph-view>`:D`<uit-list-view
                      .model=${e}
                      .selectedId=${this.selectedId}
                      .localize=${r}
                      .siteName=${a}
                  ></uit-list-view>`}
            <uit-detail-panel
                .model=${e}
                .selectedId=${this.selectedId}
                .localize=${r}
                ?narrow=${this.narrow}
            ></uit-detail-panel>
        </div>`}static styles=[rn,an,C`
            :host {
                display: block;
                height: 100%;
            }
            ha-card {
                height: 100%;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                container-type: inline-size;
            }
            .card {
                position: relative;
                display: flex;
                flex-direction: column;
                flex: 1;
                min-height: 0;
            }
            header {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px 4px;
            }
            .title {
                flex: 1;
                min-width: 0;
                margin: 0;
                font-size: var(--ha-card-header-font-size, 1.25rem);
                font-weight: normal;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .toolbar {
                padding: 4px 12px;
            }
            details.toolbar > summary {
                min-height: 44px;
                display: flex;
                align-items: center;
                cursor: pointer;
                padding: 0 4px;
            }
            .controls {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 8px 16px;
            }
            .group {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }
            .icon-button {
                padding: 0;
                border-radius: 50%;
            }
            .notices {
                list-style: none;
                margin: 4px 12px;
                padding: 0;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .notices li {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 10px;
                border-radius: 8px;
                border-inline-start: 4px solid var(--uit-warning);
                background: color-mix(
                    in srgb,
                    var(--uit-warning) 12%,
                    transparent
                );
            }
            .notices li.info {
                border-color: var(--uit-focus);
                background: color-mix(
                    in srgb,
                    var(--uit-focus) 10%,
                    transparent
                );
            }
            .notices li.error {
                border-color: var(--uit-offline);
                background: color-mix(
                    in srgb,
                    var(--uit-offline) 12%,
                    transparent
                );
            }
            .notices li span {
                flex: 1;
            }
            .body {
                position: relative;
                display: flex;
                flex: 1;
                min-height: 280px;
            }
            .content {
                position: relative;
                display: flex;
                flex: 1;
                min-width: 0;
            }
            .content.stale uit-graph-view,
            .content.stale uit-list-view {
                opacity: 0.55;
                filter: grayscale(1);
            }
            .badge.stale {
                position: absolute;
                top: 8px;
                left: 12px;
                z-index: 1;
                padding: 2px 10px;
                border-radius: 12px;
                background: var(--card-background-color);
                border: 1px solid var(--uit-line);
                font-size: 0.85em;
            }
            .message {
                margin: auto;
                padding: 24px;
                text-align: center;
                color: var(--secondary-text-color);
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
            }
            .message p {
                margin: 0;
            }
            .skeleton {
                width: 120px;
                fill: var(--uit-line);
                stroke: var(--uit-line);
                stroke-width: 2;
                animation: uit-pulse 1.5s ease-in-out infinite;
            }
            @keyframes uit-pulse {
                50% {
                    opacity: 0.4;
                }
            }
            @container (width < 600px) {
                header {
                    padding: 8px 12px 0;
                }
                .body {
                    min-height: 240px;
                }
            }
        `]},Ac=`current`,jc=``,Mc={collapsed:`clients.collapsed`,expanded:`clients.expanded`,hidden:`clients.hidden`},Nc={auto:`density.auto`,comfortable:`density.comfortable`,compact:`density.compact`},Pc={vertical:`orientation.vertical`,horizontal:`orientation.horizontal`},Fc={site:`editor.site`,title:`editor.title`,view:`editor.view`,clients:`editor.clients`,kinds:`editor.kinds`,density:`editor.density`,orientation:`editor.orientation`,show_site_selector:`editor.show_site_selector`,show_labels:`editor.show_labels`,max_clients:`editor.max_clients`};function Ic(e,t,n){return e.map(e=>({value:e,label:n(t[e])}))}var Lc=(e,t)=>typeof e==`string`&&t.includes(e);function Rc(e,t){let{entry_id:n,site_id:r}=e;if(n===void 0||r===void 0)return jc;let i=t.findIndex(e=>ae(e.binding,{entry_id:n,site_id:r}));return i>=0?String(i):Ac}function zc(t,n,r){let i=n.map((e,t)=>({value:String(t),label:e.label}));return Rc(t,n)===`current`&&i.push({value:Ac,label:r(`editor.site_unavailable`,{site:t.site_id??``})}),[{name:`site`,selector:{select:{mode:`dropdown`,options:i}}},{name:`title`,selector:{text:{}}},{name:``,type:`grid`,schema:[{name:`view`,selector:{select:{mode:`dropdown`,options:Ic(v,sn,r)}}},{name:`clients`,selector:{select:{mode:`dropdown`,options:Ic(y,Mc,r)}}},{name:`density`,selector:{select:{mode:`dropdown`,options:Ic([`auto`,...b],Nc,r)}}},{name:`orientation`,selector:{select:{mode:`dropdown`,options:Ic(ee,Pc,r)}}}]},{name:`kinds`,selector:{select:{multiple:!0,mode:`list`,options:Ic(e,on,r)}}},{name:`show_site_selector`,selector:{boolean:{}}},{name:`show_labels`,selector:{boolean:{}}},{name:`max_clients`,selector:{number:{min:1,max:500,mode:`box`}}}]}function Bc(t,n){return{site:Rc(t,n),title:t.title??``,view:t.view??`graph`,clients:t.clients??`collapsed`,density:t.density??`auto`,orientation:t.orientation??`vertical`,kinds:t.kinds?[...t.kinds]:[...e],show_site_selector:t.show_site_selector??!1,show_labels:t.show_labels??!0,max_clients:t.max_clients??500}}function Vc(t,n,r){let i={...n},a=t.site??jc;if(a===jc)delete i.entry_id,delete i.site_id;else if(a!==`current`){let e=r[Number(a)];e&&(i.entry_id=e.binding.entry_id,i.site_id=e.binding.site_id)}t.title?i.title=t.title:delete i.title,Lc(t.view,v)&&(i.view=t.view),Lc(t.clients,y)&&(i.clients=t.clients),Lc(t.orientation,ee)&&(i.orientation=t.orientation),Lc(t.density,b)?i.density=t.density:t.density===`auto`&&delete i.density;let o=(t.kinds??[]).filter(t=>Lc(t,e));o.length===e.length?delete i.kinds:o.length>0&&(i.kinds=e.filter(e=>o.includes(e))),typeof t.show_site_selector==`boolean`&&(i.show_site_selector=t.show_site_selector),typeof t.show_labels==`boolean`&&(i.show_labels=t.show_labels);let s=t.max_clients;return s===500?delete i.max_clients:typeof s==`number`&&Number.isInteger(s)&&s>=1&&s<=500&&(i.max_clients=s),i}async function Hc(e=customElements,t=window.loadCardHelpers){e.get(`ha-form`)||await((await t?.())?.createCardElement({type:`entities`,entities:[]})?.constructor)?.getConfigElement?.()}var Uc=class extends N{static properties={hass:{attribute:!1},config:{state:!0},sources:{state:!0},formReady:{state:!0}};sourcesRequested=!1;constructor(){super(),this.formReady=!1}setConfig(e){this.config={...e}}connectedCallback(){super.connectedCallback(),Hc().catch(()=>void 0).then(()=>{this.formReady=!0})}willUpdate(){this.hass&&!this.sourcesRequested&&(this.sourcesRequested=!0,this.hass.callWS({type:t}).then(e=>{this.sources=e},()=>{this.sources=[]}))}render(){let{hass:e,config:t}=this;if(!e||!t)return A;let n=ce(e.locale?.language??e.language);if(!this.formReady)return D`<p>${n(`state.loading`)}</p>`;let r=re(this.sources??[]);return D`<ha-form
            .hass=${e}
            .data=${Bc(t,r)}
            .schema=${zc(t,r,n)}
            .computeLabel=${e=>{let t=Fc[e.name];return t?n(t):``}}
            @value-changed=${this.onValueChanged}
        ></ha-form>`}onValueChanged=e=>{e.stopPropagation();let t=this.config;if(!t)return;let n=e.detail.value,r=Vc(n,t,re(this.sources??[]));this.config=r,P(this,`config-changed`,{config:r})}};S(h,kc),S(g,Uc);var Wc=ce(`en`);window.customCards??=[],window.customCards.some(e=>e.type===`unifi-insights-topology-card`)||window.customCards.push({type:h,name:Wc(`card.name`),description:Wc(`card.description`),preview:!0,documentationURL:`https://github.com/ruaan-deysel/ha-unifi-insights#network-topology-card`});