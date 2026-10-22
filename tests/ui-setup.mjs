import { JSDOM } from 'jsdom';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://app.example.com',pretendToBeVisual:true});
for (const name of ['window','document','navigator','HTMLElement','HTMLButtonElement','HTMLInputElement','Element','Node','NodeFilter','HTMLFieldSetElement','HTMLLegendElement','SVGElement','MutationObserver','localStorage','sessionStorage','CustomEvent','KeyboardEvent','Event','MouseEvent','PointerEvent','getComputedStyle']) {
 if (dom.window[name]) Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
}
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.ResizeObserver=class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView=function() {};
Element.prototype.scrollBy=function() {};
window.matchMedia=() => ({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
