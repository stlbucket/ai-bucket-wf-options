# support/tickets/[id] — Ticket Detail UI

## Status
Implemented

## Route
`/tenant/support/tickets/[id]` → `apps/tenant-app/app/pages/support/tickets/[id].vue`

## Required Permission
`p:app-user` or `p:app-admin`

## Layout
- Ticket metadata: title, status badge, submitter name, createdAt
- Comment thread (chronological)
- Comment composer (textarea + submit)
- Action buttons (role + status conditional)

## Status Badge Colors
| Status | Color |
|---|---|
| open | info (blue) |
| closed | neutral (gray) |
| deleted | error (red) |
| duplicate | warning (orange) |
| parked | warning (orange) |

## Action Buttons

**Owner actions** (ticket submitter):
| Button | Visible when |
|---|---|
| Close | status is `open` or `parked` |
| Reopen | status is `closed`, `duplicate`, or `parked` |
| Delete | any non-deleted status |

**Admin/support actions** (requires `p:app-admin` or `p:app-admin-support`):
| Button | Visible when |
|---|---|
| Park | status is `open` |
| Mark Duplicate | status is `open` or `parked` |
| Close (others) | same as owner close, but for any ticket |

## User Interactions
| Action | Trigger |
|---|---|
| Submit comment | Comment composer submit |
| Close ticket | Close button |
| Reopen ticket | Reopen button |
| Delete ticket | Delete button |
| Park ticket | Park button (admin/support only) |
| Mark duplicate | Mark Duplicate button (admin/support only) |
