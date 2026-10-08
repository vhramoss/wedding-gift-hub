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
