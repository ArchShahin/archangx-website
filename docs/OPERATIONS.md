# Operations: updating and running the website

## Change content

| To change | Edit | Notes |
|---|---|---|
| Text on a page | `site/<page>.html` | each page is self-contained HTML |
| Navigation or footer | the `<header class="site">` / `<footer class="site">` block in **every** page | keep them identical |
| Colours, spacing, layout | `site/assets/style.css` | shared by all pages |
| Logos and icons | `site/assets/` | keep the same file names, or update the references |
| Contact email | `contact.html`: the mailto link and the form script | search the pages for `@archangx.com` |
| Add a page | copy an existing page, change its content and `<title>`, add it to the nav in every page | the checker catches broken links |

Preview before publishing:
```bash
cd site && python -m http.server 8000     # open http://localhost:8000
python tools/check_site.py                # must report 0 problems
```

## Publish

```bash
git add site/ && git commit -m "Update <what>" && git push
```
GitHub Actions publishes in 1-2 minutes. Watch it in the repo's **Actions** tab; a red run means the checker found a
problem and the live site was **not** changed.

## Roll back

Every version is a commit. To undo the last change:
```bash
git revert HEAD && git push
```
The previous version is live again in 1-2 minutes.

## Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| Deploy run is red at "Check every linked file exists" | a link or image path is wrong | run `python tools/check_site.py` locally, fix the listed paths |
| Change not visible | the page itself is cached for up to 10 minutes (GitHub Pages `max-age=600`) | check the Actions run finished, then reload normally; CSS and images get new URLs on every deploy, so no cache clearing is needed |
| Old styles or images still show after a deploy and a reload | that asset link isn't a plain double-quoted `assets/<file>` path (e.g. single quotes), so the deploy didn't add a hash to it | fix the link; see "Caching" in ARCHITECTURE.md. A hand-written `?v=` fails the link check instead |
| "Your connection isn't private" | certificate not issued yet, or expired | see DEPLOYMENT.md section 3 |
| Site shows "Website Expired" | DNS points back at Squarespace | check the DNS records in DEPLOYMENT.md section 2 |
| 404 "Site not found" from GitHub | custom domain removed in repo settings | Settings → Pages → custom domain `www.archangx.com` |
| 404 on the domain right after the repository was transferred or renamed; `archangx.github.io/archangx-website/` shows the README | the transfer reset Pages to "Deploy from a branch" and dropped the custom domain | follow DEPLOYMENT.md section 5 |
| Email stopped working | MX/TXT records changed | restore the Google Workspace records (DEPLOYMENT.md section 2) |

## Regular checks

- Domain renewal: Squarespace, expires 2027-07-28.
- GitHub Actions: the runner images and action versions (`checkout`, `configure-pages`, `upload-pages-artifact`,
  `deploy-pages`) are updated by GitHub; bump the major versions in the workflow when GitHub announces deprecations.
