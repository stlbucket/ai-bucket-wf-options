# OTP Login — Share / Send Modal (UI)

The post-claims **sender-side** surface on an item detail page. Two ways to hand out the same
tenant-scoped quick-login link (D13): copy it, or send it to selected residents (D14). Data contract:
`share-link.data.md`. Shared schema/functions: `_shared.data.md`.

## Status
Draft — fill in all `[FILL IN]` sections before implementing.

## Where it lives (v1)
Todo detail — `apps/tenant-app/app/pages/tools/todo/[id].vue` (Q1 scope; generic URN item later).
Two actions in the detail header, both enabled once the todo loads (**no assignee required** — D13):

| Button | Icon | Action |
|---|---|---|
| **Copy quick-login link** | `i-lucide-link` | `shareToLink(todo.urn)` → clipboard → toast (existing, gate removed) |
| **Send to residents** | `i-lucide-send` `[FILL IN]` verify | opens the send modal below |

`[FILL IN]` — optionally fold both into one **"Share"** `UButton` that opens the modal, with "Copy
link" as a secondary action inside it. v1 keeps two buttons (faithful to the request).

## The send modal (`UModal`, UC3/UC4)

A single `UModal`; the trigger is the "Send to residents" button. Contents, top to bottom:

1. **Context header** — `subjectLabel` + module icon: "Send **Buy milk** to…".
2. **Residents** — a multi-select of the current tenant's residents (`USelectMenu` `multiple`, or a
   checkbox list for small rosters). Options come from the detail's existing `residents` list
   (name + id only — never contacts, `share-link.data.md`). At least one required.
3. **Message** — `UTextarea` "Add a message" (optional; goes into the notification as `{{message}}`).
4. **Delivery channels** — two `UCheckbox`es, **Email** and **SMS**. At least one required.
   - **SMS is disabled** with helper text "SMS coming soon" until notify SMS Phase 0/1 ships (D12);
     Email is the working default (pre-checked). `[FILL IN]` read an `smsEnabled` runtime flag.
5. **Footer** — `UButton` **"Send"** (primary, `loading` while in flight) + **"Cancel"**.
   - Also a secondary **"Copy link instead"** for the manual path. `[FILL IN]` keep or drop.

### On submit
`sendDeepLink({ subjectUrn: todo.urn, residentIds, message, channels })` (`share-link.data.md`).
- success → close modal; **toast** (UC7) "Sent to N of M residents" from the returned
  `DeliverySummary` (some may be skipped — no verified phone for SMS, etc.).
- error → keep the modal open; inline `UAlert` (error). `[FILL IN]` copy.

## Reactive state
```ts
const open = ref(false)
const selectedResidentIds = ref<string[]>([])
const message = ref('')
const channels = reactive({ email: true, sms: false })   // sms disabled until Phase 0/1
const sending = ref(false)
```

## Validation
- **Send** disabled unless `selectedResidentIds.length > 0` **and** (`channels.email || channels.sms`).
- SMS checkbox non-interactive until `smsEnabled`.

## Interactions
| Action | Result |
|---|---|
| "Send to residents" | open modal |
| pick residents / type message / tick channels | update state; enable Send when valid |
| "Send" | `sendDeepLink(…)`; on ok → toast summary + close; else inline error |
| "Copy link instead" / "Copy quick-login link" | `shareToLink(todo.urn)` → clipboard → toast |
| "Cancel" | close modal, reset state |

## Security / privacy note (UI-visible consequence of D13/D14)
The recipient still self-identifies with an OTP on `/auth/go/<id>` — sending them the link does **not**
log them in automatically. The modal never displays co-residents' phone numbers or emails (only
names); delivery contacts are resolved server-side (`share-link.data.md`).

## UI rules
UC3/UC4 (Nuxt UI + `UModal`/`UCard`), UC5 (responsive — the modal stacks on mobile), UC6 (color
tokens), UC7 (toast for "sent"/"copied", persistent `UAlert` only for errors), UC11 (verify
`i-lucide-*` names before use). No raw HTML/CSS.
