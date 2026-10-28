# GitHub Pages deployment

The `Deploy Cat Rave to GitHub Pages` workflow checks JavaScript syntax and publishes the five website assets whenever changes reach `main`. It can also be run manually from the Actions tab on `main`. The Node.js server and repository metadata are not included in the published artifact.

GitHub Pages requires GitHub Pro (or another eligible paid plan) for this private repository. GitHub Free cannot publish Pages from a private repository. The website itself will be public; the repository can remain private.

Once Pages is available:

1. Open the repository's **Settings → Pages**.
2. Select **GitHub Actions** as the source.
3. Merge the deployment workflow into `main`.
4. Check **Actions → Deploy Cat Rave to GitHub Pages** for the deployment result. Use **Run workflow** on `main` to retry or deploy manually.

Subsequent pushes or PR merges into `main` deploy automatically. The deployment URL appears in the `github-pages` environment and the workflow run.
