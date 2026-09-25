import {
    LitElement,
    css,
    html,
    nothing,
    type PropertyValues,
    type TemplateResult,
} from "lit";
import type { TopologyNode } from "../contract";
import { defineOnce } from "../define";
import { fireEvent, navigate } from "../ha-types";
import { iconFor, iconTemplate, mdiClose, mdiOpenInNew } from "../icons";
import type { LocalizeFunc, LocalizeKey } from "../localize";
import type { GraphModel, GroupVisual } from "../model/graph-model";
import { controlStyles, themeTokens } from "../styles";
import {
    KIND_KEYS,
    MEDIUM_KEYS,
    STATE_KEYS,
    formatSpeed,
    visualTitle,
} from "./describe";

type Row = [LocalizeKey, string | undefined];

/** Details of the selected device, client or client group; a side panel, or a bottom sheet when narrow. */
export class UitDetailPanel extends LitElement {
    static override properties = {
        model: { attribute: false },
        selectedId: { attribute: false },
        localize: { attribute: false },
        narrow: { type: Boolean, reflect: true },
        memberQuery: { state: true },
    };

    declare model?: GraphModel;
    declare selectedId?: string;
    declare localize?: LocalizeFunc;
    declare narrow: boolean;
    declare memberQuery: string;

    constructor() {
        super();
        this.narrow = false;
        this.memberQuery = "";
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has("selectedId")) this.memberQuery = "";
    }

    protected override render(): TemplateResult | typeof nothing {
        const { model, selectedId, localize } = this;
        if (!model || !selectedId || !localize) return nothing;
        const visual = model.visuals.get(selectedId);
        if (visual?.type === "group")
            return this.shell(
                visualTitle(visual, localize),
                this.groupBody(visual, localize),
            );
        const node = model.nodes.get(selectedId);
        if (!node) return nothing;
        const body =
            node.kind === "client"
                ? this.clientBody(model, node, localize)
                : this.deviceBody(model, node, localize);
        return this.shell(node.name, body);
    }

    private shell(title: string, body: TemplateResult): TemplateResult {
        const localize = this.localize!;
        return html`<section class="panel" role="region" aria-label=${title}>
            <header>
                <h3 title=${title}>${title}</h3>
                <button
                    class="close"
                    aria-label=${localize("detail.close")}
                    title=${localize("detail.close")}
                    @click=${() => fireEvent(this, "uit-close")}
                >
                    ${iconTemplate(mdiClose)}
                </button>
            </header>
            ${body}
        </section>`;
    }

    private rows(rows: Row[]): TemplateResult {
        const shown = rows.filter(
            (r): r is [LocalizeKey, string] =>
                r[1] !== undefined && r[1] !== "",
        );
        return html`<dl>
            ${shown.map(
                ([key, value]) =>
                    html`<div class="row">
                        <dt>${this.localize!(key)}</dt>
                        <dd>${value}</dd>
                    </div>`,
            )}
        </dl>`;
    }

    private uplinkRows(
        model: GraphModel,
        id: string,
        localize: LocalizeFunc,
        withMedium: boolean,
    ): Row[] {
        const parentId = model.realParent.get(id);
        const edge = model.edges.get(id);
        let port: string | undefined;
        if (edge?.parent_port !== undefined) {
            port =
                edge.child_port === undefined
                    ? String(edge.parent_port)
                    : `${edge.parent_port} → ${edge.child_port}`;
        }
        return [
            [
                "detail.parent",
                parentId === undefined
                    ? undefined
                    : model.nodes.get(parentId)?.name,
            ],
            ["detail.port", port],
            [
                "detail.speed",
                edge?.speed_mbps ? formatSpeed(edge.speed_mbps) : undefined,
            ],
            [
                "detail.medium",
                withMedium && edge
                    ? localize(MEDIUM_KEYS[edge.medium])
                    : undefined,
            ],
            [
                "detail.poe",
                edge?.poe_power_w === undefined
                    ? undefined
                    : `${edge.poe_power_w.toFixed(1)} W`,
            ],
        ];
    }

    private deviceBody(
        model: GraphModel,
        node: TopologyNode,
        localize: LocalizeFunc,
    ): TemplateResult {
        const counts = model.clientCounts.get(node.id);
        const hidden = model.links.get(node.id)?.viaHidden ?? [];
        return html`${this.rows([
            ["detail.kind", localize(KIND_KEYS[node.kind])],
            ["detail.model", node.model],
            ["detail.state", localize(STATE_KEYS[node.state])],
            ...this.uplinkRows(model, node.id, localize, true),
            [
                "detail.clients",
                counts
                    ? localize("detail.clients_value", {
                          total: counts.total,
                          wired: counts.wired,
                          wireless: counts.wireless,
                      })
                    : undefined,
            ],
            [
                "detail.via_hidden",
                hidden.length > 0
                    ? hidden.map((k) => localize(KIND_KEYS[k])).join(", ")
                    : undefined,
            ],
        ])}
        ${node.ha_device_id
            ? html`<button
                  class="action"
                  @click=${() =>
                      navigate(
                          `/config/devices/device/${encodeURIComponent(node.ha_device_id!)}`,
                      )}
              >
                  ${iconTemplate(mdiOpenInNew)}${localize("detail.open_device")}
              </button>`
            : nothing}`;
    }

    private clientBody(
        model: GraphModel,
        node: TopologyNode,
        localize: LocalizeFunc,
    ): TemplateResult {
        return this.rows([
            ["detail.state", localize(STATE_KEYS[node.state])],
            [
                "detail.connection",
                node.connection
                    ? localize(MEDIUM_KEYS[node.connection])
                    : undefined,
            ],
            [
                "detail.vlan",
                node.vlan_id === undefined ? undefined : String(node.vlan_id),
            ],
            ["detail.network", node.network_name],
            ...this.uplinkRows(model, node.id, localize, false),
        ]);
    }

    private groupBody(
        group: GroupVisual,
        localize: LocalizeFunc,
    ): TemplateResult {
        const q = this.memberQuery.trim().toLowerCase();
        const members = q
            ? group.members.filter((m) => m.name.toLowerCase().includes(q))
            : group.members;
        const c = group.counts;
        return html`${this.rows([
                [
                    "detail.clients",
                    localize("detail.clients_value", {
                        total: c.total,
                        wired: c.wired,
                        wireless: c.wireless,
                    }),
                ],
            ])}
            <input
                type="search"
                .value=${this.memberQuery}
                placeholder=${localize("detail.search_members")}
                aria-label=${localize("detail.search_members")}
                @input=${(e: Event) => {
                    this.memberQuery = (e.target as HTMLInputElement).value;
                }}
            />
            <ul class="members">
                ${members.map(
                    (m) =>
                        html`<li>
                            <button
                                class="member ${m.state}"
                                @click=${() =>
                                    fireEvent(this, "uit-select", { id: m.id })}
                            >
                                ${iconTemplate(iconFor(m))}<span
                                    class="name"
                                    title=${m.name}
                                    >${m.name}</span
                                >
                                ${m.state === "online"
                                    ? nothing
                                    : html`<span class="state-text"
                                          >${localize(
                                              STATE_KEYS[m.state],
                                          )}</span
                                      >`}
                            </button>
                        </li>`,
                )}
            </ul>`;
    }

    static override styles = [
        themeTokens,
        controlStyles,
        css`
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
        `,
    ];
}

defineOnce("uit-detail-panel", UitDetailPanel);

declare global {
    interface HTMLElementTagNameMap {
        "uit-detail-panel": UitDetailPanel;
    }
}
