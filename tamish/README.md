# Tamish website

Marketing site for Tamish, the family organizer with a Benefits Finder built in.
It is a single static page with no build step: open `index.html` in a browser, or host the folder anywhere that serves static files.

## Files

- `index.html`: the whole page (HTML, CSS and a small script)
- `privacy.html` and `terms.html`: draft privacy policy and terms of use, styled by `assets/legal.css`
- `assets/`: logo files made from the supplied artwork (the navy mark and the navy and orange wordmarks), with white and orange recolours, the favicon, the Apple touch icon and the social share image (`og-image.png`)

Brand colours sampled from the logo: navy `#0D3161`, orange `#F99235`.

## Turn on the waitlist

The form does not save anything until you connect it. Until then, a visitor who submits sees "Sign-ups open very soon" and no address is stored.
To collect addresses, set `data-endpoint` on the form in `index.html` to any URL that accepts a JSON `POST` of `{"email": "...", "source": "tamish-website"}`. That can be a form service such as Formspree, Basin or Getform, or your own API:

```html
<form class="waitlist" id="waitlistForm" data-endpoint="https://formspree.io/f/your-id" novalidate>
```

## Check before launch

- The UK childcare example (eligibility rules and the "up to ≈ £7,500 a year" figure) is marked as illustrative. Check it against gov.uk before going live.
- When the apps are in the stores, replace the "Coming soon" badges with links to the store listings.
- Fill in the highlighted placeholders in `privacy.html` and `terms.html` (company name, address, contact email, hosting and email providers, governing law), remove the "Draft for review" notes, and have a lawyer review both.
- For social previews, change `og:image` to an absolute URL once the site has a domain.
