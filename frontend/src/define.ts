/** Define a custom element unless something (an older bundle, a prototype) already did. */
export function defineOnce(tag: string, ctor: CustomElementConstructor): void {
    if (!customElements.get(tag)) customElements.define(tag, ctor);
}
