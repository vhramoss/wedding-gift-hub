<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use CoverPhotoPreview with viewport-based image geometry for cover upload and panel previews; gallery previews reuse PhotoCarousel to prevent a second display crop.

- Guest-facing availability and dependent-name parsing use shared pure helpers with rule tests to keep display and editing consistent.

- Attendance identity must come from an individually redeemed invitation; contact data must never allow replacing a linked guest account.
- Anonymous receipts use a wedding-scoped minimal RPC rather than direct order-table reads, to avoid exposing personal information.
- Payment retries use the persisted order ID as the provider idempotency key and reuse an existing pending Pix payload, to avoid duplicate charges.
- Unlimited unshared gifts use quantity zero; shared gifts always retain their share limit, to separate playful contributions from finite inventory.
- Public wedding reads use the explicit wedding_public projection; weddings is manager-only and mirrors internal settings to wedding_private to protect legacy fields without breaking existing management writes.
- Checkout never substitutes stored/base prices for missing quotes and never falls back to the platform collector, preventing price flashes and unintended recipients.
- Resolve guest login destinations through the authenticated invitation-link RPC, independent of attendance; redeeming an invitation never submits an attendance response.
- Keep guest tools in a tabbed workspace with paginated list and individual invitation selection, so utility access does not depend on guest-list length.
