"use client";
// The hold ledger in AG Studio (D-001 prize target: Best Use of AG Grid). Real holds from the
// database, Hawker's own widgets and theme, and an agent team: Hawker's agent fronts the chat with a
// live PayPal tool and delegates dashboard work to Studio's five built-in agents. Every model turn
// goes through /api/ai/turn (the one model client, rule 11). APIs verified in node_modules types.
import {
  AgStudioAiModule,
  createAiHarness,
  directLlmRunner,
  studioTheme,
  type AgAiHarnessSetup,
  type AgAiTool,
  type AgFieldDefinition,
  type AgReportState,
  type AgStudioApi,
} from "ag-studio";
import { AgStudio, AgStudioProvider, createWidgets } from "ag-studio-react";
import { useEffect, useMemo, useRef } from "react";
import { hawkerAdapter } from "./adapter";
import type { LedgerRow } from "@/lib/service/ledger";
import { ledgerTotals } from "./totals";
import { endingsWidget, owesWidget } from "./widgets";

const MODULES = [AgStudioAiModule];

// Invoice Pad in Studio's own theme parameters (names from api/theme/theme.d.ts).
const theme = studioTheme.withParams({
  fontFamily: "var(--font-public), system-ui, sans-serif",
  fontSize: 13,
  textColor: "#171717",
  backgroundColor: "#e6eaf2",
  borderColor: "#b9c0d6",
  studioCanvasBackgroundColor: "#e6eaf2",
  studioCanvasFontFamily: "var(--font-public), system-ui, sans-serif",
  studioWidgetBackgroundColor: "#fbfcfd",
  studioWidgetBorder: { width: 1, color: "#b9c0d6", style: "solid" },
  studioWidgetBorderRadius: 0,
  studioWidgetTitleFontFamily: "var(--font-franklin), sans-serif",
  studioWidgetTitleFontWeight: 800,
  studioWidgetTitleFontSize: 17,
  studioWidgetTitleTextColor: "#2a3a8f",
  studioToggleButtonActiveBackgroundColor: "#2a3a8f",
  studioToggleButtonActiveBorderColor: "#2a3a8f",
  studioToggleButtonActiveColor: "#ffffff",
  // Series colours follow the stamps: Paid in carbon blue, Passed in stamp red, then the copy tints.
  chartPaletteFills1Color: "#2a3a8f",
  chartPaletteFills2Color: "#b3202b",
  chartPaletteFills3Color: "#c9a91c",
  chartPaletteFills4Color: "#6f8fbf",
  chartPaletteFills5Color: "#4a4d52",
  chartFontFamily: "var(--font-public), system-ui, sans-serif",
  chartTextColor: "#171717",
  chartAxisLabelColor: "#4b5263",
});

const ledgerField = (id: string, aggregation?: "sum" | "count") => ({ id: `ledger.${id}`, ...(aggregation ? { aggregation } : {}) });
const title = (text: string) => ({ format: { title: { enabled: true, text } } });

// Field names and formats for the ledger table (format ids from api/agFormats.d.ts).
const FIELDS: AgFieldDefinition[] = [
  { id: "copy", name: "Copy", format: "textFormat", description: "The numbered copy, e.g. No. 0014." },
  { id: "serial", name: "Serial", format: "integerFormat", hide: true },
  { id: "state", name: "State", format: "textFormat", description: "Waiting, Holding, Paid or Passed." },
  { id: "ending", name: "How it ended", format: "textFormat", description: "Paid on PayPal, Passed → @next buyer, or Passed → next buyer when no one waited." },
  { id: "buyer", name: "Buyer", format: "textFormat" },
  { id: "item", name: "Item", format: "textFormat" },
  { id: "code", name: "Item code", format: "textFormat" },
  { id: "variant", name: "Variant", format: "textFormat" },
  { id: "qty", name: "Qty", format: "integerFormat" },
  { id: "amountUsd", name: "Amount", format: "currencyFormat", description: "The copy's total in USD.", formatOptions: { format: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }) } },
  { id: "paidUsd", name: "Paid amount", format: "currencyFormat", description: "The amount if the copy ended Paid, else 0.", formatOptions: { format: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }) } },
  { id: "passedUsd", name: "Passed amount", format: "currencyFormat", description: "The amount if the copy ended Passed, else 0.", formatOptions: { format: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }) } },
  { id: "paid", name: "Paid", format: "integerFormat", description: "1 if the copy ended Paid, else 0." },
  { id: "passed", name: "Passed", format: "integerFormat", description: "1 if the copy ended Passed, else 0." },
  { id: "open", name: "Open", format: "integerFormat", description: "1 if the copy is Holding or Waiting, else 0." },
  { id: "passedTo", name: "Passed to", format: "textFormat", blankValue: "—" },
  { id: "endReason", name: "End reason", format: "textFormat", blankValue: "—", description: "paid, expired or cancelled." },
  { id: "invoiceId", name: "PayPal invoice", format: "textFormat", blankValue: "—" },
  { id: "invoiceStatus", name: "Invoice status", format: "textFormat", blankValue: "—", description: "PayPal's status at the last read." },
  { id: "paypalTxn", name: "PayPal transaction", format: "textFormat", blankValue: "—" },
  { id: "said", name: "Said", format: "textFormat", description: "The buyer's comment as written." },
  { id: "via", name: "Entered by", format: "textFormat", description: "typed, or tap for a one-tap claim." },
  { id: "readBy", name: "Read by", format: "textFormat", blankValue: "—", description: "fast (regex), groq or gemini." },
  { id: "claimedAt", name: "Claimed at", format: "dateTimeFormat" },
  { id: "endedAt", name: "Ended at", format: "dateTimeFormat" },
];

const initialState = {
  pages: [
    {
      id: "tonight",
      name: "Tonight's ledger",
      widgets: {
        filter: { type: "button-filter", dataMapping: { value: [ledgerField("state")] } },
        endings: {
          type: "hawker-endings",
          ...title("Two endings"),
          dataMapping: { state: [ledgerField("state")], copies: [ledgerField("serial", "count")], amount: [ledgerField("amountUsd", "sum")] },
        },
        owes: {
          type: "hawker-owes",
          ...title("Who still owes"),
          dataMapping: {
            copy: [ledgerField("copy")],
            buyer: [ledgerField("buyer")],
            item: [ledgerField("item")],
            amount: [ledgerField("amountUsd")],
            state: [ledgerField("state")],
          },
        },
        byItem: {
          type: "column-chart-stacked",
          ...title("Paid and passed, by item"),
          dataMapping: { categoryKey: [ledgerField("code")], valueKey: [ledgerField("paid", "sum"), ledgerField("passed", "sum")] },
        },
        ledger: {
          type: "grid",
          ...title("Every copy"),
          dataMapping: {
            cols: [
              ledgerField("copy"),
              ledgerField("ending"),
              ledgerField("buyer"),
              ledgerField("item"),
              ledgerField("amountUsd"),
              ledgerField("paypalTxn"),
              ledgerField("said"),
              ledgerField("readBy"),
              ledgerField("claimedAt"),
            ],
          },
        },
      },
      widgetLayout: {
        filter: { xTrack: 0, yTrack: 0, xSpan: 24, ySpan: 6 },
        endings: { xTrack: 0, yTrack: 6, xSpan: 8, ySpan: 17 },
        owes: { xTrack: 8, yTrack: 6, xSpan: 8, ySpan: 17 },
        byItem: { xTrack: 16, yTrack: 6, xSpan: 8, ySpan: 17 },
        ledger: { xTrack: 0, yTrack: 23, xSpan: 24, ySpan: 26 },
      },
    },
  ],
  selectedPageId: "tonight",
  panels: { filters: { collapsed: true }, edit: { collapsed: true }, data: { collapsed: true } },
} as unknown as AgReportState;

const HAWKER_INSTRUCTIONS = `You are Hawker's ledger assistant for a live-sale stall: Ada's Closet, a demo store on the PayPal sandbox.
Hawker's rule: every hold ends one of two ways, paid through PayPal, or passed to the next buyer. Use the words Waiting, Holding, Paid and Passed, and quote copies as "No. 0014".
- Who owes, what is unpaid, or whether a copy is paid right now: call who_owes_now. It re-reads each open invoice from PayPal, the authority on payment.
- Counts and totals (by state, by item, by buyer, the latest paid copy): call ledger_totals. Its numbers are computed by code from the ledger rows.
- To add a chart breaking the ledger down by buyer, item, variant, reader or entry method: call add_breakdown_chart. Code builds it from the real fields.
- For any other dashboard change, or an analysis your tools can't answer: delegate to the lead agent with a clear, specific task. Only say a change was made if the lead's report shows it was; otherwise say it may not have applied.
Never invent numbers or names. If a tool fails, say so plainly. Keep answers short.`;

const GROUP_BY = { buyer: "Buyer", code: "Item", variant: "Variant", readBy: "Who read it", via: "How it was entered" } as const;

/** A chart the model only parameterises; code builds the widget and adds it through Studio's API. */
function breakdownTool(getApi: () => AgStudioApi | null): AgAiTool {
  const schema = {
    name: "add_breakdown_chart",
    description: "Adds a stacked bar chart to the bottom of the current dashboard page, breaking the ledger down by a field. Undoable.",
    parameters: {
      type: "object",
      properties: {
        groupBy: { type: "string", enum: Object.keys(GROUP_BY), description: "buyer, code (item), variant, readBy (fast/groq/gemini) or via (typed/tap)." },
        measure: { type: "string", enum: ["copies", "amount"], description: "Count copies, or sum their USD amounts." },
        only: { type: "string", enum: ["both", "paid", "passed"], description: "Which endings to show. Default both." },
      },
      required: ["groupBy", "measure"],
      additionalProperties: false,
    },
  };
  return {
    name: schema.name,
    description: schema.description,
    kind: "client",
    schema: () => schema,
    async execute(call, ctx) {
      const api = getApi();
      if (!api) return ctx.error("The dashboard isn't ready yet.");
      const groupBy = String(call.args.groupBy) as keyof typeof GROUP_BY;
      const measure = call.args.measure === "amount" ? "amount" : "copies";
      const only = call.args.only === "paid" || call.args.only === "passed" ? call.args.only : "both";
      if (!(groupBy in GROUP_BY)) return ctx.error(`groupBy must be one of ${Object.keys(GROUP_BY).join(", ")}.`);
      const series = (["paid", "passed"] as const).filter((e) => only === "both" || only === e);
      const valueKey = series.map((e) => ledgerField(measure === "amount" ? `${e}Usd` : e, "sum"));
      const what = `${only === "both" ? "Paid and passed" : only === "paid" ? "Paid" : "Passed"} ${measure === "amount" ? "amounts" : "copies"} by ${GROUP_BY[groupBy].toLowerCase()}`;
      const state = api.getState();
      const pageId = state.selectedPageId ?? state.pages[0]?.id;
      const page = state.pages.find((p) => p.id === pageId);
      if (!page) return ctx.error("No dashboard page to add the chart to.");
      const layout = (page.widgetLayout ?? {}) as Record<string, { yTrack: number; ySpan: number }>;
      const bottom = Object.values(layout).reduce((y, l) => Math.max(y, l.yTrack + l.ySpan), 0);
      const id = `hawker-${Date.now().toString(36)}`;
      const next = {
        ...state,
        pages: state.pages.map((p) =>
          p.id !== page.id
            ? p
            : {
                ...p,
                widgets: { ...p.widgets, [id]: { type: "column-chart-stacked", dataMapping: { categoryKey: [ledgerField(groupBy)], valueKey }, ...title(what) } },
                widgetLayout: { ...p.widgetLayout, [id]: { xTrack: 0, yTrack: bottom, xSpan: 24, ySpan: 16 } },
                selection: { type: "widget", id },
              },
        ),
      } as unknown as AgReportState;
      api.setState(next);
      return ctx.success(`Added the chart "${what}" at the bottom of the page. It can be undone.`, { widgetId: id, title: what });
    },
  };
}

function totalsTool(getRows: () => LedgerRow[]): AgAiTool {
  const schema = {
    name: "ledger_totals",
    description: "Copies and amounts Paid, Passed and open: overall, by item code and by buyer, plus the latest paid copy. Computed from the live ledger rows.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  };
  return {
    name: schema.name,
    description: schema.description,
    kind: "client",
    schema: () => schema,
    async execute(_call, ctx) {
      const t = ledgerTotals(getRows());
      return ctx.success(JSON.stringify(t), t);
    },
  };
}

function owesTool(stall: string): AgAiTool {
  const schema = {
    name: "who_owes_now",
    description: "Lists every open (Holding) copy with buyer, item, amount and seconds left, re-reading each invoice's status live from PayPal.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  };
  return {
    name: schema.name,
    description: schema.description,
    kind: "client",
    schema: () => schema,
    async execute(_call, ctx) {
      try {
        const res = await fetch(`/api/stalls/${encodeURIComponent(stall)}/owes`, { signal: ctx.signal });
        const json = (await res.json()) as { owed?: unknown[]; error?: string; at?: string };
        if (!res.ok) return ctx.error(json.error ?? `PayPal read failed (${res.status}).`);
        return ctx.success(JSON.stringify({ readAt: json.at, owed: json.owed }), json);
      } catch (e) {
        return ctx.error(e instanceof Error ? e.message : "PayPal read failed.");
      }
    },
  };
}

export default function LedgerStudio({ stall, rows }: { stall: string; rows: LedgerRow[] }) {
  // The agent's tool reads the latest rows, not the ones from when the harness was built.
  const rowsRef = useRef(rows);
  const apiRef = useRef<AgStudioApi | null>(null);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  const data = useMemo(
    () => ({
      sources: [
        {
          id: "ledger",
          name: "Ledger",
          primaryKeyField: "copy",
          // Times arrive as ISO strings over JSON; Studio's date-time format wants Dates.
          data: rows.map((r) => ({ ...r, claimedAt: new Date(r.claimedAt), endedAt: r.endedAt ? new Date(r.endedAt) : null })),
          fields: FIELDS,
        },
      ],
      description:
        "Every hold on Ada's Closet, one row per numbered copy. state is Waiting, Holding, Paid or Passed; ending says how it ended (Paid on PayPal, Passed → @next buyer, or Passed → next buyer when no one waited). amountUsd is the copy's total; paid/passed/open are 1 or 0 for counting; paypalTxn is the PayPal transaction for a paid copy; said is the buyer's comment as written; readBy is the reader that parsed it (fast path, groq, gemini).",
    }),
    [rows],
  );

  const widgets = useMemo(
    () => (defaults: { menu: unknown[] }) =>
      createWidgets({
        additionalTypes: [endingsWidget, owesWidget],
        menu: [...(defaults.menu as never[]), { label: "Hawker", widgetIds: ["hawker-endings", "hawker-owes"] }],
      } as never),
    [],
  );

  const ai = useMemo<AgAiHarnessSetup>(() => {
    const adapter = hawkerAdapter();
    // The setup hands Studio's core API type; at runtime it is the full API, as AG's own
    // example (ai-direct-llm-runner) passes it straight to createAiHarness.
    return ({ api }) => {
      apiRef.current = api as unknown as AgStudioApi;
      return createAiHarness(apiRef.current, ({ builtIn, tools }) => ({
        agents: [
          directLlmRunner({
            id: "hawker",
            name: "Hawker",
            description: "Answers questions about the stall's holds and who owes, reading PayPal live; hands dashboard edits to the lead agent.",
            adapter,
            instructions: () => HAWKER_INSTRUCTIONS,
            tools: () => [owesTool(stall), totalsTool(() => rowsRef.current), breakdownTool(() => apiRef.current), tools.delegateTo(["lead"]), tools.renameThread()],
          }),
          ...Object.values(builtIn).map((definition) => directLlmRunner({ ...definition, adapter })),
        ],
        primary: "hawker",
        promptStarters: [
          { label: "Who still owes right now?", prompt: "Who still owes right now? Check PayPal." },
          { label: "Paid vs passed", prompt: "How many copies ended Paid and how many Passed, and for how much in total?" },
          { label: "Add a chart", prompt: "Add a chart of passed copies by buyer to this page." },
        ],
      }));
    };
  }, [stall]);

  return (
    <AgStudioProvider modules={MODULES}>
      <AgStudio
        style={{ height: "100%", width: "100%" }}
        data={data}
        initialState={initialState}
        widgets={widgets as never}
        theme={theme}
        ai={ai}
        mode="edit"
        context={{ stall }}
      />
    </AgStudioProvider>
  );
}
