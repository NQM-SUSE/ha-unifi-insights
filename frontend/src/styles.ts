import { css } from "lit";

/** State and focus colours from the HA theme (fallbacks are HA's own defaults). */
export const themeTokens = css`
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
`;

/** Native controls styled to sit in an HA card, with ≥ 44 px targets and visible focus. */
export const controlStyles = css`
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
`;
