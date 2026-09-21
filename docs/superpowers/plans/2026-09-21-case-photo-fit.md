# Implementation

1. Add `natural_frame` to declarative CMS schema and production, backing up selected records.
2. Pass the field through the allCases loader and procedure adapter to CaseCard.
3. Use intrinsic image height for selected single-image cards, overriding square frames at all breakpoints.
4. Run Astro diagnostics and production build; verify nine cards at 375/800/1440 widths, full-image aspect ratios, loaded images and unchanged unselected square cards.
